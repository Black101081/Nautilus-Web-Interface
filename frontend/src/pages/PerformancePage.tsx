import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import api from '../lib/api';

interface PerformanceSummary {
  total_pnl: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
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

interface RiskMetrics {
  total_pnl: number;
  total_trades: number;
  max_drawdown: number;
  sharpe_ratio: number;
  var_95: number;
  total_exposure: number;
}

function formatCurrency(v: number) {
  const sign = v >= 0 ? '+' : '';
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PerformancePage() {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [risk, setRisk] = useState<RiskMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, tradesRes, riskRes] = await Promise.allSettled([
        api.get<PerformanceSummary>('/api/performance/summary'),
        api.get<{ trades: Trade[] }>('/api/trades?limit=30'),
        api.get<RiskMetrics>('/api/risk/metrics'),
      ]);

      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
      if (tradesRes.status === 'fulfilled') setTrades(tradesRes.value.trades ?? []);
      if (riskRes.status === 'fulfilled') setRisk(riskRes.value);
    } catch (err) {
      console.error('Failed to fetch performance data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const pnlColor = (v: number) => (v >= 0 ? 'text-green-600' : 'text-red-600');

  // Build win/loss bar chart data
  const wlData = summary
    ? [
        { label: 'Wins', value: summary.winning_trades ?? 0, color: '#16a34a' },
        { label: 'Losses', value: summary.losing_trades ?? 0, color: '#dc2626' },
      ]
    : [];

  // Build mini P&L distribution from recent trades (dummy bins if no data)
  const tradesBySide = {
    BUY: trades.filter(t => t.side === 'BUY').length,
    SELL: trades.filter(t => t.side === 'SELL').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg animate-pulse">Loading performance data…</div>
      </div>
    );
  }

  const noData = !summary || summary.total_trades === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Performance Analytics</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Aggregated results across all backtests &amp; live sessions
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-sm"
            >
              ⟳ Refresh
            </button>
            <button
              onClick={() => window.location.href = '/trader'}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              ← Back
            </button>
          </div>
        </div>

        {noData ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <div className="text-5xl mb-4">📊</div>
            <div className="text-xl font-bold text-gray-800 mb-2">No trading data yet</div>
            <p className="text-gray-500 text-sm mb-6">
              Run a backtest to generate performance metrics.
            </p>
            <a
              href="/trader/backtesting"
              className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-xl font-semibold hover:bg-cyan-700 text-sm"
            >
              Go to Backtesting →
            </a>
          </div>
        ) : (
          <>
            {/* P&L Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className={`rounded-xl p-5 shadow-sm border ${summary!.total_pnl >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-xs text-gray-500 mb-1">Total P&L</div>
                <div className={`text-2xl font-bold ${pnlColor(summary!.total_pnl)}`}>
                  {formatCurrency(summary!.total_pnl)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Realized P&L</div>
                <div className={`text-2xl font-bold ${pnlColor(summary!.realized_pnl)}`}>
                  {formatCurrency(summary!.realized_pnl)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Win Rate</div>
                <div className={`text-2xl font-bold ${summary!.win_rate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary!.win_rate.toFixed(1)}%
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Total Trades</div>
                <div className="text-2xl font-bold text-gray-900">{summary!.total_trades}</div>
              </div>
            </div>

            {/* Risk + Win/Loss Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

              {/* Risk Metrics */}
              {risk && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-bold text-gray-700 mb-4">Risk Metrics</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Max Drawdown', value: `${risk.max_drawdown.toFixed(2)}%`, color: 'text-orange-600' },
                      { label: 'Sharpe Ratio', value: risk.sharpe_ratio.toFixed(2), color: risk.sharpe_ratio >= 1 ? 'text-green-600' : 'text-gray-700' },
                      { label: 'VaR (95%)', value: formatCurrency(risk.var_95), color: 'text-red-600' },
                      { label: 'Open Positions', value: String(summary!.open_positions), color: 'text-blue-600' },
                    ].map(m => (
                      <div key={m.label} className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">{m.label}</div>
                        <div className={`text-lg font-bold mt-0.5 ${m.color}`}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Win / Loss Bar */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-gray-700 mb-4">Win / Loss Distribution</h2>
                {wlData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={wlData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {wlData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">No trade data</div>
                )}
                <div className="mt-2 flex justify-between text-xs text-gray-400">
                  <span className="text-green-600 font-medium">Wins: {summary!.winning_trades ?? 0}</span>
                  <span className="text-red-600 font-medium">Losses: {summary!.losing_trades ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Win Rate progress bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-bold text-gray-700">Win Rate Progress</h2>
                <span className={`text-sm font-bold ${pnlColor(summary!.win_rate - 50)}`}>{summary!.win_rate.toFixed(1)}%</span>
              </div>
              <div className="h-4 bg-red-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, summary!.win_rate)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Losses: {Math.round(summary!.total_trades * (1 - summary!.win_rate / 100))}</span>
                <span>50% break-even</span>
                <span>Wins: {Math.round(summary!.total_trades * summary!.win_rate / 100)}</span>
              </div>
            </div>

            {/* Recent Trades */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-700">Recent Trades</h2>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>BUY: <span className="text-green-600 font-semibold">{tradesBySide.BUY}</span></span>
                  <span>SELL: <span className="text-red-600 font-semibold">{tradesBySide.SELL}</span></span>
                </div>
              </div>

              {trades.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">📋</div>
                  <div className="text-gray-500 text-sm">No trade history yet. Run a backtest to generate trades.</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Trade ID', 'Instrument', 'Side', 'Qty', 'Fill Price', 'Status', 'Time'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {trades.map(trade => (
                        <tr key={trade.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 font-mono text-gray-500 text-xs truncate max-w-[120px]">{trade.id}</td>
                          <td className="px-5 py-3 font-semibold text-gray-900">{trade.instrument}</td>
                          <td className="px-5 py-3">
                            <span className={`font-bold ${trade.side === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                              {trade.side}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-700">{trade.filled_qty?.toLocaleString()}</td>
                          <td className="px-5 py-3 text-gray-700">
                            {trade.price != null ? `$${trade.price.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                              {trade.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-gray-400">
                            {trade.timestamp ? new Date(trade.timestamp).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
