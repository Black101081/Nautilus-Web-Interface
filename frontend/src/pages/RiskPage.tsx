import { useState, useEffect } from "react";
import api from "../lib/api";

interface RiskMetrics {
  total_exposure: number;
  margin_used: number;
  margin_available: number;
  max_drawdown: number;
  var_1d: number;
  position_count: number;
}

interface RiskLimits {
  max_order_size: number;
  max_position_size: number;
  max_daily_loss: number;
  max_positions: number;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  const barColor =
    pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : `bg-${color}-500`;
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function RiskPage() {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [limits, setLimits] = useState<RiskLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<RiskLimits>({
    max_order_size: 10000,
    max_position_size: 50000,
    max_daily_loss: 5000,
    max_positions: 10,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    try {
      const [m, l] = await Promise.all([
        api.get<RiskMetrics>("/api/risk/metrics"),
        api.get<RiskLimits>("/api/risk/limits"),
      ]);
      setMetrics(m);
      setLimits(l);
      setEditForm(l);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load risk data");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/api/risk/limits", editForm);
      setEditing(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save limits");
    } finally {
      setSaving(false);
    }
  };

  const marginTotal = (metrics?.margin_used ?? 0) + (metrics?.margin_available ?? 0);
  const marginPct = marginTotal > 0 ? (metrics!.margin_used / marginTotal) * 100 : 0;
  const drawdown = metrics?.max_drawdown ?? 0;

  const riskAlerts: string[] = [];
  if (drawdown > 15) riskAlerts.push(`Max drawdown ${drawdown.toFixed(2)}% exceeds 15% threshold`);
  if (marginPct > 80) riskAlerts.push(`Margin utilization ${marginPct.toFixed(0)}% critically high`);
  if (metrics && limits && metrics.position_count >= limits.max_positions)
    riskAlerts.push("Position count at maximum limit");

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Risk Management</h2>
        <button
          onClick={() => setEditing(true)}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg border border-gray-700 transition-colors"
        >
          Edit Limits
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Risk Alerts */}
      {riskAlerts.length > 0 && (
        <div className="space-y-2">
          {riskAlerts.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm"
            >
              <span>🚨</span>
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Margin utilization */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Margin Utilization</span>
              <span
                className={`font-semibold ${
                  marginPct > 80 ? "text-red-400" : marginPct > 60 ? "text-yellow-400" : "text-green-400"
                }`}
              >
                {marginPct.toFixed(1)}%
              </span>
            </div>
            <ProgressBar value={metrics.margin_used} max={marginTotal} color="blue" />
            <div className="flex justify-between text-xs text-gray-600 mt-1.5">
              <span>Used: ${metrics.margin_used.toLocaleString()}</span>
              <span>Avail: ${metrics.margin_available.toLocaleString()}</span>
            </div>
          </div>

          {/* Drawdown */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Max Drawdown</span>
              <span
                className={`font-semibold ${
                  drawdown > 15 ? "text-red-400" : drawdown > 8 ? "text-yellow-400" : "text-green-400"
                }`}
              >
                {drawdown.toFixed(2)}%
              </span>
            </div>
            <ProgressBar value={drawdown} max={20} color="orange" />
            <div className="text-xs text-gray-600 mt-1.5">Threshold: 15%</div>
          </div>

          {/* Total Exposure */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Total Exposure</span>
              <span className="text-orange-400 font-semibold">
                ${metrics.total_exposure.toLocaleString()}
              </span>
            </div>
            {limits && (
              <>
                <ProgressBar value={metrics.total_exposure} max={limits.max_position_size} color="orange" />
                <div className="text-xs text-gray-600 mt-1.5">
                  Limit: ${limits.max_position_size.toLocaleString()}
                </div>
              </>
            )}
          </div>

          {/* VaR */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">VaR (1-Day 95%)</span>
              <span className="text-purple-400 font-semibold">
                ${metrics.var_1d.toLocaleString()}
              </span>
            </div>
            {limits && (
              <>
                <ProgressBar value={metrics.var_1d} max={limits.max_daily_loss} color="purple" />
                <div className="text-xs text-gray-600 mt-1.5">
                  Daily loss limit: ${limits.max_daily_loss.toLocaleString()}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Current Limits */}
      {limits && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Current Limits</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: "Max Order Size", value: `$${limits.max_order_size.toLocaleString()}` },
              { label: "Max Position", value: `$${limits.max_position_size.toLocaleString()}` },
              { label: "Max Daily Loss", value: `$${limits.max_daily_loss.toLocaleString()}` },
              { label: "Max Positions", value: `${limits.max_positions}` },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-xs text-gray-600 mb-0.5">{item.label}</div>
                <div className="text-gray-200 font-medium">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setEditing(false)}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold text-lg mb-4">Edit Risk Limits</h3>
            <div className="space-y-3">
              {[
                { key: "max_order_size" as const, label: "Max Order Size ($)" },
                { key: "max_position_size" as const, label: "Max Position Size ($)" },
                { key: "max_daily_loss" as const, label: "Max Daily Loss ($)" },
                { key: "max_positions" as const, label: "Max Positions" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
                  <input
                    type="number"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    value={editForm[f.key]}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
