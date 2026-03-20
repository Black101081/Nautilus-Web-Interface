"""
EMA Crossover Strategy - Real Nautilus Trader Strategy Implementation
Uses exponential moving averages for trend-following signals.
"""

from decimal import Decimal
from nautilus_trader.config import StrategyConfig
from nautilus_trader.core.data import Data
from nautilus_trader.indicators import ExponentialMovingAverage
from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.model.enums import OrderSide
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.instruments import Instrument
from nautilus_trader.trading.strategy import Strategy


class EMACrossoverConfig(StrategyConfig, frozen=True):
    """Configuration for EMACrossover strategy."""
    instrument_id: str
    bar_type: str
    fast_period: int = 9
    slow_period: int = 21
    trade_size: Decimal = Decimal("100000")


class EMACrossoverStrategy(Strategy):
    """
    EMA Crossover strategy.

    BUY when fast EMA crosses above slow EMA.
    SELL when fast EMA crosses below slow EMA.
    """

    def __init__(self, config: EMACrossoverConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self.bar_type = BarType.from_str(config.bar_type)
        self.trade_size = config.trade_size
        self.fast_ema = ExponentialMovingAverage(config.fast_period)
        self.slow_ema = ExponentialMovingAverage(config.slow_period)
        self.instrument: Instrument | None = None
        self._prev_fast: float | None = None
        self._prev_slow: float | None = None

    def on_start(self):
        self.instrument = self.cache.instrument(self.instrument_id)
        if self.instrument is None:
            self.log.error(f"Could not find instrument for {self.instrument_id}")
            self.stop()
            return
        self.subscribe_bars(self.bar_type)
        self.log.info(f"EMACrossover started — fast={self.fast_ema.period}, slow={self.slow_ema.period}")

    def on_bar(self, bar: Bar):
        prev_fast = self._prev_fast
        prev_slow = self._prev_slow

        self.fast_ema.update_raw(float(bar.close))
        self.slow_ema.update_raw(float(bar.close))

        if not self.fast_ema.initialized or not self.slow_ema.initialized:
            self._prev_fast = self.fast_ema.value
            self._prev_slow = self.slow_ema.value
            return

        fast = self.fast_ema.value
        slow = self.slow_ema.value

        # Detect cross-up: bullish
        if prev_fast is not None and prev_slow is not None:
            if prev_fast <= prev_slow and fast > slow:
                if self.portfolio.is_flat(self.instrument_id):
                    self.log.info(f"EMA LONG: fast={fast:.5f} > slow={slow:.5f}")
                    self._buy()
            elif prev_fast >= prev_slow and fast < slow:
                positions = self.cache.positions_open(instrument_id=self.instrument_id)
                for pos in positions:
                    if pos.is_long:
                        self.close_position(pos)
                if self.portfolio.is_flat(self.instrument_id):
                    self.log.info(f"EMA SHORT: fast={fast:.5f} < slow={slow:.5f}")
                    self._sell()

        self._prev_fast = fast
        self._prev_slow = slow

    def _buy(self):
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.BUY,
            quantity=self.instrument.make_qty(self.trade_size),
        )
        self.submit_order(order)

    def _sell(self):
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.SELL,
            quantity=self.instrument.make_qty(self.trade_size),
        )
        self.submit_order(order)

    def on_data(self, data: Data):
        pass

    def on_stop(self):
        self.close_all_positions(self.instrument_id)
        self.unsubscribe_bars(self.bar_type)
        self.log.info("EMACrossover stopped")

    def on_reset(self):
        self.fast_ema.reset()
        self.slow_ema.reset()
        self._prev_fast = None
        self._prev_slow = None
