import api from '@/lib/api';

export interface EngineInfo {
  trader_id: string;
  components: {
    name: string;
    status: string;
  }[];
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
    return api.get<EngineInfo>('/api/nautilus/engine/info');
  },

  // Instruments
  async getInstruments() {
    return api.get<Instrument[]>('/api/nautilus/instruments');
  },

  // Database operations
  async backupDatabase(dbType: string) {
    return api.post<{ message: string }>('/api/nautilus/database/backup', { db_type: dbType });
  },

  async optimizeDatabase(dbType: string) {
    return api.post<{ message: string }>('/api/nautilus/database/optimize', { db_type: dbType });
  },

  async cleanCache(cacheType: string) {
    return api.post<{ message: string }>('/api/nautilus/database/clean', { cache_type: cacheType });
  },

  // Component operations
  async stopComponent(componentName: string) {
    return api.post<{ message: string }>('/api/nautilus/component/stop', { component: componentName });
  },

  async restartComponent(componentName: string) {
    return api.post<{ message: string }>('/api/nautilus/component/restart', { component: componentName });
  },

  async configureComponent(componentName: string, config: any) {
    return api.post<{ message: string }>('/api/nautilus/component/configure', { 
      component: componentName,
      config 
    });
  },
};

export default nautilusService;

