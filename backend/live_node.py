"""
NautilusLiveNode — TradingNode wrapper for FastAPI integration.

Architecture:
  - TradingNode runs as an asyncio.Task in the SAME event loop as FastAPI
    (via node.run_async()), so cache/portfolio reads are safe and lock-free.
  - Adapters: Binance Spot and Bybit Spot/Linear supported.
  - Strategies: All registered strategies are loaded into the Trader at build
    time.  Stop/start individual strategies on the running Trader is supported.
    Adding a NEW strategy after build requires a node rebuild (brief reconnect).
  - Events: order fills, position changes, account updates are detected by a
    background polling task that syncs to SQLite and pushes to WebSocket.

Lifecycle:
  1. connect(adapter_type, key, secret) → build + run_async()
  2. start_strategy(id) / stop_strategy(id) → Trader.start/stop_strategy()
  3. create_strategy(id, instance) → rebuild node with new strategy
  4. disconnect(adapter_type) → stop node (or rebuild without that adapter)
  5. get_portfolio_summary() / get_open_positions() → read from node.cache
"""

import asyncio
import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Nautilus imports ──────────────────────────────────────────────────────────

from nautilus_trader.live.node import TradingNode
from nautilus_trader.live.config import (
    TradingNodeConfig,
    LiveDataEngineConfig,
    LiveExecEngineConfig,
    LiveRiskEngineConfig,
)
from nautilus_trader.adapters.binance.config import (
    BinanceDataClientConfig,
    BinanceExecClientConfig,
)
from nautilus_trader.adapters.binance.common.enums import BinanceAccountType
from nautilus_trader.adapters.binance.factories import (
    BinanceLiveDataClientFactory,
    BinanceLiveExecClientFactory,
)
from nautilus_trader.adapters.bybit.config import (
    BybitDataClientConfig,
    BybitExecClientConfig,
)
from nautilus_trader.adapters.bybit.factories import (
    BybitLiveDataClientFactory,
    BybitLiveExecClientFactory,
)
from nautilus_trader.common.config import InstrumentProviderConfig, LoggingConfig
from nautilus_trader.model.identifiers import TraderId, InstrumentId
from nautilus_trader.trading.strategy import Strategy


# ── NautilusLiveNode ──────────────────────────────────────────────────────────

class NautilusLiveNode:
    """
    Singleton that manages a NautilusTrader TradingNode for live trading.

    Shares the FastAPI event loop via run_async(), so all cache/portfolio
    reads can be done directly without cross-thread locking.
    """

    def __init__(self) -> None:
        self._node: Optional[TradingNode] = None
        self._node_task: Optional[asyncio.Task] = None
        # adapter_id → {api_key, api_secret, testnet, type}
        self._adapter_cfgs: Dict[str, Dict[str, Any]] = {}
        # strategy_id → Strategy instance
        self._strategies: Dict[str, Strategy] = {}
        self._is_running: bool = False
        # Background sync task
        self._sync_task: Optional[asyncio.Task] = None
        # Last known order states for change detection
        self._last_order_status: Dict[str, str] = {}

    # ── Public connection API ─────────────────────────────────────────────────

    async def connect(
        self,
        adapter_type: str,
        api_key: str,
        api_secret: str,
        testnet: bool = False,
    ) -> Dict[str, Any]:
        """
        Connect an exchange adapter and (re)build the TradingNode.

        adapter_type: 'binance', 'binance_futures', 'bybit'
        """
        self._adapter_cfgs[adapter_type] = {
            "api_key": api_key,
            "api_secret": api_secret,
            "testnet": testnet,
        }
        try:
            await self._rebuild_node()
        except Exception as exc:
            logger.error("TradingNode build failed: %s", exc)
            raise
        return {"success": True, "adapter": adapter_type, "node_running": self._is_running}

    async def disconnect(self, adapter_type: str) -> None:
        """Disconnect an adapter, stopping the node if no adapters remain."""
        self._adapter_cfgs.pop(adapter_type, None)
        if self._adapter_cfgs:
            try:
                await self._rebuild_node()
            except Exception as exc:
                logger.warning("Node rebuild on disconnect failed: %s", exc)
        else:
            await self._stop_node()

    def is_connected(self) -> bool:
        """True when a TradingNode is live and running."""
        return self._is_running and self._node is not None

    def is_adapter_connected(self, adapter_type: str) -> bool:
        return adapter_type in self._adapter_cfgs and self._is_running

    # ── Strategy management ───────────────────────────────────────────────────

    def register_strategy(self, strategy_id: str, strategy: Strategy) -> None:
        """
        Register a strategy instance.  If the node is NOT yet running, the
        strategy will be added at next build.  If the node IS running, a
        rebuild is required — call rebuild_with_new_strategy() instead.
        """
        self._strategies[strategy_id] = strategy

    def unregister_strategy(self, strategy_id: str) -> None:
        """Remove a strategy registration.  Does not stop a live strategy."""
        self._strategies.pop(strategy_id, None)

    async def rebuild_with_new_strategy(self, strategy_id: str, strategy: Strategy) -> None:
        """
        Register + rebuild the node to include a newly created strategy.
        Brief reconnection to exchange will occur.
        """
        self._strategies[strategy_id] = strategy
        if self._adapter_cfgs:
            await self._rebuild_node()

    def start_strategy(self, strategy_id: str) -> bool:
        """Start a strategy on the running Trader (must already be registered)."""
        if not self._node or not self._is_running:
            logger.warning("Cannot start strategy — node not running")
            return False
        try:
            self._node.trader.start_strategy(strategy_id)
            logger.info("Started strategy %s on TradingNode", strategy_id)
            return True
        except Exception as exc:
            logger.warning("start_strategy(%s) failed: %s", strategy_id, exc)
            return False

    def stop_strategy(self, strategy_id: str) -> bool:
        """Stop a running strategy on the Trader."""
        if not self._node or not self._is_running:
            return False
        try:
            self._node.trader.stop_strategy(strategy_id)
            logger.info("Stopped strategy %s on TradingNode", strategy_id)
            return True
        except Exception as exc:
            logger.warning("stop_strategy(%s) failed: %s", strategy_id, exc)
            return False

    def get_strategy_states(self) -> Dict[str, str]:
        """Return {strategy_id: state_str} for all registered strategies."""
        if not self._node or not self._is_running:
            return {}
        try:
            return {
                str(sid): str(state)
                for sid, state in self._node.trader.strategy_states().items()
            }
        except Exception:
            return {}

    # ── Portfolio / position access ───────────────────────────────────────────

    def get_open_positions(self) -> List[Dict[str, Any]]:
        """Return open positions from NautilusTrader cache."""
        if not self._node or not self._is_running:
            return []
        try:
            positions = self._node.cache.positions_open()
            return [self._serialize_position(p) for p in positions]
        except Exception as exc:
            logger.debug("get_open_positions error: %s", exc)
            return []

    def get_closed_positions(self) -> List[Dict[str, Any]]:
        """Return closed positions from NautilusTrader cache."""
        if not self._node or not self._is_running:
            return []
        try:
            positions = self._node.cache.positions_closed()
            return [self._serialize_position(p) for p in positions]
        except Exception as exc:
            logger.debug("get_closed_positions error: %s", exc)
            return []

    def get_portfolio_summary(self) -> Dict[str, Any]:
        """Return portfolio summary from NautilusTrader Portfolio + Cache."""
        if not self._node or not self._is_running:
            return {"node_running": False}
        try:
            accounts = self._node.cache.accounts()
            account_list = []
            for acc in accounts:
                balances = []
                for currency, balance in acc.balances().items():
                    balances.append({
                        "currency": str(currency),
                        "total": str(balance.total),
                        "free": str(balance.free),
                        "locked": str(balance.locked),
                    })
                account_list.append({
                    "id": str(acc.id),
                    "balances": balances,
                })
            open_pos = self._node.cache.positions_open()
            closed_pos = self._node.cache.positions_closed()
            # Total unrealized PnL
            total_unrealized = sum(
                float(p.unrealized_pnl(self._node.cache.quote_tick(p.instrument_id)).as_double())
                if self._node.cache.quote_tick(p.instrument_id) else 0.0
                for p in open_pos
            )
            return {
                "node_running": True,
                "accounts": account_list,
                "open_positions_count": len(open_pos),
                "closed_positions_count": len(closed_pos),
                "total_unrealized_pnl": round(total_unrealized, 4),
            }
        except Exception as exc:
            logger.debug("get_portfolio_summary error: %s", exc)
            return {"node_running": self._is_running, "error": str(exc)}

    def get_latest_quote(self, instrument_id_str: str) -> Optional[Dict[str, Any]]:
        """Return latest quote tick from DataEngine cache."""
        if not self._node or not self._is_running:
            return None
        try:
            iid = InstrumentId.from_str(instrument_id_str)
            quote = self._node.cache.quote_tick(iid)
            if quote:
                return {
                    "instrument_id": instrument_id_str,
                    "bid": float(quote.bid_price),
                    "ask": float(quote.ask_price),
                    "bid_size": float(quote.bid_size),
                    "ask_size": float(quote.ask_size),
                    "ts_event": quote.ts_event,
                }
        except Exception:
            pass
        return None

    def get_all_orders(self) -> List[Dict[str, Any]]:
        """Return all orders from NautilusTrader cache."""
        if not self._node or not self._is_running:
            return []
        try:
            orders = self._node.cache.orders()
            return [self._serialize_order(o) for o in orders]
        except Exception:
            return []

    # ── Instrument info ───────────────────────────────────────────────────────

    def get_instruments(self) -> List[Dict[str, Any]]:
        """Return all instruments loaded into the DataEngine cache."""
        if not self._node or not self._is_running:
            return []
        try:
            instruments = self._node.cache.instruments()
            return [{"id": str(i.id), "class": type(i).__name__} for i in instruments]
        except Exception:
            return []

    # ── Node status ───────────────────────────────────────────────────────────

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_running": self._is_running,
            "adapters": list(self._adapter_cfgs.keys()),
            "registered_strategies": list(self._strategies.keys()),
            "strategy_states": self.get_strategy_states(),
            "node_built": self._node is not None and getattr(self._node, "is_built", False),
        }

    # ── Internal: build / rebuild / stop ─────────────────────────────────────

    async def _rebuild_node(self) -> None:
        """Stop existing node, build fresh one with current adapters + strategies."""
        import os
        if os.getenv("NAUTILUS_DISABLE_LIVE_NODE") or os.getenv("TESTING"):
            logger.info("TradingNode disabled (NAUTILUS_DISABLE_LIVE_NODE / TESTING env var)")
            return

        await self._stop_node()

        if not self._adapter_cfgs:
            return

        data_clients: Dict[str, Any] = {}
        exec_clients: Dict[str, Any] = {}

        for adapter_id, cfg in self._adapter_cfgs.items():
            key = cfg["api_key"]
            secret = cfg["api_secret"]
            testnet = cfg.get("testnet", False)

            if adapter_id in ("binance", "binance_spot"):
                data_clients["BINANCE"] = BinanceDataClientConfig(
                    api_key=key,
                    api_secret=secret,
                    account_type=BinanceAccountType.SPOT,
                    testnet=testnet,
                    instrument_provider=InstrumentProviderConfig(load_all=True),
                )
                exec_clients["BINANCE"] = BinanceExecClientConfig(
                    api_key=key,
                    api_secret=secret,
                    account_type=BinanceAccountType.SPOT,
                    testnet=testnet,
                    instrument_provider=InstrumentProviderConfig(load_all=True),
                )

            elif adapter_id == "binance_futures":
                data_clients["BINANCE"] = BinanceDataClientConfig(
                    api_key=key,
                    api_secret=secret,
                    account_type=BinanceAccountType.USDT_FUTURE,
                    testnet=testnet,
                    instrument_provider=InstrumentProviderConfig(load_all=True),
                )
                exec_clients["BINANCE"] = BinanceExecClientConfig(
                    api_key=key,
                    api_secret=secret,
                    account_type=BinanceAccountType.USDT_FUTURE,
                    testnet=testnet,
                    instrument_provider=InstrumentProviderConfig(load_all=True),
                )

            elif adapter_id == "bybit":
                data_clients["BYBIT"] = BybitDataClientConfig(
                    api_key=key,
                    api_secret=secret,
                    testnet=testnet,
                    instrument_provider=InstrumentProviderConfig(load_all=True),
                )
                exec_clients["BYBIT"] = BybitExecClientConfig(
                    api_key=key,
                    api_secret=secret,
                    testnet=testnet,
                    instrument_provider=InstrumentProviderConfig(load_all=True),
                )

        if not data_clients:
            logger.warning("No supported adapters found — node not built")
            return

        node_config = TradingNodeConfig(
            trader_id=TraderId("TRADER-001"),
            data_clients=data_clients,
            exec_clients=exec_clients,
            data_engine=LiveDataEngineConfig(debug=False),
            exec_engine=LiveExecEngineConfig(
                reconciliation=True,
                reconciliation_lookback_mins=1440,
            ),
            risk_engine=LiveRiskEngineConfig(bypass=False),
            logging=LoggingConfig(log_level="INFO", log_colors=False),
            timeout_connection=30.0,
            timeout_reconciliation=10.0,
            timeout_portfolio=10.0,
            timeout_disconnection=10.0,
        )

        node = TradingNode(config=node_config)

        # Register adapter factories
        if "BINANCE" in data_clients:
            node.add_data_client_factory("BINANCE", BinanceLiveDataClientFactory)
            node.add_exec_client_factory("BINANCE", BinanceLiveExecClientFactory)
        if "BYBIT" in data_clients:
            node.add_data_client_factory("BYBIT", BybitLiveDataClientFactory)
            node.add_exec_client_factory("BYBIT", BybitLiveExecClientFactory)

        # Register all known strategies (they start in INITIALIZED state)
        for strategy_id, strategy in self._strategies.items():
            try:
                node.trader.add_strategy(strategy)
                logger.info("Registered strategy %s with TradingNode", strategy_id)
            except Exception as exc:
                logger.warning("Could not register strategy %s: %s", strategy_id, exc)

        # Build (wires all components)
        node.build()
        self._node = node

        # Launch as asyncio task in the current (FastAPI) event loop
        self._node_task = asyncio.create_task(
            node.run_async(), name="NautilusLiveNode"
        )
        self._node_task.add_done_callback(self._on_node_task_done)
        self._is_running = True
        logger.info(
            "TradingNode started with adapters: %s, strategies: %s",
            list(data_clients.keys()),
            list(self._strategies.keys()),
        )

        # Start background sync task
        self._sync_task = asyncio.create_task(
            self._sync_loop(), name="NautilusNodeSync"
        )

    async def _stop_node(self) -> None:
        """Gracefully stop the TradingNode and cleanup tasks."""
        if self._sync_task and not self._sync_task.done():
            self._sync_task.cancel()
            try:
                await self._sync_task
            except asyncio.CancelledError:
                pass
        self._sync_task = None

        if self._node and self._is_running:
            try:
                await asyncio.wait_for(self._node.stop_async(), timeout=15.0)
                logger.info("TradingNode stopped")
            except asyncio.TimeoutError:
                logger.warning("TradingNode stop timed out")
            except Exception as exc:
                logger.warning("TradingNode stop error: %s", exc)

        if self._node_task and not self._node_task.done():
            self._node_task.cancel()
            try:
                await self._node_task
            except asyncio.CancelledError:
                pass

        self._node = None
        self._node_task = None
        self._is_running = False
        self._last_order_status.clear()

    def _on_node_task_done(self, task: asyncio.Task) -> None:
        """Callback when node task ends (cancelled or exception)."""
        self._is_running = False
        if not task.cancelled() and task.exception():
            logger.error("TradingNode task ended with exception: %s", task.exception())
        else:
            logger.info("TradingNode task ended")

    # ── Background sync loop ──────────────────────────────────────────────────

    async def _sync_loop(self) -> None:
        """
        Background task that detects order/position changes in the
        NautilusTrader cache and syncs them to SQLite.
        Runs in the FastAPI event loop — reads are safe (same loop).
        """
        import database

        while self._is_running:
            try:
                await asyncio.sleep(1.0)
                if not self._node or not self._is_running:
                    continue

                # ── Sync orders ───────────────────────────────────────────────
                try:
                    orders = self._node.cache.orders()
                    for order in orders:
                        cid = str(order.client_order_id)
                        status_str = str(order.status).lower()
                        if self._last_order_status.get(cid) == status_str:
                            continue
                        self._last_order_status[cid] = status_str

                        # Map Nautilus status to DB status
                        db_status = _map_order_status(status_str)
                        venue_order_id = (
                            str(order.venue_order_id) if order.venue_order_id else None
                        )

                        # Upsert into DB (client_order_id as external key)
                        await database.upsert_order_by_client_id(
                            client_order_id=cid,
                            instrument=str(order.instrument_id),
                            side=str(order.side).split(".")[-1].upper(),
                            order_type=str(order.order_type).split(".")[-1].upper(),
                            quantity=float(order.quantity),
                            price=float(order.price) if hasattr(order, "price") and order.price else None,
                            status=db_status,
                            exchange_order_id=venue_order_id,
                            filled_qty=float(order.filled_qty) if hasattr(order, "filled_qty") else 0.0,
                            avg_px=float(order.avg_px) if hasattr(order, "avg_px") and order.avg_px else None,
                            source="live_node",
                        )
                except Exception as exc:
                    logger.debug("Order sync error: %s", exc)

                # ── Sync positions ────────────────────────────────────────────
                try:
                    for pos in self._node.cache.positions_open():
                        await database.upsert_position_by_id(
                            position_id=str(pos.id),
                            instrument=str(pos.instrument_id),
                            side="LONG" if pos.is_long else "SHORT",
                            quantity=float(pos.quantity),
                            entry_price=float(pos.avg_px_open),
                            is_open=True,
                            source="live_node",
                        )
                    for pos in self._node.cache.positions_closed():
                        await database.upsert_position_by_id(
                            position_id=str(pos.id),
                            instrument=str(pos.instrument_id),
                            side="LONG" if pos.is_long else "SHORT",
                            quantity=float(pos.quantity),
                            entry_price=float(pos.avg_px_open),
                            exit_price=float(pos.avg_px_close) if pos.avg_px_close else None,
                            realized_pnl=float(pos.realized_pnl) if pos.realized_pnl else 0.0,
                            is_open=False,
                            source="live_node",
                        )
                except Exception as exc:
                    logger.debug("Position sync error: %s", exc)

            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Sync loop error: %s", exc)

    # ── Serialization helpers ─────────────────────────────────────────────────

    @staticmethod
    def _serialize_position(pos: Any) -> Dict[str, Any]:
        try:
            return {
                "id": str(pos.id),
                "instrument": str(pos.instrument_id),
                "side": "LONG" if pos.is_long else "SHORT",
                "quantity": str(pos.quantity),
                "avg_open_price": str(pos.avg_px_open),
                "avg_close_price": str(pos.avg_px_close) if pos.avg_px_close else None,
                "realized_pnl": str(pos.realized_pnl) if pos.realized_pnl else "0",
                "is_open": pos.is_open,
                "opened_at": pos.ts_opened,
                "closed_at": pos.ts_closed if pos.ts_closed else None,
                "source": "live_node",
            }
        except Exception as exc:
            return {"error": str(exc)}

    @staticmethod
    def _serialize_order(order: Any) -> Dict[str, Any]:
        try:
            return {
                "client_order_id": str(order.client_order_id),
                "venue_order_id": str(order.venue_order_id) if order.venue_order_id else None,
                "instrument": str(order.instrument_id),
                "side": str(order.side).split(".")[-1].upper(),
                "type": str(order.order_type).split(".")[-1].upper(),
                "quantity": str(order.quantity),
                "filled_qty": str(order.filled_qty) if hasattr(order, "filled_qty") else "0",
                "status": str(order.status).split(".")[-1].lower(),
                "source": "live_node",
            }
        except Exception as exc:
            return {"error": str(exc)}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _map_order_status(nautilus_status: str) -> str:
    """Map NautilusTrader order status string to DB status string."""
    _MAP = {
        "initialized": "PENDING",
        "submitted": "PENDING",
        "pending_submit": "PENDING",
        "accepted": "OPEN",
        "pending_update": "OPEN",
        "partially_filled": "partial",
        "filled": "filled",
        "pending_cancel": "OPEN",
        "canceled": "CANCELLED",
        "cancelled": "CANCELLED",
        "rejected": "rejected",
        "expired": "CANCELLED",
        "triggered": "OPEN",
    }
    for key, val in _MAP.items():
        if key in nautilus_status:
            return val
    return nautilus_status


def build_live_strategy(strategy_type: str, strategy_id: str, config: Dict[str, Any]) -> Optional[Strategy]:
    """
    Construct a NautilusTrader Strategy instance from strategy type + config dict.

    Returns None if the strategy type is unsupported.
    """
    from strategies.sma_crossover import SMACrossoverStrategy, SMACrossoverConfig
    from strategies.rsi_strategy import RSIStrategy, RSIStrategyConfig
    from strategies.macd_strategy import MACDStrategy, MACDStrategyConfig

    instrument_id = config.get("instrument_id", "BTCUSDT.BINANCE")
    bar_type = config.get("bar_type", f"{instrument_id}-1-MINUTE-LAST-EXTERNAL")
    trade_size = Decimal(str(config.get("trade_size", "0.001")))

    try:
        if strategy_type == "sma_crossover":
            cfg = SMACrossoverConfig(
                strategy_id=strategy_id,
                instrument_id=instrument_id,
                bar_type=bar_type,
                fast_period=int(config.get("fast_period", 10)),
                slow_period=int(config.get("slow_period", 20)),
                trade_size=trade_size,
            )
            return SMACrossoverStrategy(config=cfg)

        elif strategy_type == "rsi":
            cfg = RSIStrategyConfig(
                strategy_id=strategy_id,
                instrument_id=instrument_id,
                bar_type=bar_type,
                rsi_period=int(config.get("rsi_period", 14)),
                oversold_level=float(config.get("oversold_level", 30.0)),
                overbought_level=float(config.get("overbought_level", 70.0)),
                trade_size=trade_size,
            )
            return RSIStrategy(config=cfg)

        elif strategy_type == "macd":
            cfg = MACDStrategyConfig(
                strategy_id=strategy_id,
                instrument_id=instrument_id,
                bar_type=bar_type,
                fast_period=int(config.get("fast_period", 12)),
                slow_period=int(config.get("slow_period", 26)),
                signal_period=int(config.get("signal_period", 9)),
                trade_size=trade_size,
            )
            return MACDStrategy(config=cfg)

    except Exception as exc:
        logger.error("Failed to build strategy %s (%s): %s", strategy_id, strategy_type, exc)

    return None


# ── Module-level singleton ────────────────────────────────────────────────────

live_node = NautilusLiveNode()
