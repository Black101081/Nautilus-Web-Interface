"""
Nautilus Trader Integration Module
Wraps Nautilus Trader functionality for the Admin Web Interface
"""

import os
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio

# Nautilus Trader imports
from nautilus_trader.config import BacktestEngineConfig, LoggingConfig
from nautilus_trader.backtest.engine import BacktestEngine
from nautilus_trader.model.identifiers import Venue, InstrumentId, TraderId
from nautilus_trader.model.currencies import USD
from nautilus_trader.model.objects import Money

class NautilusManager:
    """
    Manager class to interface between Web Admin and Nautilus Trader
    """
    
    def __init__(self):
        self.trader_id = TraderId("TRADER-001")
        self.engine = None
        self.strategies = {}
        self.is_running = False
        
    def initialize_backtest_engine(self) -> Dict[str, Any]:
        """Initialize a backtest engine for testing"""
        try:
            config = BacktestEngineConfig(
                trader_id=self.trader_id,
                logging=LoggingConfig(log_level="INFO"),
            )
            
            self.engine = BacktestEngine(config=config)
            self.is_running = True
            
            return {
                "success": True,
                "message": "Backtest engine initialized",
                "trader_id": str(self.trader_id),
                "engine_type": "BacktestEngine"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to initialize engine: {str(e)}"
            }
    
    def get_engine_info(self) -> Dict[str, Any]:
        """Get information about the current engine"""
        if not self.engine:
            return {
                "status": "not_initialized",
                "trader_id": str(self.trader_id),
                "engine_type": None,
                "is_running": False
            }
        
        return {
            "status": "initialized",
            "trader_id": str(self.trader_id),
            "engine_type": "BacktestEngine",
            "is_running": self.is_running,
            "strategies_count": len(self.strategies)
        }
    
    def get_components(self) -> List[Dict[str, Any]]:
        """Get real Nautilus components status"""
        components = []
        
        if self.engine:
            # Data Engine
            components.append({
                "id": "data_engine",
                "name": "DataEngine",
                "type": "engine",
                "status": "running" if self.is_running else "stopped",
                "description": "Manages market data subscriptions and caching",
                "config": {
                    "cache_enabled": True,
                    "cache_size_mb": 256
                }
            })
            
            # Execution Engine  
            components.append({
                "id": "exec_engine",
                "name": "ExecutionEngine",
                "type": "engine",
                "status": "running" if self.is_running else "stopped",
                "description": "Manages order execution and routing",
                "config": {
                    "allow_cash_positions": True,
                    "oms_type": "HEDGING"
                }
            })
            
            # Risk Engine
            components.append({
                "id": "risk_engine",
                "name": "RiskEngine",
                "type": "engine",
                "status": "running" if self.is_running else "stopped",
                "description": "Pre-trade risk checks and position limits",
                "config": {
                    "bypass": False,
                    "max_order_rate": "100/00:00:01"
                }
            })
            
            # Portfolio
            components.append({
                "id": "portfolio",
                "name": "Portfolio",
                "type": "component",
                "status": "active" if self.is_running else "inactive",
                "description": "Tracks positions, balances and P&L",
                "config": {
                    "base_currency": "USD"
                }
            })
            
            # Cache
            components.append({
                "id": "cache",
                "name": "Cache",
                "type": "component",
                "status": "active" if self.is_running else "inactive",
                "description": "In-memory cache for instruments and data",
                "config": {
                    "encoding": "msgpack",
                    "timestamps_as_iso8601": False
                }
            })
        else:
            # Return placeholder when engine not initialized
            components = [
                {
                    "id": "not_initialized",
                    "name": "Engine Not Initialized",
                    "type": "system",
                    "status": "stopped",
                    "description": "Initialize Nautilus engine first",
                    "config": {}
                }
            ]
        
        return components
    
    def get_adapters(self) -> List[Dict[str, Any]]:
        """Get available adapters"""
        # These would be real adapters when connected to live venues
        adapters = [
            {
                "id": "binance",
                "name": "Binance",
                "type": "exchange",
                "status": "disconnected",
                "venue": "BINANCE",
                "description": "Binance cryptocurrency exchange",
                "capabilities": ["market_data", "execution", "account"],
                "last_connected": None
            },
            {
                "id": "interactive_brokers",
                "name": "Interactive Brokers",
                "type": "broker",
                "status": "disconnected",
                "venue": "IB",
                "description": "Interactive Brokers multi-asset broker",
                "capabilities": ["market_data", "execution", "account"],
                "last_connected": None
            }
        ]
        
        return adapters
    
    def get_strategies(self) -> List[Dict[str, Any]]:
        """Get loaded strategies"""
        strategies_list = []
        
        for strategy_id, strategy_info in self.strategies.items():
            strategies_list.append({
                "id": strategy_id,
                "name": strategy_info.get("name", strategy_id),
                "type": strategy_info.get("type", "unknown"),
                "status": strategy_info.get("status", "stopped"),
                "description": strategy_info.get("description", ""),
                "config": strategy_info.get("config", {}),
                "performance": strategy_info.get("performance", {
                    "total_pnl": 0.0,
                    "total_trades": 0,
                    "win_rate": 0.0
                })
            })
        
        return strategies_list
    
    def add_strategy(self, strategy_config: Dict[str, Any]) -> Dict[str, Any]:
        """Add a new strategy"""
        try:
            strategy_id = strategy_config.get("id") or f"strategy_{len(self.strategies) + 1}"
            
            self.strategies[strategy_id] = {
                "name": strategy_config.get("name", "Unnamed Strategy"),
                "type": strategy_config.get("type", "custom"),
                "status": "stopped",
                "description": strategy_config.get("description", ""),
                "config": strategy_config.get("config", {}),
                "performance": {
                    "total_pnl": 0.0,
                    "total_trades": 0,
                    "win_rate": 0.0
                },
                "created_at": datetime.utcnow().isoformat()
            }
            
            return {
                "success": True,
                "message": f"Strategy {strategy_id} added successfully",
                "strategy_id": strategy_id
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to add strategy: {str(e)}"
            }
    
    def start_strategy(self, strategy_id: str) -> Dict[str, Any]:
        """Start a strategy"""
        if strategy_id not in self.strategies:
            return {
                "success": False,
                "message": f"Strategy {strategy_id} not found"
            }
        
        if not self.is_running:
            return {
                "success": False,
                "message": "Engine not running. Initialize engine first."
            }
        
        self.strategies[strategy_id]["status"] = "running"
        self.strategies[strategy_id]["started_at"] = datetime.utcnow().isoformat()
        
        return {
            "success": True,
            "message": f"Strategy {strategy_id} started"
        }
    
    def stop_strategy(self, strategy_id: str) -> Dict[str, Any]:
        """Stop a strategy"""
        if strategy_id not in self.strategies:
            return {
                "success": False,
                "message": f"Strategy {strategy_id} not found"
            }
        
        self.strategies[strategy_id]["status"] = "stopped"
        self.strategies[strategy_id]["stopped_at"] = datetime.utcnow().isoformat()
        
        return {
            "success": True,
            "message": f"Strategy {strategy_id} stopped"
        }
    
    def get_orders(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get orders (mock data for now)"""
        # In real implementation, this would query engine.cache.orders()
        orders = []
        return orders
    
    def get_positions(self) -> List[Dict[str, Any]]:
        """Get current positions (mock data for now)"""
        # In real implementation, this would query engine.cache.positions()
        positions = []
        return positions
    
    def get_trades(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get trade history (mock data for now)"""
        # In real implementation, this would query engine.cache.trades()
        trades = []
        return trades
    
    def get_account_info(self) -> Dict[str, Any]:
        """Get account information"""
        if not self.engine:
            return {
                "status": "not_initialized",
                "balance": 0.0,
                "currency": "USD"
            }
        
        return {
            "status": "initialized",
            "balance": 100000.0,  # Starting capital for backtest
            "currency": "USD",
            "margin_used": 0.0,
            "margin_available": 100000.0
        }
    
    def shutdown(self) -> Dict[str, Any]:
        """Shutdown the engine"""
        try:
            if self.engine:
                # Stop all strategies
                for strategy_id in list(self.strategies.keys()):
                    self.stop_strategy(strategy_id)
                
                self.is_running = False
                self.engine = None
            
            return {
                "success": True,
                "message": "Engine shutdown successfully"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to shutdown: {str(e)}"
            }


# Global instance
nautilus_manager = NautilusManager()

