from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["adapters"])

_ADAPTERS = [
    {
        "id": "betfair", "name": "Betfair", "type": "Betting Exchange",
        "category": "Betting", "status": "available",
        "description": "Sports betting exchange adapter for Betfair markets",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/betfair",
        "supports_live": True, "supports_backtest": True,
    },
    {
        "id": "binance", "name": "Binance", "type": "Crypto Exchange",
        "category": "Crypto", "status": "available",
        "description": "World's largest crypto exchange – spot and margin trading",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/binance",
        "supports_live": True, "supports_backtest": True,
    },
    {
        "id": "binance_futures", "name": "Binance Futures", "type": "Crypto Futures",
        "category": "Crypto", "status": "available",
        "description": "Binance USD-M and COIN-M perpetual & dated futures",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/binance",
        "supports_live": True, "supports_backtest": True,
    },
    {
        "id": "bybit", "name": "Bybit", "type": "Crypto Exchange",
        "category": "Crypto", "status": "available",
        "description": "Bybit spot, perpetuals, and options trading",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/bybit",
        "supports_live": True, "supports_backtest": True,
    },
    {
        "id": "coinbase_advanced_trade", "name": "Coinbase Advanced Trade",
        "type": "Crypto Exchange", "category": "Crypto", "status": "available",
        "description": "Coinbase Advanced Trade API for professional trading",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/coinbase",
        "supports_live": True, "supports_backtest": False,
    },
    {
        "id": "databento", "name": "Databento", "type": "Data Provider",
        "category": "Data", "status": "available",
        "description": "Historical and live institutional-grade market data",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/databento",
        "supports_live": True, "supports_backtest": True,
    },
    {
        "id": "dydx", "name": "dYdX", "type": "DeFi Exchange",
        "category": "DeFi", "status": "available",
        "description": "Decentralized perpetuals exchange on Ethereum L2",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/dydx",
        "supports_live": True, "supports_backtest": False,
    },
    {
        "id": "interactive_brokers", "name": "Interactive Brokers",
        "type": "Traditional Broker", "category": "Stocks & Futures", "status": "available",
        "description": "Multi-asset brokerage – stocks, futures, forex, options",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/ib",
        "supports_live": True, "supports_backtest": False,
    },
    {
        "id": "okx", "name": "OKX", "type": "Crypto Exchange",
        "category": "Crypto", "status": "available",
        "description": "OKX spot, futures, options and DeFi trading",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/okx",
        "supports_live": True, "supports_backtest": True,
    },
    {
        "id": "polymarket", "name": "Polymarket", "type": "Prediction Market",
        "category": "DeFi", "status": "available",
        "description": "On-chain decentralized prediction markets",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/polymarket",
        "supports_live": True, "supports_backtest": False,
    },
    {
        "id": "tardis", "name": "Tardis", "type": "Data Provider",
        "category": "Data", "status": "available",
        "description": "Tick-level historical crypto market data replay",
        "docs_url": "https://nautilustrader.io/docs/nightly/integrations/tardis",
        "supports_live": False, "supports_backtest": True,
    },
]


@router.get("/adapters")
async def list_adapters():
    return {"adapters": _ADAPTERS, "count": len(_ADAPTERS)}
