"""
Nautilus Trader Strategies Module
Contains real trading strategies for the web interface.
"""

from .sma_crossover import SMACrossoverStrategy, SMACrossoverConfig
from .ema_crossover import EMACrossoverStrategy, EMACrossoverConfig
from .bollinger_bands import BollingerBandsStrategy, BollingerBandsConfig
from .vwap_strategy import VWAPStrategy, VWAPStrategyConfig

__all__ = [
    "SMACrossoverStrategy",
    "SMACrossoverConfig",
    "EMACrossoverStrategy",
    "EMACrossoverConfig",
    "BollingerBandsStrategy",
    "BollingerBandsConfig",
    "VWAPStrategy",
    "VWAPStrategyConfig",
]

