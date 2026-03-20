"""
VWAP Strategy - Real Nautilus Trader Strategy Implementation
Volume-weighted average price mean-reversion / trend-following strategy.
"""

from decimal import Decimal
from nautilus_trader.config import StrategyConfig
from nautilus_trader.core.data import Data
from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.model.enums import OrderSide
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.instruments import Instrument
from nautilus_trader.trading.strategy import Strategy


class VWAPStrategyConfig(StrategyConfig, frozen=True):
    """Configuration for VWAP strategy."""
    instrument_id: str
    bar_type: str
    vwap_period: int = 20          # rolling VWAP window (bars)
    deviation_pct: float = 0.5     # % deviation from VWAP to trigger entry
    trade_size: Decimal = Decimal("100000")


class VWAPStrategy(Strategy):
    """
    Rolling VWAP strategy.

    Maintains a rolling window of (close * volume) / volume sums.
    BUY when price drops deviation_pct% below VWAP (mean-reversion entry).
    SELL when price rises deviation_pct% above VWAP.
    Exit when price returns to VWAP.
    """

    def __init__(self, config: VWAPStrategyConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self.bar_type = BarType.from_str(config.bar_type)
        self.trade_size = config.trade_size
        self.period = config.vwap_period
        self.deviation_pct = config.deviation_pct / 100.0
        self.instrument: Instrument | None = None
        self._pv_buffer: list[float] = []   # price * volume
        self._v_buffer: list[float] = []    # volume

    def on_start(self):
        self.instrument = self.cache.instrument(self.instrument_id)
        if self.instrument is None:
            self.log.error(f"Could not find instrument for {self.instrument_id}")
            self.stop()
            return
        self.subscribe_bars(self.bar_type)
        self.log.info(f"VWAPStrategy started — period={self.period}, deviation={self.deviation_pct*100:.2f}%")

    @property
    def _is_initialized(self) -> bool:
        return len(self._pv_buffer) >= self.period

    @property
    def vwap(self) -> float:
        total_v = sum(self._v_buffer)
        if total_v == 0:
            return 0.0
        return sum(self._pv_buffer) / total_v

    def on_bar(self, bar: Bar):
        close = float(bar.close)
        volume = float(bar.volume)
        if volume <= 0:
            volume = 1.0  # avoid divide-by-zero on bars without volume

        self._pv_buffer.append(close * volume)
        self._v_buffer.append(volume)

        # Keep rolling window
        if len(self._pv_buffer) > self.period:
            self._pv_buffer.pop(0)
            self._v_buffer.pop(0)

        if not self._is_initialized:
            return

        vwap = self.vwap
        if vwap == 0:
            return

        dev = (close - vwap) / vwap   # negative = below VWAP, positive = above
        is_flat = self.portfolio.is_flat(self.instrument_id)
        positions = self.cache.positions_open(instrument_id=self.instrument_id)

        # Entry: price well below VWAP → long (mean-reversion)
        if dev <= -self.deviation_pct and is_flat:
            self.log.info(f"VWAP LONG: close={close:.5f}, vwap={vwap:.5f}, dev={dev*100:.3f}%")
            self._buy()

        # Entry: price well above VWAP → short
        elif dev >= self.deviation_pct and is_flat:
            self.log.info(f"VWAP SHORT: close={close:.5f}, vwap={vwap:.5f}, dev={dev*100:.3f}%")
            self._sell()

        # Exit: price returns to VWAP band
        elif not is_flat:
            for pos in positions:
                if pos.is_long and dev >= 0.0:
                    self.log.info(f"VWAP exit long at VWAP={vwap:.5f}")
                    self.close_position(pos)
                elif pos.is_short and dev <= 0.0:
                    self.log.info(f"VWAP exit short at VWAP={vwap:.5f}")
                    self.close_position(pos)

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
        self.log.info("VWAPStrategy stopped")

    def on_reset(self):
        self._pv_buffer.clear()
        self._v_buffer.clear()
