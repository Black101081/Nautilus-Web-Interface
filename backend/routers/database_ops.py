import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import database
from auth_jwt import require_admin

router = APIRouter(prefix="/api/database", tags=["database"])

# Path to main SQLite file (same as database.py)
_DB_PATH = database.DB_PATH


class DatabaseOpRequest(BaseModel):
    db_type: str = "all"


class CacheOpRequest(BaseModel):
    cache_type: str = "all"


class RestoreRequest(BaseModel):
    backup_file: str  # just the filename, e.g. "nautilus_backup_20240101_120000.db"


@router.post("/backup")
async def backup_database(req: DatabaseOpRequest, _admin: dict = Depends(require_admin)):
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


@router.get("/backups")
async def list_backups():
    """List all available backup files in the data directory."""
    db_dir = Path(_DB_PATH).parent
    backups = sorted(
        [
            {
                "filename": f.name,
                "size_mb": round(f.stat().st_size / 1024 / 1024, 3),
                "created_at": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat(),
            }
            for f in db_dir.glob("nautilus_backup_*.db")
        ],
        key=lambda x: x["created_at"],
        reverse=True,
    )
    return {"backups": backups, "count": len(backups)}


@router.post("/restore")
async def restore_database(req: RestoreRequest, _admin: dict = Depends(require_admin)):
    """Restore the main database from a named backup file."""
    db_dir = Path(_DB_PATH).parent
    backup_path = db_dir / req.backup_file

    # Safety: only allow files in the same data directory with the expected prefix
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail=f"Backup file '{req.backup_file}' not found")
    if not req.backup_file.startswith("nautilus_backup_") or not req.backup_file.endswith(".db"):
        raise HTTPException(status_code=400, detail="Invalid backup filename")
    if backup_path.parent.resolve() != db_dir.resolve():
        raise HTTPException(status_code=400, detail="Path traversal not allowed")

    try:
        # Copy current DB to a safety snapshot first
        safety_ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safety_path = db_dir / f"nautilus_pre_restore_{safety_ts}.db"
        src = sqlite3.connect(str(_DB_PATH))
        dst = sqlite3.connect(str(safety_path))
        src.backup(dst)
        dst.close()
        src.close()

        # Restore from backup
        bak = sqlite3.connect(str(backup_path))
        live = sqlite3.connect(str(_DB_PATH))
        bak.backup(live)
        live.close()
        bak.close()

        return {
            "success": True,
            "message": f"Restored from '{req.backup_file}'",
            "safety_snapshot": safety_path.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Restore failed: {exc}")


@router.post("/optimize")
async def optimize_database(req: DatabaseOpRequest, _admin: dict = Depends(require_admin)):
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
async def clean_cache(req: CacheOpRequest, _admin: dict = Depends(require_admin)):
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
