
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import { useEffect, useState } from "react";
import nautilusService, { type EngineInfo } from "@/services/nautilusService";

export default function AdminDashboard() {
  const { success, error, info } = useNotification();
  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEngineInfo();
  }, []);

  const loadEngineInfo = async () => {
    try {
      setLoading(true);
      const data = await nautilusService.getEngineInfo();
      setEngineInfo(data);
      success('Connected to Nautilus Trader!');
    } catch (err) {
      error('Failed to connect to Nautilus API');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = () => {
    success('Admin panel is working! This is a test notification.');
  };

  const handleRefresh = () => {
    info('Refreshing engine info...');
    loadEngineInfo();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Nautilus Admin Panel</h1>
              <p className="text-sm text-gray-600 mt-1">
                {loading ? '⏳ Connecting...' : engineInfo ? `✅ Connected: ${engineInfo.trader_id}` : '❌ Disconnected'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRefresh} disabled={loading}>
                {loading ? 'Loading...' : '🔄 Refresh'}
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/'}>
                ← Back to Home
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-600">Welcome to Nautilus Trader Admin Interface</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Operations</CardDescription>
              <CardTitle className="text-3xl">140+</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Admin Pages</CardDescription>
              <CardTitle className="text-3xl">8</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>API Endpoints</CardDescription>
              <CardTitle className="text-3xl">15+</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Status</CardDescription>
              <CardTitle className="text-3xl text-green-600">Live</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>💾 Database</CardTitle>
              <CardDescription>PostgreSQL, Parquet, Redis management</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Manage database operations, backups, and cache optimization.
              </p>
              <Button className="w-full" onClick={() => window.location.href = '/admin/database'}>
                Open Database
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔧 Components</CardTitle>
              <CardDescription>Manage Nautilus components</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Control lifecycle of engines, adapters, and services.
              </p>
              <Button className="w-full" onClick={() => window.location.href = '/admin/components'}>
                Open Components
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🎛️ Features</CardTitle>
              <CardDescription>Feature flags and configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Toggle features and configure system parameters.
              </p>
              <Button className="w-full" onClick={() => window.location.href = '/admin/features'}>
                Open Features
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔌 Adapters</CardTitle>
              <CardDescription>Exchange/broker connections</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Manage connections to exchanges and brokers.
              </p>
              <Button className="w-full" onClick={() => window.location.href = '/admin/adapters'}>
                Open Adapters
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📊 Monitoring</CardTitle>
              <CardDescription>System metrics and logs</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                View real-time metrics, logs, and alerts.
              </p>
              <Button className="w-full" onClick={() => window.location.href = '/admin/monitoring'}>
                Open Monitoring
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>⚙️ Settings</CardTitle>
              <CardDescription>System configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Configure system settings and preferences.
              </p>
              <Button onClick={() => window.location.href = '/admin/settings'}>
                Settings
              </Button>
            </CardContent>
          </Card>

          {/* Database Management Card */}
          <Card>
            <CardHeader>
              <CardTitle>🗄️ Database Management</CardTitle>
              <CardDescription>System settings and configurations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Manage system settings, users, and configurations.
              </p>
              <Button onClick={() => window.location.href = '/admin/database-management'}>
                Manage Database
              </Button>
            </CardContent>
          </Card>

          {/* Documentation Card */}
          <Card>
            <CardHeader>
              <CardTitle>📚 Documentation</CardTitle>
              <CardDescription>View project documentation</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Read the documentation for the Nautilus Web Interface.
              </p>
              <Button onClick={() => window.location.href = '/docs'}>
                View Documentation
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Test Notification */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>🔔 Notification System</CardTitle>
              <CardDescription>Test the notification system</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleTestNotification}>
                Test Notification
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Nautilus Web Interface v1.0.0</p>
          <p className="mt-2">
            <a href="https://github.com/Black101081/Nautilus-Web-Interface" className="text-blue-600 hover:underline">
              View on GitHub
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

