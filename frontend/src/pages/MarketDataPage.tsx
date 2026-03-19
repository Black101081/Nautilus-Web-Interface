import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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

export default function MarketDataPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [priceHistory, setPriceHistory] = useState<{ time: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInstruments();
    if (selected) await fetchQuote(selected);
    setRefreshing(false);
  };

  const getChangeColor = (change: number) => change >= 0 ? 'text-green-600' : 'text-red-600';
  const getChangeBg = (change: number) => change >= 0 ? 'bg-green-100' : 'bg-red-100';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading market data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">📊 Market Data</h1>
            <p className="text-gray-500">Real-time market feeds and quotes</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Instrument List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Instruments</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {instruments.map(inst => (
                  <button
                    key={inst.symbol}
                    onClick={() => setSelected(inst.symbol)}
                    className={`w-full px-5 py-4 text-left transition-colors hover:bg-indigo-50 flex items-center justify-between ${
                      selected === inst.symbol ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                    }`}
                  >
                    <div>
                      <div className="font-bold text-gray-900">{inst.symbol}</div>
                      <div className="text-xs text-gray-400">{inst.exchange}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        ${inst.price.toLocaleString()}
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

          {/* Quote Detail */}
          <div className="lg:col-span-2">
            {quote ? (
              <div className="space-y-4">
                {/* Main Quote */}
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

                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="text-sm text-gray-500 mb-2">Spread</div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${(quote.ask - quote.bid).toFixed(4)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {(((quote.ask - quote.bid) / quote.price) * 100).toFixed(4)}%
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="text-sm text-gray-500 mb-2">Volume 24h</div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${(quote.volume_24h / 1_000_000).toFixed(2)}M
                    </div>
                    <div className="text-xs text-gray-400">USD equivalent</div>
                  </div>
                </div>

                {/* Price History Chart */}
                {priceHistory.length > 1 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="text-sm font-semibold text-gray-700 mb-3">Price History (live)</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={priceHistory} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                          interval="preserveStartEnd"
                          tickLine={false}
                        />
                        <YAxis
                          domain={['auto', 'auto']}
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                          tickLine={false}
                          axisLine={false}
                          width={70}
                          tickFormatter={(v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        />
                        <Tooltip
                          formatter={(v: number) => [`$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Price']}
                          labelStyle={{ fontSize: 11 }}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke={quote.change_24h >= 0 ? '#16a34a' : '#dc2626'}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Subscribed Info */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
                    <div>
                      <div className="font-semibold text-indigo-900">Live Data Feed</div>
                      <div className="text-sm text-indigo-700">
                        Subscribed to {quote.symbol} — updates every 3 seconds
                      </div>
                    </div>
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
