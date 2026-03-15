// API Configuration
// Uses environment variables (VITE_*) with sensible defaults for local development

export const API_CONFIG = {
  NAUTILUS_API_URL: import.meta.env.VITE_NAUTILUS_API_URL || 'http://localhost:8000',
  ADMIN_DB_API_URL: import.meta.env.VITE_ADMIN_DB_API_URL || 'http://localhost:8001',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8000',
  TIMEOUT: 30000, // 30 seconds (backtest can take time)
};

export async function loadApiConfig(): Promise<void> {
  // no-op: config is resolved from environment variables at build time
}

export default API_CONFIG;

