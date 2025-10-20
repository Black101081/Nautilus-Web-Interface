/**
 * Database Service - Connects to Nautilus Trader API
 * Handles all database-related operations
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
}

class DatabaseService {
  private async callApi(endpoint: string, method: string = 'GET'): Promise<ApiResponse> {
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
      return {
        success: false,
        message: `Failed to connect to API: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // PostgreSQL operations
  async optimizePostgreSQL(): Promise<ApiResponse> {
    return this.callApi('/api/nautilus/database/optimize-postgresql', 'POST');
  }

  async backupPostgreSQL(): Promise<ApiResponse> {
    return this.callApi('/api/nautilus/database/backup-postgresql', 'POST');
  }

  // Parquet operations
  async exportParquet(): Promise<ApiResponse> {
    return this.callApi('/api/nautilus/database/export-parquet', 'POST');
  }

  async cleanParquet(): Promise<ApiResponse> {
    return this.callApi('/api/nautilus/database/clean-parquet', 'POST');
  }

  // Redis operations
  async flushRedis(): Promise<ApiResponse> {
    return this.callApi('/api/nautilus/database/flush-redis', 'POST');
  }

  async getRedisStats(): Promise<ApiResponse> {
    return this.callApi('/api/nautilus/database/redis-stats', 'GET');
  }

  // Table operations (mock for now, can be implemented later)
  async viewTable(tableName: string): Promise<ApiResponse> {
    return {
      success: true,
      message: `Opening ${tableName} table viewer`,
      data: { table: tableName },
    };
  }

  // Maintenance operations
  async fullBackup(): Promise<ApiResponse> {
    return this.callApi('/api/nautilus/database/backup-postgresql', 'POST');
  }

  async optimizeAll(): Promise<ApiResponse> {
    return this.callApi('/api/nautilus/database/optimize-postgresql', 'POST');
  }

  async exportData(): Promise<ApiResponse> {
    return this.callApi('/api/nautilus/database/export-parquet', 'POST');
  }

  async viewLogs(): Promise<ApiResponse> {
    return {
      success: true,
      message: 'Opening database logs',
      data: { logs: [] },
    };
  }
}

export const databaseService = new DatabaseService();

