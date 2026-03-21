import { useEffect, useState, useCallback, useRef } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import api from "@/lib/api";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

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

interface HistoryPoint {
  t: number;
  cpu: number;
  mem: number;
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MiniBar({ value, color }: { value: number; color: string }) {
  const barColor = value > 80 ? "bg-red-500" : value > 60 ? "bg-yellow-500" : `bg-${color}-500`;
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

const LOG_LEVELS = ["ALL", "INFO", "WARN", "ERROR"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

// Simulated log generation since backend may not have log endpoint
const MOCK_LOGS = [
  { ts: new Date().toISOString(), level: "INFO", msg: "WebSocket connection established" },
  { ts: new Date(Date.now() - 5000).toISOString(), level: "INFO", msg: "Market data subscription active" },
  { ts: new Date(Date.now() - 15000).toISOString(), level: "WARN", msg: "Strategy heartbeat delayed > 5s" },
  { ts: new Date(Date.now() - 30000).toISOString(), level: "INFO", msg: "Risk limits loaded from database" },
  { ts: new Date(Date.now() - 60000).toISOString(), level: "INFO", msg: "Nautilus engine started" },
];

export default function MonitoringPage() {
  const { connected: wsConnected, lastMessage } = useWebSocket();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsLive, setWsLive] = useState<{ cpu_percent?: number; memory_percent?: number } | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [logLevel, setLogLevel] = useState<LogLevel>("ALL");
  const historyRef = useRef(history);
  historyRef.current = history;

  const load = useCallback(async () => {
    try {
      const data = await api.get<SystemMetrics>("/api/system/metrics");
      setMetrics(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (lastMessage?.type === "live_data" && lastMessage.metrics) {
      const m = lastMessage.metrics;
      setWsLive(m);
      setHistory((prev) => {
        const next = [
          ...prev,
          { t: Date.now(), cpu: m.cpu_percent ?? 0, mem: m.memory_percent ?? 0 },
        ].slice(-60);
        return next;
      });
    }
  }, [lastMessage]);

  const cpu = wsLive?.cpu_percent ?? metrics?.cpu_percent ?? 0;
  const mem = wsLive?.memory_percent ?? metrics?.memory_percent ?? 0;

  const filteredLogs =
    logLevel === "ALL" ? MOCK_LOGS : MOCK_LOGS.filter((l) => l.level === logLevel);

  if (loading && !metrics) {
    return <div className="p-6 text-gray-500 text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">System Monitoring</h2>
        <button
          onClick={load}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg border border-gray-700 transition-colors"
        >
          ⟳ Refresh
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label={`CPU ${wsConnected ? "● live" : ""}`}
          value={`${cpu.toFixed(1)}%`}
          color={cpu > 80 ? "red" : cpu > 60 ? "yellow" : "green"}
          bar={<MiniBar value={cpu} color="green" />}
        />
        <MetricCard
          label={`Memory ${wsConnected ? "● live" : ""}`}
          value={`${metrics?.memory_used_gb?.toFixed(1) ?? "—"}GB`}
          sub={`${mem.toFixed(1)}% of ${metrics?.memory_total_gb?.toFixed(0) ?? "—"}GB`}
          color={mem > 85 ? "red" : mem > 70 ? "yellow" : "blue"}
          bar={<MiniBar value={mem} color="blue" />}
        />
        <MetricCard
          label="Disk"
          value={`${metrics?.disk_used_gb?.toFixed(0) ?? "—"}GB`}
          sub={`${metrics?.disk_percent?.toFixed(1) ?? "—"}% of ${metrics?.disk_total_gb?.toFixed(0) ?? "—"}GB`}
          color="gray"
          bar={<MiniBar value={metrics?.disk_percent ?? 0} color="gray" />}
        />
        <MetricCard
          label="Uptime"
          value={formatUptime(metrics?.uptime_seconds ?? 0)}
          sub={`${(metrics?.requests_total ?? 0).toLocaleString()} requests`}
          color="purple"
        />
      </div>

      {/* Alerts */}
      {(cpu > 80 || mem > 85 || (metrics?.disk_percent ?? 0) > 90) && (
        <div className="space-y-2">
          {cpu > 80 && (
            <Alert level="error" msg={`High CPU usage: ${cpu.toFixed(1)}%`} />
          )}
          {mem > 85 && (
            <Alert level="error" msg={`High memory usage: ${mem.toFixed(1)}%`} />
          )}
          {(metrics?.disk_percent ?? 0) > 90 && (
            <Alert
              level="warn"
              msg={`Low disk space: ${((metrics?.disk_total_gb ?? 0) - (metrics?.disk_used_gb ?? 0)).toFixed(0)}GB free`}
            />
          )}
        </div>
      )}

      {/* Historical charts */}
      {history.length > 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-2">CPU History</div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={history}>
                <YAxis domain={[0, 100]} hide />
                <Line type="monotone" dataKey="cpu" stroke="#22c55e" strokeWidth={1.5} dot={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", fontSize: "11px", color: "#e5e7eb" }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, "CPU"]}
                  labelFormatter={() => ""}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-2">Memory History</div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={history}>
                <YAxis domain={[0, 100]} hide />
                <Line type="monotone" dataKey="mem" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", fontSize: "11px", color: "#e5e7eb" }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, "Memory"]}
                  labelFormatter={() => ""}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Live log viewer */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-300">System Log</h3>
          <div className="flex gap-1 ml-auto">
            {LOG_LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setLogLevel(l)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  logLevel === l ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500 hover:text-gray-300"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
          {filteredLogs.map((log, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-gray-600 shrink-0">
                {new Date(log.ts).toLocaleTimeString()}
              </span>
              <span
                className={`shrink-0 font-semibold ${
                  log.level === "ERROR"
                    ? "text-red-400"
                    : log.level === "WARN"
                    ? "text-yellow-400"
                    : "text-green-400"
                }`}
              >
                {log.level}
              </span>
              <span className="text-gray-400">{log.msg}</span>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="text-gray-600">No {logLevel} entries</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  color,
  bar,
}: {
  label: string;
  value: string;
  sub?: string;
  color: "red" | "yellow" | "green" | "blue" | "gray" | "purple";
  bar?: React.ReactNode;
}) {
  const colorMap = {
    red: "text-red-400",
    yellow: "text-yellow-400",
    green: "text-green-400",
    blue: "text-blue-400",
    gray: "text-gray-400",
    purple: "text-purple-400",
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold mb-1 ${colorMap[color]}`}>{value}</div>
      {sub && <div className="text-xs text-gray-600 mb-1">{sub}</div>}
      {bar}
    </div>
  );
}

function Alert({ level, msg }: { level: "error" | "warn"; msg: string }) {
  return (
    <div
      className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
        level === "error"
          ? "bg-red-900/30 border border-red-800 text-red-400"
          : "bg-yellow-900/30 border border-yellow-800 text-yellow-400"
      }`}
    >
      {level === "error" ? "🚨" : "⚠️"} {msg}
    </div>
  );
}
