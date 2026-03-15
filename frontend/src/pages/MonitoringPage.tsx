import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import { API_CONFIG } from "@/config";

interface SystemMetrics {
  cpu_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  memory_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  disk_percent: number;
  uptime_seconds: number;
  request_count: number;
  active_connections: number;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function MonitoringPage() {
  const { success, error: notifyError } = useNotification();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/system/metrics`);
      const data = await res.json();
      setMetrics(data);
    } catch {
      notifyError("Failed to load system metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const cpuColor = (v: number) => v > 80 ? "text-red-600" : v > 60 ? "text-yellow-600" : "text-green-600";
  const memColor = (v: number) => v > 85 ? "text-red-600" : v > 70 ? "text-yellow-600" : "text-blue-600";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">System Monitoring</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {loading ? "Loading…" : "Live metrics · auto-refresh every 5s"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchMetrics}>⟳ Refresh</Button>
              <Button variant="outline" onClick={() => window.location.href = "/admin"}>
                ← Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Live Metrics */}
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>CPU Usage</CardDescription>
              <CardTitle className={`text-3xl ${metrics ? cpuColor(metrics.cpu_percent) : ""}`}>
                {loading ? "—" : `${metrics?.cpu_percent.toFixed(1)}%`}
              </CardTitle>
            </CardHeader>
            {metrics && (
              <CardContent className="pt-0">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${metrics.cpu_percent > 80 ? "bg-red-500" : metrics.cpu_percent > 60 ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${metrics.cpu_percent}%` }}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Memory</CardDescription>
              <CardTitle className={`text-3xl ${metrics ? memColor(metrics.memory_percent) : ""}`}>
                {loading ? "—" : `${metrics?.memory_used_gb.toFixed(1)}GB`}
              </CardTitle>
            </CardHeader>
            {metrics && (
              <CardContent className="pt-0">
                <p className="text-xs text-gray-500 mb-1">
                  {metrics.memory_percent.toFixed(1)}% of {metrics.memory_total_gb.toFixed(1)}GB
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${metrics.memory_percent > 85 ? "bg-red-500" : metrics.memory_percent > 70 ? "bg-yellow-500" : "bg-blue-500"}`}
                    style={{ width: `${metrics.memory_percent}%` }}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Disk</CardDescription>
              <CardTitle className="text-3xl text-gray-800">
                {loading ? "—" : `${metrics?.disk_used_gb.toFixed(0)}GB`}
              </CardTitle>
            </CardHeader>
            {metrics && (
              <CardContent className="pt-0">
                <p className="text-xs text-gray-500 mb-1">
                  {metrics.disk_percent.toFixed(1)}% of {metrics.disk_total_gb.toFixed(0)}GB
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${metrics.disk_percent > 90 ? "bg-red-500" : "bg-gray-500"}`}
                    style={{ width: `${metrics.disk_percent}%` }}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Uptime</CardDescription>
              <CardTitle className="text-3xl text-gray-800">
                {loading ? "—" : formatUptime(metrics?.uptime_seconds ?? 0)}
              </CardTitle>
            </CardHeader>
            {metrics && (
              <CardContent className="pt-0">
                <p className="text-xs text-gray-500">
                  {metrics.request_count.toLocaleString()} total requests
                </p>
                <p className="text-xs text-gray-500">
                  {metrics.active_connections} active connections
                </p>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Metrics</CardTitle>
              <CardDescription>System performance metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={fetchMetrics}>
                Refresh Metrics
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  if (metrics) {
                    const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `metrics-${new Date().toISOString()}.json`;
                    a.click();
                    success("Metrics exported!");
                  }
                }}
              >
                Export Metrics
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alerts</CardTitle>
              <CardDescription>System alerts & warnings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {metrics && metrics.cpu_percent > 80 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  High CPU usage: {metrics.cpu_percent.toFixed(1)}%
                </div>
              )}
              {metrics && metrics.memory_percent > 85 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  High memory usage: {metrics.memory_percent.toFixed(1)}%
                </div>
              )}
              {metrics && metrics.disk_percent > 90 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700">
                  Low disk space: {(metrics.disk_total_gb - metrics.disk_used_gb).toFixed(0)}GB free
                </div>
              )}
              {metrics && metrics.cpu_percent <= 80 && metrics.memory_percent <= 85 && metrics.disk_percent <= 90 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                  All systems normal
                </div>
              )}
              <Button
                className="w-full"
                variant="outline"
                onClick={() => window.location.href = "/alerts"}
              >
                View Price Alerts
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
