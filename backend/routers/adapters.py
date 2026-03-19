"""
Adapters router.

Supports listing all known adapters and managing connection credentials /
status via SQLite persistence (adapter_configs table).
Real exchange connections require a LiveTradingNode — not available in
BacktestEngine mode.  This router validates credentials format and stores
status so the UI reflects the correct state across restarts.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import database
from auth_jwt import require_admin
from credential_utils import encrypt_credential, mask_credential
from state import live_manager

router = APIRouter(prefix="/api", tags=["adapters"])

# ── Static adapter catalogue ──────────────────────────────────────────────────

_ADAPTERS: list[dict] = [
    {
        "id": "betfair", "name": "Betfair", "type": "Betting Exchange",
        "category": "Betting",
        "description": "Sports betting exchange adapter for Betfair markets",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/betfair",
        "supports_live": True, "supports_backtest": True,
        "credential_fields": ["api_key", "api_secret"],
    },
    {
        "id": "binance", "name": "Binance", "type": "Crypto Exchange",
        "category": "Crypto",
        "description": "World's largest crypto exchange – spot and margin trading",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/binance",
        "supports_live": True, "supports_backtest": True,
        "credential_fields": ["api_key", "api_secret"],
    },
    {
        "id": "binance_futures", "name": "Binance Futures", "type": "Crypto Futures",
        "category": "Crypto",
        "description": "Binance USD-M and COIN-M perpetual & dated futures",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/binance",
        "supports_live": True, "supports_backtest": True,
        "credential_fields": ["api_key", "api_secret"],
    },
    {
        "id": "bybit", "name": "Bybit", "type": "Crypto Exchange",
        "category": "Crypto",
        "description": "Bybit spot, perpetuals, and options trading",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/bybit",
        "supports_live": True, "supports_backtest": True,
        "credential_fields": ["api_key", "api_secret"],
    },
    {
        "id": "coinbase_advanced_trade", "name": "Coinbase Advanced Trade",
        "type": "Crypto Exchange", "category": "Crypto",
        "description": "Coinbase Advanced Trade API for professional trading",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/coinbase",
        "supports_live": True, "supports_backtest": False,
        "credential_fields": ["api_key", "api_secret"],
    },
    {
        "id": "databento", "name": "Databento", "type": "Data Provider",
        "category": "Data",
        "description": "Historical and live institutional-grade market data",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/databento",
        "supports_live": True, "supports_backtest": True,
        "credential_fields": ["api_key"],
    },
    {
        "id": "dydx", "name": "dYdX", "type": "DeFi Exchange",
        "category": "DeFi",
        "description": "Decentralized perpetuals exchange on Ethereum L2",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/dydx",
        "supports_live": True, "supports_backtest": False,
        "credential_fields": ["api_key", "api_secret"],
    },
    {
        "id": "interactive_brokers", "name": "Interactive Brokers",
        "type": "Traditional Broker", "category": "Stocks & Futures",
        "description": "Multi-asset brokerage – stocks, futures, forex, options",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/ib",
        "supports_live": True, "supports_backtest": False,
        "credential_fields": ["api_key"],
    },
    {
        "id": "okx", "name": "OKX", "type": "Crypto Exchange",
        "category": "Crypto",
        "description": "OKX spot, futures, options and DeFi trading",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/okx",
        "supports_live": True, "supports_backtest": True,
        "credential_fields": ["api_key", "api_secret"],
    },
    {
        "id": "polymarket", "name": "Polymarket", "type": "Prediction Market",
        "category": "DeFi",
        "description": "On-chain decentralized prediction markets",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/polymarket",
        "supports_live": True, "supports_backtest": False,
        "credential_fields": ["api_key"],
    },
    {
        "id": "tardis", "name": "Tardis", "type": "Data Provider",
        "category": "Data",
        "description": "Tick-level historical crypto market data replay",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/tardis",
        "supports_live": False, "supports_backtest": True,
        "credential_fields": ["api_key"],
    },
]

_ADAPTER_BY_ID = {a["id"]: a for a in _ADAPTERS}


# ── Pydantic models ───────────────────────────────────────────────────────────

class AdapterConnectRequest(BaseModel):
    api_key: Optional[str] = None
    api_secret: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _enrich(adapter: dict) -> dict:
    """Merge static catalogue entry with persisted DB status."""
    cfg = await database.get_adapter_config(adapter["id"])
    status = cfg["status"] if cfg else "disconnected"
    last_connected = cfg["last_connected"] if cfg else None
    has_credentials = bool(cfg and cfg.get("api_key"))

    # Masked key: show last 4 chars only — never expose plaintext
    api_key_masked = ""
    if cfg and cfg.get("api_key"):
        from credential_utils import decrypt_credential, mask_credential
        decrypted = decrypt_credential(cfg["api_key"])
        api_key_masked = mask_credential(decrypted) if decrypted else "****"

    # Connection ID from extra_config
    extra = {}
    try:
        import json
        extra = json.loads(cfg.get("extra_config", "{}")) if cfg else {}
    except Exception:
        pass

    return {
        **adapter,
        "status": status,
        "last_connected": last_connected,
        "has_credentials": has_credentials,
        "api_key_masked": api_key_masked,
        "connection_id": extra.get("connection_id"),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/adapters")
async def list_adapters():
    enriched = [await _enrich(a) for a in _ADAPTERS]
    return {"adapters": enriched, "count": len(enriched)}


@router.get("/adapters/{adapter_id}")
async def get_adapter(adapter_id: str):
    if adapter_id not in _ADAPTER_BY_ID:
        raise HTTPException(status_code=404, detail=f"Adapter '{adapter_id}' not found")
    return await _enrich(_ADAPTER_BY_ID[adapter_id])


@router.post("/adapters/{adapter_id}/connect")
async def connect_adapter(adapter_id: str, req: AdapterConnectRequest, _admin: dict = Depends(require_admin)):
    """
    Validate credentials, encrypt, and connect adapter.
    For Binance: activates LiveTradingNode via live_manager.
    """
    if adapter_id not in _ADAPTER_BY_ID:
        raise HTTPException(status_code=404, detail=f"Adapter '{adapter_id}' not found")

    meta = _ADAPTER_BY_ID[adapter_id]
    required = meta.get("credential_fields", [])

    # Validate required fields are present, non-empty, and no null bytes
    missing = [f for f in required if not getattr(req, f, None)]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required credentials: {', '.join(missing)}",
        )

    import re as _re
    api_key = (req.api_key or "").strip().replace("\x00", "")
    api_secret = (req.api_secret or "").strip().replace("\x00", "")

    # Reject oversized credentials
    if len(api_key) > 512 or len(api_secret) > 512:
        raise HTTPException(status_code=400, detail="Credential too long (max 512 chars)")

    # Minimum-length guard (real exchange keys are always >= 8 chars)
    if api_key and len(api_key) < 8:
        raise HTTPException(status_code=400, detail="api_key too short (min 8 chars)")
    if api_secret and len(api_secret) < 8:
        raise HTTPException(status_code=400, detail="api_secret too short (min 8 chars)")

    # Allow only printable ASCII (no control characters beyond what was already stripped)
    _safe_re = _re.compile(r'^[\x20-\x7E]+$')
    if api_key and not _safe_re.match(api_key):
        raise HTTPException(status_code=400, detail="api_key contains invalid characters")
    if api_secret and not _safe_re.match(api_secret):
        raise HTTPException(status_code=400, detail="api_secret contains invalid characters")

    # Encrypt credentials before storing
    from credential_utils import encrypt_credential
    encrypted_key = encrypt_credential(api_key) if api_key else ""
    encrypted_secret = encrypt_credential(api_secret) if api_secret else ""

    # Mark as "connecting" before attempting real connection
    await database.upsert_adapter_config(
        adapter_id=adapter_id,
        status="connecting",
        api_key=encrypted_key,
        api_secret=encrypted_secret,
    )

    # Try to activate live trading node
    connection_id = None
    try:
        if adapter_id in ("binance", "binance_futures"):
            result = await live_manager.connect_binance(api_key, api_secret)
            connection_id = result.get("connection_id")
        elif adapter_id == "bybit":
            result = await live_manager.connect_bybit(api_key, api_secret)
            connection_id = result.get("connection_id")
        # Other adapters: store credentials only (no live node yet)

        import json
        extra = {"connection_id": connection_id} if connection_id else {}
        await database.upsert_adapter_config(
            adapter_id=adapter_id,
            status="connected",
            api_key=encrypted_key,
            api_secret=encrypted_secret,
            extra_config=extra,
        )
        return {
            "success": True,
            "adapter_id": adapter_id,
            "status": "connected",
            "connection_id": connection_id,
            "message": f"Adapter '{meta['name']}' connected.",
            "last_connected": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        await database.upsert_adapter_config(
            adapter_id=adapter_id,
            status="error",
            api_key=encrypted_key,
            api_secret=encrypted_secret,
        )
        raise HTTPException(status_code=502, detail=f"Connection failed: {str(exc)}")


@router.post("/adapters/{adapter_id}/disconnect")
async def disconnect_adapter(adapter_id: str, _admin: dict = Depends(require_admin)):
    if adapter_id not in _ADAPTER_BY_ID:
        raise HTTPException(status_code=404, detail=f"Adapter '{adapter_id}' not found")

    # Disconnect from live trading manager
    await live_manager.disconnect(adapter_id)

    await database.upsert_adapter_config(
        adapter_id=adapter_id,
        status="disconnected",
    )

    return {
        "success": True,
        "adapter_id": adapter_id,
        "status": "disconnected",
        "message": f"Adapter '{_ADAPTER_BY_ID[adapter_id]['name']}' disconnected.",
    }
