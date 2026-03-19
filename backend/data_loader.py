"""
Data Loader — auto-download historical OHLCV data for backtesting.

Downloads kline (bar) data from Binance REST API and writes it to the
NautilusTrader ParquetDataCatalog so BacktestEngine can read it.

Supported: Binance SPOT (any XXXUSDT symbol)
Bar types:   1m, 5m, 15m, 1h, 4h, 1d
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

BINANCE_BASE = "https://api.binance.com"
MAX_KLINES_PER_REQUEST = 1000

_INTERVAL_MAP = {
    "1m":  "1-MINUTE",
    "3m":  "3-MINUTE",
    "5m":  "5-MINUTE",
    "15m": "15-MINUTE",
    "30m": "30-MINUTE",
    "1h":  "1-HOUR",
    "2h":  "2-HOUR",
    "4h":  "4-HOUR",
    "6h":  "6-HOUR",
    "8h":  "8-HOUR",
    "12h": "12-HOUR",
    "1d":  "1-DAY",
    "1w":  "1-WEEK",
}

# ── Public API ─────────────────────────────────────────────────────────────────

async def ensure_data_available(
    symbol: str,
    interval: str,
    start_date: str,
    end_date: str,
    catalog_path: str,
) -> Tuple[bool, str]:
    """
    Check if data is already in catalog; download from Binance if not.

    Returns (success, message).
    """
    try:
        from nautilus_trader.persistence.catalog import ParquetDataCatalog
        from nautilus_trader.model.identifiers import InstrumentId

        catalog = ParquetDataCatalog(catalog_path)
        instrument_id_str = f"{symbol.upper()}.BINANCE"

        # Check for existing bars in catalog
        try:
            existing = catalog.bars(
                instrument_ids=[instrument_id_str],
                start=start_date,
                end=end_date,
            )
            if existing and len(existing) > 50:
                logger.info(
                    "Catalog already has %d bars for %s [%s, %s]",
                    len(existing), instrument_id_str, start_date, end_date,
                )
                return True, f"Data available: {len(existing)} bars in catalog"
        except Exception:
            pass  # Catalog may not have this instrument yet

        # Download from Binance
        logger.info(
            "Downloading %s %s bars from Binance: %s → %s",
            symbol, interval, start_date, end_date,
        )
        bars_data = await _download_binance_klines(symbol, interval, start_date, end_date)
        if not bars_data:
            return False, f"No data returned from Binance for {symbol} {interval}"

        # Write to catalog
        success, msg = await _write_to_catalog(
            bars_data, symbol, interval, catalog_path
        )
        return success, msg

    except Exception as exc:
        logger.error("ensure_data_available error: %s", exc)
        return False, str(exc)


async def download_and_cache(
    symbol: str,
    interval: str,
    start_date: str,
    end_date: str,
    catalog_path: str,
) -> Tuple[bool, str, int]:
    """
    Download kline data from Binance and write to ParquetDataCatalog.
    Returns (success, message, bars_count).
    """
    try:
        bars_data = await _download_binance_klines(symbol, interval, start_date, end_date)
        if not bars_data:
            return False, "No data returned from Binance", 0

        success, msg = await _write_to_catalog(bars_data, symbol, interval, catalog_path)
        return success, msg, len(bars_data) if success else 0

    except Exception as exc:
        logger.error("download_and_cache error: %s", exc)
        return False, str(exc), 0


# ── Internal: Binance download ────────────────────────────────────────────────

async def _download_binance_klines(
    symbol: str,
    interval: str,
    start_date: str,
    end_date: str,
) -> List[List]:
    """
    Download all klines from Binance for the given symbol/interval/date range.
    Handles pagination automatically (max 1000 bars per request).
    Returns raw Binance kline arrays.
    """
    start_ms = _date_to_ms(start_date)
    end_ms = _date_to_ms(end_date, end_of_day=True)
    all_klines: List[List] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        current_start = start_ms
        while current_start < end_ms:
            params = {
                "symbol": symbol.upper(),
                "interval": interval,
                "startTime": current_start,
                "endTime": end_ms,
                "limit": MAX_KLINES_PER_REQUEST,
            }
            try:
                resp = await client.get(
                    f"{BINANCE_BASE}/api/v3/klines", params=params
                )
                resp.raise_for_status()
                klines = resp.json()
            except httpx.HTTPStatusError as exc:
                logger.error("Binance API error %s: %s", exc.response.status_code, exc)
                break
            except Exception as exc:
                logger.error("Binance download error: %s", exc)
                break

            if not klines:
                break

            all_klines.extend(klines)

            # Next page: start from close time of last bar + 1ms
            last_close_time = int(klines[-1][6])
            current_start = last_close_time + 1

            # Stop if we got fewer bars than limit (we've reached the end)
            if len(klines) < MAX_KLINES_PER_REQUEST:
                break

            # Rate limit: Binance allows 1200 weight/min; klines = 2 weight/call
            await asyncio.sleep(0.1)

    logger.info("Downloaded %d klines for %s %s", len(all_klines), symbol, interval)
    return all_klines


# ── Internal: Write to catalog ────────────────────────────────────────────────

async def _write_to_catalog(
    klines: List[List],
    symbol: str,
    interval: str,
    catalog_path: str,
) -> Tuple[bool, str]:
    """Convert raw Binance klines to NautilusTrader Bars and write to catalog."""
    try:
        from nautilus_trader.persistence.catalog import ParquetDataCatalog
        from nautilus_trader.model.data import Bar, BarType, BarSpecification
        from nautilus_trader.model.identifiers import InstrumentId, Symbol, Venue
        from nautilus_trader.model.enums import BarAggregation, PriceType, AggregationSource
        from nautilus_trader.model.objects import Price, Quantity
        from nautilus_trader.test_kit.providers import TestInstrumentProvider

        Path(catalog_path).mkdir(parents=True, exist_ok=True)
        catalog = ParquetDataCatalog(catalog_path)

        # Build InstrumentId
        instrument_id = InstrumentId(
            symbol=Symbol(symbol.upper()),
            venue=Venue("BINANCE"),
        )

        # Build BarType from interval
        nautilus_interval = _INTERVAL_MAP.get(interval, "1-MINUTE")
        parts = nautilus_interval.split("-")
        step = int(parts[0])
        aggregation_str = parts[1] if len(parts) > 1 else "MINUTE"

        aggregation_map = {
            "MINUTE": BarAggregation.MINUTE,
            "HOUR": BarAggregation.HOUR,
            "DAY": BarAggregation.DAY,
            "WEEK": BarAggregation.WEEK,
        }
        aggregation = aggregation_map.get(aggregation_str, BarAggregation.MINUTE)

        bar_spec = BarSpecification(
            step=step,
            aggregation=aggregation,
            price_type=PriceType.LAST,
        )
        bar_type = BarType(
            instrument_id=instrument_id,
            bar_spec=bar_spec,
            aggregation_source=AggregationSource.EXTERNAL,
        )

        # Convert klines to Bar objects
        bars: List[Bar] = []
        for k in klines:
            open_time_ns = int(k[0]) * 1_000_000  # ms → ns
            close_time_ns = int(k[6]) * 1_000_000
            try:
                bar = Bar(
                    bar_type=bar_type,
                    open=Price.from_str(str(k[1])),
                    high=Price.from_str(str(k[2])),
                    low=Price.from_str(str(k[3])),
                    close=Price.from_str(str(k[4])),
                    volume=Quantity.from_str(str(k[5])),
                    ts_event=close_time_ns,
                    ts_init=close_time_ns,
                )
                bars.append(bar)
            except Exception as exc:
                logger.debug("Skipping malformed kline: %s", exc)

        if not bars:
            return False, "No valid bars could be constructed from kline data"

        # Write instrument to catalog if not present
        try:
            existing_instruments = catalog.instruments(
                instrument_ids=[str(instrument_id)]
            )
        except Exception:
            existing_instruments = []

        if not existing_instruments:
            # Create a synthetic instrument for the catalog
            _write_synthetic_instrument(catalog, instrument_id, symbol)

        # Write bars to catalog
        catalog.write_data(bars)
        logger.info(
            "Wrote %d %s bars for %s to catalog at %s",
            len(bars), interval, symbol, catalog_path,
        )
        return True, f"Downloaded and cached {len(bars)} {interval} bars for {symbol}"

    except Exception as exc:
        logger.error("Catalog write error: %s", exc)
        return False, str(exc)


def _write_synthetic_instrument(catalog, instrument_id, symbol: str) -> None:
    """Write a minimal CurrencyPair instrument for the given symbol to catalog."""
    try:
        from nautilus_trader.model.instruments import CurrencyPair
        from nautilus_trader.model.objects import Price, Quantity
        from nautilus_trader.model.currencies import USDT
        from nautilus_trader.model.identifiers import Symbol, Venue
        from nautilus_trader.model.enums import CurrencyType
        from nautilus_trader.model.objects import Currency

        # Determine base currency from symbol (e.g. BTC from BTCUSDT)
        upper = symbol.upper()
        if upper.endswith("USDT"):
            base_code = upper[:-4]
        elif upper.endswith("BUSD"):
            base_code = upper[:-4]
        else:
            base_code = upper[:3]

        try:
            from nautilus_trader.model import currencies as _cur
            base_currency = getattr(_cur, base_code, None)
            if base_currency is None:
                base_currency = Currency(
                    code=base_code,
                    precision=8,
                    iso4217=0,
                    name=base_code,
                    currency_type=CurrencyType.CRYPTO,
                )
        except Exception:
            base_currency = Currency(
                code=base_code[:4],
                precision=8,
                iso4217=0,
                name=base_code,
                currency_type=CurrencyType.CRYPTO,
            )

        instrument = CurrencyPair(
            instrument_id=instrument_id,
            raw_symbol=Symbol(upper),
            base_currency=base_currency,
            quote_currency=USDT,
            price_precision=2,
            size_precision=6,
            price_increment=Price.from_str("0.01"),
            size_increment=Quantity.from_str("0.000001"),
            lot_size=None,
            max_quantity=None,
            min_quantity=Quantity.from_str("0.000001"),
            max_notional=None,
            min_notional=None,
            max_price=None,
            min_price=None,
            margin_init=None,
            margin_maint=None,
            maker_fee=None,
            taker_fee=None,
            ts_event=0,
            ts_init=0,
        )
        catalog.write_data([instrument])
        logger.info("Wrote synthetic instrument %s to catalog", instrument_id)
    except Exception as exc:
        logger.warning("Could not write synthetic instrument: %s", exc)


# ── Utility ───────────────────────────────────────────────────────────────────

def _date_to_ms(date_str: str, end_of_day: bool = False) -> int:
    """Convert 'YYYY-MM-DD' string to Binance millisecond timestamp."""
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    if end_of_day:
        dt = dt + timedelta(days=1) - timedelta(milliseconds=1)
    return int(dt.timestamp() * 1000)
