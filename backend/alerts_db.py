"""
Alerts Database
===============
Async SQLite persistence for price alerts using aiosqlite.

The database file lives at  backend/data/alerts.db  (path relative to this
file's directory) so it survives server restarts.  The ``data/`` directory is
created automatically on first use and is excluded from git via .gitignore.

Public interface (all coroutines):
    init_db()                                 — call once at startup
    get_all_alerts()                          — returns list[dict], newest first
    create_alert(alert_data: dict)            — inserts + returns the full dict
    delete_alert(alert_id: str)               — True if deleted, False if 404
    update_alert_status(id, status, triggered_at) — for future trigger logic
"""

import os
from typing import Any, Dict, List, Optional

import aiosqlite

# ---------------------------------------------------------------------------
# DB path: <this_file_dir>/data/alerts.db
# ---------------------------------------------------------------------------
_DB_DIR = os.path.join(os.path.dirname(__file__), "data")
_DB_PATH = os.path.join(_DB_DIR, "alerts.db")

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS alerts (
    id           TEXT PRIMARY KEY,
    symbol       TEXT NOT NULL,
    condition    TEXT NOT NULL,
    price        REAL NOT NULL,
    message      TEXT,
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TEXT NOT NULL,
    triggered_at TEXT
);
"""


async def init_db() -> None:
    """
    Create the data/ directory and the alerts table if they do not exist.
    Safe to call multiple times.
    """
    os.makedirs(_DB_DIR, exist_ok=True)
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute(_CREATE_TABLE_SQL)
        await db.commit()


def _row_to_dict(row: aiosqlite.Row) -> Dict[str, Any]:
    """Convert an aiosqlite Row (returned with row_factory set) to a dict."""
    return dict(row)


async def get_all_alerts() -> List[Dict[str, Any]]:
    """Return all alerts ordered by created_at descending (newest first)."""
    async with aiosqlite.connect(_DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM alerts ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()
        return [_row_to_dict(r) for r in rows]


async def create_alert(alert_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Insert a new alert row and return the stored dict.

    ``alert_data`` must contain: id, symbol, condition, price, message,
    status, created_at.  ``triggered_at`` is optional (defaults to None).
    """
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO alerts
                (id, symbol, condition, price, message, status, created_at, triggered_at)
            VALUES
                (:id, :symbol, :condition, :price, :message, :status, :created_at, :triggered_at)
            """,
            {
                "id": alert_data["id"],
                "symbol": alert_data["symbol"],
                "condition": alert_data["condition"],
                "price": alert_data["price"],
                "message": alert_data.get("message"),
                "status": alert_data.get("status", "active"),
                "created_at": alert_data["created_at"],
                "triggered_at": alert_data.get("triggered_at"),
            },
        )
        await db.commit()
    return alert_data


async def delete_alert(alert_id: str) -> bool:
    """
    Delete the alert with ``alert_id``.

    Returns True if a row was deleted, False if no matching row was found.
    """
    async with aiosqlite.connect(_DB_PATH) as db:
        cursor = await db.execute(
            "DELETE FROM alerts WHERE id = ?", (alert_id,)
        )
        await db.commit()
        return cursor.rowcount > 0


async def update_alert_status(
    alert_id: str,
    status: str,
    triggered_at: Optional[str] = None,
) -> bool:
    """
    Update the status (and optionally triggered_at) of an existing alert.

    Returns True if the row was found and updated, False otherwise.
    Intended for future alert-trigger background logic.
    """
    async with aiosqlite.connect(_DB_PATH) as db:
        cursor = await db.execute(
            "UPDATE alerts SET status = ?, triggered_at = ? WHERE id = ?",
            (status, triggered_at, alert_id),
        )
        await db.commit()
        return cursor.rowcount > 0
