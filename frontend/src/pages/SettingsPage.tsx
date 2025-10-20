import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";

export default function SettingsPage() {
  const { success, info, warning } = useNotification();

  const handleSave = (section: string) => {
    info(`Saving ${section} settings...`);
    setTimeout(() => success(`${section} settings saved successfully!`), 1000);
  };

  const handleReset = (section: string) => {
    warning(`Resetting ${section} to defaults...`);
    setTimeout(() => success(`${section} reset to defaults!`), 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">System Settings</h1>
            <Button variant="outline" onClick={() => window.location.href = '/admin'}>
              ← Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle>⚙️ General Settings</CardTitle>
              <CardDescription>Basic system configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">System Name</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border rounded-md" 
                  defaultValue="Nautilus Trader"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Environment</label>
                <select className="w-full px-3 py-2 border rounded-md">
                  <option>Production</option>
                  <option>Staging</option>
                  <option>Development</option>
                </select>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => handleSave('General')}>Save</Button>
                <Button variant="outline" onClick={() => handleReset('General')}>Reset</Button>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle>🔔 Notifications</CardTitle>
              <CardDescription>Alert preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Email Notifications</label>
                <input type="checkbox" className="w-4 h-4" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Slack Notifications</label>
                <input type="checkbox" className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">SMS Alerts</label>
                <input type="checkbox" className="w-4 h-4" />
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => handleSave('Notification')}>Save</Button>
                <Button variant="outline" onClick={() => handleReset('Notification')}>Reset</Button>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle>🔒 Security</CardTitle>
              <CardDescription>Security & authentication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Session Timeout (minutes)</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border rounded-md" 
                  defaultValue="30"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Two-Factor Auth</label>
                <input type="checkbox" className="w-4 h-4" defaultChecked />
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => handleSave('Security')}>Save</Button>
                <Button variant="outline" onClick={() => handleReset('Security')}>Reset</Button>
              </div>
            </CardContent>
          </Card>

          {/* Performance Settings */}
          <Card>
            <CardHeader>
              <CardTitle>⚡ Performance</CardTitle>
              <CardDescription>System performance tuning</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Concurrent Requests</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border rounded-md" 
                  defaultValue="100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cache TTL (seconds)</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border rounded-md" 
                  defaultValue="3600"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => handleSave('Performance')}>Save</Button>
                <Button variant="outline" onClick={() => handleReset('Performance')}>Reset</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Global Actions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Global Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button onClick={() => success('All settings exported!')}>
                Export Settings
              </Button>
              <Button variant="outline" onClick={() => info('Import settings file...')}>
                Import Settings
              </Button>
              <Button variant="outline" onClick={() => handleSave('All')}>
                Save All
              </Button>
              <Button variant="outline" onClick={() => handleReset('All')}>
                Reset All to Defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

