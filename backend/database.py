"""
Async SQLite persistence for orders, alerts, risk limits, and settings.
Replaces the in-memory dicts that were lost on every server restart.
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiosqlite

DB_PATH = Path(__file__).parent / "data" / "nautilus.db"

# ── Default values ────────────────────────────────────────────────────────────

DEFAULT_RISK_LIMITS: Dict[str, Any] = {
    "max_position_size": 100_000,
    "max_daily_loss": 5_000,
    "max_drawdown_pct": 15.0,
    "max_leverage": 10,
    "max_orders_per_day": 1_000,
}

DEFAULT_SETTINGS: Dict[str, Any] = {
    "general": {
        "system_name": "Nautilus Trader",
        "environment": "Development",
    },
    "notifications": {
        "email_enabled": True,
        "slack_enabled": False,
        "sms_enabled": False,
    },
    "security": {
        "session_timeout": 30,
        "two_factor_auth": True,
    },
    "performance": {
        "max_concurrent_requests": 100,
        "cache_ttl": 3600,
    },
}


# ── Schema ────────────────────────────────────────────────────────────────────

async def init_db() -> None:
    """Create all tables if they don't exist and seed defaults."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id          TEXT PRIMARY KEY,
                instrument  TEXT NOT NULL,
                side        TEXT NOT NULL,
                type        TEXT NOT NULL DEFAULT 'MARKET',
                quantity    REAL NOT NULL DEFAULT 0,
                price       REAL,
                status      TEXT NOT NULL DEFAULT 'PENDING',
                filled_qty  REAL NOT NULL DEFAULT 0,
                timestamp   TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id          TEXT PRIMARY KEY,
                symbol      TEXT NOT NULL,
                condition   TEXT NOT NULL,
                price       REAL NOT NULL,
                message     TEXT NOT NULL DEFAULT '',
                status      TEXT NOT NULL DEFAULT 'active',
                created_at  TEXT NOT NULL,
                triggered_at TEXT
            );

            CREATE TABLE IF NOT EXISTS kv_store (
                namespace   TEXT NOT NULL,
                key         TEXT NOT NULL,
                value       TEXT NOT NULL,
                PRIMARY KEY (namespace, key)
            );
            """
        )
        await db.commit()
        await _seed_defaults(db)


async def _seed_defaults(db: aiosqlite.Connection) -> None:
    """Populate kv_store with defaults if they don't exist yet."""
    # Single query: which namespaces already have rows?
    async with db.execute(
        "SELECT namespace FROM kv_store WHERE namespace IN ('risk', 'settings') GROUP BY namespace"
    ) as cur:
        existing = {row[0] for row in await cur.fetchall()}

    if "risk" not in existing:
        await db.execute(
            "INSERT INTO kv_store (namespace, key, value) VALUES ('risk', 'limits', ?)",
            (json.dumps(DEFAULT_RISK_LIMITS),),
        )

    if "settings" not in existing:
        for section, values in DEFAULT_SETTINGS.items():
            await db.execute(
                "INSERT INTO kv_store (namespace, key, value) VALUES ('settings', ?, ?)",
                (section, json.dumps(values)),
            )

    await db.commit()


# ── Orders ────────────────────────────────────────────────────────────────────

async def list_orders() -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM orders ORDER BY timestamp DESC LIMIT 200") as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def create_order(
    instrument: str,
    side: str,
    order_type: str = "MARKET",
    quantity: float = 0.0,
    price: Optional[float] = None,
) -> Dict[str, Any]:
    order = {
        "id": f"ORD-{uuid.uuid4().hex[:8].upper()}",
        "instrument": instrument,
        "side": side,
        "type": order_type,
        "quantity": quantity,
        "price": price,
        "status": "PENDING",
        "filled_qty": 0.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO orders (id, instrument, side, type, quantity, price, status, filled_qty, timestamp)
            VALUES (:id, :instrument, :side, :type, :quantity, :price, :status, :filled_qty, :timestamp)
            """,
            order,
        )
        await db.commit()
    return order


async def cancel_order(order_id: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE orders SET status='CANCELLED' WHERE id=? AND status='PENDING'",
            (order_id,),
        )
        await db.commit()
        return cur.rowcount > 0


# ── Alerts ────────────────────────────────────────────────────────────────────

async def list_alerts() -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM alerts ORDER BY created_at DESC") as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def create_alert(
    symbol: str,
    condition: str,
    price: float,
    message: str = "",
) -> Dict[str, Any]:
    alert = {
        "id": f"ALT-{uuid.uuid4().hex[:8].upper()}",
        "symbol": symbol,
        "condition": condition,
        "price": price,
        "message": message,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "triggered_at": None,
    }
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO alerts (id, symbol, condition, price, message, status, created_at, triggered_at)
            VALUES (:id, :symbol, :condition, :price, :message, :status, :created_at, :triggered_at)
            """,
            alert,
        )
        await db.commit()
    return alert


async def delete_alert(alert_id: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("DELETE FROM alerts WHERE id=?", (alert_id,))
        await db.commit()
        return cur.rowcount > 0


# ── Risk limits ───────────────────────────────────────────────────────────────

async def get_risk_limits() -> Dict[str, Any]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT value FROM kv_store WHERE namespace='risk' AND key='limits'"
        ) as cur:
            row = await cur.fetchone()
    return json.loads(row[0]) if row else DEFAULT_RISK_LIMITS.copy()


async def update_risk_limits(updates: Dict[str, Any]) -> Dict[str, Any]:
    limits = await get_risk_limits()
    limits.update(updates)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO kv_store (namespace, key, value) VALUES ('risk', 'limits', ?)",
            (json.dumps(limits),),
        )
        await db.commit()
    return limits


# ── Settings ──────────────────────────────────────────────────────────────────

async def get_settings() -> Dict[str, Any]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT key, value FROM kv_store WHERE namespace='settings'"
        ) as cur:
            rows = await cur.fetchall()
    if not rows:
        return DEFAULT_SETTINGS.copy()
    return {key: json.loads(value) for key, value in rows}


async def update_settings(body: Dict[str, Any]) -> Dict[str, Any]:
    settings = await get_settings()
    for section, values in body.items():
        if isinstance(values, dict):
            if section in settings:
                settings[section].update(values)
            else:
                settings[section] = values
    async with aiosqlite.connect(DB_PATH) as db:
        for section, values in settings.items():
            await db.execute(
                "INSERT OR REPLACE INTO kv_store (namespace, key, value) VALUES ('settings', ?, ?)",
                (section, json.dumps(values)),
            )
        await db.commit()
    return settings
