import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useWebSocket } from "@/hooks/useWebSocket";
import nautilusService from "@/services/nautilusService";
import api from "@/lib/api";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface EngineInfo {
  trader_id?: string;
  engine_type?: string;
  status?: string;
  is_running?: boolean;
  strategies_count?: number;
}

interface RiskMetrics {
  total_exposure?: number;
  margin_used?: number;
  margin_available?: number;
  max_drawdown?: number;
  var_1d?: number;
  position_count?: number;
}

export default function TraderDashboard() {
  const [, navigate] = useLocation();
  const { connected: wsConnected, lastMessage } = useWebSocket();
  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [equityCurve, setEquityCurve] = useState<{ t: string; v: number }[]>([]);
  const [liveStrategies, setLiveStrategies] = useState(0);
  const [livePositions, setLivePositions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (lastMessage?.type === "live_data") {
      if (lastMessage.engine?.strategies_count !== undefined)
        setLiveStrategies(lastMessage.engine.strategies_count);
      if (lastMessage.open_positions_count !== undefined)
        setLivePositions(lastMessage.open_positions_count);
    }
  }, [lastMessage]);

  const load = async () => {
    try {
      const [engine, risk] = await Promise.all([
        nautilusService.getEngineInfo(),
        nautilusService.getRiskMetrics(),
      ]);
      setEngineInfo(engine);
      setRiskMetrics(risk);

      // Try to get equity curve
      try {
        const perfData = await api.get<{ curve?: { timestamp: string; equity: number }[] }>(
          "/api/analytics/equity-curve"
        );
        if (Array.isArray(perfData?.curve)) {
          setEquityCurve(
            perfData.curve.slice(-50).map((p) => ({
              t: p.timestamp,
              v: p.equity,
            }))
          );
        }
      } catch {
        /* no chart data yet */
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const drawdown = riskMetrics?.max_drawdown ?? 0;
  const marginPct =
    riskMetrics && (riskMetrics.margin_used ?? 0) + (riskMetrics.margin_available ?? 0) > 0
      ? ((riskMetrics.margin_used ?? 0) /
          ((riskMetrics.margin_used ?? 0) + (riskMetrics.margin_available ?? 0))) *
        100
      : 0;

  const riskLevel =
    drawdown > 15 || marginPct > 80
      ? "critical"
      : drawdown > 8 || marginPct > 60
      ? "warning"
      : "ok";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Risk Alert Banner */}
      {riskLevel !== "ok" && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
            riskLevel === "critical"
              ? "bg-red-900/40 border border-red-700 text-red-300"
              : "bg-yellow-900/40 border border-yellow-700 text-yellow-300"
          }`}
        >
          <span>{riskLevel === "critical" ? "🚨" : "⚠️"}</span>
          <span>
            {riskLevel === "critical"
              ? `Critical risk level: drawdown ${drawdown.toFixed(1)}%, margin ${marginPct.toFixed(0)}% used`
              : `Elevated risk: drawdown ${drawdown.toFixed(1)}%, margin ${marginPct.toFixed(0)}% used`}
          </span>
          <button
            className="ml-auto underline opacity-80 hover:opacity-100"
            onClick={() => navigate("/trader/risk")}
          >
            View Risk
          </button>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Active Strategies"
          value={liveStrategies}
          suffix={wsConnected ? "● live" : ""}
          color="blue"
          onClick={() => navigate("/trader/strategies")}
        />
        <KpiCard
          label="Open Positions"
          value={livePositions}
          suffix={wsConnected ? "● live" : ""}
          color="green"
          onClick={() => navigate("/trader/positions")}
        />
        <KpiCard
          label="Total Exposure"
          value={`$${(riskMetrics?.total_exposure ?? 0).toLocaleString()}`}
          color="orange"
          onClick={() => navigate("/trader/risk")}
        />
        <KpiCard
          label="Max Drawdown"
          value={`${drawdown.toFixed(2)}%`}
          color={drawdown > 10 ? "red" : "gray"}
          onClick={() => navigate("/trader/performance")}
        />
      </div>

      {/* Equity Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Equity mini chart */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">Equity Curve</h3>
            <button
              className="text-xs text-blue-400 hover:text-blue-300"
              onClick={() => navigate("/trader/performance")}
            >
              Full view →
            </button>
          </div>
          {equityCurve.length > 1 ? (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={equityCurve}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "6px",
                    fontSize: "11px",
                    color: "#e5e7eb",
                  }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "Equity"]}
                  labelFormatter={() => ""}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-gray-600 text-sm">
              No equity data yet — run some trades first
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <ActionBtn
              label="New Order"
              icon="📋"
              color="green"
              onClick={() => navigate("/trader/orders")}
            />
            <ActionBtn
              label="Start Strategy"
              icon="⚡"
              color="blue"
              onClick={() => navigate("/trader/strategies")}
            />
            <ActionBtn
              label="Run Backtest"
              icon="🔬"
              color="purple"
              onClick={() => navigate("/trader/backtesting")}
            />
            <ActionBtn
              label="Risk Dashboard"
              icon="⚖️"
              color="red"
              onClick={() => navigate("/trader/risk")}
            />
          </div>
        </div>
      </div>

      {/* Navigation Cards Grid */}
      <div>
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
          All Sections
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { path: "/trader/market-data", icon: "📊", label: "Market Data" },
            { path: "/trader/alerts", icon: "🔔", label: "Alerts" },
            { path: "/trader/strategies", icon: "⚡", label: "Strategies" },
            { path: "/trader/orders", icon: "📋", label: "Orders" },
            { path: "/trader/positions", icon: "💼", label: "Positions" },
            { path: "/trader/risk", icon: "⚖️", label: "Risk" },
            { path: "/trader/performance", icon: "📈", label: "Performance" },
            { path: "/trader/analytics", icon: "🔬", label: "Analytics" },
            { path: "/trader/backtesting", icon: "🕐", label: "Backtesting" },
            { path: "/trader/catalog", icon: "🗄️", label: "Data Catalog" },
          ].map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl p-4 text-center transition-all"
            >
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-xs text-gray-400">{item.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Engine Info */}
      {engineInfo && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Engine</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-600 mb-0.5">Trader ID</div>
              <div className="text-gray-300 font-mono text-xs truncate">
                {engineInfo.trader_id ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-0.5">Type</div>
              <div className="text-gray-300 text-xs">{engineInfo.engine_type ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-0.5">Status</div>
              <div
                className={`text-xs font-semibold ${
                  engineInfo.is_running ? "text-green-400" : "text-red-400"
                }`}
              >
                {engineInfo.status ?? "Unknown"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-0.5">VaR (1D)</div>
              <div className="text-gray-300 text-xs">
                ${(riskMetrics?.var_1d ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  suffix,
  color,
  onClick,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  color: "blue" | "green" | "orange" | "red" | "gray";
  onClick?: () => void;
}) {
  const colorMap = {
    blue: "text-blue-400",
    green: "text-green-400",
    orange: "text-orange-400",
    red: "text-red-400",
    gray: "text-gray-400",
  };
  return (
    <button
      onClick={onClick}
      className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-4 text-left transition-all"
    >
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorMap[color]}`}>{value}</div>
      {suffix && <div className="text-xs text-green-500 mt-0.5">{suffix}</div>}
    </button>
  );
}

function ActionBtn({
  label,
  icon,
  color,
  onClick,
}: {
  label: string;
  icon: string;
  color: "green" | "blue" | "purple" | "red";
  onClick?: () => void;
}) {
  const colorMap = {
    green: "bg-green-700/20 hover:bg-green-700/40 text-green-400 border-green-800",
    blue: "bg-blue-700/20 hover:bg-blue-700/40 text-blue-400 border-blue-800",
    purple: "bg-purple-700/20 hover:bg-purple-700/40 text-purple-400 border-purple-800",
    red: "bg-red-700/20 hover:bg-red-700/40 text-red-400 border-red-800",
  };
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${colorMap[color]}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
