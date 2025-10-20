/**
 * Mock API Service
 * Provides mock data when backend APIs are not available
 * Used for demo/development purposes
 */

export const mockApi = {
  // Engine
  engine: {
    info: {
      status: "initialized",
      trader_id: "TRADER-001",
      engine_type: "BacktestEngine",
      is_running: true,
      strategies_count: 3
    },
    initialize: {
      success: true,
      message: "Backtest engine initialized",
      trader_id: "TRADER-001",
      engine_type: "BacktestEngine"
    }
  },

  // Components
  components: [
    {
      id: "data_engine",
      name: "DataEngine",
      type: "engine",
      status: "running",
      description: "Manages market data subscriptions and caching",
      config: { cache_enabled: true, cache_size_mb: 256 }
    },
    {
      id: "exec_engine",
      name: "ExecutionEngine",
      type: "engine",
      status: "running",
      description: "Manages order execution and routing",
      config: { allow_cash_positions: true, oms_type: "HEDGING" }
    },
    {
      id: "risk_engine",
      name: "RiskEngine",
      type: "engine",
      status: "running",
      description: "Pre-trade risk checks and position limits",
      config: { max_order_rate: 100, max_notional_per_order: 1000000 }
    },
    {
      id: "portfolio",
      name: "Portfolio",
      type: "portfolio",
      status: "running",
      description: "Tracks positions and account balances",
      config: { base_currency: "USD" }
    },
    {
      id: "cache",
      name: "Cache",
      type: "cache",
      status: "running",
      description: "In-memory data cache",
      config: { capacity: 10000 }
    }
  ],

  // Strategies
  strategies: [
    {
      id: "strategy_1",
      name: "Momentum Strategy",
      type: "momentum",
      status: "running",
      description: "Simple momentum-based strategy",
      performance: {
        pnl: 1250.50,
        trades: 45,
        win_rate: 62.5,
        sharpe_ratio: 1.85
      },
      config: { lookback_period: 20, threshold: 0.02 }
    },
    {
      id: "strategy_2",
      name: "Mean Reversion",
      type: "mean_reversion",
      status: "stopped",
      description: "Mean reversion strategy",
      performance: {
        pnl: -150.25,
        trades: 28,
        win_rate: 45.5,
        sharpe_ratio: 0.65
      },
      config: { window: 50, std_dev: 2 }
    },
    {
      id: "strategy_3",
      name: "Market Making",
      type: "market_making",
      status: "running",
      description: "Provides liquidity",
      performance: {
        pnl: 850.75,
        trades: 120,
        win_rate: 58.3,
        sharpe_ratio: 1.45
      },
      config: { spread: 0.001, size: 1.0 }
    }
  ],

  // Orders
  orders: [
    {
      id: "order_1",
      instrument: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      quantity: 0.001,
      price: 50000.00,
      status: "PENDING",
      filled: 0,
      timestamp: new Date().toISOString()
    },
    {
      id: "order_2",
      instrument: "ETHUSDT",
      side: "SELL",
      type: "MARKET",
      quantity: 0.05,
      price: 3000.00,
      status: "FILLED",
      filled: 0.05,
      timestamp: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: "order_3",
      instrument: "BTCUSDT",
      side: "SELL",
      type: "STOP",
      quantity: 0.002,
      price: 48000.00,
      status: "PENDING",
      filled: 0,
      timestamp: new Date(Date.now() - 7200000).toISOString()
    }
  ],

  // Positions
  positions: [
    {
      id: "pos_1",
      instrument: "BTCUSDT",
      side: "LONG",
      quantity: 0.005,
      entry_price: 49500.00,
      current_price: 50200.00,
      unrealized_pnl: 350.00,
      realized_pnl: 0,
      timestamp: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: "pos_2",
      instrument: "ETHUSDT",
      side: "SHORT",
      quantity: 0.1,
      entry_price: 3100.00,
      current_price: 3000.00,
      unrealized_pnl: 100.00,
      realized_pnl: 50.00,
      timestamp: new Date(Date.now() - 43200000).toISOString()
    },
    {
      id: "pos_3",
      instrument: "SOLUSDT",
      side: "LONG",
      quantity: 5.0,
      entry_price: 180.00,
      current_price: 185.00,
      unrealized_pnl: 250.00,
      realized_pnl: 0,
      timestamp: new Date(Date.now() - 21600000).toISOString()
    }
  ],

  // Risk Metrics
  risk: {
    metrics: {
      total_exposure: 25000.00,
      margin_used: 5000.00,
      margin_available: 95000.00,
      max_drawdown: 2.5,
      var_1d: 1250.00,
      position_count: 3
    },
    limits: {
      max_order_size: 10000.00,
      max_position_size: 50000.00,
      max_daily_loss: 5000.00,
      max_positions: 10
    }
  },

  // Adapters
  adapters: [
    {
      id: "binance",
      name: "Binance",
      type: "exchange",
      status: "connected",
      venue: "BINANCE",
      description: "Binance cryptocurrency exchange",
      capabilities: ["market_data", "execution", "account"],
      last_connected: new Date().toISOString()
    },
    {
      id: "interactive_brokers",
      name: "Interactive Brokers",
      type: "broker",
      status: "disconnected",
      venue: "INTERACTIVE_BROKERS",
      description: "Interactive Brokers brokerage",
      capabilities: ["market_data", "execution", "account"],
      last_connected: null
    }
  ]
};

/**
 * Check if we should use mock API
 * Returns true if backend APIs are not available
 */
export async function shouldUseMockApi(apiUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    return !response.ok;
  } catch (error) {
    // If fetch fails, use mock API
    return true;
  }
}

/**
 * Fetch with fallback to mock data
 */
export async function fetchWithMock<T>(
  url: string,
  mockData: T,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      console.warn(`API request failed, using mock data: ${url}`);
      return mockData;
    }
    
    return await response.json();
  } catch (error) {
    console.warn(`API request error, using mock data: ${url}`, error);
    return mockData;
  }
}

