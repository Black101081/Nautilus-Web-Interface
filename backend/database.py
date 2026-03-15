"""
Persistent Database
===================
Async SQLite persistence for orders, settings, and risk limits using aiosqlite.

The database file lives at  backend/data/nautilus.db  (path relative to this
file's directory).  The ``data/`` directory is created automatically on first
use and is excluded from git via .gitignore.

Public interface (all coroutines):
    init_db()                              — call once at startup
    # Orders
    get_all_orders()                       — returns list[dict]
    get_order(order_id)                    — returns dict | None
    create_order(order_data)               — inserts + returns dict
    update_order_status(order_id, status)  — True if updated
    # Settings
    get_all_settings()                     — returns dict (section -> dict)
    save_settings(section, values)         — upsert key/value pairs
    # Risk limits
    get_risk_limits()                      — returns dict
    save_risk_limits(limits)               — upsert key/value pairs
"""

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import aiosqlite

# ---------------------------------------------------------------------------
# DB path: <this_file_dir>/data/nautilus.db
# ---------------------------------------------------------------------------
_DB_DIR = os.path.join(os.path.dirname(__file__), "data")
_DB_PATH = os.path.join(_DB_DIR, "nautilus.db")

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS orders (
    id          TEXT PRIMARY KEY,
    instrument  TEXT NOT NULL,
    side        TEXT NOT NULL,
    type        TEXT NOT NULL,
    quantity    REAL NOT NULL,
    price       REAL,
    status      TEXT NOT NULL DEFAULT 'PENDING',
    filled_qty  REAL NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS risk_limits (
    metric      TEXT PRIMARY KEY,
    value       REAL NOT NULL,
    updated_at  TEXT NOT NULL
);
"""

# Default risk limits loaded on first startup when table is empty
_DEFAULT_RISK_LIMITS: Dict[str, float] = {
    "max_position_size": 100000.0,
    "max_daily_loss": 5000.0,
    "max_drawdown_pct": 15.0,
    "max_leverage": 10.0,
    "max_orders_per_day": 1000.0,
}

# Default settings loaded on first startup when table is empty
_DEFAULT_SETTINGS: Dict[str, Dict[str, Any]] = {
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


async def init_db() -> None:
    """Create the data/ directory and all tables if they do not exist."""
    os.makedirs(_DB_DIR, exist_ok=True)
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.executescript(_SCHEMA_SQL)
        await db.commit()
        # Seed default risk limits if table is empty
        cursor = await db.execute("SELECT COUNT(*) FROM risk_limits")
        (count,) = await cursor.fetchone()
        if count == 0:
            now = datetime.now(timezone.utc).isoformat()
            await db.executemany(
                "INSERT INTO risk_limits (metric, value, updated_at) VALUES (?, ?, ?)",
                [(metric, value, now) for metric, value in _DEFAULT_RISK_LIMITS.items()],
            )
        # Seed default settings if table is empty
        cursor = await db.execute("SELECT COUNT(*) FROM settings")
        (count,) = await cursor.fetchone()
        if count == 0:
            now = datetime.now(timezone.utc).isoformat()
            rows = [
                (f"{section}.{k}", json.dumps(v), now)
                for section, values in _DEFAULT_SETTINGS.items()
                for k, v in values.items()
            ]
            await db.executemany(
                "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
                rows,
            )
        await db.commit()


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

def _row_to_dict(row: aiosqlite.Row) -> Dict[str, Any]:
    return dict(row)


async def get_all_orders() -> List[Dict[str, Any]]:
    async with aiosqlite.connect(_DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM orders ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()
        return [_row_to_dict(r) for r in rows]


async def get_order(order_id: str) -> Optional[Dict[str, Any]]:
    async with aiosqlite.connect(_DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM orders WHERE id = ?", (order_id,)
        )
        row = await cursor.fetchone()
        return _row_to_dict(row) if row else None


async def create_order(order_data: Dict[str, Any]) -> Dict[str, Any]:
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO orders (id, instrument, side, type, quantity, price, status, filled_qty, created_at)
            VALUES (:id, :instrument, :side, :type, :quantity, :price, :status, :filled_qty, :created_at)
            """,
            {
                "id": order_data["id"],
                "instrument": order_data.get("instrument", ""),
                "side": order_data.get("side", "BUY"),
                "type": order_data.get("type", "MARKET"),
                "quantity": order_data.get("quantity", 0),
                "price": order_data.get("price"),
                "status": order_data.get("status", "PENDING"),
                "filled_qty": order_data.get("filled_qty", 0),
                "created_at": order_data["created_at"],
            },
        )
        await db.commit()
    return order_data


async def update_order_status(order_id: str, status: str) -> bool:
    async with aiosqlite.connect(_DB_PATH) as db:
        cursor = await db.execute(
            "UPDATE orders SET status = ? WHERE id = ?", (status, order_id)
        )
        await db.commit()
        return cursor.rowcount > 0


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

async def get_all_settings() -> Dict[str, Any]:
    """Return settings as a nested dict: {section: {key: value}}."""
    async with aiosqlite.connect(_DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT key, value FROM settings")
        rows = await cursor.fetchall()
    result: Dict[str, Any] = {}
    for row in rows:
        key: str = row["key"]
        value = json.loads(row["value"])
        if "." in key:
            section, subkey = key.split(".", 1)
            result.setdefault(section, {})[subkey] = value
        else:
            result[key] = value
    return result


async def save_settings(body: Dict[str, Any]) -> None:
    """Upsert settings from a nested {section: {key: value}} dict."""
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(_DB_PATH) as db:
        for section, values in body.items():
            if isinstance(values, dict):
                for k, v in values.items():
                    db_key = f"{section}.{k}"
                    await db.execute(
                        """
                        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
                        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                        """,
                        (db_key, json.dumps(v), now),
                    )
            else:
                await db.execute(
                    """
                    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                    """,
                    (section, json.dumps(values), now),
                )
        await db.commit()


# ---------------------------------------------------------------------------
# Risk Limits
# ---------------------------------------------------------------------------

async def get_risk_limits() -> Dict[str, Any]:
    """Return risk limits as a flat dict: {metric: value}."""
    async with aiosqlite.connect(_DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT metric, value FROM risk_limits")
        rows = await cursor.fetchall()
    return {row["metric"]: row["value"] for row in rows}


async def save_risk_limits(limits: Dict[str, Any]) -> None:
    """Upsert risk limit values."""
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(_DB_PATH) as db:
        for metric, value in limits.items():
            await db.execute(
                """
                INSERT INTO risk_limits (metric, value, updated_at) VALUES (?, ?, ?)
                ON CONFLICT(metric) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """,
                (metric, float(value), now),
            )
        await db.commit()
