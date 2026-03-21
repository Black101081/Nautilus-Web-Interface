import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import nautilusService, { type EngineInfo } from "@/services/nautilusService";
import api from "@/lib/api";

interface SystemMetrics {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  uptime_seconds: number;
  requests_total: number;
  active_connections?: number;
}

function formatUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const ADMIN_SECTIONS = [
  { path: "/admin/users", icon: "👥", label: "Users", desc: "Manage accounts & roles" },
  { path: "/admin/adapters", icon: "🔌", label: "Adapters", desc: "Exchange connections" },
  { path: "/admin/components", icon: "⚙️", label: "Components", desc: "Engine component lifecycle" },
  { path: "/admin/monitoring", icon: "📡", label: "Monitoring", desc: "System metrics & logs" },
  { path: "/admin/features", icon: "🧩", label: "Features", desc: "Feature flags" },
  { path: "/admin/database", icon: "🗄️", label: "Database", desc: "DB inspection" },
  { path: "/admin/db-management", icon: "🔧", label: "DB Mgmt", desc: "Backup & queries" },
  { path: "/admin/api-config", icon: "🔑", label: "API Config", desc: "Backend API settings" },
  { path: "/admin/settings", icon: "⚙️", label: "Settings", desc: "System preferences" },
];

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);
  const [sysMetrics, setSysMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    try {
      const [engine, sys] = await Promise.all([
        nautilusService.getEngineInfo(),
        api.get<SystemMetrics>("/api/system/metrics"),
      ]);
      setEngineInfo(engine);
      setSysMetrics(sys);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const cpu = sysMetrics?.cpu_percent ?? 0;
  const mem = sysMetrics?.memory_percent ?? 0;
  const disk = sysMetrics?.disk_percent ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Admin Dashboard</h2>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg border border-gray-700 transition-colors disabled:opacity-50"
        >
          ⟳ Refresh
        </button>
      </div>

      {/* Engine Status */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              engineInfo?.is_running ? "bg-green-400 animate-pulse" : "bg-gray-600"
            }`}
          />
          <div>
            <span className="text-sm text-white font-medium">
              {engineInfo?.trader_id ?? "Not connected"}
            </span>
            <span className="text-xs text-gray-500 ml-2">
              {engineInfo?.engine_type ?? ""}
            </span>
          </div>
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
              engineInfo?.is_running
                ? "bg-green-900/40 text-green-400"
                : "bg-gray-800 text-gray-500"
            }`}
          >
            {engineInfo?.status ?? "unknown"}
          </span>
        </div>
      </div>

      {/* System KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="CPU"
          value={`${cpu.toFixed(1)}%`}
          color={cpu > 80 ? "red" : cpu > 60 ? "yellow" : "green"}
          bar={cpu}
        />
        <KpiCard
          label="Memory"
          value={`${mem.toFixed(1)}%`}
          color={mem > 85 ? "red" : mem > 70 ? "yellow" : "blue"}
          bar={mem}
        />
        <KpiCard
          label="Disk"
          value={`${disk.toFixed(1)}%`}
          color={disk > 90 ? "red" : "gray"}
          bar={disk}
        />
        <KpiCard
          label="Uptime"
          value={formatUptime(sysMetrics?.uptime_seconds ?? 0)}
          color="purple"
        />
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Requests", value: (sysMetrics?.requests_total ?? 0).toLocaleString() },
          { label: "Connections", value: String(sysMetrics?.active_connections ?? 0) },
          { label: "Engine", value: engineInfo?.is_running ? "Live" : "Stopped" },
        ].map((item) => (
          <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">{item.label}</div>
            <div className="text-white font-semibold">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Admin section grid */}
      <div>
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
          Admin Sections
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {ADMIN_SECTIONS.map((sec) => (
            <button
              key={sec.path}
              onClick={() => navigate(sec.path)}
              className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl p-4 text-left transition-all"
            >
              <div className="text-xl mb-2">{sec.icon}</div>
              <div className="text-sm text-white font-medium">{sec.label}</div>
              <div className="text-xs text-gray-600 mt-0.5">{sec.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
  bar,
}: {
  label: string;
  value: string;
  color: "red" | "yellow" | "green" | "blue" | "gray" | "purple";
  bar?: number;
}) {
  const colorMap = {
    red: "text-red-400",
    yellow: "text-yellow-400",
    green: "text-green-400",
    blue: "text-blue-400",
    gray: "text-gray-400",
    purple: "text-purple-400",
  };
  const barColor =
    bar !== undefined
      ? bar > 80
        ? "bg-red-500"
        : bar > 60
        ? "bg-yellow-500"
        : "bg-green-500"
      : "";
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold mb-2 ${colorMap[color]}`}>{value}</div>
      {bar !== undefined && (
        <div className="w-full bg-gray-800 rounded-full h-1">
          <div
            className={`h-1 rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(bar, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
