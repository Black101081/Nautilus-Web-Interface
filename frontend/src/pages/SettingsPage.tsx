import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import api from "@/lib/api";

interface Settings {
  system_name: string;
  environment: string;
  email_notifications: boolean;
  slack_notifications: boolean;
  sms_alerts: boolean;
  session_timeout: number;
  two_factor_auth: boolean;
  max_concurrent_requests: number;
  cache_ttl: number;
}

const DEFAULTS: Settings = {
  system_name: "Nautilus Trader",
  environment: "Production",
  email_notifications: true,
  slack_notifications: false,
  sms_alerts: false,
  session_timeout: 30,
  two_factor_auth: true,
  max_concurrent_requests: 100,
  cache_ttl: 3600,
};

export default function SettingsPage() {
  const { success, error: notifyError, warning } = useNotification();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Settings>('/api/settings')
      .then(data => setSettings({ ...DEFAULTS, ...data }))
      .catch(() => {/* use defaults */})
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof Settings, value: Settings[keyof Settings]) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const saveAll = async () => {
    setSaving(true);
    try {
      await api.post('/api/settings', settings);
      success("All settings saved successfully!");
    } catch {
      notifyError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setSettings(DEFAULTS);
    warning("Settings reset to defaults (not saved yet)");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">System Settings</h1>
            <Button variant="outline" onClick={() => window.location.href = "/admin"}>
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
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic system configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">System Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md"
                  value={settings.system_name}
                  onChange={e => set("system_name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Environment</label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={settings.environment}
                  onChange={e => set("environment", e.target.value)}
                >
                  <option>Production</option>
                  <option>Staging</option>
                  <option>Development</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Alert preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {([
                ["email_notifications", "Email Notifications"],
                ["slack_notifications", "Slack Notifications"],
                ["sms_alerts", "SMS Alerts"],
              ] as [keyof Settings, string][]).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-sm font-medium">{label}</label>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={settings[key] as boolean}
                    onChange={e => set(key, e.target.checked)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Security & authentication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Session Timeout (minutes)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-md"
                  value={settings.session_timeout}
                  onChange={e => set("session_timeout", parseInt(e.target.value) || 30)}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Two-Factor Auth</label>
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={settings.two_factor_auth}
                  onChange={e => set("two_factor_auth", e.target.checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Performance Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
              <CardDescription>System performance tuning</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Max Concurrent Requests</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-md"
                  value={settings.max_concurrent_requests}
                  onChange={e => set("max_concurrent_requests", parseInt(e.target.value) || 100)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Cache TTL (seconds)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-md"
                  value={settings.cache_ttl}
                  onChange={e => set("cache_ttl", parseInt(e.target.value) || 3600)}
                />
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
              <Button onClick={saveAll} disabled={saving}>
                {saving ? "Saving…" : "Save All Settings"}
              </Button>
              <Button variant="outline" onClick={resetAll}>
                Reset to Defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
