import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { API_CONFIG } from '../config';

interface Strategy {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface EquityPoint {
  time: string;
  equity: number;
}

interface BacktestResult {
  strategy_id: string;
  strategy_name?: string;
  start_date: string;
  end_date: string;
  starting_balance: number;
  ending_balance: number;
  total_pnl: number;
  total_trades: number;
  winning_trades?: number;
  losing_trades?: number;
  win_rate: number;
  max_drawdown?: number;
  sharpe_ratio?: number;
  total_orders?: number;
  completed_at: string;
  equity_curve?: EquityPoint[];
  positions?: any[];
  fast_period?: number;
  slow_period?: number;
}

type Mode = 'demo' | 'real';

const METRIC = (label: string, value: string, sub?: string, color?: string) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
    <div className="text-xs text-gray-500 mb-1">{label}</div>
    <div className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</div>
    {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
  </div>
);

function formatEquityLabel(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function BacktestingPage() {
  const [mode, setMode] = useState<Mode>('demo');

  // Demo mode params
  const [fastPeriod, setFastPeriod] = useState(10);
  const [slowPeriod, setSlowPeriod] = useState(20);
  const [numBars, setNumBars] = useState(500);
  const [demoBalance, setDemoBalance] = useState(100000);

  // Real mode params
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [realBalance, setRealBalance] = useState(100000);

  const [result, setResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPositions, setShowPositions] = useState(false);

  useEffect(() => {
    fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/strategies`)
      .then(r => r.json())
      .then(data => {
        const strats: Strategy[] = Array.isArray(data) ? data : (data.strategies ?? []);
        setStrategies(strats);
        if (strats.length > 0) setSelectedStrategy(strats[0].id);
      })
      .catch(() => {});
  }, []);

  const runBacktest = async () => {
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      if (mode === 'demo') {
        if (fastPeriod >= slowPeriod) {
          setError('Fast period must be less than slow period.');
          setRunning(false);
          return;
        }
        const res = await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/nautilus/demo-backtest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fast_period: fastPeriod,
            slow_period: slowPeriod,
            starting_balance: demoBalance,
            num_bars: numBars,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? 'Demo backtest failed');
        setResult(data.result);
      } else {
        if (!selectedStrategy) {
          setError('Please select a strategy first.');
          setRunning(false);
          return;
        }
        const res = await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/nautilus/backtest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategy_id: selectedStrategy,
            start_date: startDate,
            end_date: endDate,
            starting_balance: realBalance,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? 'Backtest failed');
        setResult(data.result);
      }
    } catch (err: any) {
      setError(err.message ?? 'Backtest failed. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  const pnlColor = (v: number) => (v >= 0 ? 'text-green-600' : 'text-red-600');
  const pnlBg = (v: number) => (v >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200');

  const equityCurve = result?.equity_curve ?? [];
  const startingBalance = result?.starting_balance ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Backtesting</h1>
            <p className="text-gray-500 text-sm mt-0.5">Run strategy simulations on historical or synthetic data</p>
          </div>
          <button
            onClick={() => window.location.href = '/trader'}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
          >
            ← Back
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Config Panel ──────────────────────────────────────── */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 self-start">

            {/* Mode tabs */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-5">
              {(['demo', 'real'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                    mode === m
                      ? 'bg-cyan-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {m === 'demo' ? '🧪 Demo Mode' : '📊 Real Data'}
                </button>
              ))}
            </div>

            {mode === 'demo' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 bg-cyan-50 rounded-lg px-3 py-2">
                  Demo mode generates synthetic EUR/USD price data and runs a real SMA Crossover strategy through the NautilusTrader BacktestEngine.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Fast SMA Period</label>
                    <input
                      type="number" min={2} max={50}
                      value={fastPeriod}
                      onChange={e => setFastPeriod(Number(e.target.value))}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-cyan-400 focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Slow SMA Period</label>
                    <input
                      type="number" min={3} max={200}
                      value={slowPeriod}
                      onChange={e => setSlowPeriod(Number(e.target.value))}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-cyan-400 focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Number of 1-min Bars</label>
                  <select
                    value={numBars}
                    onChange={e => setNumBars(Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-cyan-400 focus:outline-none text-sm"
                  >
                    <option value={200}>200 bars (~3 hours)</option>
                    <option value={500}>500 bars (~8 hours)</option>
                    <option value={1000}>1 000 bars (~17 hours)</option>
                    <option value={2000}>2 000 bars (~33 hours)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Starting Balance ($)</label>
                  <input
                    type="number" min={1000} step={1000}
                    value={demoBalance}
                    onChange={e => setDemoBalance(Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-cyan-400 focus:outline-none text-sm"
                  />
                </div>
              </div>
            )}

            {mode === 'real' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Strategy</label>
                  {strategies.length === 0 ? (
                    <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                      No strategies yet.{' '}
                      <a href="/trader/strategies" className="text-cyan-600 hover:underline">Create one →</a>
                    </div>
                  ) : (
                    <select
                      value={selectedStrategy}
                      onChange={e => setSelectedStrategy(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-cyan-400 focus:outline-none text-sm"
                    >
                      {strategies.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                    <input type="date" value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-cyan-400 focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                    <input type="date" value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-cyan-400 focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Starting Balance ($)</label>
                  <input type="number" min={1000} step={1000}
                    value={realBalance}
                    onChange={e => setRealBalance(Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-cyan-400 focus:outline-none text-sm"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={runBacktest}
              disabled={running}
              className="mt-5 w-full py-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {running ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Running…
                </>
              ) : '▶  Run Backtest'}
            </button>
          </div>

          {/* ── Results Panel ─────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-4">

            {running && (
              <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center">
                <svg className="animate-spin h-10 w-10 text-cyan-600 mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <div className="text-cyan-800 font-semibold text-lg">Running NautilusTrader backtest…</div>
                <div className="text-cyan-600 text-sm mt-1">Executing strategy against historical data</div>
              </div>
            )}

            {!running && !result && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center flex flex-col items-center justify-center">
                <div className="text-5xl mb-3">🔬</div>
                <div className="text-xl font-bold text-gray-900 mb-1">No Results Yet</div>
                <div className="text-gray-500 text-sm">Configure parameters and click Run Backtest</div>
              </div>
            )}

            {result && !running && (
              <>
                {/* P&L banner */}
                <div className={`rounded-2xl border p-5 ${pnlBg(result.total_pnl)}`}>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Total P&L</div>
                      <div className={`text-4xl font-bold ${pnlColor(result.total_pnl)}`}>
                        {result.total_pnl >= 0 ? '+' : ''}${result.total_pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {((result.total_pnl / result.starting_balance) * 100).toFixed(2)}% return
                        &nbsp;·&nbsp;
                        ${result.starting_balance.toLocaleString()} → ${result.ending_balance.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      {result.strategy_name && <div className="font-medium text-gray-700 mb-0.5">{result.strategy_name}</div>}
                      <div>{result.start_date} → {result.end_date}</div>
                      <div>Completed: {new Date(result.completed_at).toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {METRIC('Total Trades', String(result.total_trades))}
                  {METRIC('Win Rate', `${result.win_rate.toFixed(1)}%`, undefined, result.win_rate >= 50 ? 'text-green-600' : 'text-red-600')}
                  {METRIC('Max Drawdown', result.max_drawdown != null ? `${result.max_drawdown.toFixed(2)}%` : '-', undefined, 'text-orange-600')}
                  {METRIC('Sharpe Ratio', result.sharpe_ratio != null ? result.sharpe_ratio.toFixed(2) : '-', undefined, result.sharpe_ratio && result.sharpe_ratio >= 1 ? 'text-green-600' : 'text-gray-700')}
                </div>
                {result.winning_trades != null && (
                  <div className="grid grid-cols-3 gap-3">
                    {METRIC('Winning Trades', String(result.winning_trades), undefined, 'text-green-600')}
                    {METRIC('Losing Trades', String(result.losing_trades ?? 0), undefined, 'text-red-600')}
                    {METRIC('Total Orders', String(result.total_orders ?? 0))}
                  </div>
                )}

                {/* Equity curve */}
                {equityCurve.length > 1 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-700 mb-3">Equity Curve</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={equityCurve} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="time"
                          tickFormatter={formatTime}
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tickFormatter={formatEquityLabel}
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                          width={60}
                        />
                        <Tooltip
                          formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Equity']}
                          labelFormatter={(label: string) => `Time: ${label}`}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <ReferenceLine y={startingBalance} stroke="#d1d5db" strokeDasharray="4 2" />
                        <Line
                          type="monotone"
                          dataKey="equity"
                          stroke={result.total_pnl >= 0 ? '#16a34a' : '#dc2626'}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Start: ${startingBalance.toLocaleString()}</span>
                      <span>End: ${result.ending_balance.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Positions table (collapsible) */}
                {result.positions && result.positions.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <button
                      onClick={() => setShowPositions(v => !v)}
                      className="w-full flex justify-between items-center px-5 py-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      <span>Positions ({result.positions.length})</span>
                      <span>{showPositions ? '▲' : '▼'}</span>
                    </button>
                    {showPositions && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              {['Instrument', 'Side', 'Qty', 'Avg Open', 'Avg Close', 'Realized P&L', 'Status'].map(h => (
                                <th key={h} className="px-4 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {result.positions.slice(0, 50).map((pos, i) => {
                              const side = String(pos.side ?? '');
                              const isBuy = side.includes('LONG') || side.includes('BUY');
                              return (
                                <tr key={i} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 font-mono text-gray-700">{pos.instrument_id}</td>
                                  <td className="px-4 py-2">
                                    <span className={`font-bold ${isBuy ? 'text-green-600' : 'text-red-600'}`}>
                                      {isBuy ? 'LONG' : 'SHORT'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-gray-700">{Number(pos.quantity).toLocaleString()}</td>
                                  <td className="px-4 py-2 text-gray-700">{pos.avg_px_open?.toFixed(5) ?? '-'}</td>
                                  <td className="px-4 py-2 text-gray-700">{pos.avg_px_close?.toFixed(5) ?? '-'}</td>
                                  <td className={`px-4 py-2 font-semibold ${pos.realized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {pos.realized_pnl >= 0 ? '+' : ''}{pos.realized_pnl?.toFixed(2) ?? '0.00'}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pos.is_closed ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                                      {pos.is_closed ? 'CLOSED' : 'OPEN'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {result.positions.length > 50 && (
                          <div className="text-center text-xs text-gray-400 py-2">Showing 50 of {result.positions.length} positions</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
