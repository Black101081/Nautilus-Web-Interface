from fastapi import APIRouter, HTTPException

import market_data_service as svc

router = APIRouter(prefix="/api/market-data", tags=["market-data"])


@router.get("/instruments")
async def list_instruments():
    instruments = await svc.get_instruments()
    return {"instruments": instruments, "count": len(instruments)}


@router.get("/{symbol}")
async def get_quote(symbol: str):
    upper = symbol.upper()
    if upper not in svc.SYMBOLS:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
    data = await svc.get_symbol_data(upper)
    return data
