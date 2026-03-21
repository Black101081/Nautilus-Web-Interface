import { useEffect, useState } from "react";
import { useNotification } from "@/contexts/NotificationContext";
import api from "@/lib/api";

interface Adapter {
  id: string;
  name: string;
  type: string;
  category: string;
  status: string;
  description: string;
  docs_url: string;
  supports_live: boolean;
  supports_backtest: boolean;
  has_credentials?: boolean;
}

interface CredForm {
  apiKey: string;
  apiSecret: string;
  endpoint: string;
  testnet: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Crypto: "text-yellow-400 bg-yellow-900/30 border-yellow-800",
  "Stocks & Futures": "text-blue-400 bg-blue-900/30 border-blue-800",
  Data: "text-purple-400 bg-purple-900/30 border-purple-800",
  DeFi: "text-indigo-400 bg-indigo-900/30 border-indigo-800",
  Betting: "text-pink-400 bg-pink-900/30 border-pink-800",
};

// Wizard steps
type Step = "choose" | "credentials" | "verify";

export default function AdaptersPage() {
  const { success, info, error: notifyError } = useNotification();
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("All");

  // Wizard state
  const [wizardAdapter, setWizardAdapter] = useState<Adapter | null>(null);
  const [wizardStep, setWizardStep] = useState<Step>("choose");
  const [creds, setCreds] = useState<CredForm>({ apiKey: "", apiSecret: "", endpoint: "", testnet: false });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await api.get<{ adapters: (Adapter & { status: string; has_credentials: boolean })[] }>(
        "/api/adapters"
      );
      const list = data.adapters ?? [];
      setAdapters(list);
      const connMap: Record<string, boolean> = {};
      list.forEach((a) => (connMap[a.id] = a.status === "connected"));
      setConnected(connMap);
    } catch {
      notifyError("Could not load adapters");
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async (adapter: Adapter) => {
    try {
      await api.post(`/api/adapters/${adapter.id}/disconnect`, {});
      setConnected((p) => ({ ...p, [adapter.id]: false }));
      success(`${adapter.name} disconnected`);
    } catch {
      notifyError(`Failed to disconnect ${adapter.name}`);
    }
  };

  const openWizard = (adapter: Adapter) => {
    setWizardAdapter(adapter);
    setCreds({ apiKey: "", apiSecret: "", endpoint: "", testnet: false });
    setTestResult(null);
    setWizardStep("credentials");
  };

  const runTest = async () => {
    if (!wizardAdapter) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        `/api/adapters/${wizardAdapter.id}/test`,
        { api_key: creds.apiKey, api_secret: creds.apiSecret, endpoint: creds.endpoint, testnet: creds.testnet }
      );
      setTestResult({ ok: res.success, msg: res.message });
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  const connect = async () => {
    if (!wizardAdapter) return;
    setConnecting(true);
    try {
      await api.post(`/api/adapters/${wizardAdapter.id}/connect`, {
        api_key: creds.apiKey,
        api_secret: creds.apiSecret,
        endpoint: creds.endpoint,
        testnet: creds.testnet,
      });
      setConnected((p) => ({ ...p, [wizardAdapter.id]: true }));
      success(`${wizardAdapter.name} connected!`);
      setWizardAdapter(null);
      info("");
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const categories = ["All", ...Array.from(new Set(adapters.map((a) => a.category)))];
  const filtered =
    filterCategory === "All" ? adapters : adapters.filter((a) => a.category === filterCategory);

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading…</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Adapters</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {Object.values(connected).filter(Boolean).length} connected / {adapters.length} total
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilterCategory(c)}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              filterCategory === c
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Adapter grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((adapter) => {
          const isConnected = connected[adapter.id] ?? false;
          const catColor = CATEGORY_COLORS[adapter.category] ?? "text-gray-400 bg-gray-800 border-gray-700";
          return (
            <div
              key={adapter.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm">{adapter.name}</div>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full border mt-1 ${catColor}`}>
                    {adapter.category}
                  </span>
                </div>
                <div
                  className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                    isConnected ? "bg-green-400 animate-pulse" : "bg-gray-700"
                  }`}
                />
              </div>

              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{adapter.description}</p>

              <div className="flex gap-1.5 text-xs mb-3">
                {adapter.supports_live && (
                  <span className="px-2 py-0.5 bg-green-900/30 text-green-400 rounded">Live</span>
                )}
                {adapter.supports_backtest && (
                  <span className="px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded">Backtest</span>
                )}
              </div>

              <div className="flex gap-2">
                {isConnected ? (
                  <button
                    onClick={() => disconnect(adapter)}
                    className="flex-1 py-1.5 bg-red-900/40 hover:bg-red-800/40 text-red-400 text-xs font-medium rounded-lg border border-red-800 transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => openWizard(adapter)}
                    className="flex-1 py-1.5 bg-blue-700/40 hover:bg-blue-600/40 text-blue-400 text-xs font-medium rounded-lg border border-blue-700 transition-colors"
                  >
                    Connect
                  </button>
                )}
                {adapter.docs_url && (
                  <a
                    href={adapter.docs_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg border border-gray-700 transition-colors"
                  >
                    Docs
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection Wizard Modal */}
      {wizardAdapter && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            {/* Wizard header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-blue-700/30 rounded-lg flex items-center justify-center text-blue-400 font-bold">
                🔌
              </div>
              <div>
                <div className="text-white font-semibold">{wizardAdapter.name}</div>
                <div className="text-xs text-gray-500">Connection wizard</div>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-5">
              {(["credentials", "verify"] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      wizardStep === s
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-500"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className={`text-xs ${wizardStep === s ? "text-gray-200" : "text-gray-600"}`}>
                    {s === "credentials" ? "Credentials" : "Verify & Connect"}
                  </span>
                  {i < 1 && <div className="w-6 h-px bg-gray-700" />}
                </div>
              ))}
            </div>

            {wizardStep === "credentials" && (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">API Key</label>
                    <input
                      type="text"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      value={creds.apiKey}
                      onChange={(e) => setCreds((p) => ({ ...p, apiKey: e.target.value }))}
                      placeholder="Enter API key"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">API Secret</label>
                    <input
                      type="password"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      value={creds.apiSecret}
                      onChange={(e) => setCreds((p) => ({ ...p, apiSecret: e.target.value }))}
                      placeholder="Enter API secret"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Endpoint <span className="text-gray-600">(optional)</span>
                    </label>
                    <input
                      type="text"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      value={creds.endpoint}
                      onChange={(e) => setCreds((p) => ({ ...p, endpoint: e.target.value }))}
                      placeholder="Custom endpoint URL"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-blue-500"
                      checked={creds.testnet}
                      onChange={(e) => setCreds((p) => ({ ...p, testnet: e.target.checked }))}
                    />
                    Use testnet
                  </label>
                </div>
                {wizardAdapter.docs_url && (
                  <div className="mt-3">
                    <a
                      href={wizardAdapter.docs_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      📖 View {wizardAdapter.name} API docs →
                    </a>
                  </div>
                )}
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setWizardAdapter(null)}
                    className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setWizardStep("verify")}
                    disabled={!creds.apiKey}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                  >
                    Next →
                  </button>
                </div>
              </>
            )}

            {wizardStep === "verify" && (
              <>
                <div className="bg-gray-800 rounded-xl p-4 mb-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Adapter</span>
                    <span className="text-white">{wizardAdapter.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">API Key</span>
                    <span className="text-white font-mono">
                      {creds.apiKey.slice(0, 8)}…
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Testnet</span>
                    <span className={creds.testnet ? "text-yellow-400" : "text-green-400"}>
                      {creds.testnet ? "Yes" : "No (mainnet)"}
                    </span>
                  </div>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-lg mb-4 text-sm ${
                      testResult.ok
                        ? "bg-green-900/30 border border-green-800 text-green-400"
                        : "bg-red-900/30 border border-red-800 text-red-400"
                    }`}
                  >
                    {testResult.ok ? "✓ " : "✗ "}
                    {testResult.msg}
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <button
                    onClick={runTest}
                    disabled={testing}
                    className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg border border-gray-700 transition-colors disabled:opacity-50"
                  >
                    {testing ? "Testing…" : "Test Connection"}
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setWizardStep("credentials")}
                    className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={connect}
                    disabled={connecting}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                  >
                    {connecting ? "Connecting…" : "Connect"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
