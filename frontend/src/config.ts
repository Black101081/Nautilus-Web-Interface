// API Configuration
// Uses environment variables (VITE_*) with sensible defaults for local development

export const API_CONFIG = {
  NAUTILUS_API_URL: import.meta.env.VITE_NAUTILUS_API_URL || 'http://localhost:8000',
  ADMIN_DB_API_URL: import.meta.env.VITE_ADMIN_DB_API_URL || 'http://localhost:8001',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8000',
  TIMEOUT: 30000, // 30 seconds (backtest can take time)
};

export async function loadApiConfig(): Promise<void> {
  console.log('✅ API config loaded');
  console.log('Nautilus API:', API_CONFIG.NAUTILUS_API_URL);
  console.log('Admin DB API:', API_CONFIG.ADMIN_DB_API_URL);
}

export default API_CONFIG;

