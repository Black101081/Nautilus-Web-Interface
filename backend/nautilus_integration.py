"""
Nautilus Trader Integration Module
Wraps Nautilus Trader functionality for the Admin Web Interface
"""

import os
import uuid
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
        self.strategies: Dict[str, Any] = {}
        self.orders: Dict[str, Any] = {}
        self.positions: Dict[str, Any] = {}
        self.adapter_states: Dict[str, str] = {}  # id -> status
        self.risk_limits: Dict[str, float] = {
            "max_order_size": 10000.0,
            "max_position_size": 50000.0,
            "max_daily_loss": 5000.0,
            "max_positions": 10,
        }
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
        """Get available adapters with current connection state"""
        adapter_defs = [
            {
                "id": "binance",
                "name": "Binance",
                "type": "exchange",
                "venue": "BINANCE",
                "description": "Binance cryptocurrency exchange",
                "capabilities": ["market_data", "execution", "account"],
            },
            {
                "id": "interactive_brokers",
                "name": "Interactive Brokers",
                "type": "broker",
                "venue": "IB",
                "description": "Interactive Brokers multi-asset broker",
                "capabilities": ["market_data", "execution", "account"],
            },
            {
                "id": "coinbase",
                "name": "Coinbase Advanced",
                "type": "exchange",
                "venue": "COINBASE",
                "description": "Coinbase Advanced Trade API",
                "capabilities": ["market_data", "execution", "account"],
            },
            {
                "id": "kraken",
                "name": "Kraken",
                "type": "exchange",
                "venue": "KRAKEN",
                "description": "Kraken cryptocurrency exchange",
                "capabilities": ["market_data", "execution"],
            },
        ]

        result = []
        for adapter in adapter_defs:
            status = self.adapter_states.get(adapter["id"], "disconnected")
            result.append({
                **adapter,
                "status": status,
                "last_connected": None,
            })
        return result

    def connect_adapter(self, adapter_id: str) -> Dict[str, Any]:
        """Connect an adapter"""
        adapters = {a["id"] for a in self.get_adapters()}
        if adapter_id not in adapters:
            return {"success": False, "message": f"Adapter '{adapter_id}' not found"}

        self.adapter_states[adapter_id] = "connected"
        return {
            "success": True,
            "message": f"Adapter {adapter_id} connected",
            "status": "connected"
        }

    def disconnect_adapter(self, adapter_id: str) -> Dict[str, Any]:
        """Disconnect an adapter"""
        self.adapter_states[adapter_id] = "disconnected"
        return {
            "success": True,
            "message": f"Adapter {adapter_id} disconnected",
            "status": "disconnected"
        }

    def get_strategies(self) -> List[Dict[str, Any]]:
        """Get loaded strategies"""
        return [
            {
                "id": sid,
                "name": info.get("name", sid),
                "type": info.get("type", "unknown"),
                "status": info.get("status", "stopped"),
                "description": info.get("description", ""),
                "config": info.get("config", {}),
                "performance": info.get("performance", {
                    "total_pnl": 0.0,
                    "total_trades": 0,
                    "win_rate": 0.0
                })
            }
            for sid, info in self.strategies.items()
        ]

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

    def delete_strategy(self, strategy_id: str) -> Dict[str, Any]:
        """Delete a strategy"""
        if strategy_id not in self.strategies:
            return {"success": False, "message": f"Strategy {strategy_id} not found"}

        # Stop before deleting if running
        if self.strategies[strategy_id].get("status") == "running":
            self.stop_strategy(strategy_id)

        del self.strategies[strategy_id]
        return {"success": True, "message": f"Strategy {strategy_id} deleted"}

    def start_strategy(self, strategy_id: str) -> Dict[str, Any]:
        """Start a strategy"""
        if strategy_id not in self.strategies:
            return {"success": False, "message": f"Strategy {strategy_id} not found"}

        if not self.is_running:
            return {"success": False, "message": "Engine not running. Initialize engine first."}

        self.strategies[strategy_id]["status"] = "running"
        self.strategies[strategy_id]["started_at"] = datetime.utcnow().isoformat()

        return {"success": True, "message": f"Strategy {strategy_id} started"}

    def stop_strategy(self, strategy_id: str) -> Dict[str, Any]:
        """Stop a strategy"""
        if strategy_id not in self.strategies:
            return {"success": False, "message": f"Strategy {strategy_id} not found"}

        self.strategies[strategy_id]["status"] = "stopped"
        self.strategies[strategy_id]["stopped_at"] = datetime.utcnow().isoformat()

        return {"success": True, "message": f"Strategy {strategy_id} stopped"}

    # ---------- Orders ----------

    def get_orders(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get orders, optionally filtered by status"""
        orders = list(self.orders.values())
        if status:
            orders = [o for o in orders if o["status"].upper() == status.upper()]
        return sorted(orders, key=lambda o: o["timestamp"], reverse=True)

    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Get a single order by ID"""
        return self.orders.get(order_id)

    def create_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new simulated order"""
        order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        order = {
            "id": order_id,
            "instrument": order_data.get("instrument", "BTCUSDT"),
            "side": order_data.get("side", "BUY").upper(),
            "type": order_data.get("type", "LIMIT").upper(),
            "quantity": float(order_data.get("quantity", 0)),
            "price": float(order_data.get("price", 0)) if order_data.get("price") else None,
            "status": "PENDING",
            "filled_qty": 0.0,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self.orders[order_id] = order

        # Auto-fill MARKET orders immediately
        if order["type"] == "MARKET":
            self._fill_order(order_id)

        return {"success": True, "message": "Order created", "order_id": order_id, "order": self.orders[order_id]}

    def _fill_order(self, order_id: str) -> None:
        """Simulate filling an order and create a position"""
        order = self.orders.get(order_id)
        if not order:
            return

        order["status"] = "FILLED"
        order["filled_qty"] = order["quantity"]

        # Create/update a position
        instrument = order["instrument"]
        pos_id = f"POS-{instrument}-{order['side']}"

        fill_price = order.get("price") or 50000.0  # Default fill price for simulation

        if order["side"] == "BUY":
            side = "LONG"
        else:
            side = "SHORT"

        if pos_id not in self.positions:
            self.positions[pos_id] = {
                "id": pos_id,
                "instrument": instrument,
                "side": side,
                "quantity": order["quantity"],
                "entry_price": fill_price,
                "current_price": fill_price,
                "unrealized_pnl": 0.0,
                "realized_pnl": 0.0,
                "timestamp": datetime.utcnow().isoformat(),
                "is_open": True,
            }
        else:
            pos = self.positions[pos_id]
            # Simple position update - average in
            total_qty = pos["quantity"] + order["quantity"]
            pos["entry_price"] = (pos["entry_price"] * pos["quantity"] + fill_price * order["quantity"]) / total_qty
            pos["quantity"] = total_qty

    def cancel_order(self, order_id: str) -> Dict[str, Any]:
        """Cancel an order"""
        order = self.orders.get(order_id)
        if not order:
            return {"success": False, "message": f"Order {order_id} not found"}

        if order["status"] in ("FILLED", "CANCELLED"):
            return {"success": False, "message": f"Cannot cancel order with status {order['status']}"}

        order["status"] = "CANCELLED"
        return {"success": True, "message": f"Order {order_id} cancelled"}

    # ---------- Positions ----------

    def get_positions(self) -> List[Dict[str, Any]]:
        """Get all open positions"""
        return [p for p in self.positions.values() if p.get("is_open", True)]

    def get_position(self, position_id: str) -> Optional[Dict[str, Any]]:
        """Get a single position by ID"""
        return self.positions.get(position_id)

    def close_position(self, position_id: str) -> Dict[str, Any]:
        """Close a position"""
        pos = self.positions.get(position_id)
        if not pos:
            return {"success": False, "message": f"Position {position_id} not found"}

        if not pos.get("is_open", True):
            return {"success": False, "message": "Position is already closed"}

        # Simulate closing: realize P&L from unrealized
        pos["realized_pnl"] += pos.get("unrealized_pnl", 0.0)
        pos["unrealized_pnl"] = 0.0
        pos["is_open"] = False
        pos["closed_at"] = datetime.utcnow().isoformat()

        return {"success": True, "message": f"Position {position_id} closed", "realized_pnl": pos["realized_pnl"]}

    # ---------- Trades ----------

    def get_trades(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get trade history from filled orders"""
        filled = [o for o in self.orders.values() if o["status"] == "FILLED"]
        filled_sorted = sorted(filled, key=lambda o: o["timestamp"], reverse=True)
        return filled_sorted[:limit]

    # ---------- Risk ----------

    def get_risk_metrics(self) -> Dict[str, Any]:
        """Calculate risk metrics from current positions"""
        open_positions = self.get_positions()
        total_exposure = sum(
            p["quantity"] * p.get("current_price", p["entry_price"])
            for p in open_positions
        )
        total_unrealized_pnl = sum(p.get("unrealized_pnl", 0.0) for p in open_positions)

        # Calculate max drawdown from realized P&L
        realized_pnls = [p.get("realized_pnl", 0.0) for p in self.positions.values()]
        max_drawdown = abs(min(realized_pnls, default=0.0))

        # Simple VaR approximation (1% of exposure)
        var_1d = total_exposure * 0.01

        balance = 100000.0  # Default starting balance
        margin_used = total_exposure * 0.1  # 10% margin requirement
        margin_available = max(0.0, balance - margin_used)

        return {
            "total_exposure": round(total_exposure, 2),
            "margin_used": round(margin_used, 2),
            "margin_available": round(margin_available, 2),
            "max_drawdown": round(max_drawdown, 4),
            "var_1d": round(var_1d, 2),
            "position_count": len(open_positions),
            "total_unrealized_pnl": round(total_unrealized_pnl, 2),
        }

    def get_risk_limits(self) -> Dict[str, Any]:
        """Get current risk limits"""
        return dict(self.risk_limits)

    def update_risk_limits(self, limits: Dict[str, float]) -> Dict[str, Any]:
        """Update risk limits"""
        self.risk_limits.update(limits)
        return {"success": True, "message": "Risk limits updated", "limits": self.risk_limits}

    # ---------- Account ----------

    def get_account_info(self) -> Dict[str, Any]:
        """Get account information"""
        if not self.engine:
            return {
                "status": "not_initialized",
                "balance": 0.0,
                "currency": "USD"
            }

        metrics = self.get_risk_metrics()
        return {
            "status": "initialized",
            "balance": 100000.0,
            "currency": "USD",
            "margin_used": metrics["margin_used"],
            "margin_available": metrics["margin_available"],
            "unrealized_pnl": metrics["total_unrealized_pnl"],
        }

    def shutdown(self) -> Dict[str, Any]:
        """Shutdown the engine"""
        try:
            if self.engine:
                for strategy_id in list(self.strategies.keys()):
                    self.stop_strategy(strategy_id)

                self.is_running = False
                self.engine = None

            return {"success": True, "message": "Engine shutdown successfully"}
        except Exception as e:
            return {"success": False, "message": f"Failed to shutdown: {str(e)}"}


# Global instance
nautilus_manager = NautilusManager()
