from fastapi import APIRouter, HTTPException, Query

import market_data_service as svc

router = APIRouter(prefix="/api/market-data", tags=["market-data"])


@router.get("/instruments")
async def list_instruments():
    instruments = await svc.get_instruments()
    return {"instruments": instruments, "count": len(instruments)}


@router.get("/intervals")
async def list_intervals():
    """Return supported OHLCV candlestick intervals."""
    return {"intervals": svc.OHLCV_INTERVALS}


@router.get("/ohlcv/{symbol}")
async def get_ohlcv(
    symbol: str,
    interval: str = Query("1h", description="Candlestick interval (e.g. 1m, 5m, 1h, 1d)"),
    limit: int = Query(200, ge=1, le=1000, description="Number of bars to return"),
):
    """Return OHLCV candlestick data for a symbol."""
    upper = symbol.upper()
    if upper not in svc.SYMBOLS:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
    bars = await svc.get_ohlcv(upper, interval=interval, limit=limit)
    return {
        "symbol": upper,
        "interval": interval,
        "bars": bars,
        "count": len(bars),
    }


@router.get("/{symbol}")
async def get_quote(symbol: str):
    upper = symbol.upper()
    if upper not in svc.SYMBOLS:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
    data = await svc.get_symbol_data(upper)
    return data
