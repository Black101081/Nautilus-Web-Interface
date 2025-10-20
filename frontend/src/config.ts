// API Configuration
// Use environment variables if available, otherwise use sandbox URLs

export const API_CONFIG = {
  // Nautilus Trader API
  NAUTILUS_API_URL: import.meta.env.VITE_API_URL || 'https://8000-izgd9v56smwjcue9xjn05-99f39a2a.manusvm.computer',
  
  // Admin Database API
  ADMIN_DB_API_URL: import.meta.env.VITE_ADMIN_DB_API_URL || 'https://8001-izgd9v56smwjcue9xjn05-99f39a2a.manusvm.computer',
  
  // API timeout
  TIMEOUT: 30000, // 30 seconds
};

export default API_CONFIG;

