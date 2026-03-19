import io
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

import database
from auth_jwt import get_current_user, require_admin
from state import live_manager, nautilus_system
from utils import normalize_order

router = APIRouter(prefix="/api", tags=["system"])

_server_start_time = time.time()
_request_counter = 0


def increment_request_counter() -> None:
    # asyncio is single-threaded: += on int is safe without a lock
    # (no await between the read and write means no interleaving)
    global _request_counter
    _request_counter += 1


@router.get("/health")
async def health_check():
    checks: dict = {}

    # 1. SQLite database reachable?
    try:
        async with database.aiosqlite.connect(database.DB_PATH) as db:
            await db.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc}"

    # 2. Nautilus engine state
    info = nautilus_system.get_system_info()
    checks["engine"] = "initialized" if info["is_initialized"] else "not_initialized"

    # 3. psutil available?
    try:
        import psutil
        psutil.cpu_percent(interval=None)
        checks["psutil"] = "ok"
    except Exception:
        checks["psutil"] = "unavailable"

    # 4. Market data service reachable?
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get("https://api.binance.com/api/v3/ping")
        checks["market_data"] = "ok" if resp.status_code == 200 else f"http_{resp.status_code}"
    except Exception:
        # Binance unreachable — degraded but not critical in backtest mode
        checks["market_data"] = "unreachable"

    all_ok = all(
        v in ("ok", "initialized", "not_initialized")
        for v in checks.values()
    )
    return {
        "status": "healthy" if all_ok else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "nautilus-trader-api",
        "version": "2.0.0",
        "checks": checks,
    }


@router.get("/engine/info")
async def get_engine_info():
    info = nautilus_system.get_system_info()
    live_status = live_manager.get_status()

    # Check live mode: live_manager OR any DB adapter is connected
    db_connected = await database.has_connected_adapter()
    is_live = live_status["is_active"] or db_connected

    return {
        "trader_id": info["trader_id"],
        "status": "running" if info["is_initialized"] else "initializing",
        "engine_type": "live" if is_live else "backtest",
        "is_running": info["is_initialized"],
        "strategies_count": info["strategies_count"],
        "backtests_count": len(nautilus_system.backtest_results),
        "is_initialized": info["is_initialized"],
        "catalog_path": info["catalog_path"],
        "uptime": "active",
        "live_node_active": is_live,
        "live_connections": live_status["connections"],
    }


@router.post("/engine/initialize")
async def initialize_system(_admin: dict = Depends(require_admin)):
    result = nautilus_system.initialize()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.post("/engine/shutdown")
async def shutdown_system(_admin: dict = Depends(require_admin)):
    return {"success": True, "message": "Engine shutdown requested"}


@router.get("/components")
async def list_components():
    info = nautilus_system.get_system_info()
    active = info["is_initialized"]
    components = [
        {"id": "data_engine",  "name": "Data Engine",       "type": "DataEngine",      "status": "running" if active else "stopped"},
        {"id": "exec_engine",  "name": "Execution Engine",  "type": "ExecutionEngine", "status": "running" if active else "stopped"},
        {"id": "risk_engine",  "name": "Risk Engine",       "type": "RiskEngine",      "status": "running" if active else "stopped"},
        {"id": "portfolio",    "name": "Portfolio",          "type": "Portfolio",       "status": "active"  if active else "stopped"},
        {"id": "cache",        "name": "Cache",              "type": "Cache",           "status": "active"},
        {"id": "message_bus",  "name": "MessageBus",         "type": "MessageBus",      "status": "active"},
    ]
    return {"components": components, "count": len(components)}


@router.get("/system/metrics")
async def get_system_metrics():
    uptime_secs = time.time() - _server_start_time
    hours = int(uptime_secs // 3600)
    minutes = int((uptime_secs % 3600) // 60)
    base = {
        "uptime_seconds": round(uptime_secs),
        "uptime_formatted": f"{hours}h {minutes}m",
        "requests_total": _request_counter,
    }
    try:
        import psutil

        cpu = psutil.cpu_percent(interval=None)  # non-blocking; returns cached value
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        return {
            **base,
            "cpu_percent": round(cpu, 1),
            "memory_used_gb": round(mem.used / 1024**3, 2),
            "memory_total_gb": round(mem.total / 1024**3, 2),
            "memory_percent": round(mem.percent, 1),
            "disk_used_gb": round(disk.used / 1024**3, 1),
            "disk_total_gb": round(disk.total / 1024**3, 1),
            "disk_percent": round(disk.percent, 1),
        }
    except Exception:
        return {**base, "cpu_percent": 0.0, "memory_percent": 0.0, "disk_percent": 0.0}


@router.get("/settings")
async def get_settings():
    return await database.get_settings()


@router.post("/settings")
async def save_settings(body: Dict[str, Any] = Body(...), _admin: dict = Depends(require_admin)):
    settings = await database.update_settings(body)
    return {"success": True, "settings": settings}


@router.get("/performance/summary")
async def get_performance_summary():
    total_pnl = realized_pnl = 0.0
    total_trades = winning_trades = losing_trades = 0
    all_positions = open_positions = 0

    for results in nautilus_system.backtest_results.values():
        total_pnl += results.get("total_pnl", 0.0)
        realized_pnl += results.get("total_pnl", 0.0)
        total_trades += results.get("total_trades", 0)
        winning_trades += results.get("winning_trades", 0)
        losing_trades += results.get("losing_trades", 0)
        all_positions += len(results.get("positions", []))
        open_positions += sum(1 for p in results.get("positions", []) if p.get("is_open"))

    win_rate = (winning_trades / total_trades * 100) if total_trades else 0.0
    return {
        "total_pnl": round(total_pnl, 2),
        "realized_pnl": round(realized_pnl, 2),
        "unrealized_pnl": 0.0,
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "win_rate": round(win_rate, 2),
        "total_positions": all_positions,
        "open_positions": open_positions,
    }


@router.get("/trades")
async def list_trades(limit: int = 20):
    all_trades = []
    for results in nautilus_system.backtest_results.values():
        for order in results.get("orders", []):
            row = normalize_order(order)
            row["timestamp"] = datetime.now(timezone.utc).isoformat()
            all_trades.append(row)
    return {"trades": all_trades[:limit], "count": len(all_trades)}


@router.post("/notifications/test-email")
async def test_email(body: Dict[str, Any] = Body(...), _admin: dict = Depends(require_admin)):
    """Send a test email to verify SMTP configuration."""
    from notifications import EmailNotifier
    settings_data = await database.get_settings()
    notif = settings_data.get("notifications", {})
    to_addr = body.get("email", notif.get("email_to", ""))
    if not to_addr:
        return {"success": False, "error": "No email address provided"}
    try:
        notifier = EmailNotifier()
        await notifier.send(
            subject="Test Email from Nautilus Trader",
            body="<p>Test email sent successfully from Nautilus Web Interface!</p>",
            to=to_addr,
            settings=notif,
        )
        return {"success": True, "message": f"Test email sent to {to_addr}"}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@router.post("/notifications/test-telegram")
async def test_telegram(body: Dict[str, Any] = Body(...), _admin: dict = Depends(require_admin)):
    """Send a test Telegram message to verify bot configuration."""
    from notifications import TelegramNotifier
    bot_token = body.get("bot_token", "")
    chat_id = body.get("chat_id", "")
    if not bot_token or not chat_id:
        return {"success": False, "error": "bot_token and chat_id are required"}
    try:
        notifier = TelegramNotifier()
        await notifier.send(
            text="✅ Test message from Nautilus Web Interface",
            bot_token=bot_token,
            chat_id=chat_id,
        )
        return {"success": True, "message": "Telegram message sent"}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@router.get("/instruments")
async def list_instruments():
    instruments = []
    for instr in nautilus_system.instruments:
        instruments.append(
            {
                "id": str(instr.id),
                "symbol": str(instr.id.symbol),
                "venue": str(instr.id.venue),
            }
        )
    if not instruments:
        instruments = [
            {"id": "EUR/USD.SIM",    "symbol": "EUR/USD",  "venue": "SIM"},
            {"id": "GBP/USD.SIM",    "symbol": "GBP/USD",  "venue": "SIM"},
            {"id": "USD/JPY.SIM",    "symbol": "USD/JPY",  "venue": "SIM"},
            {"id": "AUD/USD.SIM",    "symbol": "AUD/USD",  "venue": "SIM"},
            {"id": "BTCUSDT.BINANCE","symbol": "BTCUSDT",  "venue": "BINANCE"},
            {"id": "ETHUSDT.BINANCE","symbol": "ETHUSDT",  "venue": "BINANCE"},
        ]
    return {"instruments": instruments, "count": len(instruments)}


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/admin/audit-logs")
async def list_audit_logs(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    user_id: str = Query(default=""),
    action: str = Query(default=""),
    _admin: dict = Depends(require_admin),
):
    """Return audit log entries (admin only). Append-only — no DELETE."""
    logs = await database.get_audit_logs(limit=limit, offset=offset, user_id=user_id, action=action)
    return {"logs": logs, "count": len(logs), "limit": limit, "offset": offset}


# ── Performance Export ────────────────────────────────────────────────────────

@router.get("/performance/export")
async def export_performance(
    format: str = Query(default="excel", pattern="^(excel|pdf)$"),
    _user: dict = Depends(get_current_user),
):
    """Export trade performance as Excel or PDF."""
    trades = await database.list_orders(limit=1000)

    if format == "excel":
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Performance"
        headers = ["ID", "Instrument", "Side", "Type", "Quantity", "Price", "Status", "Filled Qty", "PnL", "Timestamp"]
        ws.append(headers)
        for t in trades:
            ws.append([
                t.get("id", ""),
                t.get("instrument", ""),
                t.get("side", ""),
                t.get("type", ""),
                t.get("quantity", ""),
                t.get("price", ""),
                t.get("status", ""),
                t.get("filled_qty", ""),
                t.get("pnl", ""),
                t.get("timestamp", ""),
            ])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=performance.xlsx"},
        )

    elif format == "pdf":
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
        from reportlab.lib.styles import getSampleStyleSheet

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4))
        styles = getSampleStyleSheet()
        elements = [Paragraph("Nautilus — Performance Report", styles["Title"])]

        headers = ["ID", "Instrument", "Side", "Qty", "Price", "Status", "PnL", "Timestamp"]
        data = [headers]
        for t in trades:
            data.append([
                t.get("id", ""),
                t.get("instrument", ""),
                t.get("side", ""),
                str(t.get("quantity", "")),
                str(t.get("price", "")),
                t.get("status", ""),
                str(t.get("pnl", "")),
                t.get("timestamp", "")[:19] if t.get("timestamp") else "",
            ])
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4f8")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        elements.append(table)
        doc.build(elements)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=performance.pdf"},
        )
