// API Configuration
// Hardcoded URLs for testing (will be replaced with database loading later)

export const API_CONFIG = {
  NAUTILUS_API_URL: 'https://8003-izgd9v56smwjcue9xjn05-99f39a2a.manusvm.computer',
  ADMIN_DB_API_URL: 'https://8001-izgd9v56smwjcue9xjn05-99f39a2a.manusvm.computer',
  TIMEOUT: 30000, // 30 seconds (backtest can take time)
};

// Dummy function for compatibility
export async function loadApiConfig(): Promise<void> {
  console.log('✅ API config loaded (hardcoded)');
  console.log('Nautilus API:', API_CONFIG.NAUTILUS_API_URL);
  console.log('Admin DB API:', API_CONFIG.ADMIN_DB_API_URL);
}

export default API_CONFIG;

