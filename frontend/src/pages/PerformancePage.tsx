import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../config';

interface PerformanceSummary {
  total_pnl: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_trades: number;
  win_rate: number;
  total_positions: number;
  open_positions: number;
}

interface Trade {
  id: string;
  instrument: string;
  side: string;
  quantity: number;
  price: number | null;
  status: string;
  filled_qty: number;
  timestamp: string;
}

export default function PerformancePage() {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [summaryRes, tradesRes] = await Promise.all([
        fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/performance/summary`),
        fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/trades?limit=20`),
      ]);
      const summaryData = await summaryRes.json();
      const tradesData = await tradesRes.json();
      setSummary(summaryData);
      setTrades(tradesData.trades || []);
    } catch (err) {
      console.error('Failed to fetch performance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPnLColor = (v: number) => v >= 0 ? 'text-green-600' : 'text-red-600';
  const getPnLBg = (v: number) => v >= 0 ? 'bg-green-50' : 'bg-red-50';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 p-8 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading performance data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">📉 Performance Analytics</h1>
            <p className="text-gray-500">Trading performance and P&L reports</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchData}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold"
            >
              ⟳ Refresh
            </button>
            <button
              onClick={() => window.location.href = '/trader'}
              className="px-5 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className={`rounded-xl p-5 shadow-sm border ${getPnLBg(summary.total_pnl)} border-gray-100`}>
                <div className="text-sm text-gray-500 mb-1">Total P&L</div>
                <div className={`text-3xl font-bold ${getPnLColor(summary.total_pnl)}`}>
                  {summary.total_pnl >= 0 ? '+' : ''}${summary.total_pnl.toFixed(2)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="text-sm text-gray-500 mb-1">Realized P&L</div>
                <div className={`text-3xl font-bold ${getPnLColor(summary.realized_pnl)}`}>
                  {summary.realized_pnl >= 0 ? '+' : ''}${summary.realized_pnl.toFixed(2)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="text-sm text-gray-500 mb-1">Unrealized P&L</div>
                <div className={`text-3xl font-bold ${getPnLColor(summary.unrealized_pnl)}`}>
                  {summary.unrealized_pnl >= 0 ? '+' : ''}${summary.unrealized_pnl.toFixed(2)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="text-sm text-gray-500 mb-1">Win Rate</div>
                <div className={`text-3xl font-bold ${summary.win_rate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.win_rate.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Total Trades', value: summary.total_trades, icon: '🔄' },
                { label: 'Total Positions', value: summary.total_positions, icon: '💼' },
                { label: 'Open Positions', value: summary.open_positions, icon: '📂' },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="text-3xl">{item.icon}</div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                    <div className="text-sm text-gray-500">{item.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Win Rate Progress */}
        {summary && summary.total_trades > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Win/Loss Ratio</h2>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1 h-6 bg-red-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${summary.win_rate}%` }}
                />
              </div>
              <div className="text-sm font-semibold w-16 text-right text-green-600">{summary.win_rate.toFixed(1)}% wins</div>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Losing trades: {Math.round(summary.total_trades * (1 - summary.win_rate / 100))}</span>
              <span>Winning trades: {Math.round(summary.total_trades * summary.win_rate / 100)}</span>
            </div>
          </div>
        )}

        {/* Recent Trades */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Recent Trades</h2>
          </div>
          {trades.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">📋</div>
              <div className="text-gray-500">No trades yet. Create orders to see trade history.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['Trade ID', 'Instrument', 'Side', 'Qty', 'Price', 'Status', 'Time'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {trades.map(trade => (
                    <tr key={trade.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 text-sm font-mono text-gray-700">{trade.id}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-900">{trade.instrument}</td>
                      <td className="px-5 py-4 text-sm">
                        <span className={`font-bold ${trade.side === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">{trade.filled_qty}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {trade.price ? `$${trade.price.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                          {trade.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400">
                        {new Date(trade.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
