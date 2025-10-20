import api from '@/lib/api';

export interface EngineInfo {
  trader_id: string;
  status: string;
  engine_type: string;
  is_running: boolean;
  strategies_count: number;
}

export interface Instrument {
  id: string;
  symbol: string;
  venue: string;
}

export interface Strategy {
  id: string;
  name: string;
  type: string;
  status: string;
  instrument?: string;
  pnl?: number;
  trades?: number;
  win_rate?: number;
  created_at?: string;
  last_backtest?: string;
}

export interface BacktestRequest {
  strategy_id: string;
  start_date: string;
  end_date: string;
  starting_balance: number;
}

export interface BacktestResult {
  strategy_id: string;
  start_date: string;
  end_date: string;
  starting_balance: number;
  ending_balance: number;
  total_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_orders: number;
  completed_at: string;
  orders: Order[];
  positions: Position[];
}

export interface Order {
  id: string;
  instrument_id: string;
  side: string;
  type: string;
  quantity: number;
  status: string;
  filled_qty: number;
  avg_px: number | null;
  ts_init: number;
}

export interface Position {
  id: string;
  instrument_id: string;
  side: string;
  quantity: number;
  avg_px_open: number;
  avg_px_close: number | null;
  realized_pnl: number;
  unrealized_pnl: number;
  is_open: boolean;
  is_closed: boolean;
  ts_opened: number;
  ts_closed: number | null;
}

export const nautilusService = {
  // Health check
  async healthCheck() {
    return api.get<{ status: string; system: any }>('/health');
  },

  // System operations
  async initialize() {
    return api.post<{ success: boolean; message: string }>('/api/nautilus/initialize', {});
  },

  async getSystemInfo() {
    return api.get<any>('/api/nautilus/system-info');
  },

  // Engine info
  async getEngineInfo() {
    return api.get<EngineInfo>('/api/engine/info');
  },

  // Instruments
  async getInstruments() {
    return api.get<Instrument[]>('/api/instruments');
  },

  // Strategy operations
  async createStrategy(config: {
    id?: string;
    name: string;
    type: string;
    instrument_id?: string;
    bar_type?: string;
    fast_period?: number;
    slow_period?: number;
    trade_size?: string;
  }) {
    return api.post<{ success: boolean; message: string; strategy_id?: string }>(
      '/api/nautilus/strategies',
      config
    );
  },

  async listStrategies() {
    return api.get<{ success: boolean; strategies: Strategy[]; count: number }>(
      '/api/nautilus/strategies'
    );
  },

  async getStrategy(strategyId: string) {
    return api.get<{ success: boolean; strategy: Strategy }>(
      `/api/nautilus/strategies/${strategyId}`
    );
  },

  // Backtest operations
  async runBacktest(request: BacktestRequest) {
    return api.post<{ success: boolean; message: string; result?: BacktestResult }>(
      '/api/nautilus/backtest',
      request
    );
  },

  async getBacktestResults(strategyId: string) {
    return api.get<{ success: boolean; results: BacktestResult }>(
      `/api/nautilus/backtest/${strategyId}`
    );
  },

  // Legacy endpoints
  async getOrders() {
    return api.get<Order[]>('/api/orders');
  },

  async getPositions() {
    return api.get<Position[]>('/api/positions');
  },

  async getRiskMetrics() {
    return api.get<{
      total_exposure: number;
      var_95: number;
      max_drawdown: number;
      sharpe_ratio: number;
      total_pnl: number;
      total_trades: number;
    }>('/api/risk/metrics');
  },

  // Database operations
  async backupDatabase(dbType: string) {
    return api.post<{ message: string }>('/api/database/backup', { db_type: dbType });
  },

  async optimizeDatabase(dbType: string) {
    return api.post<{ message: string }>('/api/database/optimize', { db_type: dbType });
  },

  async cleanCache(cacheType: string) {
    return api.post<{ message: string }>('/api/database/clean', { cache_type: cacheType });
  },

  // Component operations
  async stopComponent(componentName: string) {
    return api.post<{ message: string }>('/api/component/stop', { component: componentName });
  },

  async restartComponent(componentName: string) {
    return api.post<{ message: string }>('/api/component/restart', { component: componentName });
  },

  async configureComponent(componentName: string, config: any) {
    return api.post<{ message: string }>('/api/component/configure', { 
      component: componentName,
      config 
    });
  },
};

export default nautilusService;

