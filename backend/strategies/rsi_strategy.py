"""
RSI Mean-Reversion Strategy — Real Nautilus Trader implementation.

Buy when RSI crosses above `oversold_level` (default 30) from below.
Sell when RSI crosses below `overbought_level` (default 70) from above.
"""

from decimal import Decimal

from nautilus_trader.config import StrategyConfig
from nautilus_trader.core.data import Data
from nautilus_trader.indicators import RelativeStrengthIndex
from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.model.enums import OrderSide
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.instruments import Instrument
from nautilus_trader.trading.strategy import Strategy


class RSIStrategyConfig(StrategyConfig, frozen=True):
    instrument_id: str
    bar_type: str
    rsi_period: int = 14
    oversold_level: float = 30.0
    overbought_level: float = 70.0
    trade_size: Decimal = Decimal("100000")


class RSIStrategy(Strategy):
    """
    RSI mean-reversion strategy.

    Entry long : RSI rises through `oversold_level`  (was below, now above).
    Entry short: RSI falls through `overbought_level` (was above, now below).
    Exit       : opposite signal or on_stop().
    """

    def __init__(self, config: RSIStrategyConfig) -> None:
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self.bar_type = BarType.from_str(config.bar_type)
        self.trade_size = config.trade_size
        self.oversold = config.oversold_level
        self.overbought = config.overbought_level

        self.rsi = RelativeStrengthIndex(config.rsi_period)
        self._prev_rsi: float | None = None
        self.instrument: Instrument | None = None

    def on_start(self) -> None:
        self.instrument = self.cache.instrument(self.instrument_id)
        if self.instrument is None:
            self.log.error(f"Instrument not found: {self.instrument_id}")
            self.stop()
            return
        self.subscribe_bars(self.bar_type)
        self.log.info(
            f"RSI strategy started — period={self.rsi.period}, "
            f"oversold={self.oversold}, overbought={self.overbought}"
        )

    def on_bar(self, bar: Bar) -> None:
        self.rsi.update_raw(float(bar.close))
        if not self.rsi.initialized:
            return

        current = self.rsi.value
        prev = self._prev_rsi

        if prev is not None:
            is_flat = self.portfolio.is_flat(self.instrument_id)

            # Oversold cross-up → long signal
            if prev < self.oversold <= current:
                self._close_shorts()
                if self.portfolio.is_flat(self.instrument_id):
                    self.log.info(f"RSI {current:.1f} crossed above {self.oversold} → LONG")
                    self._buy()

            # Overbought cross-down → short signal
            elif prev > self.overbought >= current:
                self._close_longs()
                if self.portfolio.is_flat(self.instrument_id):
                    self.log.info(f"RSI {current:.1f} crossed below {self.overbought} → SHORT")
                    self._sell()

        self._prev_rsi = current

    def _close_longs(self) -> None:
        for pos in self.cache.positions_open(instrument_id=self.instrument_id):
            if pos.is_long:
                self.close_position(pos)

    def _close_shorts(self) -> None:
        for pos in self.cache.positions_open(instrument_id=self.instrument_id):
            if pos.is_short:
                self.close_position(pos)

    def _buy(self) -> None:
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.BUY,
            quantity=self.instrument.make_qty(self.trade_size),
        )
        self.submit_order(order)

    def _sell(self) -> None:
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.SELL,
            quantity=self.instrument.make_qty(self.trade_size),
        )
        self.submit_order(order)

    def on_data(self, data: Data) -> None:
        pass

    def on_stop(self) -> None:
        self.close_all_positions(self.instrument_id)
        self.unsubscribe_bars(self.bar_type)
        self.log.info("RSI strategy stopped")

    def on_reset(self) -> None:
        self.rsi.reset()
        self._prev_rsi = None
        self.log.info("RSI strategy reset")
