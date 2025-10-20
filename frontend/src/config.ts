// API Configuration
// Fetches API URLs from database on startup

// Default Admin DB API URL (bootstrap URL to fetch other endpoints)
const DEFAULT_ADMIN_DB_API_URL = 'https://8001-izgd9v56smwjcue9xjn05-99f39a2a.manusvm.computer';

// Runtime URLs (will be loaded from database)
let NAUTILUS_API_URL = '';
let ADMIN_DB_API_URL = DEFAULT_ADMIN_DB_API_URL;

// Flag to track if config has been loaded
let configLoaded = false;

/**
 * Load API configuration from database
 * This should be called once when the app starts
 */
export async function loadApiConfig(): Promise<void> {
  if (configLoaded) return;
  
  try {
    console.log('🔄 Loading API config from database...');
    
    // Fetch endpoints from admin DB API
    const response = await fetch(`${ADMIN_DB_API_URL}/api/admin/endpoints`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const data = await response.json();
      const endpoints = data.endpoints || [];
      
      // Update URLs from database
      endpoints.forEach((endpoint: any) => {
        if (endpoint.name === 'nautilus_api') {
          NAUTILUS_API_URL = endpoint.url;
          console.log('✅ Nautilus API URL:', NAUTILUS_API_URL);
        } else if (endpoint.name === 'admin_db_api') {
          ADMIN_DB_API_URL = endpoint.url;
          console.log('✅ Admin DB API URL:', ADMIN_DB_API_URL);
        }
      });
      
      configLoaded = true;
      console.log('✅ API config loaded successfully');
    } else {
      console.error('❌ Failed to load API config:', response.status);
      throw new Error(`Failed to load config: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error loading API config:', error);
    throw error;
  }
}

export const API_CONFIG = {
  get NAUTILUS_API_URL() {
    return import.meta.env.VITE_NAUTILUS_API_URL || NAUTILUS_API_URL;
  },
  
  get ADMIN_DB_API_URL() {
    return import.meta.env.VITE_ADMIN_DB_API_URL || ADMIN_DB_API_URL;
  },
  
  // API timeout
  TIMEOUT: 10000, // 10 seconds
};

export default API_CONFIG;

