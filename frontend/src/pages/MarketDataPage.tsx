import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import api from '../lib/api';

interface Instrument {
  symbol: string;
  base: string;
  quote: string;
  exchange: string;
  price: number;
  change_24h: number;
}

interface MarketQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume_24h: number;
  change_24h: number;
  timestamp: string;
}

interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

function CandlestickTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const color = d.close >= d.open ? '#16a34a' : '#dc2626';
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <div className="font-bold text-gray-700 mb-1">
        {new Date(d.time).toLocaleString()}
      </div>
      {[['O', d.open], ['H', d.high], ['L', d.low], ['C', d.close]].map(([label, val]) => (
        <div key={String(label)} className="flex justify-between gap-4">
          <span className="text-gray-500">{label}</span>
          <span style={{ color }} className="font-semibold">
            {Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      ))}
      <div className="flex justify-between gap-4 mt-1 border-t pt-1">
        <span className="text-gray-500">Vol</span>
        <span className="font-semibold text-gray-700">
          {Number(d.volume).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

export default function MarketDataPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [priceHistory, setPriceHistory] = useState<{ time: string; price: number }[]>([]);
  const [ohlcv, setOhlcv] = useState<OHLCVBar[]>([]);
  const [interval, setIntervalVal] = useState('1h');
  const [activeTab, setActiveTab] = useState<'live' | 'ohlcv'>('live');
  const [loading, setLoading] = useState(true);
  const [loadingOhlcv, setLoadingOhlcv] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchInstruments();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (selected) {
      setPriceHistory([]);
      fetchQuote(selected);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => fetchQuote(selected), 3000);
    }
  }, [selected]);

  useEffect(() => {
    if (selected && activeTab === 'ohlcv') {
      fetchOhlcv(selected, interval);
    }
  }, [selected, interval, activeTab]);

  const fetchInstruments = async () => {
    try {
      const data = await api.get<{ instruments: Instrument[] }>('/api/market-data/instruments');
      setInstruments(data.instruments || []);
      if (data.instruments?.length > 0) setSelected(data.instruments[0].symbol);
    } catch (err) {
      console.error('Failed to fetch instruments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuote = async (symbol: string) => {
    try {
      const data = await api.get<MarketQuote>(`/api/market-data/${symbol}`);
      setQuote(data);
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setPriceHistory(prev => {
        const next = [...prev, { time, price: data.price }];
        return next.length > 60 ? next.slice(-60) : next;
      });
    } catch (err) {
      console.error('Failed to fetch quote:', err);
    }
  };

  const fetchOhlcv = async (symbol: string, iv: string) => {
    setLoadingOhlcv(true);
    try {
      const data = await api.get<{ bars: OHLCVBar[] }>(
        `/api/market-data/ohlcv/${symbol}?interval=${iv}&limit=200`
      );
      setOhlcv(data.bars || []);
    } catch (err) {
      console.error('Failed to fetch OHLCV:', err);
    } finally {
      setLoadingOhlcv(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInstruments();
    if (selected) {
      await fetchQuote(selected);
      if (activeTab === 'ohlcv') await fetchOhlcv(selected, interval);
    }
    setRefreshing(false);
  };

  const handleExportCsv = () => {
    if (!selected) return;
    window.open(`/api/catalog/export/csv/${selected}?interval=${interval}&limit=200`, '_blank');
  };

  const getChangeColor = (change: number) => change >= 0 ? 'text-green-600' : 'text-red-600';
  const getChangeBg = (change: number) => change >= 0 ? 'bg-green-100' : 'bg-red-100';

  // Prepare candlestick data: encode OHLC as stacked bar ranges
  const candleData = ohlcv.map(b => {
    const bullish = b.close >= b.open;
    const bodyLow = Math.min(b.open, b.close);
    const bodyHigh = Math.max(b.open, b.close);
    const label = new Date(b.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return {
      ...b,
      label,
      bullish,
      bodyLow,
      bodyHigh,
      bodySize: bodyHigh - bodyLow || 0.01,
      wickTop: b.high - bodyHigh,
      wickBottom: bodyLow - b.low,
    };
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading market data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">📊 Market Data</h1>
            <p className="text-gray-500">Real-time quotes and OHLCV candlestick charts</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold transition-all disabled:opacity-50"
            >
              {refreshing ? '⟳ Refreshing...' : '⟳ Refresh'}
            </button>
            <button
              onClick={() => window.location.href = '/trader'}
              className="px-5 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
            >
              ← Back
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Instrument List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Instruments</h2>
                <p className="text-xs text-gray-400 mt-0.5">{instruments.length} pairs</p>
              </div>
              <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                {instruments.map(inst => (
                  <button
                    key={inst.symbol}
                    onClick={() => setSelected(inst.symbol)}
                    className={`w-full px-5 py-3 text-left transition-colors hover:bg-indigo-50 flex items-center justify-between ${
                      selected === inst.symbol ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                    }`}
                  >
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{inst.symbol}</div>
                      <div className="text-xs text-gray-400">{inst.exchange}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 text-sm">
                        ${inst.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </div>
                      <div className={`text-xs font-semibold ${getChangeColor(inst.change_24h)}`}>
                        {inst.change_24h >= 0 ? '+' : ''}{inst.change_24h.toFixed(2)}%
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-3">
            {quote ? (
              <div className="space-y-4">
                {/* Quote header */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{quote.symbol}</h2>
                      <div className="text-sm text-gray-400">
                        Last updated: {new Date(quote.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${getChangeBg(quote.change_24h)} ${getChangeColor(quote.change_24h)}`}>
                      {quote.change_24h >= 0 ? '+' : ''}{quote.change_24h.toFixed(2)}% 24h
                    </span>
                  </div>

                  <div className="text-5xl font-bold text-gray-900 mb-6">
                    ${quote.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">Bid</div>
                      <div className="text-xl font-bold text-green-600">
                        ${quote.bid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">Ask</div>
                      <div className="text-xl font-bold text-red-600">
                        ${quote.ask.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">Volume 24h</div>
                      <div className="text-xl font-bold text-gray-800">
                        ${(quote.volume_24h / 1_000_000).toFixed(2)}M
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex border-b border-gray-100">
                    <button
                      onClick={() => setActiveTab('live')}
                      className={`px-6 py-3 text-sm font-semibold transition-colors ${
                        activeTab === 'live'
                          ? 'border-b-2 border-indigo-500 text-indigo-600'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Live Price
                    </button>
                    <button
                      onClick={() => setActiveTab('ohlcv')}
                      className={`px-6 py-3 text-sm font-semibold transition-colors ${
                        activeTab === 'ohlcv'
                          ? 'border-b-2 border-indigo-500 text-indigo-600'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      OHLCV Chart
                    </button>
                  </div>

                  <div className="p-5">
                    {activeTab === 'live' ? (
                      priceHistory.length > 1 ? (
                        <>
                          <div className="text-sm font-semibold text-gray-700 mb-3">
                            Price History (live · updates every 3s)
                          </div>
                          <ResponsiveContainer width="100%" height={200}>
                            <ComposedChart data={priceHistory} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} interval="preserveStartEnd" tickLine={false} />
                              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={75}
                                tickFormatter={(v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                              <Tooltip formatter={(v: number) => [`$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Price']} />
                              <Line type="monotone" dataKey="price" stroke={quote.change_24h >= 0 ? '#16a34a' : '#dc2626'} strokeWidth={2} dot={false} isAnimationActive={false} />
                            </ComposedChart>
                          </ResponsiveContainer>
                          <div className="flex items-center gap-2 mt-3">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                            <span className="text-xs text-indigo-600">Live — {priceHistory.length} data points</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <div className="text-3xl mb-2">📈</div>
                          Collecting live price data...
                        </div>
                      )
                    ) : (
                      <>
                        {/* Interval selector + export */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex gap-1">
                            {INTERVALS.map(iv => (
                              <button
                                key={iv}
                                onClick={() => setIntervalVal(iv)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                  interval === iv
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {iv}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={handleExportCsv}
                            className="px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            ↓ Export CSV
                          </button>
                        </div>

                        {loadingOhlcv ? (
                          <div className="text-center py-8 text-gray-400">Loading OHLCV data...</div>
                        ) : candleData.length > 0 ? (
                          <>
                            {/* OHLCV composed chart: low→high range bar + close line */}
                            <div className="text-sm font-semibold text-gray-700 mb-2">
                              {quote.symbol} · {interval.toUpperCase()} · {candleData.length} bars
                            </div>
                            <ResponsiveContainer width="100%" height={260}>
                              <ComposedChart data={candleData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} interval={Math.floor(candleData.length / 8)} tickLine={false} />
                                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={75}
                                  tickFormatter={(v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                                <Tooltip content={<CandlestickTooltip />} />
                                {/* High-low wick */}
                                <Bar dataKey="wickTop" stackId="wick" fill="transparent" stroke="transparent" barSize={1} />
                                {/* Body */}
                                <Bar dataKey="bodySize" stackId="body" barSize={4}>
                                  {candleData.map((entry, index) => (
                                    <Cell key={index} fill={entry.bullish ? '#16a34a' : '#dc2626'} />
                                  ))}
                                </Bar>
                                {/* Close price line */}
                                <Line type="monotone" dataKey="close" stroke="#6366f1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                              </ComposedChart>
                            </ResponsiveContainer>

                            {/* Volume bars */}
                            <div className="mt-3">
                              <div className="text-xs text-gray-500 mb-1">Volume</div>
                              <ResponsiveContainer width="100%" height={60}>
                                <ComposedChart data={candleData} margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                                  <Bar dataKey="volume" barSize={3}>
                                    {candleData.map((entry, index) => (
                                      <Cell key={index} fill={entry.bullish ? '#86efac' : '#fca5a5'} />
                                    ))}
                                  </Bar>
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8 text-gray-400">No OHLCV data available</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="text-5xl mb-4">📊</div>
                <div className="text-gray-500">Select an instrument to view market data</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
