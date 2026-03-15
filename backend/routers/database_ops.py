import os
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

import database

router = APIRouter(prefix="/api/database", tags=["database"])

# Path to main SQLite file (same as database.py)
_DB_PATH = database.DB_PATH


class DatabaseOpRequest(BaseModel):
    db_type: str = "all"


class CacheOpRequest(BaseModel):
    cache_type: str = "all"


@router.post("/backup")
async def backup_database(req: DatabaseOpRequest):
    """Copy the SQLite database file to a timestamped backup."""
    db_path = Path(_DB_PATH)
    if not db_path.exists():
        return {
            "success": False,
            "message": "Database file not found — no data has been written yet",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "size_mb": 0.0,
        }

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_path = db_path.parent / f"nautilus_backup_{timestamp}.db"

    try:
        # sqlite3.connect + backup() gives a consistent hot-copy even while DB is in use
        src = sqlite3.connect(str(db_path))
        dst = sqlite3.connect(str(backup_path))
        src.backup(dst)
        dst.close()
        src.close()

        size_mb = round(backup_path.stat().st_size / 1024 / 1024, 3)
        return {
            "success": True,
            "message": f"Backup saved to {backup_path.name}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "backup_file": str(backup_path),
            "size_mb": size_mb,
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Backup failed: {exc}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "size_mb": 0.0,
        }


@router.post("/optimize")
async def optimize_database(req: DatabaseOpRequest):
    """Run VACUUM + ANALYZE to reclaim space and update query planner stats."""
    db_path = Path(_DB_PATH)
    if not db_path.exists():
        return {"success": False, "message": "Database file not found"}

    size_before = db_path.stat().st_size
    try:
        conn = sqlite3.connect(str(db_path))
        conn.execute("VACUUM")
        conn.execute("ANALYZE")
        conn.close()
        size_after = db_path.stat().st_size
        saved_kb = round((size_before - size_after) / 1024, 1)
        return {
            "success": True,
            "message": f"VACUUM + ANALYZE complete — freed {max(0, saved_kb)} KB",
            "size_before_kb": round(size_before / 1024, 1),
            "size_after_kb": round(size_after / 1024, 1),
        }
    except Exception as exc:
        return {"success": False, "message": f"Optimize failed: {exc}"}


@router.post("/clean")
async def clean_cache(req: CacheOpRequest):
    """Delete triggered/cancelled records older than 30 days to reduce DB size."""
    db_path = Path(_DB_PATH)
    if not db_path.exists():
        return {"success": False, "message": "Database file not found"}

    try:
        conn = sqlite3.connect(str(db_path))
        # Remove triggered alerts
        cur = conn.execute(
            "DELETE FROM alerts WHERE status = 'triggered' "
            "AND created_at < datetime('now', '-30 days')"
        )
        alerts_removed = cur.rowcount
        # Remove cancelled / filled orders
        cur = conn.execute(
            "DELETE FROM orders WHERE status IN ('CANCELLED', 'FILLED') "
            "AND timestamp < datetime('now', '-30 days')"
        )
        orders_removed = cur.rowcount
        conn.commit()
        conn.close()

        total = alerts_removed + orders_removed
        return {
            "success": True,
            "message": f"Removed {total} old records "
                       f"({alerts_removed} alerts, {orders_removed} orders)",
            "alerts_removed": alerts_removed,
            "orders_removed": orders_removed,
        }
    except Exception as exc:
        return {"success": False, "message": f"Clean failed: {exc}"}
