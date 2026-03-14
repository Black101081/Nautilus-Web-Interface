import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../config';

interface Alert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  price: number;
  message: string;
  status: 'active' | 'triggered' | 'dismissed';
  created_at: string;
  triggered_at: string | null;
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT'];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    symbol: 'BTCUSDT',
    condition: 'above' as 'above' | 'below',
    price: 0,
    message: '',
  });

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/alerts`);
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.price) return;
    try {
      const res = await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ symbol: 'BTCUSDT', condition: 'above', price: 0, message: '' });
        fetchAlerts();
      }
    } catch (err) {
      console.error('Failed to create alert:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alert?')) return;
    try {
      await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/alerts/${id}`, { method: 'DELETE' });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      triggered: 'bg-blue-100 text-blue-800',
      dismissed: 'bg-gray-100 text-gray-600',
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-yellow-50 p-8 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-yellow-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">🔔 Alerts & Notifications</h1>
            <p className="text-gray-500">Configure price alerts and system notifications</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.href = '/trader'}
              className="px-5 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-all"
            >
              ← Back
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-semibold transition-all"
            >
              + New Alert
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Alerts', value: alerts.length, color: 'text-gray-900' },
            { label: 'Active', value: alerts.filter(a => a.status === 'active').length, color: 'text-green-600' },
            { label: 'Triggered', value: alerts.filter(a => a.status === 'triggered').length, color: 'text-blue-600' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl shadow p-5 text-center">
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Alert List */}
        {alerts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🔔</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Alerts Set</h3>
            <p className="text-gray-500 mb-6">Create a price alert to get notified when the market moves</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-semibold"
            >
              + Create First Alert
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => (
              <div key={alert.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center text-2xl">
                    {alert.condition === 'above' ? '📈' : '📉'}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-lg">
                      {alert.symbol} {alert.condition === 'above' ? '▲' : '▼'} ${alert.price.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">{alert.message}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Created {new Date(alert.created_at).toLocaleString()}
                      {alert.triggered_at && ` · Triggered ${new Date(alert.triggered_at).toLocaleString()}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(alert.status)}`}>
                    {alert.status}
                  </span>
                  <button
                    onClick={() => handleDelete(alert.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Delete alert"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Price Alert</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Symbol</label>
                  <select
                    value={form.symbol}
                    onChange={e => setForm({ ...form, symbol: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:outline-none"
                  >
                    {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Condition</label>
                  <select
                    value={form.condition}
                    onChange={e => setForm({ ...form, condition: e.target.value as 'above' | 'below' })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:outline-none"
                  >
                    <option value="above">Price goes above</option>
                    <option value="below">Price goes below</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.price || ''}
                    onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:outline-none"
                    placeholder="e.g. 65000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Message (optional)</label>
                  <input
                    type="text"
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-yellow-400 focus:outline-none"
                    placeholder="Alert description..."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-5 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.price}
                  className="flex-1 px-5 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-semibold disabled:opacity-50"
                >
                  Create Alert
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
