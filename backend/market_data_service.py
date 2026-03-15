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
]

# ---------------------------------------------------------------------------
# Hard-coded fallback values (used only when Binance is unreachable AND cache
# is empty — i.e. on a cold start with no network).
# ---------------------------------------------------------------------------
_FALLBACK: Dict[str, Dict[str, Any]] = {
    "BTCUSDT": {"price": 65420.0, "change_24h": 2.3,  "bid": 65419.0, "ask": 65421.0, "volume_24h": 30_000_000.0},
    "ETHUSDT": {"price":  3240.0, "change_24h": -0.8, "bid":  3239.5, "ask":  3240.5, "volume_24h": 15_000_000.0},
    "BNBUSDT": {"price":   580.0, "change_24h":  1.1, "bid":   579.8, "ask":   580.2, "volume_24h":  5_000_000.0},
    "SOLUSDT": {"price":   175.0, "change_24h":  4.2, "bid":   174.9, "ask":   175.1, "volume_24h":  8_000_000.0},
    "ADAUSDT": {"price":   0.485, "change_24h": -1.5, "bid":   0.4849,"ask":   0.4851,"volume_24h":  2_000_000.0},
    "DOTUSDT": {"price":     8.2, "change_24h":  0.7, "bid":   8.19,  "ask":   8.21,  "volume_24h":  1_000_000.0},
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

    Uses the per-symbol cache; falls back to a fresh Binance request if
    stale, then to the last known cached value, then to hard-coded defaults.
    """
    upper = symbol.upper()

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
