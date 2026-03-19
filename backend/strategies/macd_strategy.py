"""
MACD (Moving Average Convergence Divergence) Strategy — Sprint 3 (S3-02).

Entry signals:
  - BUY  when MACD line crosses above signal line (bullish crossover)
  - SELL when MACD line crosses below signal line (bearish crossover)
"""

from decimal import Decimal

from nautilus_trader.config import StrategyConfig
from nautilus_trader.indicators.macd import MovingAverageConvergenceDivergence
from nautilus_trader.model.data import Bar
from nautilus_trader.model.enums import OrderSide
from nautilus_trader.trading.strategy import Strategy


class MACDStrategyConfig(StrategyConfig, frozen=True):
    instrument_id: str = "EUR/USD.SIM"
    bar_type: str = "EUR/USD.SIM-1-MINUTE-BID-INTERNAL"
    fast_period: int = 12
    slow_period: int = 26
    signal_period: int = 9
    trade_size: Decimal = Decimal("100000")


class MACDStrategy(Strategy):
    """MACD crossover strategy for Nautilus Trader."""

    def __init__(self, config: MACDStrategyConfig) -> None:
        super().__init__(config)
        self.macd = MovingAverageConvergenceDivergence(
            config.fast_period,
            config.slow_period,
            config.signal_period,
        )
        self._prev_macd: float = 0.0
        self._prev_signal: float = 0.0
        self._initialized_prev: bool = False

    def on_start(self) -> None:
        self.bar_type = self.config.bar_type
        self.instrument_id = self.config.instrument_id
        self.register_indicator_for_bars(self.bar_type, self.macd)
        self.subscribe_bars(self.bar_type)

    def on_bar(self, bar: Bar) -> None:
        if not self.macd.initialized:
            return

        macd_val = float(self.macd.value)
        signal_val = float(self.macd.signal)

        if self._initialized_prev:
            # Bullish crossover: MACD crosses above signal
            if self._prev_macd <= self._prev_signal and macd_val > signal_val:
                if not self.portfolio.is_net_long(self.instrument_id):
                    self._buy()
            # Bearish crossover: MACD crosses below signal
            elif self._prev_macd >= self._prev_signal and macd_val < signal_val:
                if not self.portfolio.is_net_short(self.instrument_id):
                    self._sell()

        self._prev_macd = macd_val
        self._prev_signal = signal_val
        self._initialized_prev = True

    def _buy(self) -> None:
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.BUY,
            quantity=self.instrument.make_qty(self.config.trade_size),
        )
        self.submit_order(order)

    def _sell(self) -> None:
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.SELL,
            quantity=self.instrument.make_qty(self.config.trade_size),
        )
        self.submit_order(order)

    def on_stop(self) -> None:
        self.close_all_positions(self.instrument_id)
