"""
Data Catalog Management Router
Provides import/export of OHLCV data as CSV or Parquet,
catalog listing, and symbol management.
"""

import csv
import io
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from auth_jwt import get_current_user, require_admin

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

# Path where custom catalog data is stored (next to the app)
_CATALOG_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "catalog")


def _ensure_catalog_dir():
    os.makedirs(_CATALOG_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Catalog listing
# ---------------------------------------------------------------------------

@router.get("/datasets")
async def list_datasets():
    """Return all datasets stored in the local catalog directory."""
    _ensure_catalog_dir()
    datasets = []
    for fname in sorted(os.listdir(_CATALOG_DIR)):
        path = os.path.join(_CATALOG_DIR, fname)
        if not os.path.isfile(path):
            continue
        stat = os.stat(path)
        ext = os.path.splitext(fname)[1].lower()
        datasets.append({
            "filename": fname,
            "format": ext.lstrip(".") if ext else "unknown",
            "size_bytes": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })
    return {"datasets": datasets, "count": len(datasets)}


# ---------------------------------------------------------------------------
# CSV Export (OHLCV bars from Binance)
# ---------------------------------------------------------------------------

@router.get("/export/csv/{symbol}")
async def export_csv(
    symbol: str,
    interval: str = Query("1h", description="Bar interval"),
    limit: int = Query(500, ge=1, le=1000),
):
    """Export OHLCV data for a symbol as CSV download."""
    import market_data_service as svc
    upper = symbol.upper()
    if upper not in svc.SYMBOLS:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")

    bars = await svc.get_ohlcv(upper, interval=interval, limit=limit)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["time", "open", "high", "low", "close", "volume", "quote_volume", "trades"],
    )
    writer.writeheader()
    for bar in bars:
        writer.writerow({k: bar.get(k, "") for k in writer.fieldnames})

    output.seek(0)
    filename = f"{upper}_{interval}_{limit}bars.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Parquet Export (OHLCV bars from Binance)
# ---------------------------------------------------------------------------

@router.get("/export/parquet/{symbol}")
async def export_parquet(
    symbol: str,
    interval: str = Query("1h"),
    limit: int = Query(500, ge=1, le=1000),
):
    """Export OHLCV data for a symbol as Parquet download."""
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="pyarrow is not installed; Parquet export unavailable.",
        )

    import market_data_service as svc
    upper = symbol.upper()
    if upper not in svc.SYMBOLS:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")

    bars = await svc.get_ohlcv(upper, interval=interval, limit=limit)

    table = pa.table({
        "time": pa.array([b["time"] for b in bars], type=pa.int64()),
        "open": pa.array([b["open"] for b in bars], type=pa.float64()),
        "high": pa.array([b["high"] for b in bars], type=pa.float64()),
        "low": pa.array([b["low"] for b in bars], type=pa.float64()),
        "close": pa.array([b["close"] for b in bars], type=pa.float64()),
        "volume": pa.array([b["volume"] for b in bars], type=pa.float64()),
        "quote_volume": pa.array([b["quote_volume"] for b in bars], type=pa.float64()),
        "trades": pa.array([b["trades"] for b in bars], type=pa.int64()),
    })

    buf = io.BytesIO()
    pq.write_table(table, buf)
    buf.seek(0)
    filename = f"{upper}_{interval}_{limit}bars.parquet"
    return StreamingResponse(
        buf,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# CSV Import
# ---------------------------------------------------------------------------

@router.post("/import/csv")
async def import_csv(
    file: UploadFile = File(...),
    _user: dict = Depends(get_current_user),
):
    """
    Import OHLCV bars from a CSV file.

    Expected columns: time, open, high, low, close, volume
    The file is stored in the local catalog directory.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50 MB
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    # Validate CSV structure
    reader = csv.DictReader(io.StringIO(text))
    required_cols = {"time", "open", "high", "low", "close", "volume"}
    if not reader.fieldnames or not required_cols.issubset(set(reader.fieldnames)):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain columns: {sorted(required_cols)}",
        )

    row_count = sum(1 for _ in reader)

    _ensure_catalog_dir()
    safe_name = "".join(c for c in file.filename if c.isalnum() or c in ("_", "-", "."))
    dest = os.path.join(_CATALOG_DIR, safe_name)
    with open(dest, "wb") as f:
        f.write(content)

    return {
        "success": True,
        "filename": safe_name,
        "rows": row_count,
        "message": f"Imported {row_count} bars from {safe_name}",
    }


# ---------------------------------------------------------------------------
# Parquet Import
# ---------------------------------------------------------------------------

@router.post("/import/parquet")
async def import_parquet(
    file: UploadFile = File(...),
    _user: dict = Depends(get_current_user),
):
    """Import OHLCV bars from a Parquet file."""
    try:
        import pyarrow.parquet as pq
    except ImportError:
        raise HTTPException(status_code=503, detail="pyarrow not installed")

    if not file.filename or not file.filename.lower().endswith(".parquet"):
        raise HTTPException(status_code=400, detail="Only .parquet files are accepted")

    content = await file.read()
    if len(content) > 200 * 1024 * 1024:  # 200 MB
        raise HTTPException(status_code=400, detail="File too large (max 200 MB)")

    try:
        buf = io.BytesIO(content)
        table = pq.read_table(buf)
        row_count = table.num_rows
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid Parquet file: {exc}")

    _ensure_catalog_dir()
    safe_name = "".join(c for c in file.filename if c.isalnum() or c in ("_", "-", "."))
    dest = os.path.join(_CATALOG_DIR, safe_name)
    with open(dest, "wb") as f:
        f.write(content)

    return {
        "success": True,
        "filename": safe_name,
        "rows": row_count,
        "columns": table.column_names,
        "message": f"Imported {row_count} rows from {safe_name}",
    }


# ---------------------------------------------------------------------------
# Delete dataset
# ---------------------------------------------------------------------------

@router.delete("/datasets/{filename}")
async def delete_dataset(filename: str, _admin: dict = Depends(require_admin)):
    """Delete a catalog dataset file."""
    safe_name = "".join(c for c in filename if c.isalnum() or c in ("_", "-", "."))
    path = os.path.join(_CATALOG_DIR, safe_name)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"Dataset '{filename}' not found")
    os.remove(path)
    return {"success": True, "message": f"Dataset '{safe_name}' deleted"}
