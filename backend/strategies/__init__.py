"""
Nautilus Trader Strategies Module
Contains real trading strategies for the web interface.
"""

from .sma_crossover import SMACrossoverStrategy, SMACrossoverConfig

__all__ = [
    "SMACrossoverStrategy",
    "SMACrossoverConfig",
]

