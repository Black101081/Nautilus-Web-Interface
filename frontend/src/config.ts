// API Configuration
// Fetches API URLs from database on startup

// Default fallback URLs (will be replaced by database values)
let NAUTILUS_API_URL = '';
let ADMIN_DB_API_URL = 'https://8001-izgd9v56smwjcue9xjn05-99f39a2a.manusvm.computer';

// Flag to track if config has been loaded
let configLoaded = false;

/**
 * Load API configuration from database
 * This should be called once when the app starts
 */
export async function loadApiConfig(): Promise<void> {
  if (configLoaded) return;
  
  try {
    // Fetch endpoints from admin DB API
    const response = await fetch(`${ADMIN_DB_API_URL}/api/admin/endpoints`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      const data = await response.json();
      const endpoints = data.endpoints || [];
      
      // Update URLs from database
      endpoints.forEach((endpoint: any) => {
        if (endpoint.name === 'nautilus_api') {
          NAUTILUS_API_URL = endpoint.url;
        } else if (endpoint.name === 'admin_db_api') {
          ADMIN_DB_API_URL = endpoint.url;
        }
      });
      
      configLoaded = true;
      console.log('✅ API config loaded from database');
    } else {
      console.warn('⚠️ Failed to load API config from database, using defaults');
    }
  } catch (error) {
    console.warn('⚠️ Error loading API config:', error);
  }
}

export const API_CONFIG = {
  get NAUTILUS_API_URL() {
    return import.meta.env.VITE_NAUTILUS_API_URL || NAUTILUS_API_URL;
  },
  
  get ADMIN_DB_API_URL() {
    return import.meta.env.VITE_ADMIN_DB_API_URL || ADMIN_DB_API_URL;
  },
  
  // Force mock API mode when no backend available
  get USE_MOCK_API() {
    return import.meta.env.VITE_USE_MOCK_API === 'true' || !this.NAUTILUS_API_URL;
  },
  
  // API timeout
  TIMEOUT: 5000, // 5 seconds
};

export default API_CONFIG;

