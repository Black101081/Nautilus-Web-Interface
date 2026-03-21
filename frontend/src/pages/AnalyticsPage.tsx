import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import api from '../lib/api';

interface PerformanceSummary {
  total_pnl: number;
  total_trades: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number | null;
  max_drawdown: number;
  sharpe_ratio: number;
  gross_profit: number;
  gross_loss: number;
}

interface EquityPoint {
  timestamp: string;
  equity: number;
  pnl: number;
}

interface WalkForwardWindow {
  window: number;
  in_sample: { total_pnl: number; trades: number; win_rate: number; sharpe: number };
  out_of_sample: { total_pnl: number; trades: number; win_rate: number; sharpe: number };
}

interface CorrelationResult {
  symbols: string[];
  matrix: (number | null)[][];
}

interface PositionSizeResult {
  account_equity: number;
  kelly_fraction: number;
  kelly_position: number;
  half_kelly_fraction: number;
  half_kelly_position: number;
  fixed_fraction: number;
  fixed_fraction_position: number;
  recommendation: string;
}

type Tab = 'performance' | 'equity' | 'walkforward' | 'correlation' | 'possize';

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function getHeatColor(val: number | null): string {
  if (val === null) return '#e5e7eb';
  if (val >= 0.8) return '#166534';
  if (val >= 0.6) return '#15803d';
  if (val >= 0.4) return '#4ade80';
  if (val >= 0.2) return '#bbf7d0';
  if (val >= -0.2) return '#f3f4f6';
  if (val >= -0.4) return '#fecaca';
  if (val >= -0.6) return '#f87171';
  if (val >= -0.8) return '#dc2626';
  return '#7f1d1d';
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('performance');
  const [perf, setPerf] = useState<PerformanceSummary | null>(null);
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [wfSymbol, setWfSymbol] = useState('BTCUSDT');
  const [wfInterval, setWfInterval] = useState('1h');
  const [wfInSample, setWfInSample] = useState(200);
  const [wfOutSample, setWfOutSample] = useState(50);
  const [wfWindows, setWfWindows] = useState(5);
  const [wfResult, setWfResult] = useState<{ windows: WalkForwardWindow[]; combined_out_of_sample: any } | null>(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [corrSymbols, setCorrSymbols] = useState('BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT');
  const [corrInterval, setCorrInterval] = useState('1d');
  const [corrResult, setCorrResult] = useState<CorrelationResult | null>(null);
  const [corrLoading, setCorrLoading] = useState(false);
  const [posAccount, setPosAccount] = useState(100000);
  const [posWinRate, setPosWinRate] = useState(0.55);
  const [posAvgWin, setPosAvgWin] = useState(200);
  const [posAvgLoss, setPosAvgLoss] = useState(100);
  const [posRisk, setPosRisk] = useState(1.0);
  const [posResult, setPosResult] = useState<PositionSizeResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'performance' && !perf) fetchPerf();
    if (tab === 'equity' && equity.length === 0) fetchEquity();
  }, [tab]);

  const fetchPerf = async () => {
    setLoading(true);
    try {
      const d = await api.get<PerformanceSummary>('/api/analytics/performance');
      setPerf(d);
    } finally {
      setLoading(false);
    }
  };

  const fetchEquity = async () => {
    setLoading(true);
    try {
      const d = await api.get<{ points: EquityPoint[] }>('/api/analytics/equity-curve');
      setEquity(d.points || []);
    } finally {
      setLoading(false);
    }
  };

  const runWalkForward = async () => {
    setWfLoading(true);
    try {
      const d = await api.post<any>('/api/analytics/walk-forward', {
        strategy_id: 'demo',
        symbol: wfSymbol,
        interval: wfInterval,
        in_sample_bars: wfInSample,
        out_sample_bars: wfOutSample,
        windows: wfWindows,
      });
      setWfResult(d);
    } catch (e: any) {
      alert(e.message || 'Walk-forward failed');
    } finally {
      setWfLoading(false);
    }
  };

  const runCorrelation = async () => {
    setCorrLoading(true);
    try {
      const d = await api.get<CorrelationResult>(
        `/api/analytics/correlation?symbols=${corrSymbols}&interval=${corrInterval}&limit=90`
      );
      setCorrResult(d);
    } catch (e: any) {
      alert(e.message || 'Correlation failed');
    } finally {
      setCorrLoading(false);
    }
  };

  const calcPositionSize = async () => {
    try {
      const d = await api.post<PositionSizeResult>('/api/analytics/position-size', {
        account_equity: posAccount,
        win_rate: posWinRate,
        avg_win: posAvgWin,
        avg_loss: posAvgLoss,
        risk_pct: posRisk,
      });
      setPosResult(d);
    } catch (e: any) {
      alert(e.message || 'Calculation failed');
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'performance', label: '📈 Performance' },
    { id: 'equity', label: '💰 Equity Curve' },
    { id: 'walkforward', label: '🔄 Walk-Forward' },
    { id: 'correlation', label: '🔗 Correlation' },
    { id: 'possize', label: '⚖️ Position Size' },
  ];

  return (
    <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">📊 Analytics</h1>
            <p className="text-gray-500">Portfolio analytics, walk-forward analysis, and correlation matrix</p>
          </div>
          <div className="flex gap-3">
            <a href="/api/reports/excel" target="_blank"
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm">
              ↓ Excel
            </a>
            <a href="/api/reports/pdf" target="_blank"
              className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm">
              ↓ PDF
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tab === t.id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Performance tab */}
        {tab === 'performance' && (
          <div>
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading performance data...</div>
            ) : perf ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <MetricCard label="Total PnL" value={`$${perf.total_pnl.toFixed(2)}`} color={perf.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'} />
                  <MetricCard label="Total Trades" value={perf.total_trades} />
                  <MetricCard label="Win Rate" value={`${(perf.win_rate * 100).toFixed(1)}%`} />
                  <MetricCard label="Sharpe Ratio" value={perf.sharpe_ratio.toFixed(3)} sub="annualized" />
                  <MetricCard label="Profit Factor" value={perf.profit_factor != null ? perf.profit_factor.toFixed(3) : '∞'} color={perf.profit_factor != null && perf.profit_factor >= 1.5 ? 'text-green-600' : 'text-red-600'} />
                  <MetricCard label="Max Drawdown" value={`$${perf.max_drawdown.toFixed(2)}`} color="text-red-600" />
                  <MetricCard label="Gross Profit" value={`$${perf.gross_profit.toFixed(2)}`} color="text-green-600" />
                  <MetricCard label="Gross Loss" value={`$${Math.abs(perf.gross_loss).toFixed(2)}`} color="text-red-600" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard label="Avg Win" value={`$${perf.avg_win.toFixed(2)}`} color="text-green-600" />
                  <MetricCard label="Avg Loss" value={`$${Math.abs(perf.avg_loss).toFixed(2)}`} color="text-red-600" />
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">No performance data available yet.</div>
            )}
          </div>
        )}

        {/* Equity Curve tab */}
        {tab === 'equity' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-4">Equity Curve</h2>
            {loading ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : equity.length > 1 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={equity} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 9, fill: '#9ca3af' }} interval={Math.floor(equity.length / 6)} tickLine={false}
                    tickFormatter={v => v ? new Date(v).toLocaleDateString() : ''} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={80}
                    tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']} />
                  <Line type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-400">No trades recorded yet — execute some trades to see the equity curve.</div>
            )}
          </div>
        )}

        {/* Walk-Forward tab */}
        {tab === 'walkforward' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-4">Walk-Forward Analysis</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Symbol</label>
                  <input value={wfSymbol} onChange={e => setWfSymbol(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Interval</label>
                  <select value={wfInterval} onChange={e => setWfInterval(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {['1m','5m','15m','1h','4h','1d'].map(iv => <option key={iv}>{iv}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">In-Sample Bars</label>
                  <input type="number" value={wfInSample} min={50} max={1000}
                    onChange={e => setWfInSample(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">OOS Bars</label>
                  <input type="number" value={wfOutSample} min={10} max={500}
                    onChange={e => setWfOutSample(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Windows</label>
                  <input type="number" value={wfWindows} min={2} max={20}
                    onChange={e => setWfWindows(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <button onClick={runWalkForward} disabled={wfLoading}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm disabled:opacity-50">
                {wfLoading ? 'Running...' : '▶ Run Walk-Forward'}
              </button>
            </div>

            {wfResult && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-4">Results — {wfResult.windows.length} windows</h3>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <MetricCard label="Combined OOS PnL"
                    value={`$${wfResult.combined_out_of_sample.total_pnl.toFixed(4)}`}
                    color={wfResult.combined_out_of_sample.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'} />
                  <MetricCard label="Positive Windows"
                    value={`${wfResult.combined_out_of_sample.positive_windows}/${wfResult.combined_out_of_sample.total_windows}`} />
                  <MetricCard label="Avg OOS PnL/Window"
                    value={`$${wfResult.combined_out_of_sample.avg_pnl_per_window.toFixed(4)}`} />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-gray-600 font-semibold">Window</th>
                        <th className="px-4 py-2 text-right text-blue-600">IS PnL</th>
                        <th className="px-4 py-2 text-right text-blue-600">IS Trades</th>
                        <th className="px-4 py-2 text-right text-blue-600">IS Win%</th>
                        <th className="px-4 py-2 text-right text-indigo-600">OOS PnL</th>
                        <th className="px-4 py-2 text-right text-indigo-600">OOS Trades</th>
                        <th className="px-4 py-2 text-right text-indigo-600">OOS Win%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {wfResult.windows.map((w: WalkForwardWindow) => (
                        <tr key={w.window} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-semibold">#{w.window}</td>
                          <td className={`px-4 py-2 text-right ${w.in_sample.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {w.in_sample.total_pnl.toFixed(4)}
                          </td>
                          <td className="px-4 py-2 text-right">{w.in_sample.trades}</td>
                          <td className="px-4 py-2 text-right">{(w.in_sample.win_rate * 100).toFixed(1)}%</td>
                          <td className={`px-4 py-2 text-right font-semibold ${w.out_of_sample.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {w.out_of_sample.total_pnl.toFixed(4)}
                          </td>
                          <td className="px-4 py-2 text-right">{w.out_of_sample.trades}</td>
                          <td className="px-4 py-2 text-right">{(w.out_of_sample.win_rate * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Correlation tab */}
        {tab === 'correlation' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-4">Return Correlation Matrix</h2>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Symbols (comma-separated)</label>
                  <input value={corrSymbols} onChange={e => setCorrSymbols(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="w-32">
                  <label className="text-xs text-gray-500 block mb-1">Interval</label>
                  <select value={corrInterval} onChange={e => setCorrInterval(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {['1h','4h','1d','1w'].map(iv => <option key={iv}>{iv}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={runCorrelation} disabled={corrLoading}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm disabled:opacity-50">
                    {corrLoading ? 'Computing...' : '▶ Compute'}
                  </button>
                </div>
              </div>

              {corrResult && (
                <div>
                  <div className="text-xs text-gray-400 mb-3">
                    Log returns correlation · {corrInterval} bars
                  </div>
                  <div className="overflow-x-auto">
                    <table className="text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="w-24"></th>
                          {corrResult.symbols.map(s => (
                            <th key={s} className="px-2 py-1 text-center text-gray-600 font-semibold w-20">{s.replace('USDT','')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {corrResult.symbols.map((row, i) => (
                          <tr key={row}>
                            <td className="px-2 py-1 font-semibold text-gray-700">{row.replace('USDT','')}</td>
                            {corrResult.matrix[i].map((val, j) => (
                              <td key={j} className="px-2 py-1 text-center font-semibold w-20 h-10"
                                style={{ backgroundColor: getHeatColor(val), color: val != null && (val > 0.4 || val < -0.4) ? 'white' : '#374151' }}>
                                {val != null ? val.toFixed(2) : 'n/a'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap text-xs">
                    <span className="px-2 py-1 rounded" style={{ backgroundColor: getHeatColor(0.9), color: 'white' }}>High +</span>
                    <span className="px-2 py-1 rounded" style={{ backgroundColor: getHeatColor(0.5) }}>Moderate +</span>
                    <span className="px-2 py-1 rounded" style={{ backgroundColor: getHeatColor(0) }}>Low</span>
                    <span className="px-2 py-1 rounded" style={{ backgroundColor: getHeatColor(-0.5) }}>Moderate −</span>
                    <span className="px-2 py-1 rounded" style={{ backgroundColor: getHeatColor(-0.9), color: 'white' }}>High −</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Position Sizing tab */}
        {tab === 'possize' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-4">Position Size Calculator</h2>
              {[
                { label: 'Account Equity ($)', value: posAccount, set: setPosAccount, step: 1000, min: 100 },
                { label: 'Win Rate (0–1)', value: posWinRate, set: setPosWinRate, step: 0.01, min: 0.01, max: 0.99 },
                { label: 'Avg Win ($)', value: posAvgWin, set: setPosAvgWin, step: 10, min: 1 },
                { label: 'Avg Loss ($)', value: posAvgLoss, set: setPosAvgLoss, step: 10, min: 1 },
                { label: 'Fixed Risk %', value: posRisk, set: setPosRisk, step: 0.1, min: 0.1, max: 100 },
              ].map(({ label, value, set, step, min, max }) => (
                <div key={label} className="mb-4">
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input type="number" value={value} step={step} min={min} max={max}
                    onChange={e => set(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
              <button onClick={calcPositionSize}
                className="w-full px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm">
                Calculate
              </button>
            </div>

            {posResult && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Results</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Full Kelly', fraction: posResult.kelly_fraction, position: posResult.kelly_position },
                      { label: 'Half Kelly (recommended)', fraction: posResult.half_kelly_fraction, position: posResult.half_kelly_position },
                      { label: `Fixed ${posResult.fixed_fraction * 100}%`, fraction: posResult.fixed_fraction, position: posResult.fixed_fraction_position },
                    ].map(({ label, fraction, position }) => (
                      <div key={label} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <div>
                          <div className="font-semibold text-sm text-gray-800">{label}</div>
                          <div className="text-xs text-gray-400">{(fraction * 100).toFixed(2)}% of equity</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-indigo-700">${position.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                    <div className="text-xs font-semibold text-indigo-700">
                      Recommendation: {posResult.recommendation === 'half_kelly' ? 'Half-Kelly (safer for real trading)' : 'Full Kelly'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
