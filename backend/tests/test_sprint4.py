"""
Sprint 4 Tests
==============
Tests for the new features:
- OHLCV market data endpoint
- Expanded symbols list
- New strategy types (EMA, Bollinger, VWAP)
- Custom strategy upload
- Data catalog endpoints (CSV/Parquet export/import)
- Analytics endpoints (performance, equity, walk-forward, correlation, position size)
- Report exports (Excel, PDF)
- OKX and dYdX adapter connections
"""

import io
import json
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────

def _make_fake_bars(n: int = 10) -> list:
    """Generate n fake OHLCV bar dicts."""
    bars = []
    price = 65000.0
    for i in range(n):
        bars.append({
            "time": 1_700_000_000_000 + i * 3_600_000,
            "open": price,
            "high": price * 1.01,
            "low": price * 0.99,
            "close": price * 1.005,
            "volume": 100.0 + i,
            "close_time": 1_700_000_000_000 + (i + 1) * 3_600_000 - 1,
            "quote_volume": price * 100.0,
            "trades": 50,
        })
        price = bars[-1]["close"]
    return bars


# ────────────────────────────────────────────────────────────────────────────
# A. OHLCV / Market Data
# ────────────────────────────────────────────────────────────────────────────

class TestOHLCVEndpoints:
    def test_ohlcv_endpoint_returns_200(self, client, monkeypatch):
        import market_data_service as svc
        monkeypatch.setattr(svc, "get_ohlcv", AsyncMock(return_value=_make_fake_bars(50)))
        r = client.get("/api/market-data/ohlcv/BTCUSDT?interval=1h&limit=50")
        assert r.status_code == 200
        body = r.json()
        assert "bars" in body
        assert body["symbol"] == "BTCUSDT"
        assert body["interval"] == "1h"

    def test_ohlcv_returns_bars_array(self, client, monkeypatch):
        import market_data_service as svc
        bars = _make_fake_bars(100)
        monkeypatch.setattr(svc, "get_ohlcv", AsyncMock(return_value=bars))
        r = client.get("/api/market-data/ohlcv/ETHUSDT?interval=4h&limit=100")
        assert r.status_code == 200
        assert r.json()["count"] == 100

    def test_ohlcv_bar_has_required_fields(self, client, monkeypatch):
        import market_data_service as svc
        monkeypatch.setattr(svc, "get_ohlcv", AsyncMock(return_value=_make_fake_bars(1)))
        r = client.get("/api/market-data/ohlcv/BTCUSDT")
        bar = r.json()["bars"][0]
        for field in ("time", "open", "high", "low", "close", "volume"):
            assert field in bar, f"Missing field: {field}"

    def test_ohlcv_unknown_symbol_returns_404(self, client):
        r = client.get("/api/market-data/ohlcv/FAKECOIN")
        assert r.status_code == 404

    def test_intervals_endpoint_returns_list(self, client):
        r = client.get("/api/market-data/intervals")
        assert r.status_code == 200
        assert "intervals" in r.json()
        assert "1h" in r.json()["intervals"]
        assert "1d" in r.json()["intervals"]

    def test_expanded_symbols_includes_xrp(self, client, monkeypatch):
        import market_data_service as svc
        monkeypatch.setattr(svc, "get_instruments", AsyncMock(return_value=[
            {"symbol": s, "price": 1.0, "change_24h": 0.0, "bid": 1.0, "ask": 1.0,
             "volume_24h": 0.0, "exchange": "BINANCE", "base": s[:-4], "quote": "USDT",
             "timestamp": "2024-01-01T00:00:00Z"}
            for s in svc.SYMBOLS
        ]))
        r = client.get("/api/market-data/instruments")
        symbols = [i["symbol"] for i in r.json()["instruments"]]
        assert "XRPUSDT" in symbols
        assert "DOGEUSDT" in symbols
        assert "AVAXUSDT" in symbols

    def test_ohlcv_fallback_generates_bars(self):
        """Synthetic bar generation when Binance is unreachable."""
        import market_data_service as svc
        bars = svc._generate_fallback_ohlcv("BTCUSDT", "1h", 20)
        assert len(bars) == 20
        for b in bars:
            assert b["high"] >= b["open"]
            assert b["high"] >= b["close"]
            assert b["low"] <= b["open"]
            assert b["low"] <= b["close"]


# ────────────────────────────────────────────────────────────────────────────
# B. New Strategy Types
# ────────────────────────────────────────────────────────────────────────────

class TestNewStrategyTypes:
    def test_strategy_types_includes_ema(self, client):
        r = client.get("/api/strategy-types")
        ids = [t["id"] for t in r.json()["types"]]
        assert "ema_crossover" in ids

    def test_strategy_types_includes_bollinger(self, client):
        r = client.get("/api/strategy-types")
        ids = [t["id"] for t in r.json()["types"]]
        assert "bollinger_bands" in ids

    def test_strategy_types_includes_vwap(self, client):
        r = client.get("/api/strategy-types")
        ids = [t["id"] for t in r.json()["types"]]
        assert "vwap" in ids

    def test_strategy_types_includes_custom(self, client):
        r = client.get("/api/strategy-types")
        ids = [t["id"] for t in r.json()["types"]]
        assert "custom" in ids

    def test_create_ema_strategy(self, client):
        r = client.post("/api/strategies", json={
            "name": "EMA Test",
            "type": "ema_crossover",
            "fast_period": 9,
            "slow_period": 21,
        })
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_ema_fast_must_be_less_than_slow(self, client):
        r = client.post("/api/strategies", json={
            "name": "Bad EMA",
            "type": "ema_crossover",
            "fast_period": 21,
            "slow_period": 9,
        })
        assert r.status_code == 422

    def test_create_bollinger_strategy(self, client):
        r = client.post("/api/strategies", json={
            "name": "BB Test",
            "type": "bollinger_bands",
            "period": 20,
            "std_dev": 2.0,
        })
        assert r.status_code == 200

    def test_bollinger_period_validation(self, client):
        r = client.post("/api/strategies", json={
            "name": "Bad BB",
            "type": "bollinger_bands",
            "period": 1,
        })
        assert r.status_code == 422

    def test_create_vwap_strategy(self, client):
        r = client.post("/api/strategies", json={
            "name": "VWAP Test",
            "type": "vwap",
            "vwap_period": 20,
            "deviation_pct": 0.5,
        })
        assert r.status_code == 200

    def test_vwap_deviation_must_be_positive(self, client):
        r = client.post("/api/strategies", json={
            "name": "Bad VWAP",
            "type": "vwap",
            "deviation_pct": 0,
        })
        assert r.status_code == 422

    def test_upload_custom_strategy(self, client, tmp_path):
        code = b"from nautilus_trader.trading.strategy import Strategy\nclass MyStrategy(Strategy): pass\n"
        r = client.post(
            "/api/strategies/upload",
            files={"file": ("my_strategy.py", io.BytesIO(code), "text/x-python")},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["filename"] == "my_strategy.py"

    def test_upload_non_py_rejected(self, client):
        r = client.post(
            "/api/strategies/upload",
            files={"file": ("data.csv", io.BytesIO(b"a,b,c"), "text/csv")},
        )
        assert r.status_code == 400

    def test_upload_without_strategy_class_rejected(self, client):
        code = b"# just a helper module\ndef foo(): pass\n"
        r = client.post(
            "/api/strategies/upload",
            files={"file": ("helper.py", io.BytesIO(code), "text/x-python")},
        )
        assert r.status_code == 400

    def test_seven_strategy_types_available(self, client):
        r = client.get("/api/strategy-types")
        assert len(r.json()["types"]) >= 7  # sma, rsi, macd, ema, bb, vwap, custom


# ────────────────────────────────────────────────────────────────────────────
# C. Data Catalog
# ────────────────────────────────────────────────────────────────────────────

class TestDataCatalog:
    def test_datasets_endpoint_returns_200(self, client):
        r = client.get("/api/catalog/datasets")
        assert r.status_code == 200
        assert "datasets" in r.json()

    def test_export_csv_returns_200(self, client, monkeypatch):
        import market_data_service as svc
        monkeypatch.setattr(svc, "get_ohlcv", AsyncMock(return_value=_make_fake_bars(10)))
        r = client.get("/api/catalog/export/csv/BTCUSDT?interval=1h&limit=10")
        assert r.status_code == 200
        assert "text/csv" in r.headers["content-type"]

    def test_export_csv_content_has_header(self, client, monkeypatch):
        import market_data_service as svc
        monkeypatch.setattr(svc, "get_ohlcv", AsyncMock(return_value=_make_fake_bars(5)))
        r = client.get("/api/catalog/export/csv/BTCUSDT")
        lines = r.text.split("\n")
        header = lines[0]
        assert "time" in header
        assert "open" in header
        assert "close" in header

    def test_export_csv_unknown_symbol_404(self, client):
        r = client.get("/api/catalog/export/csv/FAKECOIN")
        assert r.status_code == 404

    def test_import_csv_valid_file(self, client, tmp_path, monkeypatch):
        # Patch catalog dir to tmp_path
        import routers.catalog as cat_mod
        monkeypatch.setattr(cat_mod, "_CATALOG_DIR", str(tmp_path))
        csv_content = b"time,open,high,low,close,volume\n1700000000000,65000,65100,64900,65050,100\n"
        r = client.post(
            "/api/catalog/import/csv",
            files={"file": ("test.csv", io.BytesIO(csv_content), "text/csv")},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["rows"] == 1

    def test_import_csv_missing_columns_rejected(self, client, tmp_path, monkeypatch):
        import routers.catalog as cat_mod
        monkeypatch.setattr(cat_mod, "_CATALOG_DIR", str(tmp_path))
        csv_content = b"timestamp,price\n1700000,65000\n"
        r = client.post(
            "/api/catalog/import/csv",
            files={"file": ("bad.csv", io.BytesIO(csv_content), "text/csv")},
        )
        assert r.status_code == 400

    def test_import_non_csv_rejected(self, client):
        r = client.post(
            "/api/catalog/import/csv",
            files={"file": ("data.json", io.BytesIO(b"{}"), "application/json")},
        )
        assert r.status_code == 400

    def test_delete_nonexistent_dataset_returns_404(self, client, tmp_path, monkeypatch):
        import routers.catalog as cat_mod
        monkeypatch.setattr(cat_mod, "_CATALOG_DIR", str(tmp_path))
        r = client.delete("/api/catalog/datasets/nonexistent.csv")
        assert r.status_code == 404


# ────────────────────────────────────────────────────────────────────────────
# D. Analytics
# ────────────────────────────────────────────────────────────────────────────

class TestAnalytics:
    def test_performance_endpoint_returns_200(self, client):
        r = client.get("/api/analytics/performance")
        assert r.status_code == 200
        body = r.json()
        assert "total_pnl" in body
        assert "win_rate" in body
        assert "sharpe_ratio" in body
        assert "max_drawdown" in body

    def test_performance_total_trades_is_int(self, client):
        r = client.get("/api/analytics/performance")
        assert isinstance(r.json()["total_trades"], int)

    def test_equity_curve_endpoint_returns_200(self, client):
        r = client.get("/api/analytics/equity-curve")
        assert r.status_code == 200
        assert "points" in r.json()
        assert "final_equity" in r.json()

    def test_walk_forward_returns_windows(self, client, monkeypatch):
        import market_data_service as svc
        monkeypatch.setattr(svc, "get_ohlcv", AsyncMock(return_value=_make_fake_bars(500)))
        r = client.post("/api/analytics/walk-forward", json={
            "strategy_id": "test",
            "symbol": "BTCUSDT",
            "interval": "1h",
            "in_sample_bars": 100,
            "out_sample_bars": 30,
            "windows": 3,
        })
        assert r.status_code == 200
        body = r.json()
        assert "windows" in body
        assert len(body["windows"]) >= 1
        assert "combined_out_of_sample" in body

    def test_walk_forward_window_has_in_and_oos(self, client, monkeypatch):
        import market_data_service as svc
        monkeypatch.setattr(svc, "get_ohlcv", AsyncMock(return_value=_make_fake_bars(500)))
        r = client.post("/api/analytics/walk-forward", json={
            "strategy_id": "test",
            "symbol": "BTCUSDT",
            "interval": "1h",
            "in_sample_bars": 100,
            "out_sample_bars": 30,
            "windows": 2,
        })
        w = r.json()["windows"][0]
        assert "in_sample" in w
        assert "out_of_sample" in w
        assert "total_pnl" in w["in_sample"]

    def test_walk_forward_requires_enough_bars(self, client, monkeypatch):
        import market_data_service as svc
        monkeypatch.setattr(svc, "get_ohlcv", AsyncMock(return_value=_make_fake_bars(5)))
        r = client.post("/api/analytics/walk-forward", json={
            "strategy_id": "test",
            "symbol": "BTCUSDT",
            "interval": "1h",
            "in_sample_bars": 200,
            "out_sample_bars": 50,
            "windows": 5,
        })
        assert r.status_code == 400

    def test_correlation_returns_matrix(self, client, monkeypatch):
        import market_data_service as svc
        monkeypatch.setattr(svc, "get_ohlcv", AsyncMock(return_value=_make_fake_bars(100)))
        r = client.get("/api/analytics/correlation?symbols=BTCUSDT,ETHUSDT&interval=1d&limit=90")
        assert r.status_code == 200
        body = r.json()
        assert "matrix" in body
        assert "symbols" in body
        assert len(body["matrix"]) == 2

    def test_correlation_diagonal_is_one(self, client, monkeypatch):
        import market_data_service as svc
        monkeypatch.setattr(svc, "get_ohlcv", AsyncMock(return_value=_make_fake_bars(50)))
        r = client.get("/api/analytics/correlation?symbols=BTCUSDT,ETHUSDT")
        body = r.json()
        assert body["matrix"][0][0] == 1.0
        assert body["matrix"][1][1] == 1.0

    def test_correlation_requires_at_least_two_symbols(self, client, monkeypatch):
        import market_data_service as svc
        monkeypatch.setattr(svc, "get_ohlcv", AsyncMock(return_value=_make_fake_bars(50)))
        r = client.get("/api/analytics/correlation?symbols=BTCUSDT")
        assert r.status_code == 400

    def test_position_size_kelly(self, client):
        r = client.post("/api/analytics/position-size", json={
            "account_equity": 100000,
            "win_rate": 0.6,
            "avg_win": 300,
            "avg_loss": 150,
            "risk_pct": 1.0,
        })
        assert r.status_code == 200
        body = r.json()
        assert "kelly_position" in body
        assert "half_kelly_position" in body
        assert "fixed_fraction_position" in body

    def test_position_size_half_kelly_less_than_full(self, client):
        r = client.post("/api/analytics/position-size", json={
            "account_equity": 100000,
            "win_rate": 0.6,
            "avg_win": 300,
            "avg_loss": 150,
            "risk_pct": 1.0,
        })
        body = r.json()
        assert body["half_kelly_position"] <= body["kelly_position"]


# ────────────────────────────────────────────────────────────────────────────
# E. Reports
# ────────────────────────────────────────────────────────────────────────────

class TestReports:
    def test_excel_report_returns_xlsx(self, client):
        r = client.get("/api/reports/excel")
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers["content-type"] or "octet-stream" in r.headers["content-type"]

    def test_excel_report_has_content_disposition(self, client):
        r = client.get("/api/reports/excel")
        cd = r.headers.get("content-disposition", "")
        assert ".xlsx" in cd

    def test_pdf_report_returns_pdf(self, client):
        r = client.get("/api/reports/pdf")
        assert r.status_code == 200
        assert "pdf" in r.headers["content-type"]

    def test_pdf_report_has_content_disposition(self, client):
        r = client.get("/api/reports/pdf")
        cd = r.headers.get("content-disposition", "")
        assert ".pdf" in cd

    def test_excel_content_is_valid_zip(self, client):
        """Excel .xlsx files are ZIP archives."""
        import zipfile
        r = client.get("/api/reports/excel")
        buf = io.BytesIO(r.content)
        assert zipfile.is_zipfile(buf)

    def test_pdf_content_starts_with_pdf_header(self, client):
        r = client.get("/api/reports/pdf")
        assert r.content[:4] == b"%PDF"


# ────────────────────────────────────────────────────────────────────────────
# F. New Exchange Adapters (OKX, dYdX)
# ────────────────────────────────────────────────────────────────────────────

class TestNewAdapters:
    def test_okx_in_adapter_list(self, client):
        r = client.get("/api/adapters")
        ids = [a["id"] for a in r.json()["adapters"]]
        assert "okx" in ids

    def test_dydx_in_adapter_list(self, client):
        r = client.get("/api/adapters")
        ids = [a["id"] for a in r.json()["adapters"]]
        assert "dydx" in ids

    def test_connect_okx_stores_credentials(self, client, monkeypatch):
        from live_trading import LiveTradingManager
        async def mock_connect_okx(self, api_key, api_secret):
            return {"success": True, "connection_id": "CONN-OKX-TESTTEST", "verified": False}
        monkeypatch.setattr(LiveTradingManager, "connect_okx", mock_connect_okx)
        r = client.post("/api/adapters/okx/connect", json={
            "api_key": "test_api_key_12345678",
            "api_secret": "test_api_secret_12345678",
        })
        assert r.status_code == 200
        assert r.json()["status"] == "connected"

    def test_connect_dydx_requires_api_key(self, client):
        r = client.post("/api/adapters/dydx/connect", json={
            "api_key": "",
            "api_secret": "some_secret",
        })
        assert r.status_code == 400

    def test_connect_okx_manager_method_exists(self):
        from live_trading import LiveTradingManager
        mgr = LiveTradingManager()
        assert hasattr(mgr, "connect_okx")
        assert callable(mgr.connect_okx)

    def test_connect_dydx_manager_method_exists(self):
        from live_trading import LiveTradingManager
        mgr = LiveTradingManager()
        assert hasattr(mgr, "connect_dydx")
        assert callable(mgr.connect_dydx)

    def test_okx_adapter_has_credentials_fields(self, client):
        r = client.get("/api/adapters/okx")
        assert r.status_code == 200
        fields = r.json()["credential_fields"]
        assert "api_key" in fields
        assert "api_secret" in fields

    def test_dydx_adapter_has_required_fields(self, client):
        r = client.get("/api/adapters/dydx")
        assert r.status_code == 200
        body = r.json()
        assert body["supports_live"] is True
