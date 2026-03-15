"""
Market Data Router
==================
Handles /api/market-data/* endpoints using live Binance data via market_data_service.
"""

from fastapi import APIRouter

import market_data_service

router = APIRouter()


@router.get("/api/market-data/instruments")
async def get_market_instruments():
    """Return list of supported instruments with live Binance prices."""
    instruments = await market_data_service.get_instruments()
    return {"instruments": instruments, "count": len(instruments)}


@router.get("/api/market-data/{symbol}")
async def get_market_data(symbol: str):
    """Return live market data for a symbol from Binance."""
    return await market_data_service.get_symbol_data(symbol)
