import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import api from "@/lib/api";

// ── 2FA Management component ─────────────────────────────────────────────────

function TwoFactorCard() {
  const { success, error: notifyError } = useNotification();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setupData, setSetupData] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"idle" | "enabling" | "disabling">("idle");

  useEffect(() => {
    api.get<{ two_factor_enabled: boolean }>("/api/auth/2fa/status")
      .then(d => setEnabled(d.two_factor_enabled))
      .catch(() => setEnabled(false));
  }, []);

  const startSetup = async () => {
    setBusy(true);
    try {
      const d = await api.get<{ secret: string; otpauth_uri: string }>("/api/auth/2fa/setup");
      setSetupData(d);
      setMode("enabling");
      setCode("");
    } catch { notifyError("Failed to generate 2FA secret"); }
    finally { setBusy(false); }
  };

  const confirmEnable = async () => {
    if (code.length < 6) return;
    setBusy(true);
    try {
      await api.post("/api/auth/2fa/enable", { totp_code: code });
      setEnabled(true);
      setMode("idle");
      setSetupData(null);
      setCode("");
      success("2FA activated — your account is now protected");
    } catch { notifyError("Invalid code — check your authenticator app"); }
    finally { setBusy(false); }
  };

  const startDisable = () => { setMode("disabling"); setCode(""); };

  const confirmDisable = async () => {
    if (code.length < 6) return;
    setBusy(true);
    try {
      await api.post("/api/auth/2fa/disable", { totp_code: code });
      setEnabled(false);
      setMode("idle");
      setCode("");
      success("2FA deactivated");
    } catch { notifyError("Invalid code"); }
    finally { setBusy(false); }
  };

  const cancel = () => { setMode("idle"); setSetupData(null); setCode(""); };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>TOTP-based 2FA (Google Authenticator, Authy, etc.)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status badge */}
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
            enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}>
            <span className={`w-2 h-2 rounded-full ${enabled ? "bg-green-500" : "bg-gray-400"}`} />
            {enabled === null ? "Checking…" : enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {/* Idle — show action buttons */}
        {mode === "idle" && enabled !== null && (
          enabled
            ? <Button variant="outline" onClick={startDisable} className="text-red-600 border-red-200 hover:bg-red-50">
                Disable 2FA
              </Button>
            : <Button onClick={startSetup} disabled={busy}>
                {busy ? "Generating…" : "Set Up 2FA"}
              </Button>
        )}

        {/* Setup: show secret + QR + confirm step */}
        {mode === "enabling" && setupData && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">Step 1 — Add to your authenticator app</p>
              <p className="text-xs text-amber-700 mb-3">
                Scan the QR code or manually enter this secret key:
              </p>
              <div className="font-mono text-sm bg-white border rounded px-3 py-2 break-all select-all mb-3">
                {setupData.secret}
              </div>
              {/* QR code via Google Charts API — data URI approach */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(setupData.otpauth_uri)}`}
                alt="TOTP QR code"
                className="rounded border"
                width={160}
                height={160}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Step 2 — Enter the 6-digit code to confirm</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-32 px-3 py-2 border rounded-md font-mono text-lg tracking-widest text-center"
                  autoFocus
                />
                <Button onClick={confirmEnable} disabled={busy || code.length < 6}>
                  {busy ? "Verifying…" : "Activate 2FA"}
                </Button>
                <Button variant="outline" onClick={cancel}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* Disable: confirm with current TOTP code */}
        {mode === "disabling" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Enter your current 2FA code to disable:</p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-32 px-3 py-2 border rounded-md font-mono text-lg tracking-widest text-center"
                autoFocus
              />
              <Button variant="outline" onClick={confirmDisable} disabled={busy || code.length < 6}
                className="text-red-600 border-red-200 hover:bg-red-50">
                {busy ? "Verifying…" : "Disable 2FA"}
              </Button>
              <Button variant="outline" onClick={cancel}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
                <p className="text-xs text-gray-400">
                  Token expiry in minutes. 0 = use JWT_EXPIRE_HOURS env var (default 8h).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 2FA Card */}
          <TwoFactorCard />

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
