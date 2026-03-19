"""
MACD (Moving Average Convergence Divergence) Strategy — real Nautilus implementation.

Entry signals:
  - BUY  when MACD line crosses above signal line (bullish crossover)
  - SELL when MACD line crosses below signal line (bearish crossover)

Works in both Backtest (BacktestEngine) and Live (TradingNode) modes.
"""

from decimal import Decimal

from nautilus_trader.config import StrategyConfig
from nautilus_trader.indicators import MovingAverageConvergenceDivergence
from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.model.enums import OrderSide
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.instruments import Instrument
from nautilus_trader.trading.strategy import Strategy


class MACDStrategyConfig(StrategyConfig, frozen=True):
    instrument_id: str = "EUR/USD.SIM"
    bar_type: str = "EUR/USD.SIM-1-MINUTE-BID-INTERNAL"
    fast_period: int = 12
    slow_period: int = 26
    signal_period: int = 9
    trade_size: Decimal = Decimal("100000")


class MACDStrategy(Strategy):
    """MACD crossover strategy for NautilusTrader (backtest & live)."""

    def __init__(self, config: MACDStrategyConfig) -> None:
        super().__init__(config)
        self._instrument_id = InstrumentId.from_str(config.instrument_id)
        self._bar_type = BarType.from_str(config.bar_type)
        self.macd = MovingAverageConvergenceDivergence(
            config.fast_period,
            config.slow_period,
            config.signal_period,
        )
        self._prev_macd: float = 0.0
        self._prev_signal: float = 0.0
        self._initialized_prev: bool = False
        self.instrument: Instrument | None = None

    def on_start(self) -> None:
        self.instrument = self.cache.instrument(self._instrument_id)
        if self.instrument is None:
            self.log.error(f"Instrument not found: {self._instrument_id}")
            self.stop()
            return
        self.register_indicator_for_bars(self._bar_type, self.macd)
        self.subscribe_bars(self._bar_type)
        self.log.info(
            f"MACD strategy started — fast={self.config.fast_period}, "
            f"slow={self.config.slow_period}, signal={self.config.signal_period}"
        )

    def on_bar(self, bar: Bar) -> None:
        if not self.macd.initialized:
            return

        macd_val = float(self.macd.value)
        signal_val = float(self.macd.signal)

        if self._initialized_prev:
            # Bullish crossover: MACD crosses above signal
            if self._prev_macd <= self._prev_signal and macd_val > signal_val:
                if not self.portfolio.is_net_long(self._instrument_id):
                    self._close_shorts()
                    if self.portfolio.is_flat(self._instrument_id):
                        self.log.info(
                            f"MACD {macd_val:.6f} crossed above signal {signal_val:.6f} → BUY"
                        )
                        self._buy()
            # Bearish crossover: MACD crosses below signal
            elif self._prev_macd >= self._prev_signal and macd_val < signal_val:
                if not self.portfolio.is_net_short(self._instrument_id):
                    self._close_longs()
                    if self.portfolio.is_flat(self._instrument_id):
                        self.log.info(
                            f"MACD {macd_val:.6f} crossed below signal {signal_val:.6f} → SELL"
                        )
                        self._sell()

        self._prev_macd = macd_val
        self._prev_signal = signal_val
        self._initialized_prev = True

    def _close_longs(self) -> None:
        for pos in self.cache.positions_open(instrument_id=self._instrument_id):
            if pos.is_long:
                self.close_position(pos)

    def _close_shorts(self) -> None:
        for pos in self.cache.positions_open(instrument_id=self._instrument_id):
            if pos.is_short:
                self.close_position(pos)

    def _buy(self) -> None:
        order = self.order_factory.market(
            instrument_id=self._instrument_id,
            order_side=OrderSide.BUY,
            quantity=self.instrument.make_qty(self.config.trade_size),
        )
        self.submit_order(order)

    def _sell(self) -> None:
        order = self.order_factory.market(
            instrument_id=self._instrument_id,
            order_side=OrderSide.SELL,
            quantity=self.instrument.make_qty(self.config.trade_size),
        )
        self.submit_order(order)

    def on_stop(self) -> None:
        self.close_all_positions(self._instrument_id)
        self.unsubscribe_bars(self._bar_type)
        self.log.info("MACD strategy stopped")

    def on_reset(self) -> None:
        self.macd.reset()
        self._prev_macd = 0.0
        self._prev_signal = 0.0
        self._initialized_prev = False
        self.log.info("MACD strategy reset")
