"""Tests for /api/market-data endpoints with mocked Binance responses."""

import sys
from unittest.mock import AsyncMock, patch

import pytest


def test_get_instruments(client):
    response = client.get("/api/market-data/instruments")
    assert response.status_code == 200
    data = response.json()
    assert "instruments" in data
    assert isinstance(data["instruments"], list)


def test_get_instruments_with_mocked_binance(client):
    """Market data endpoint should return correct shape from Binance response."""
    mock_ticker = [
        {
            "symbol": "BTCUSDT",
            "lastPrice": "65000.0",
            "priceChangePercent": "2.5",
            "bidPrice": "64999.0",
            "askPrice": "65001.0",
            "quoteVolume": "1000000.0",
        }
    ]

    async def mock_get_instruments():
        return [
            {
                "symbol": "BTCUSDT",
                "base": "BTC",
                "quote": "USDT",
                "exchange": "BINANCE",
                "price": 65000.0,
                "change_24h": 2.5,
                "bid": 64999.0,
                "ask": 65001.0,
                "volume_24h": 1000000.0,
                "timestamp": "2024-01-01T00:00:00+00:00",
            }
        ]

    market_data_service = sys.modules.get("market_data_service")
    if market_data_service is None:
        pytest.skip("market_data_service not importable in this test environment")

    with patch.object(market_data_service, "get_instruments", mock_get_instruments):
        response = client.get("/api/market-data/instruments")
        assert response.status_code == 200
        instruments = response.json()["instruments"]
        assert len(instruments) == 1
        assert instruments[0]["symbol"] == "BTCUSDT"
        assert instruments[0]["price"] == 65000.0


def test_get_single_symbol_market_data(client):
    response = client.get("/api/market-data/BTCUSDT")
    assert response.status_code == 200
    data = response.json()
    assert "symbol" in data
    assert "price" in data


def test_market_data_uses_no_fake_sin_cos(client):
    """Verify that the instruments response does NOT use simulated prices
    (i.e. _simulated_price based on sin/cos is gone from the production path).
    """
    import inspect
    import importlib
    mod = importlib.import_module("nautilus_fastapi")
    source = inspect.getsource(mod)
    assert "_simulated_price" not in source, (
        "_simulated_price fake data function should not exist in nautilus_fastapi"
    )
