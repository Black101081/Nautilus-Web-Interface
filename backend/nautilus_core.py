"""
Nautilus Trader Core Integration
Real integration with Nautilus Trader engine - NOT MOCK DATA
Uses low-level BacktestEngine API for direct control
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
from decimal import Decimal

from nautilus_trader.backtest.engine import BacktestEngine, BacktestEngineConfig
from nautilus_trader.config import LoggingConfig
from nautilus_trader.model.identifiers import TraderId, Venue, InstrumentId
from nautilus_trader.model.currencies import USD
from nautilus_trader.model.objects import Money
from nautilus_trader.model.enums import AccountType, OmsType
from nautilus_trader.persistence.catalog import ParquetDataCatalog

# Import our real strategy
from strategies.sma_crossover import SMACrossoverStrategy, SMACrossoverConfig


class NautilusTradingSystem:
    """
    Real Nautilus Trader integration for web interface.
    This is NOT a mock - it uses actual Nautilus BacktestEngine.
    """
    
    def __init__(self, catalog_path: str = None):
        """
        Initialize the trading system.
        
        Args:
            catalog_path: Path to Nautilus data catalog
        """
        self.trader_id = TraderId("TRADER-001")
        self.catalog_path = catalog_path or "/home/ubuntu/nautilus_data/catalog"
        
        # Engine
        self.engine: Optional[BacktestEngine] = None
        
        # Catalog for data
        self.catalog: Optional[ParquetDataCatalog] = None
        
        # State tracking
        self.strategies: Dict[str, Any] = {}
        self.backtest_results: Dict[str, Any] = {}
        self.is_initialized = False
        self.instruments = []
        
    def initialize(self) -> Dict[str, Any]:
        """
        Initialize the Nautilus engine and load data catalog.
        """
        try:
            # Load data catalog
            if os.path.exists(self.catalog_path):
                self.catalog = ParquetDataCatalog(self.catalog_path)
                self.instruments = self.catalog.instruments()
                
                print(f"✅ Loaded catalog from {self.catalog_path}")
                print(f"📊 Available instruments: {len(self.instruments)}")
                for instrument in self.instruments:
                    print(f"   - {instrument.id}")
            else:
                print(f"⚠️  Catalog path not found: {self.catalog_path}")
                return {
                    "success": False,
                    "message": f"Data catalog not found at {self.catalog_path}"
                }
            
            self.is_initialized = True
            
            return {
                "success": True,
                "message": "Nautilus Trading System initialized",
                "trader_id": str(self.trader_id),
                "catalog_path": self.catalog_path,
                "instruments_count": len(self.instruments)
            }
            
        except Exception as e:
            import traceback
            return {
                "success": False,
                "message": f"Failed to initialize: {str(e)}",
                "error": str(e),
                "trace": traceback.format_exc()
            }
    
    def get_system_info(self) -> Dict[str, Any]:
        """Get system information."""
        return {
            "is_initialized": self.is_initialized,
            "trader_id": str(self.trader_id),
            "catalog_path": self.catalog_path,
            "strategies_count": len(self.strategies),
            "backtests_count": len(self.backtest_results)
        }
    
    def create_strategy(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a real Nautilus strategy.
        
        Args:
            config: Strategy configuration
        """
        try:
            strategy_id = config.get("id", f"strategy_{len(self.strategies) + 1}")
            strategy_type = config.get("type", "sma_crossover")
            
            if strategy_type == "sma_crossover":
                # Create real SMA Crossover strategy config
                strategy_config = SMACrossoverConfig(
                    strategy_id=strategy_id,
                    instrument_id=config.get("instrument_id", "EUR/USD.SIM"),
                    bar_type=config.get("bar_type", "EUR/USD.SIM-1-MINUTE-BID-INTERNAL"),
                    fast_period=config.get("fast_period", 10),
                    slow_period=config.get("slow_period", 20),
                    trade_size=Decimal(str(config.get("trade_size", "100000")))
                )
                
                # Store strategy info
                self.strategies[strategy_id] = {
                    "id": strategy_id,
                    "name": config.get("name", "SMA Crossover"),
                    "type": strategy_type,
                    "config": strategy_config,
                    "status": "created",
                    "created_at": datetime.utcnow().isoformat()
                }
                
                return {
                    "success": True,
                    "message": f"Strategy {strategy_id} created",
                    "strategy_id": strategy_id,
                    "type": strategy_type
                }
            else:
                return {
                    "success": False,
                    "message": f"Unknown strategy type: {strategy_type}"
                }
                
        except Exception as e:
            import traceback
            return {
                "success": False,
                "message": f"Failed to create strategy: {str(e)}",
                "error": str(e),
                "trace": traceback.format_exc()
            }
    
    def run_backtest(
        self,
        strategy_id: str,
        start_date: str = "2020-01-01",
        end_date: str = "2020-01-31",
        starting_balance: float = 100000.0
    ) -> Dict[str, Any]:
        """
        Run a real backtest using Nautilus BacktestEngine (low-level API).
        
        Args:
            strategy_id: ID of the strategy to backtest
            start_date: Start date for backtest (YYYY-MM-DD)
            end_date: End date for backtest (YYYY-MM-DD)
            starting_balance: Starting account balance
        """
        try:
            if not self.is_initialized:
                return {
                    "success": False,
                    "message": "System not initialized. Call initialize() first."
                }
            
            if strategy_id not in self.strategies:
                return {
                    "success": False,
                    "message": f"Strategy {strategy_id} not found"
                }
            
            strategy_info = self.strategies[strategy_id]
            strategy_config = strategy_info["config"]
            
            print(f"🚀 Starting backtest for {strategy_id}")
            print(f"📅 Period: {start_date} to {end_date}")
            print(f"💰 Starting balance: ${starting_balance:,.2f}")
            
            # Create BacktestEngine with configuration
            engine_config = BacktestEngineConfig(
                trader_id=self.trader_id,
                logging=LoggingConfig(log_level="INFO"),
            )
            
            engine = BacktestEngine(config=engine_config)
            
            # Add venue (simulated exchange)
            VENUE = Venue("SIM")
            engine.add_venue(
                venue=VENUE,
                oms_type=OmsType.HEDGING,
                account_type=AccountType.MARGIN,
                base_currency=USD,
                starting_balances=[Money(starting_balance, USD)],
            )
            
            # Get instrument from catalog
            instrument = None
            for instr in self.instruments:
                if str(instr.id) == strategy_config.instrument_id:
                    instrument = instr
                    break
            
            if not instrument:
                return {
                    "success": False,
                    "message": f"Instrument {strategy_config.instrument_id} not found in catalog"
                }
            
            # Add instrument
            engine.add_instrument(instrument)
            
            # Load quote tick data from catalog
            print(f"📥 Loading quote tick data for {instrument.id}...")
            quote_ticks = self.catalog.quote_ticks(
                instrument_ids=[str(instrument.id)],
                start=start_date,
                end=end_date
            )
            
            if not quote_ticks:
                return {
                    "success": False,
                    "message": f"No quote tick data found for {instrument.id} between {start_date} and {end_date}"
                }
            
            print(f"✅ Loaded {len(quote_ticks)} quote ticks")
            
            # Add data to engine
            engine.add_data(quote_ticks)
            
            # Create and add strategy
            strategy = SMACrossoverStrategy(config=strategy_config)
            engine.add_strategy(strategy=strategy)
            
            # Run backtest
            print("⚙️  Running backtest...")
            engine.run()
            
            print("✅ Backtest completed!")
            
            # Extract results from engine
            # Get account
            accounts = list(engine.cache.accounts())
            account = accounts[0] if accounts else None
            
            # Get all orders
            orders = list(engine.cache.orders())
            
            # Get all positions
            positions = list(engine.cache.positions())
            
            # Calculate statistics
            total_pnl = 0.0
            if account:
                total_pnl = float(account.balance_total(USD).as_double()) - starting_balance
            
            winning_trades = 0
            losing_trades = 0
            total_trades = len([p for p in positions if p.is_closed])
            
            for position in positions:
                if position.is_closed:
                    pnl = float(position.realized_pnl.as_double()) if position.realized_pnl else 0.0
                    if pnl > 0:
                        winning_trades += 1
                    elif pnl < 0:
                        losing_trades += 1
            
            win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0
            
            # Store results
            backtest_result = {
                "strategy_id": strategy_id,
                "start_date": start_date,
                "end_date": end_date,
                "starting_balance": starting_balance,
                "ending_balance": float(account.balance_total(USD).as_double()) if account else starting_balance,
                "total_pnl": total_pnl,
                "total_trades": total_trades,
                "winning_trades": winning_trades,
                "losing_trades": losing_trades,
                "win_rate": win_rate,
                "total_orders": len(orders),
                "completed_at": datetime.utcnow().isoformat(),
                "orders": [self._order_to_dict(o) for o in orders[:100]],  # Limit to 100 for performance
                "positions": [self._position_to_dict(p) for p in positions[:100]],
            }
            
            self.backtest_results[strategy_id] = backtest_result
            self.strategies[strategy_id]["status"] = "backtested"
            self.strategies[strategy_id]["last_backtest"] = datetime.utcnow().isoformat()
            
            print(f"📈 Total P&L: ${total_pnl:,.2f}")
            print(f"📊 Total Trades: {total_trades}")
            print(f"🎯 Win Rate: {win_rate:.2f}%")
            
            # Clean up
            engine.dispose()
            
            return {
                "success": True,
                "message": "Backtest completed successfully",
                "result": backtest_result
            }
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"❌ Backtest failed: {str(e)}")
            print(error_trace)
            
            return {
                "success": False,
                "message": f"Backtest failed: {str(e)}",
                "error": str(e),
                "trace": error_trace
            }
    
    def get_backtest_results(self, strategy_id: str) -> Optional[Dict[str, Any]]:
        """Get backtest results for a strategy."""
        return self.backtest_results.get(strategy_id)
    
    def get_all_strategies(self) -> List[Dict[str, Any]]:
        """Get all strategies."""
        return list(self.strategies.values())
    
    def get_strategy(self, strategy_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific strategy."""
        return self.strategies.get(strategy_id)
    
    def _order_to_dict(self, order) -> Dict[str, Any]:
        """Convert Nautilus Order to dictionary."""
        return {
            "id": str(order.client_order_id),
            "instrument_id": str(order.instrument_id),
            "side": str(order.side),
            "type": str(order.order_type),
            "quantity": float(order.quantity),
            "status": str(order.status),
            "filled_qty": float(order.filled_qty),
            "avg_px": float(order.avg_px) if order.avg_px else None,
            "ts_init": order.ts_init,
        }
    
    def _position_to_dict(self, position) -> Dict[str, Any]:
        """Convert Nautilus Position to dictionary."""
        return {
            "id": str(position.id),
            "instrument_id": str(position.instrument_id),
            "side": str(position.side),
            "quantity": float(position.quantity),
            "avg_px_open": float(position.avg_px_open),
            "avg_px_close": float(position.avg_px_close) if position.avg_px_close else None,
            "realized_pnl": float(position.realized_pnl.as_double()) if position.realized_pnl else 0.0,
            "unrealized_pnl": float(position.unrealized_pnl(position.last_px).as_double()) if not position.is_closed else 0.0,
            "is_open": position.is_open,
            "is_closed": position.is_closed,
            "ts_opened": position.ts_opened,
            "ts_closed": position.ts_closed if position.is_closed else None,
        }


# Global instance
nautilus_system = NautilusTradingSystem()

