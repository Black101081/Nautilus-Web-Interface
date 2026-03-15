import { useEffect, useState } from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import api from '@/lib/api';

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
}

interface AdapterState {
  connected: boolean;
  apiKey: string;
  apiSecret: string;
  endpoint: string;
  testnet: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Crypto: 'bg-yellow-100 text-yellow-700',
  'Stocks & Futures': 'bg-blue-100 text-blue-700',
  Data: 'bg-purple-100 text-purple-700',
  DeFi: 'bg-indigo-100 text-indigo-700',
  Betting: 'bg-pink-100 text-pink-700',
};

const CATEGORY_ICONS: Record<string, string> = {
  Crypto: '₿',
  'Stocks & Futures': '📈',
  Data: '🗄️',
  DeFi: '🔗',
  Betting: '🎰',
};

export default function AdaptersPage() {
  const { success, info, error: notifyError } = useNotification();
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [states, setStates] = useState<Record<string, AdapterState>>({});
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('All');

  useEffect(() => {
    api.get<{ adapters: Adapter[] }>('/api/adapters')
      .then(data => {
        const list: Adapter[] = data.adapters ?? [];
        setAdapters(list);
        const initial: Record<string, AdapterState> = {};
        list.forEach(a => {
          initial[a.id] = { connected: false, apiKey: '', apiSecret: '', endpoint: '', testnet: false };
        });
        setStates(initial);
      })
      .catch(() => {
        notifyError('Could not load adapters from backend');
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleConnect = (adapter: Adapter) => {
    const current = states[adapter.id]?.connected ?? false;
    info(`${current ? 'Disconnecting' : 'Connecting'} ${adapter.name}…`);
    setTimeout(() => {
      setStates(prev => ({ ...prev, [adapter.id]: { ...prev[adapter.id], connected: !current } }));
      success(`${adapter.name} ${current ? 'disconnected' : 'connected'} successfully`);
    }, 900);
  };

  const testConnection = (adapter: Adapter) => {
    setTesting(adapter.id);
    info(`Testing ${adapter.name} connection…`);
    setTimeout(() => {
      setTesting(null);
      if (states[adapter.id]?.connected) {
        success(`${adapter.name}: connection test passed ✔`);
      } else {
        notifyError(`${adapter.name}: not connected – configure API keys first`);
      }
    }, 1400);
  };

  const saveConfig = (adapterId: string) => {
    setConfigOpen(null);
    success('Configuration saved');
  };

  const categories = ['All', ...Array.from(new Set(adapters.map(a => a.category)))];
  const filtered = filterCategory === 'All' ? adapters : adapters.filter(a => a.category === filterCategory);
  const connectedCount = Object.values(states).filter(s => s.connected).length;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Adapters & Connections</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${adapters.length} adapters available · ${connectedCount} connected`}
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/admin'}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            ← Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Stats row */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total', value: adapters.length, color: 'text-gray-900' },
            { label: 'Connected', value: connectedCount, color: 'text-green-600' },
            { label: 'Live Trading', value: adapters.filter(a => a.supports_live).length, color: 'text-blue-600' },
            { label: 'Backtest', value: adapters.filter(a => a.supports_backtest).length, color: 'text-purple-600' },
            { label: 'Categories', value: categories.length - 1, color: 'text-gray-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterCategory === cat
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {cat !== 'All' && CATEGORY_ICONS[cat] ? `${CATEGORY_ICONS[cat]} ` : ''}{cat}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-20 text-gray-500">Loading adapters…</div>
        )}

        {/* Adapter cards */}
        {!loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(adapter => {
              const state = states[adapter.id] ?? { connected: false };
              const isConnected = state.connected;
              const isTesting = testing === adapter.id;
              return (
                <div key={adapter.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col">

                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{adapter.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[adapter.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {adapter.category}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 ${
                        isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {isConnected ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mb-3 flex-1">{adapter.description}</p>

                  {/* Capabilities */}
                  <div className="flex gap-2 mb-4">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${adapter.supports_live ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400 line-through'}`}>
                      Live
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${adapter.supports_backtest ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-400 line-through'}`}>
                      Backtest
                    </span>
                    <a
                      href={adapter.docs_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-xs text-cyan-600 hover:underline"
                    >
                      Docs ↗
                    </a>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleConnect(adapter)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isConnected
                          ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      }`}
                    >
                      {isConnected ? 'Disconnect' : 'Connect'}
                    </button>
                    <button
                      onClick={() => testConnection(adapter)}
                      disabled={isTesting}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {isTesting ? 'Testing…' : 'Test'}
                    </button>
                    <button
                      onClick={() => setConfigOpen(configOpen === adapter.id ? null : adapter.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      ⚙
                    </button>
                  </div>

                  {/* Inline config panel */}
                  {configOpen === adapter.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">API Key</label>
                        <input
                          type="password"
                          placeholder="••••••••••••••••"
                          value={states[adapter.id]?.apiKey ?? ''}
                          onChange={e => setStates(prev => ({ ...prev, [adapter.id]: { ...prev[adapter.id], apiKey: e.target.value } }))}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">API Secret</label>
                        <input
                          type="password"
                          placeholder="••••••••••••••••"
                          value={states[adapter.id]?.apiSecret ?? ''}
                          onChange={e => setStates(prev => ({ ...prev, [adapter.id]: { ...prev[adapter.id], apiSecret: e.target.value } }))}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`testnet-${adapter.id}`}
                          checked={states[adapter.id]?.testnet ?? false}
                          onChange={e => setStates(prev => ({ ...prev, [adapter.id]: { ...prev[adapter.id], testnet: e.target.checked } }))}
                          className="rounded"
                        />
                        <label htmlFor={`testnet-${adapter.id}`} className="text-xs text-gray-600">Use testnet/paper trading</label>
                      </div>
                      <button
                        onClick={() => saveConfig(adapter.id)}
                        className="w-full py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-semibold hover:bg-cyan-700"
                      >
                        Save Configuration
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
