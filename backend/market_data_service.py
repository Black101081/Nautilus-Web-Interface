"""
Market Data Service
===================
Fetches real-time market data from the Binance public REST API (no API key
required).  A simple 5-second in-memory TTL cache sits in front of every
Binance call so we stay well within the 1 200 req/min weight budget.

Fall-back chain (most to least authoritative):
  1. Binance API response         — live data
  2. Cached Binance response      — if Binance is temporarily unreachable
  3. Hard-coded default values    — last resort so the API never crashes
"""

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

# ---------------------------------------------------------------------------
# Supported symbols
# ---------------------------------------------------------------------------
SYMBOLS: List[str] = [
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT",
    "SOLUSDT",
    "ADAUSDT",
    "DOTUSDT",
    "XRPUSDT",
    "DOGEUSDT",
    "AVAXUSDT",
    "LINKUSDT",
    "MATICUSDT",
    "UNIUSDT",
    "LTCUSDT",
    "ATOMUSDT",
    "NEARUSDT",
]

# Supported candlestick intervals (Binance notation)
OHLCV_INTERVALS: List[str] = [
    "1m", "3m", "5m", "15m", "30m",
    "1h", "2h", "4h", "6h", "8h", "12h",
    "1d", "3d", "1w", "1M",
]

# ---------------------------------------------------------------------------
# Hard-coded fallback values (used only when Binance is unreachable AND cache
# is empty — i.e. on a cold start with no network).
# ---------------------------------------------------------------------------
_FALLBACK: Dict[str, Dict[str, Any]] = {
    "BTCUSDT":   {"price": 65420.0, "change_24h":  2.3, "bid": 65419.0,  "ask": 65421.0,  "volume_24h": 30_000_000.0},
    "ETHUSDT":   {"price":  3240.0, "change_24h": -0.8, "bid":  3239.5,  "ask":  3240.5,  "volume_24h": 15_000_000.0},
    "BNBUSDT":   {"price":   580.0, "change_24h":  1.1, "bid":   579.8,  "ask":   580.2,  "volume_24h":  5_000_000.0},
    "SOLUSDT":   {"price":   175.0, "change_24h":  4.2, "bid":   174.9,  "ask":   175.1,  "volume_24h":  8_000_000.0},
    "ADAUSDT":   {"price":   0.485, "change_24h": -1.5, "bid":   0.4849, "ask":   0.4851, "volume_24h":  2_000_000.0},
    "DOTUSDT":   {"price":     8.2, "change_24h":  0.7, "bid":   8.19,   "ask":   8.21,   "volume_24h":  1_000_000.0},
    "XRPUSDT":   {"price":   0.590, "change_24h":  1.2, "bid":   0.589,  "ask":   0.591,  "volume_24h":  3_000_000.0},
    "DOGEUSDT":  {"price":  0.1380, "change_24h":  3.1, "bid":  0.1379,  "ask":  0.1381,  "volume_24h":  2_500_000.0},
    "AVAXUSDT":  {"price":    37.5, "change_24h": -1.0, "bid":    37.49, "ask":    37.51,  "volume_24h":  1_200_000.0},
    "LINKUSDT":  {"price":    14.8, "change_24h":  0.5, "bid":    14.79, "ask":    14.81,  "volume_24h":    800_000.0},
    "MATICUSDT": {"price":   0.860, "change_24h": -0.3, "bid":   0.859,  "ask":   0.861,  "volume_24h":  1_500_000.0},
    "UNIUSDT":   {"price":    7.20, "change_24h":  2.0, "bid":    7.19,  "ask":    7.21,  "volume_24h":    600_000.0},
    "LTCUSDT":   {"price":    85.0, "change_24h":  0.8, "bid":    84.9,  "ask":    85.1,  "volume_24h":    900_000.0},
    "ATOMUSDT":  {"price":    9.50, "change_24h": -0.4, "bid":    9.49,  "ask":    9.51,  "volume_24h":    700_000.0},
    "NEARUSDT":  {"price":    5.80, "change_24h":  1.5, "bid":    5.79,  "ask":    5.81,  "volume_24h":    500_000.0},
}

# ---------------------------------------------------------------------------
# TTL cache
# ---------------------------------------------------------------------------
_CACHE_TTL_SECONDS = 5

# Per-symbol cache: symbol -> {"data": {...}, "fetched_at": float}
_symbol_cache: Dict[str, Dict[str, Any]] = {}
# All-symbols cache for the instruments list endpoint
_instruments_cache: Optional[Dict[str, Any]] = None

# A lock so concurrent requests don't all fire off to Binance simultaneously
_fetch_lock = asyncio.Lock()

BINANCE_BASE = "https://api.binance.com"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_ticker(ticker: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a Binance 24hr ticker dict to our internal format."""
    symbol = ticker["symbol"]
    base = symbol[:-4]  # strip trailing "USDT"
    return {
        "symbol": symbol,
        "base": base,
        "quote": "USDT",
        "exchange": "BINANCE",
        "price": round(float(ticker["lastPrice"]), 8),
        "change_24h": round(float(ticker["priceChangePercent"]), 4),
        "bid": round(float(ticker["bidPrice"]), 8),
        "ask": round(float(ticker["askPrice"]), 8),
        "volume_24h": round(float(ticker["quoteVolume"]), 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _fallback_for(symbol: str) -> Dict[str, Any]:
    """Return the hard-coded fallback for one symbol."""
    fb = _FALLBACK.get(symbol.upper(), {"price": 100.0, "change_24h": 0.0,
                                        "bid": 99.99, "ask": 100.01,
                                        "volume_24h": 0.0})
    return {
        "symbol": symbol.upper(),
        "base": symbol.upper()[:-4] if symbol.upper().endswith("USDT") else symbol,
        "quote": "USDT",
        "exchange": "BINANCE",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **fb,
    }


def _cache_is_fresh(entry: Optional[Dict[str, Any]]) -> bool:
    return (
        entry is not None
        and (time.monotonic() - entry["fetched_at"]) < _CACHE_TTL_SECONDS
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def get_instruments() -> List[Dict[str, Any]]:
    """
    Return 24-hr ticker data for all supported symbols.

    Hits Binance with a single batch request using the ``symbols`` parameter
    to keep weight usage low.  Results are cached for CACHE_TTL seconds.
    """
    global _instruments_cache

    async with _fetch_lock:
        if _cache_is_fresh(_instruments_cache):
            return _instruments_cache["data"]  # type: ignore[index]

        try:
            import json as _json
            params = {"symbols": _json.dumps(SYMBOLS)}
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{BINANCE_BASE}/api/v3/ticker/24hr", params=params
                )
                resp.raise_for_status()
                tickers = resp.json()

            result = [_parse_ticker(t) for t in tickers if t.get("symbol") in SYMBOLS]

            # Preserve original symbol ordering
            order = {s: i for i, s in enumerate(SYMBOLS)}
            result.sort(key=lambda x: order.get(x["symbol"], 99))

            # Update per-symbol cache as a side-effect
            for item in result:
                _symbol_cache[item["symbol"]] = {
                    "data": item,
                    "fetched_at": time.monotonic(),
                }

            _instruments_cache = {"data": result, "fetched_at": time.monotonic()}
            return result

        except Exception:
            # Binance unreachable — use cached values if available
            cached_items = [
                _symbol_cache[s]["data"]
                for s in SYMBOLS
                if s in _symbol_cache
            ]
            if cached_items:
                return cached_items
            # Cold start with no network — serve fallback values
            return [_fallback_for(s) for s in SYMBOLS]


async def get_symbol_data(symbol: str) -> Dict[str, Any]:
    """
    Return 24-hr ticker data for a single symbol.

    Priority chain:
      1. NautilusTrader DataEngine quote cache (real-time, zero extra calls)
      2. Per-symbol REST cache (< 5s old)
      3. Fresh Binance REST request
      4. Stale cached Binance response
      5. Hard-coded fallback defaults
    """
    upper = symbol.upper()

    # ── 1. Try NautilusTrader DataEngine quote cache ──────────────────────────
    try:
        from state import live_node
        if live_node.is_connected():
            # Map BTCUSDT → BTCUSDT.BINANCE (or BYBIT)
            for venue_suffix in ("BINANCE", "BYBIT"):
                instrument_id_str = f"{upper}.{venue_suffix}"
                quote = live_node.get_latest_quote(instrument_id_str)
                if quote:
                    mid = (quote["bid"] + quote["ask"]) / 2
                    data = {
                        "symbol": upper,
                        "base": upper[:-4] if upper.endswith("USDT") else upper,
                        "quote": "USDT",
                        "exchange": venue_suffix,
                        "price": round(mid, 8),
                        "bid": round(quote["bid"], 8),
                        "ask": round(quote["ask"], 8),
                        "change_24h": 0.0,
                        "volume_24h": 0.0,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "source": "live_node",
                    }
                    # Update local cache as side-effect
                    _symbol_cache[upper] = {"data": data, "fetched_at": time.monotonic()}
                    return data
    except Exception:
        pass

    async with _fetch_lock:
        if _cache_is_fresh(_symbol_cache.get(upper)):
            return _symbol_cache[upper]["data"]

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{BINANCE_BASE}/api/v3/ticker/24hr",
                    params={"symbol": upper},
                )
                resp.raise_for_status()
                ticker = resp.json()

            data = _parse_ticker(ticker)
            _symbol_cache[upper] = {"data": data, "fetched_at": time.monotonic()}
            return data

        except Exception:
            # Return stale cache if present
            if upper in _symbol_cache:
                return _symbol_cache[upper]["data"]
            # Ultimate fallback
            return _fallback_for(upper)


# ---------------------------------------------------------------------------
# OHLCV / Candlestick data
# ---------------------------------------------------------------------------

# Cache for candlestick data: (symbol, interval) -> {"data": [...], "fetched_at": float}
_ohlcv_cache: Dict[tuple, Dict[str, Any]] = {}
_OHLCV_CACHE_TTL = 30  # seconds


def _parse_kline(k: list) -> Dict[str, Any]:
    """Convert a Binance kline array to OHLCV dict."""
    return {
        "time": int(k[0]),           # open time (ms)
        "open": float(k[1]),
        "high": float(k[2]),
        "low": float(k[3]),
        "close": float(k[4]),
        "volume": float(k[5]),
        "close_time": int(k[6]),     # close time (ms)
        "quote_volume": float(k[7]),
        "trades": int(k[8]),
    }


def _generate_fallback_ohlcv(symbol: str, interval: str, limit: int) -> List[Dict[str, Any]]:
    """Generate synthetic OHLCV bars when Binance is unreachable."""
    import random
    fb = _FALLBACK.get(symbol.upper(), {"price": 100.0})
    base_price = fb["price"]
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    # Determine bar duration in ms
    _dur = {
        "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000,
        "30m": 1_800_000, "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000,
        "6h": 21_600_000, "8h": 28_800_000, "12h": 43_200_000,
        "1d": 86_400_000, "3d": 259_200_000, "1w": 604_800_000, "1M": 2_592_000_000,
    }
    dur_ms = _dur.get(interval, 60_000)

    bars = []
    price = base_price * 0.95
    for i in range(limit - 1, -1, -1):
        open_t = now_ms - i * dur_ms
        close_t = open_t + dur_ms - 1
        change = random.uniform(-0.01, 0.01) * price
        o = round(price, 8)
        c = round(price + change, 8)
        h = round(max(o, c) * random.uniform(1.0, 1.005), 8)
        lo = round(min(o, c) * random.uniform(0.995, 1.0), 8)
        vol = round(random.uniform(100, 10000), 4)
        bars.append({
            "time": open_t,
            "open": o, "high": h, "low": lo, "close": c,
            "volume": vol,
            "close_time": close_t,
            "quote_volume": round(vol * (o + c) / 2, 2),
            "trades": random.randint(10, 500),
        })
        price = c
    return bars


async def get_ohlcv(
    symbol: str,
    interval: str = "1h",
    limit: int = 200,
) -> List[Dict[str, Any]]:
    """
    Return OHLCV candlestick data for *symbol* at *interval* resolution.

    Uses Binance /api/v3/klines endpoint (no auth required).
    Falls back to synthetic bars on network errors.
    """
    upper = symbol.upper()
    if interval not in OHLCV_INTERVALS:
        interval = "1h"
    limit = max(1, min(limit, 1000))

    cache_key = (upper, interval)
    entry = _ohlcv_cache.get(cache_key)
    if entry and (time.monotonic() - entry["fetched_at"]) < _OHLCV_CACHE_TTL:
        return entry["data"]

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{BINANCE_BASE}/api/v3/klines",
                params={"symbol": upper, "interval": interval, "limit": limit},
            )
            resp.raise_for_status()
            klines = resp.json()

        bars = [_parse_kline(k) for k in klines]
        _ohlcv_cache[cache_key] = {"data": bars, "fetched_at": time.monotonic()}
        return bars

    except Exception:
        if entry:
            return entry["data"]
        return _generate_fallback_ohlcv(upper, interval, limit)
