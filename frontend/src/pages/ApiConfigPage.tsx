import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import { API_CONFIG } from '@/config';

interface ApiEndpoint {
  id: number;
  name: string;
  url: string;
  description: string;
  is_active: boolean;
  last_updated: string;
}

interface ApiHealth {
  endpoint: string;
  status: 'healthy' | 'unhealthy' | 'checking';
  response_time?: number;
  error?: string;
}

export default function ApiConfigPage() {
  const { success, error: showError, info } = useNotification();
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [healthStatus, setHealthStatus] = useState<Record<string, ApiHealth>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ url: '', description: '' });

  useEffect(() => {
    loadEndpoints();
  }, []);

  const loadEndpoints = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.ADMIN_DB_API_URL}/api/admin/endpoints`);
      const data = await response.json();
      setEndpoints(data.endpoints || []);
      
      // Check health of all endpoints
      data.endpoints?.forEach((ep: ApiEndpoint) => {
        checkHealth(ep);
      });
    } catch (err) {
      showError('Failed to load API endpoints');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkHealth = async (endpoint: ApiEndpoint) => {
    setHealthStatus(prev => ({
      ...prev,
      [endpoint.name]: { endpoint: endpoint.url, status: 'checking' }
    }));

    const startTime = Date.now();
    try {
      const response = await fetch(`${endpoint.url}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        setHealthStatus(prev => ({
          ...prev,
          [endpoint.name]: {
            endpoint: endpoint.url,
            status: 'healthy',
            response_time: responseTime
          }
        }));
      } else {
        setHealthStatus(prev => ({
          ...prev,
          [endpoint.name]: {
            endpoint: endpoint.url,
            status: 'unhealthy',
            error: `HTTP ${response.status}`
          }
        }));
      }
    } catch (err: any) {
      setHealthStatus(prev => ({
        ...prev,
        [endpoint.name]: {
          endpoint: endpoint.url,
          status: 'unhealthy',
          error: err.message || 'Connection failed'
        }
      }));
    }
  };

  const handleEdit = (endpoint: ApiEndpoint) => {
    setEditingId(endpoint.id);
    setEditForm({
      url: endpoint.url,
      description: endpoint.description
    });
  };

  const handleSave = async (id: number) => {
    try {
      const response = await fetch(`${API_CONFIG.ADMIN_DB_API_URL}/api/admin/endpoints/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        success('API endpoint updated successfully');
        setEditingId(null);
        loadEndpoints();
        
        // Reload page to apply new config
        info('Reloading page to apply new configuration...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showError('Failed to update endpoint');
      }
    } catch (err) {
      showError('Error updating endpoint');
      console.error(err);
    }
  };

  const handleToggleActive = async (endpoint: ApiEndpoint) => {
    try {
      const response = await fetch(`${API_CONFIG.ADMIN_DB_API_URL}/api/admin/endpoints/${endpoint.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: endpoint.url,
          description: endpoint.description,
          is_active: !endpoint.is_active
        })
      });

      if (response.ok) {
        success(`API endpoint ${!endpoint.is_active ? 'enabled' : 'disabled'}`);
        loadEndpoints();
      }
    } catch (err) {
      showError('Failed to toggle endpoint status');
    }
  };

  const handleTestAll = () => {
    info('Testing all API endpoints...');
    endpoints.forEach(ep => checkHealth(ep));
  };

  const getStatusBadge = (health: ApiHealth | undefined) => {
    if (!health) return <span className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-600">Unknown</span>;
    
    switch (health.status) {
      case 'healthy':
        return (
          <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">
            ✓ Healthy ({health.response_time}ms)
          </span>
        );
      case 'unhealthy':
        return (
          <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-700">
            ✗ Unhealthy {health.error && `(${health.error})`}
          </span>
        );
      case 'checking':
        return <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700">⏳ Checking...</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">⚙️ API Configuration</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage backend API endpoints and connections
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleTestAll} variant="outline">
                🔄 Test All
              </Button>
              <Button onClick={loadEndpoints} variant="outline">
                ↻ Refresh
              </Button>
              <Button onClick={() => window.history.back()} variant="outline">
                ← Back
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Current Configuration Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Configuration</CardTitle>
            <CardDescription>Active API endpoints in use</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-900 mb-1">Nautilus Trader API</div>
                <div className="text-xs text-blue-700 font-mono break-all">{API_CONFIG.NAUTILUS_API_URL}</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-sm font-medium text-purple-900 mb-1">Admin Database API</div>
                <div className="text-xs text-purple-700 font-mono break-all">{API_CONFIG.ADMIN_DB_API_URL}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Endpoints List */}
        <Card>
          <CardHeader>
            <CardTitle>API Endpoints</CardTitle>
            <CardDescription>Configure and manage backend API endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading endpoints...</div>
            ) : endpoints.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No endpoints configured</div>
            ) : (
              <div className="space-y-4">
                {endpoints.map(endpoint => (
                  <div key={endpoint.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{endpoint.name}</h3>
                          {getStatusBadge(healthStatus[endpoint.name])}
                          <span className={`px-2 py-1 text-xs rounded ${
                            endpoint.is_active 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {endpoint.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        {editingId === endpoint.id ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                API URL
                              </label>
                              <input
                                type="text"
                                value={editForm.url}
                                onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                                placeholder="https://api.example.com"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                              </label>
                              <input
                                type="text"
                                value={editForm.description}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md text-sm"
                                placeholder="API description"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm text-gray-600 mb-1">{endpoint.description}</div>
                            <div className="text-xs font-mono text-gray-500 break-all">{endpoint.url}</div>
                            <div className="text-xs text-gray-400 mt-2">
                              Last updated: {new Date(endpoint.last_updated).toLocaleString()}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {editingId === endpoint.id ? (
                        <>
                          <Button 
                            onClick={() => handleSave(endpoint.id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            💾 Save
                          </Button>
                          <Button 
                            onClick={() => setEditingId(null)}
                            size="sm"
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button 
                            onClick={() => handleEdit(endpoint)}
                            size="sm"
                            variant="outline"
                          >
                            ✏️ Edit
                          </Button>
                          <Button 
                            onClick={() => checkHealth(endpoint)}
                            size="sm"
                            variant="outline"
                          >
                            🔍 Test
                          </Button>
                          <Button 
                            onClick={() => handleToggleActive(endpoint)}
                            size="sm"
                            variant="outline"
                          >
                            {endpoint.is_active ? '⏸️ Disable' : '▶️ Enable'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration Tips */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>💡 Configuration Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• <strong>Nautilus API</strong>: Main trading engine API (default port 8000)</li>
              <li>• <strong>Admin DB API</strong>: Admin panel database API (default port 8001)</li>
              <li>• Changes to API URLs require page reload to take effect</li>
              <li>• Test connections before saving to ensure APIs are accessible</li>
              <li>• For production, use HTTPS URLs with valid SSL certificates</li>
              <li>• Keep timeout settings reasonable (5-10 seconds recommended)</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

