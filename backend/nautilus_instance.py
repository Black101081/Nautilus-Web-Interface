#!/usr/bin/env python3
"""
Create a Nautilus Trader backtest instance to explore API
Based on official documentation
"""

from decimal import Decimal
from nautilus_trader.backtest.config import BacktestEngineConfig
from nautilus_trader.backtest.engine import BacktestEngine
from nautilus_trader.model import Money, TraderId, Venue
from nautilus_trader.model.currencies import ETH, USDT
from nautilus_trader.model.enums import AccountType, OmsType
from nautilus_trader.test_kit.providers import TestInstrumentProvider

print("="*60)
print("Creating Nautilus Trader Backtest Instance")
print("="*60)

# Step 1: Configure backtest engine
print("\n1. Configuring backtest engine...")
config = BacktestEngineConfig(trader_id=TraderId("ADMIN-001"))
engine = BacktestEngine(config=config)
print("✅ Engine created")

# Step 2: Add venue
print("\n2. Adding BINANCE venue...")
BINANCE = Venue("BINANCE")
engine.add_venue(
    venue=BINANCE,
    oms_type=OmsType.NETTING,
    account_type=AccountType.CASH,
    base_currency=None,
    starting_balances=[Money(1_000_000.0, USDT), Money(10.0, ETH)],
)
print("✅ Venue added")

# Step 3: Add instrument
print("\n3. Adding ETHUSDT instrument...")
ETHUSDT_BINANCE = TestInstrumentProvider.ethusdt_binance()
engine.add_instrument(ETHUSDT_BINANCE)
print("✅ Instrument added")

# Step 4: Explore engine components
print("\n" + "="*60)
print("Exploring Engine Components")
print("="*60)

print(f"\n✅ Engine type: {type(engine)}")
print(f"✅ Trader: {engine.trader}")
print(f"✅ Kernel: {engine.kernel}")

# Access core components
print("\n--- Core Components ---")
print(f"Cache: {engine.cache}")
print(f"Portfolio: {engine.portfolio}")

# Try to access engines
if hasattr(engine, 'data_engine'):
    print(f"DataEngine: {engine.data_engine}")
    
if hasattr(engine, 'exec_engine'):
    print(f"ExecutionEngine: {engine.exec_engine}")
    
if hasattr(engine, 'risk_engine'):
    print(f"RiskEngine: {engine.risk_engine}")

# Check cache contents
print("\n--- Cache Contents ---")
print(f"Instruments in cache: {list(engine.cache.instruments())}")
print(f"Accounts in cache: {list(engine.cache.accounts())}")

# Check portfolio
print("\n--- Portfolio ---")
print(f"Portfolio balances: {engine.portfolio.balances_total()}")

print("\n" + "="*60)
print("SUCCESS! Nautilus instance ready for API wrapping")
print("="*60)

# Keep engine reference for API server
NAUTILUS_ENGINE = engine

print("\nEngine is ready to be wrapped by FastAPI!")

