import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';

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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [triggeredNotice, setTriggeredNotice] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    symbol: 'BTCUSDT',
    condition: 'above' as 'above' | 'below',
    price: 0,
    message: '',
  });
  const { lastMessage } = useWebSocket();
  const prevMessageRef = useRef(lastMessage);

  useEffect(() => {
    fetchAlerts();
  }, []);

  // Listen for alert_triggered WebSocket events
  useEffect(() => {
    if (lastMessage && lastMessage !== prevMessageRef.current) {
      prevMessageRef.current = lastMessage;
      if (lastMessage.type === 'alert_triggered') {
        fetchAlerts();
        const alertData = (lastMessage as any).alert;
        const notice = alertData
          ? `Alert triggered: ${alertData.symbol} ${alertData.condition} $${alertData.price}`
          : 'An alert was triggered';
        setTriggeredNotice(notice);
        setTimeout(() => setTriggeredNotice(null), 5000);
      }
    }
  }, [lastMessage]);

  const fetchAlerts = async () => {
    try {
      const data = await api.get<{ alerts: Alert[] }>('/api/alerts');
      setAlerts(data.alerts || []);
      setFetchError(null);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.price) return;
    setFormError(null);
    try {
      await api.post('/api/alerts', form);
      setShowModal(false);
      setForm({ symbol: 'BTCUSDT', condition: 'above', price: 0, message: '' });
      fetchAlerts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create alert');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await api.put(`/api/alerts/${id}/dismiss`, {});
      fetchAlerts();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to dismiss alert');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alert?')) return;
    try {
      await api.delete(`/api/alerts/${id}`);
      fetchAlerts();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to delete alert');
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
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
        {triggeredNotice && (
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm font-semibold">
            🔔 {triggeredNotice}
          </div>
        )}
        {fetchError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {fetchError}
          </div>
        )}
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">🔔 Alerts & Notifications</h1>
            <p className="text-gray-500">Configure price alerts and system notifications</p>
          </div>
          <div className="flex gap-3">
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
                  {alert.status === 'active' && (
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                      title="Dismiss alert"
                    >
                      ✕
                    </button>
                  )}
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
              {formError && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  {formError}
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowModal(false); setFormError(null); }}
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
  );
}
