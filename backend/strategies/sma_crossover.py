"""
SMA Crossover Strategy - Real Nautilus Trader Strategy Implementation
A simple moving average crossover strategy for demonstration purposes.
"""

from decimal import Decimal
from nautilus_trader.config import StrategyConfig
from nautilus_trader.core.data import Data
from nautilus_trader.indicators import SimpleMovingAverage
from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.model.enums import OrderSide
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.instruments import Instrument
from nautilus_trader.model.orders import MarketOrder
from nautilus_trader.trading.strategy import Strategy


class SMACrossoverConfig(StrategyConfig, frozen=True):
    """
    Configuration for SMACrossover strategy.
    """
    instrument_id: str
    bar_type: str
    fast_period: int = 10
    slow_period: int = 20
    trade_size: Decimal = Decimal("100000")  # 1 standard lot for FX


class SMACrossoverStrategy(Strategy):
    """
    A simple SMA crossover strategy.
    
    When the fast SMA crosses above the slow SMA, go LONG.
    When the fast SMA crosses below the slow SMA, go SHORT.
    """

    def __init__(self, config: SMACrossoverConfig):
        super().__init__(config)
        
        # Configuration
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self.bar_type = BarType.from_str(config.bar_type)
        self.trade_size = config.trade_size
        
        # Create indicators
        self.fast_sma = SimpleMovingAverage(config.fast_period)
        self.slow_sma = SimpleMovingAverage(config.slow_period)
        
        # State tracking
        self.instrument: Instrument | None = None
        
    def on_start(self):
        """Actions to be performed on strategy start."""
        self.instrument = self.cache.instrument(self.instrument_id)
        if self.instrument is None:
            self.log.error(f"Could not find instrument for {self.instrument_id}")
            self.stop()
            return

        # Subscribe to bars
        self.subscribe_bars(self.bar_type)
        
        self.log.info(f"SMACrossover strategy started for {self.instrument_id}")
        self.log.info(f"Fast SMA period: {self.fast_sma.period}, Slow SMA period: {self.slow_sma.period}")

    def on_bar(self, bar: Bar):
        """
        Actions to be performed when a bar is received.
        
        Args:
            bar: The bar received.
        """
        # Update indicators
        self.fast_sma.update_raw(float(bar.close))
        self.slow_sma.update_raw(float(bar.close))
        
        # Check if indicators are initialized
        if not self.fast_sma.initialized or not self.slow_sma.initialized:
            self.log.info(
                f"Waiting for indicators to initialize... "
                f"Fast: {self.fast_sma.count}/{self.fast_sma.period}, "
                f"Slow: {self.slow_sma.count}/{self.slow_sma.period}"
            )
            return
        
        # Get indicator values
        fast_value = self.fast_sma.value
        slow_value = self.slow_sma.value
        
        self.log.info(
            f"Bar: {bar.close}, Fast SMA: {fast_value:.5f}, Slow SMA: {slow_value:.5f}"
        )
        
        # Generate trading signals
        if fast_value > slow_value:
            # Bullish signal - go LONG
            if not self.portfolio.is_flat(self.instrument_id):
                # Already have a position, check if it's SHORT
                positions = self.cache.positions_open(instrument_id=self.instrument_id)
                for position in positions:
                    if position.is_short:
                        # Close SHORT position
                        self.close_position(position)
            
            # Open LONG position if flat
            if self.portfolio.is_flat(self.instrument_id):
                self.log.info(f"🟢 LONG SIGNAL: Fast SMA ({fast_value:.5f}) > Slow SMA ({slow_value:.5f})")
                self.buy(quantity=self.trade_size)
                
        elif fast_value < slow_value:
            # Bearish signal - go SHORT
            if not self.portfolio.is_flat(self.instrument_id):
                # Already have a position, check if it's LONG
                positions = self.cache.positions_open(instrument_id=self.instrument_id)
                for position in positions:
                    if position.is_long:
                        # Close LONG position
                        self.close_position(position)
            
            # Open SHORT position if flat
            if self.portfolio.is_flat(self.instrument_id):
                self.log.info(f"🔴 SHORT SIGNAL: Fast SMA ({fast_value:.5f}) < Slow SMA ({slow_value:.5f})")
                self.sell(quantity=self.trade_size)

    def buy(self, quantity: Decimal):
        """
        Open a LONG position.
        """
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.BUY,
            quantity=self.instrument.make_qty(quantity),
        )
        self.submit_order(order)

    def sell(self, quantity: Decimal):
        """
        Open a SHORT position.
        """
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.SELL,
            quantity=self.instrument.make_qty(quantity),
        )
        self.submit_order(order)

    def on_data(self, data: Data):
        """
        Actions to be performed when generic data is received.
        """
        pass

    def on_stop(self):
        """
        Actions to be performed when the strategy is stopped.
        """
        # Close all positions
        self.close_all_positions(self.instrument_id)
        
        # Unsubscribe from data
        self.unsubscribe_bars(self.bar_type)
        
        self.log.info("SMACrossover strategy stopped")

    def on_reset(self):
        """
        Actions to be performed when the strategy is reset.
        """
        # Reset indicators
        self.fast_sma.reset()
        self.slow_sma.reset()
        
        self.log.info("SMACrossover strategy reset")

