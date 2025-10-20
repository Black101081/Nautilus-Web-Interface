/**
 * Engine Service - Connects to Nautilus Trader API
 * Handles engine info and status operations
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ComponentStatus {
  name: string;
  status: string;
  type: string;
}

interface EngineInfo {
  trader_id: string;
  components: ComponentStatus[];
  instruments_count: number;
  accounts_count: number;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
}

class EngineService {
  private async callApi(endpoint: string, method: string = 'GET'): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API call failed: ${endpoint}`, error);
      throw error;
    }
  }

  async getEngineInfo(): Promise<EngineInfo> {
    return this.callApi('/api/nautilus/engine/info');
  }

  async getInstruments(): Promise<ApiResponse> {
    return this.callApi('/api/nautilus/instruments');
  }

  async getCacheStats(): Promise<ApiResponse> {
    return this.callApi('/api/nautilus/cache/stats');
  }

  async healthCheck(): Promise<ApiResponse> {
    return this.callApi('/api/health');
  }
}

export const engineService = new EngineService();

