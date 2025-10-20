import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import { useEffect, useState } from "react";
import API_CONFIG from "@/config";

const ADMIN_API_URL = API_CONFIG.ADMIN_DB_API_URL;

interface Setting {
  id: number;
  key: string;
  value: string;
  category: string;
  description: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface APIConfig {
  id: number;
  name: string;
  endpoint: string;
  is_enabled: boolean;
}

export default function AdminDBPage() {
  const { success, error, info } = useNotification();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [apiConfigs, setAPIConfigs] = useState<APIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [settingsRes, usersRes, configsRes] = await Promise.all([
        fetch(`${ADMIN_API_URL}/api/admin/settings`),
        fetch(`${ADMIN_API_URL}/api/admin/users`),
        fetch(`${ADMIN_API_URL}/api/admin/api-configs`)
      ]);

      const settingsData = await settingsRes.json();
      const usersData = await usersRes.json();
      const configsData = await configsRes.json();

      setSettings(settingsData.settings || []);
      setUsers(usersData.users || []);
      setAPIConfigs(configsData.configs || []);
      
      success('Admin database loaded successfully!');
    } catch (err) {
      error('Failed to load admin database');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      const response = await fetch(`${ADMIN_API_URL}/api/admin/settings/${key}?value=${encodeURIComponent(value)}`, {
        method: 'PUT',
      });
      
      if (!response.ok) throw new Error('Update failed');
      
      success(`Setting '${key}' updated!`);
      setEditingKey(null);
      loadData();
    } catch (err) {
      error(`Failed to update setting '${key}'`);
    }
  };

  const groupedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, Setting[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Database</h1>
              <p className="text-sm text-gray-600 mt-1">Manage system settings, users, and configurations</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={loadData}>
                🔄 Refresh
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/admin'}>
                ← Back
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Settings Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">System Settings</h2>
          <div className="grid gap-4">
            {Object.entries(groupedSettings).map(([category, categorySettings]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize">{category}</CardTitle>
                  <CardDescription>{categorySettings.length} settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categorySettings.map((setting) => (
                      <div key={setting.key} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="font-medium">{setting.key}</div>
                          <div className="text-sm text-gray-600">{setting.description}</div>
                          {editingKey === setting.key ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="mt-2 px-3 py-1 border rounded w-full max-w-md"
                              autoFocus
                            />
                          ) : (
                            <div className="mt-1 text-blue-600 font-mono">{setting.value}</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {editingKey === setting.key ? (
                            <>
                              <Button size="sm" onClick={() => handleUpdateSetting(setting.key, editValue)}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingKey(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setEditingKey(setting.key);
                                setEditValue(setting.value);
                              }}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Users Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Users</h2>
          <Card>
            <CardHeader>
              <CardTitle>Admin Users</CardTitle>
              <CardDescription>{users.length} users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium">{user.username}</div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                        {user.role}
                      </span>
                      <span className={`px-2 py-1 rounded text-sm ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Configs Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">API Configurations</h2>
          <Card>
            <CardHeader>
              <CardTitle>External APIs</CardTitle>
              <CardDescription>{apiConfigs.length} configurations</CardDescription>
            </CardHeader>
            <CardContent>
              {apiConfigs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No API configurations yet</p>
              ) : (
                <div className="space-y-2">
                  {apiConfigs.map((config) => (
                    <div key={config.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">{config.name}</div>
                        <div className="text-sm text-gray-600">{config.endpoint}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-sm ${
                        config.is_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {config.is_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

