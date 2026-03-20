"""
Bollinger Bands Strategy - Real Nautilus Trader Strategy Implementation
Mean-reversion strategy using Bollinger Bands.
"""

from decimal import Decimal
from nautilus_trader.config import StrategyConfig
from nautilus_trader.core.data import Data
from nautilus_trader.indicators import BollingerBands
from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.model.enums import OrderSide
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.instruments import Instrument
from nautilus_trader.trading.strategy import Strategy


class BollingerBandsConfig(StrategyConfig, frozen=True):
    """Configuration for Bollinger Bands strategy."""
    instrument_id: str
    bar_type: str
    period: int = 20
    std_dev: float = 2.0
    trade_size: Decimal = Decimal("100000")


class BollingerBandsStrategy(Strategy):
    """
    Bollinger Bands mean-reversion strategy.

    BUY when price touches lower band (oversold).
    SELL when price touches upper band (overbought).
    Close on mid-band crossing.
    """

    def __init__(self, config: BollingerBandsConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self.bar_type = BarType.from_str(config.bar_type)
        self.trade_size = config.trade_size
        self.bb = BollingerBands(config.period, config.std_dev)
        self.instrument: Instrument | None = None

    def on_start(self):
        self.instrument = self.cache.instrument(self.instrument_id)
        if self.instrument is None:
            self.log.error(f"Could not find instrument for {self.instrument_id}")
            self.stop()
            return
        self.subscribe_bars(self.bar_type)
        self.log.info(f"BollingerBands started — period={self.bb.period}, std={self.bb.k}")

    def on_bar(self, bar: Bar):
        self.bb.update_raw(float(bar.close))

        if not self.bb.initialized:
            return

        close = float(bar.close)
        upper = self.bb.upper
        lower = self.bb.lower
        mid = self.bb.middle

        is_flat = self.portfolio.is_flat(self.instrument_id)
        positions = self.cache.positions_open(instrument_id=self.instrument_id)

        # Entry: price at lower band → long
        if close <= lower and is_flat:
            self.log.info(f"BB LONG: price={close:.5f} <= lower={lower:.5f}")
            self._buy()

        # Entry: price at upper band → short
        elif close >= upper and is_flat:
            self.log.info(f"BB SHORT: price={close:.5f} >= upper={upper:.5f}")
            self._sell()

        # Exit long on mid-band
        elif not is_flat:
            for pos in positions:
                if pos.is_long and close >= mid:
                    self.log.info(f"BB exit long at mid={mid:.5f}")
                    self.close_position(pos)
                elif pos.is_short and close <= mid:
                    self.log.info(f"BB exit short at mid={mid:.5f}")
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
        self.log.info("BollingerBands stopped")

    def on_reset(self):
        self.bb.reset()
