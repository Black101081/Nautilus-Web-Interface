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

interface ApiRoute {
  id: number;
  api_endpoint_id: number;
  method: string;
  path: string;
  description: string;
  parameters: string;
  is_active: number;
  requires_auth: number;
  created_at: string;
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
  const [routes, setRoutes] = useState<Record<number, ApiRoute[]>>({});
  const [healthStatus, setHealthStatus] = useState<Record<string, ApiHealth>>({});
  const [loading, setLoading] = useState(true);
  const [selectedEndpoint, setSelectedEndpoint] = useState<number | null>(null);
  const [editingRoute, setEditingRoute] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ method: '', path: '', description: '', parameters: '{}' });
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [testingRoute, setTestingRoute] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, any>>({});

  useEffect(() => {
    loadEndpoints();
  }, []);

  const loadEndpoints = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.ADMIN_DB_API_URL}/api/admin/endpoints`);
      const data = await response.json();
      setEndpoints(data.endpoints || []);
      
      // Load routes for all endpoints
      for (const ep of data.endpoints || []) {
        await loadRoutes(ep.id);
        checkHealth(ep);
      }
    } catch (err) {
      showError('Failed to load API endpoints');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRoutes = async (endpointId: number) => {
    try {
      const response = await fetch(`${API_CONFIG.ADMIN_DB_API_URL}/api/admin/routes/by-endpoint/${endpointId}`);
      const data = await response.json();
      setRoutes(prev => ({ ...prev, [endpointId]: data.routes || [] }));
    } catch (err) {
      console.error('Failed to load routes:', err);
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

  const handleToggleRoute = async (routeId: number, currentStatus: number) => {
    try {
      const response = await fetch(`${API_CONFIG.ADMIN_DB_API_URL}/api/admin/routes/${routeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: currentStatus === 1 ? 0 : 1 })
      });

      if (response.ok) {
        success(`Route ${currentStatus === 1 ? 'disabled' : 'enabled'}`);
        if (selectedEndpoint) {
          await loadRoutes(selectedEndpoint);
        }
      }
    } catch (err) {
      showError('Failed to toggle route');
    }
  };

  const handleTestRoute = async (route: ApiRoute) => {
    setTestingRoute(route.id);
    try {
      const response = await fetch(`${API_CONFIG.ADMIN_DB_API_URL}/api/admin/routes/${route.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const result = await response.json();
      setTestResults(prev => ({ ...prev, [route.id]: result }));
      
      if (result.success) {
        success(`Route test successful (${result.response_time?.toFixed(0)}ms)`);
      } else {
        showError(`Route test failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      showError('Failed to test route');
    } finally {
      setTestingRoute(null);
    }
  };

  const handleEditRoute = (route: ApiRoute) => {
    setEditingRoute(route.id);
    setEditForm({
      method: route.method,
      path: route.path,
      description: route.description,
      parameters: route.parameters
    });
  };

  const handleSaveRoute = async (routeId: number) => {
    try {
      const response = await fetch(`${API_CONFIG.ADMIN_DB_API_URL}/api/admin/routes/${routeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        success('Route updated successfully');
        setEditingRoute(null);
        if (selectedEndpoint) {
          await loadRoutes(selectedEndpoint);
        }
      }
    } catch (err) {
      showError('Failed to update route');
    }
  };

  const handleAddRoute = async () => {
    if (!selectedEndpoint) return;
    
    try {
      const response = await fetch(`${API_CONFIG.ADMIN_DB_API_URL}/api/admin/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          api_endpoint_id: selectedEndpoint
        })
      });

      if (response.ok) {
        success('Route added successfully');
        setShowAddRoute(false);
        setEditForm({ method: 'GET', path: '', description: '', parameters: '{}' });
        await loadRoutes(selectedEndpoint);
      }
    } catch (err) {
      showError('Failed to add route');
    }
  };

  const handleDeleteRoute = async (routeId: number) => {
    if (!confirm('Are you sure you want to delete this route?')) return;
    
    try {
      const response = await fetch(`${API_CONFIG.ADMIN_DB_API_URL}/api/admin/routes/${routeId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        success('Route deleted successfully');
        if (selectedEndpoint) {
          await loadRoutes(selectedEndpoint);
        }
      }
    } catch (err) {
      showError('Failed to delete route');
    }
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      'GET': 'bg-blue-100 text-blue-700',
      'POST': 'bg-green-100 text-green-700',
      'PUT': 'bg-yellow-100 text-yellow-700',
      'DELETE': 'bg-red-100 text-red-700',
      'PATCH': 'bg-purple-100 text-purple-700'
    };
    return colors[method] || 'bg-gray-100 text-gray-700';
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
              <h1 className="text-2xl font-bold text-gray-900">⚙️ API Configuration & Routes</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage backend API endpoints and their routes
              </p>
            </div>
            <div className="flex gap-2">
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
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: API Endpoints List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>API Services</CardTitle>
                  <CardDescription>Select an API to manage routes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {endpoints.map(endpoint => (
                      <div
                        key={endpoint.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedEndpoint === endpoint.id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedEndpoint(endpoint.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-semibold text-sm">{endpoint.name}</div>
                          {getStatusBadge(healthStatus[endpoint.name])}
                        </div>
                        <div className="text-xs text-gray-600 mb-2">{endpoint.description}</div>
                        <div className="text-xs font-mono text-gray-500 break-all">{endpoint.url}</div>
                        <div className="mt-2 text-xs text-gray-500">
                          {routes[endpoint.id]?.length || 0} routes
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Routes Management */}
            <div className="lg:col-span-2">
              {selectedEndpoint ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>API Routes</CardTitle>
                        <CardDescription>
                          {endpoints.find(e => e.id === selectedEndpoint)?.name} endpoints
                        </CardDescription>
                      </div>
                      <Button 
                        onClick={() => {
                          setShowAddRoute(true);
                          setEditForm({ method: 'GET', path: '', description: '', parameters: '{}' });
                        }}
                        size="sm"
                      >
                        + Add Route
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Add Route Form */}
                    {showAddRoute && (
                      <div className="mb-6 p-4 border border-green-200 rounded-lg bg-green-50">
                        <h4 className="font-semibold mb-3">Add New Route</h4>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">Method</label>
                            <select
                              value={editForm.method}
                              onChange={(e) => setEditForm({ ...editForm, method: e.target.value })}
                              className="w-full px-3 py-2 border rounded-md text-sm"
                            >
                              <option value="GET">GET</option>
                              <option value="POST">POST</option>
                              <option value="PUT">PUT</option>
                              <option value="DELETE">DELETE</option>
                              <option value="PATCH">PATCH</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Path</label>
                            <input
                              type="text"
                              value={editForm.path}
                              onChange={(e) => setEditForm({ ...editForm, path: e.target.value })}
                              className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                              placeholder="/api/example"
                            />
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="block text-sm font-medium mb-1">Description</label>
                          <input
                            type="text"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder="Route description"
                          />
                        </div>
                        <div className="mb-3">
                          <label className="block text-sm font-medium mb-1">Parameters (JSON)</label>
                          <textarea
                            value={editForm.parameters}
                            onChange={(e) => setEditForm({ ...editForm, parameters: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md font-mono text-xs"
                            rows={3}
                            placeholder='{"param": "type"}'
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleAddRoute} size="sm" className="bg-green-600 hover:bg-green-700">
                            💾 Save
                          </Button>
                          <Button onClick={() => setShowAddRoute(false)} size="sm" variant="outline">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Routes List */}
                    <div className="space-y-3">
                      {routes[selectedEndpoint]?.map(route => (
                        <div key={route.id} className="border rounded-lg p-4">
                          {editingRoute === route.id ? (
                            // Edit Mode
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium mb-1">Method</label>
                                  <select
                                    value={editForm.method}
                                    onChange={(e) => setEditForm({ ...editForm, method: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md text-sm"
                                  >
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                    <option value="PATCH">PATCH</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Path</label>
                                  <input
                                    type="text"
                                    value={editForm.path}
                                    onChange={(e) => setEditForm({ ...editForm, path: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <input
                                  type="text"
                                  value={editForm.description}
                                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                  className="w-full px-3 py-2 border rounded-md text-sm"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={() => handleSaveRoute(route.id)} size="sm" className="bg-green-600">
                                  💾 Save
                                </Button>
                                <Button onClick={() => setEditingRoute(null)} size="sm" variant="outline">
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // View Mode
                            <>
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 text-xs font-semibold rounded ${getMethodColor(route.method)}`}>
                                    {route.method}
                                  </span>
                                  <span className="font-mono text-sm">{route.path}</span>
                                  {route.is_active === 0 && (
                                    <span className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-600">
                                      Disabled
                                    </span>
                                  )}
                                  {route.requires_auth === 1 && (
                                    <span className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-700">
                                      🔒 Auth
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-sm text-gray-600 mb-3">{route.description}</div>
                              
                              {route.parameters !== '{}' && (
                                <div className="mb-3">
                                  <div className="text-xs font-medium text-gray-700 mb-1">Parameters:</div>
                                  <pre className="text-xs bg-gray-100 p-2 rounded font-mono overflow-x-auto">
                                    {route.parameters}
                                  </pre>
                                </div>
                              )}

                              {testResults[route.id] && (
                                <div className={`mb-3 p-2 rounded text-xs ${
                                  testResults[route.id].success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                                }`}>
                                  <div className="font-semibold mb-1">
                                    Test Result: {testResults[route.id].success ? '✓ Success' : '✗ Failed'}
                                    {testResults[route.id].response_time && ` (${testResults[route.id].response_time.toFixed(0)}ms)`}
                                  </div>
                                  {testResults[route.id].error && (
                                    <div className="text-red-700">{testResults[route.id].error}</div>
                                  )}
                                </div>
                              )}

                              <div className="flex gap-2">
                                <Button onClick={() => handleEditRoute(route)} size="sm" variant="outline">
                                  ✏️ Edit
                                </Button>
                                <Button 
                                  onClick={() => handleTestRoute(route)} 
                                  size="sm" 
                                  variant="outline"
                                  disabled={testingRoute === route.id}
                                >
                                  {testingRoute === route.id ? '⏳ Testing...' : '🔍 Test'}
                                </Button>
                                <Button 
                                  onClick={() => handleToggleRoute(route.id, route.is_active)} 
                                  size="sm" 
                                  variant="outline"
                                >
                                  {route.is_active === 1 ? '⏸️ Disable' : '▶️ Enable'}
                                </Button>
                                <Button 
                                  onClick={() => handleDeleteRoute(route.id)} 
                                  size="sm" 
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  🗑️ Delete
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      
                      {routes[selectedEndpoint]?.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          No routes configured for this API
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-gray-500">
                      <div className="text-4xl mb-4">👈</div>
                      <div>Select an API service to manage its routes</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

