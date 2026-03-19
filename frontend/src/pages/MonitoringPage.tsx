import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import api from "@/lib/api";

interface SystemMetrics {
  cpu_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  memory_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  disk_percent: number;
  uptime_seconds: number;
  requests_total: number;
  active_connections?: number;
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
  const { connected: wsConnected, lastMessage } = useWebSocket();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  // Live CPU/memory overlay from WebSocket (updates every 3s without extra HTTP call)
  const [wsMetrics, setWsMetrics] = useState<{ cpu_percent?: number; memory_percent?: number } | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await api.get<SystemMetrics>('/api/system/metrics');
      setMetrics(data);
    } catch {
      notifyError("Failed to load system metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    // Full refresh every 30s; WS provides lightweight CPU/mem overlay in between
    const interval = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // Update CPU/memory from WebSocket live_data push (every 3s)
  useEffect(() => {
    if (lastMessage?.type === "live_data" && lastMessage.metrics) {
      setWsMetrics(lastMessage.metrics);
    }
  }, [lastMessage]);

  const cpu = wsMetrics?.cpu_percent ?? metrics?.cpu_percent ?? 0;
  const mem = wsMetrics?.memory_percent ?? metrics?.memory_percent ?? 0;

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
                {loading ? "Loading…" : (
                  <>
                    CPU/Mem live via WebSocket
                    <span className={`ml-2 inline-block w-2 h-2 rounded-full ${wsConnected ? "bg-green-500" : "bg-red-400"}`} />
                    {wsConnected ? " Connected" : " Disconnected — reconnecting…"}
                  </>
                )}
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
              <CardDescription>CPU Usage {wsConnected && <span className="text-xs text-green-600">● live</span>}</CardDescription>
              <CardTitle className={`text-3xl ${cpuColor(cpu)}`}>
                {loading ? "—" : `${cpu.toFixed(1)}%`}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${cpu > 80 ? "bg-red-500" : cpu > 60 ? "bg-yellow-500" : "bg-green-500"}`}
                  style={{ width: `${Math.min(cpu, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Memory {wsConnected && <span className="text-xs text-green-600">● live</span>}</CardDescription>
              <CardTitle className={`text-3xl ${memColor(mem)}`}>
                {loading ? "—" : `${metrics?.memory_used_gb?.toFixed(1) ?? "—"}GB`}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-gray-500 mb-1">
                {mem.toFixed(1)}% of {metrics?.memory_total_gb?.toFixed(1) ?? "—"}GB
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${mem > 85 ? "bg-red-500" : mem > 70 ? "bg-yellow-500" : "bg-blue-500"}`}
                  style={{ width: `${Math.min(mem, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Disk</CardDescription>
              <CardTitle className="text-3xl text-gray-800">
                {loading ? "—" : `${metrics?.disk_used_gb?.toFixed(0) ?? "—"}GB`}
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
                  {(metrics.requests_total ?? 0).toLocaleString()} total requests
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
                    const blob = new Blob([JSON.stringify({ ...metrics, cpu_percent: cpu, memory_percent: mem }, null, 2)], { type: "application/json" });
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
              {cpu > 80 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  High CPU usage: {cpu.toFixed(1)}%
                </div>
              )}
              {mem > 85 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  High memory usage: {mem.toFixed(1)}%
                </div>
              )}
              {metrics && metrics.disk_percent > 90 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700">
                  Low disk space: {(metrics.disk_total_gb - metrics.disk_used_gb).toFixed(0)}GB free
                </div>
              )}
              {cpu <= 80 && mem <= 85 && (!metrics || metrics.disk_percent <= 90) && (
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
