import { useState, useEffect } from "react";
import api from "../lib/api";

interface Strategy {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string;
  config: Record<string, unknown>;
  performance: {
    total_pnl: number;
    total_trades: number;
    win_rate: number;
  };
}

const STRATEGY_SCHEMAS: Record<string, { label: string; fields: { key: string; label: string; type: string; default: number | string }[] }> = {
  sma_crossover: {
    label: "SMA Crossover",
    fields: [
      { key: "fast_period", label: "Fast Period", type: "number", default: 10 },
      { key: "slow_period", label: "Slow Period", type: "number", default: 30 },
      { key: "trade_size", label: "Trade Size", type: "number", default: 1.0 },
    ],
  },
  ema_crossover: {
    label: "EMA Crossover",
    fields: [
      { key: "fast_period", label: "Fast EMA Period", type: "number", default: 12 },
      { key: "slow_period", label: "Slow EMA Period", type: "number", default: 26 },
      { key: "trade_size", label: "Trade Size", type: "number", default: 1.0 },
    ],
  },
  bollinger_bands: {
    label: "Bollinger Bands",
    fields: [
      { key: "period", label: "Period", type: "number", default: 20 },
      { key: "std_dev", label: "Std Dev", type: "number", default: 2.0 },
      { key: "trade_size", label: "Trade Size", type: "number", default: 1.0 },
    ],
  },
  vwap: {
    label: "VWAP",
    fields: [
      { key: "period", label: "VWAP Period", type: "number", default: 20 },
      { key: "deviation_pct", label: "Deviation %", type: "number", default: 0.5 },
      { key: "trade_size", label: "Trade Size", type: "number", default: 1.0 },
    ],
  },
  custom: {
    label: "Custom",
    fields: [],
  },
};

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "sma_crossover",
    description: "",
    config: {} as Record<string, number | string>,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const data = await api.get<{ strategies: Strategy[] }>("/api/strategies");
      setStrategies(data.strategies ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const start = async (id: string) => {
    await api.post(`/api/strategies/${id}/start`);
    load();
  };

  const stop = async (id: string) => {
    await api.post(`/api/strategies/${id}/stop`);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this strategy?")) return;
    await api.delete(`/api/strategies/${id}`);
    load();
  };

  const openAdd = () => {
    const schema = STRATEGY_SCHEMAS["sma_crossover"];
    const defaults: Record<string, number | string> = {};
    schema.fields.forEach((f) => (defaults[f.key] = f.default));
    setForm({ name: "", type: "sma_crossover", description: "", config: defaults });
    setFormError(null);
    setShowAdd(true);
  };

  const handleTypeChange = (type: string) => {
    const schema = STRATEGY_SCHEMAS[type] ?? { fields: [] };
    const defaults: Record<string, number | string> = {};
    schema.fields.forEach((f) => (defaults[f.key] = f.default));
    setForm((p) => ({ ...p, type, config: defaults }));
  };

  const handleConfigChange = (key: string, val: string) => {
    setForm((p) => ({ ...p, config: { ...p.config, [key]: parseFloat(val) || val } }));
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setFormError("Name is required");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post("/api/strategies", form);
      setShowAdd(false);
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSubmitting(false);
    }
  };

  const schema = STRATEGY_SCHEMAS[form.type] ?? { fields: [] };

  const statusColor = (s: string) => {
    if (s === "running" || s === "active") return "text-green-400 bg-green-900/30";
    if (s === "stopped") return "text-gray-500 bg-gray-800";
    if (s === "error") return "text-red-400 bg-red-900/30";
    return "text-yellow-400 bg-yellow-900/30";
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Strategies</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {strategies.filter((s) => s.status === "running").length} running /{" "}
            {strategies.length} total
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Strategy
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading strategies…</div>
      ) : strategies.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <div className="text-4xl mb-3">⚡</div>
          <div>No strategies yet</div>
          <div className="text-xs mt-1">Click "New Strategy" to add one</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {strategies.map((s) => (
            <div
              key={s.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm truncate">{s.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {STRATEGY_SCHEMAS[s.type]?.label ?? s.type}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${statusColor(
                    s.status
                  )}`}
                >
                  {s.status}
                </span>
              </div>

              {/* Performance */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <div
                    className={`text-sm font-bold ${
                      s.performance?.total_pnl >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {s.performance?.total_pnl >= 0 ? "+" : ""}
                    {(s.performance?.total_pnl ?? 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600">PnL</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-gray-300">
                    {s.performance?.total_trades ?? 0}
                  </div>
                  <div className="text-xs text-gray-600">Trades</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-blue-400">
                    {((s.performance?.win_rate ?? 0) * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-600">Win Rate</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {s.status === "running" || s.status === "active" ? (
                  <button
                    onClick={() => stop(s.id)}
                    className="flex-1 py-1.5 bg-red-800/40 hover:bg-red-700/40 text-red-400 text-xs font-medium rounded-lg border border-red-800 transition-colors"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={() => start(s.id)}
                    className="flex-1 py-1.5 bg-green-800/40 hover:bg-green-700/40 text-green-400 text-xs font-medium rounded-lg border border-green-800 transition-colors"
                  >
                    Start
                  </button>
                )}
                <button
                  onClick={() => del(s.id)}
                  className="py-1.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg border border-gray-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-white font-semibold text-lg mb-4">New Strategy</h3>

            {formError && (
              <div className="mb-3 p-2 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-xs">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="My Strategy"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Type</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={form.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                >
                  {Object.entries(STRATEGY_SCHEMAS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>

              {schema.fields.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Parameters</label>
                  <div className="space-y-2 bg-gray-800 rounded-lg p-3">
                    {schema.fields.map((f) => (
                      <div key={f.key} className="flex items-center gap-3">
                        <label className="text-xs text-gray-400 w-32 shrink-0">{f.label}</label>
                        <input
                          type="number"
                          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
                          value={String(form.config[f.key] ?? f.default)}
                          onChange={(e) => handleConfigChange(f.key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? "Adding…" : "Add Strategy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
