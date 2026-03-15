import math
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/market-data", tags=["market-data"])

_DEMO_PRICES = {
    "EUR/USD": (1.0850, "SIM"),
    "GBP/USD": (1.2720, "SIM"),
    "USD/JPY": (149.50, "SIM"),
    "AUD/USD": (0.6540, "SIM"),
    "USD/CHF": (0.9015, "SIM"),
    "EUR/GBP": (0.8530, "SIM"),
    "BTCUSDT": (67_450.0, "BINANCE"),
    "ETHUSDT": (3_520.0, "BINANCE"),
    "BNBUSDT": (420.0, "BINANCE"),
    "SOLUSDT": (155.0, "BINANCE"),
    "ADAUSDT": (0.485, "BINANCE"),
    "DOTUSDT": (8.90, "BINANCE"),
}


def _simulated_price(base: float) -> float:
    t = datetime.now(timezone.utc).timestamp()
    noise = math.sin(t * 0.3) * 0.0002 + math.cos(t * 0.7) * 0.0001
    return round(base * (1 + noise), 5)


@router.get("/instruments")
async def list_instruments():
    instruments = []
    for symbol, (base_price, exchange) in _DEMO_PRICES.items():
        price = _simulated_price(base_price)
        parts = symbol.replace("USDT", "/USDT").split("/")
        instruments.append(
            {
                "symbol": symbol,
                "base": parts[0] if len(parts) > 1 else symbol[:3],
                "quote": parts[1] if len(parts) > 1 else "USD",
                "exchange": exchange,
                "price": price,
                "change_24h": round((price - base_price) / base_price * 100, 3),
            }
        )
    return {"instruments": instruments, "count": len(instruments)}


@router.get("/{symbol}")
async def get_quote(symbol: str):
    normalised = symbol.replace("_", "/")
    key = normalised if normalised in _DEMO_PRICES else symbol
    if key not in _DEMO_PRICES:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
    base_price, exchange = _DEMO_PRICES[key]
    price = _simulated_price(base_price)
    spread = price * 0.00015
    return {
        "symbol": key,
        "price": price,
        "bid": round(price - spread, 5),
        "ask": round(price + spread, 5),
        "volume_24h": round(base_price * 1_200_000, 2),
        "change_24h": round((price - base_price) / base_price * 100, 3),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
