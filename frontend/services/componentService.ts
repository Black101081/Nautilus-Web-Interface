/**
 * Component Service - Connects to Nautilus Trader API
 * Handles all component-related operations
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
}

class ComponentService {
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

  // Component lifecycle operations
  async stopComponent(componentId: string): Promise<ApiResponse> {
    return this.callApi(`/api/nautilus/components/${componentId}/stop`, 'POST');
  }

  async restartComponent(componentId: string): Promise<ApiResponse> {
    return this.callApi(`/api/nautilus/components/${componentId}/restart`, 'POST');
  }

  async configureComponent(componentId: string): Promise<ApiResponse> {
    return this.callApi(`/api/nautilus/components/${componentId}/configure`, 'POST');
  }

  // Bulk operations
  async startAll(): Promise<ApiResponse> {
    return {
      success: true,
      message: 'Starting all components...',
    };
  }

  async stopAll(): Promise<ApiResponse> {
    return {
      success: true,
      message: 'Stopping all components...',
    };
  }

  async restartAll(): Promise<ApiResponse> {
    return {
      success: true,
      message: 'Restarting all components...',
    };
  }

  // Export config
  async exportConfig(): Promise<ApiResponse> {
    return {
      success: true,
      message: 'Exporting component configuration...',
      data: { file: 'components_config.json' },
    };
  }
}

export const componentService = new ComponentService();

