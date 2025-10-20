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

export const nautilusService = {
  // Health check
  async healthCheck() {
    return api.get<{ status: string; message: string }>('/api/health');
  },

  // Engine info
  async getEngineInfo() {
    return api.get<EngineInfo>('/api/engine/info');
  },

  // Instruments
  async getInstruments() {
    return api.get<Instrument[]>('/api/instruments');
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

