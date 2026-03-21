import { useState, useEffect, useRef } from "react";
import api from "../lib/api";
import { useWebSocket } from "../hooks/useWebSocket";

interface Position {
  id: string;
  instrument: string;
  side: "LONG" | "SHORT";
  quantity: number;
  entry_price: number;
  current_price?: number;
  pnl?: number;
  unrealized_pnl?: number;
  realized_pnl?: number;
  timestamp: string;
  avg_price?: number;
}

function getPositionPnl(pos: Position): number {
  if (pos.pnl != null) return pos.pnl;
  return (pos.unrealized_pnl ?? 0) + (pos.realized_pnl ?? 0);
}

function getAge(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const { lastMessage } = useWebSocket();
  const prevRef = useRef(lastMessage);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (lastMessage && lastMessage !== prevRef.current) {
      prevRef.current = lastMessage;
      if (lastMessage.type === "live_data") load();
    }
  }, [lastMessage]);

  const load = async () => {
    try {
      const data = await api.get<{ positions: Position[] }>("/api/positions");
      setPositions(data.positions ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const closePosition = async (id: string, qty?: number) => {
    setClosing(id);
    try {
      const body = qty !== undefined ? { quantity: qty } : {};
      await api.post(`/api/positions/${id}/close`, body);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close");
    } finally {
      setClosing(null);
    }
  };

  const closeAll = async (side?: "LONG" | "SHORT") => {
    const toClose = side ? positions.filter((p) => p.side === side) : positions;
    for (const p of toClose) await closePosition(p.id);
  };

  const totalPnl = positions.reduce((s, p) => s + getPositionPnl(p), 0);
  const longs = positions.filter((p) => p.side === "LONG");
  const shorts = positions.filter((p) => p.side === "SHORT");
  const longPnl = longs.reduce((s, p) => s + getPositionPnl(p), 0);
  const shortPnl = shorts.reduce((s, p) => s + getPositionPnl(p), 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Positions</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {longs.length} long / {shorts.length} short
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Summary row */}
      {positions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <div className={`text-lg font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(4)}
            </div>
            <div className="text-xs text-gray-500">Net PnL</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <div className={`text-lg font-bold ${longPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {longPnl >= 0 ? "+" : ""}{longPnl.toFixed(4)}
            </div>
            <div className="text-xs text-gray-500">Long PnL ({longs.length})</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <div className={`text-lg font-bold ${shortPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {shortPnl >= 0 ? "+" : ""}{shortPnl.toFixed(4)}
            </div>
            <div className="text-xs text-gray-500">Short PnL ({shorts.length})</div>
          </div>
        </div>
      )}

      {/* Batch actions */}
      {positions.length > 0 && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => closeAll("LONG")}
            disabled={longs.length === 0}
            className="px-3 py-1.5 text-xs bg-red-900/40 hover:bg-red-800/40 text-red-400 border border-red-800 rounded-lg transition-colors disabled:opacity-40"
          >
            Close All Long ({longs.length})
          </button>
          <button
            onClick={() => closeAll("SHORT")}
            disabled={shorts.length === 0}
            className="px-3 py-1.5 text-xs bg-red-900/40 hover:bg-red-800/40 text-red-400 border border-red-800 rounded-lg transition-colors disabled:opacity-40"
          >
            Close All Short ({shorts.length})
          </button>
          <button
            onClick={() => closeAll()}
            className="px-3 py-1.5 text-xs bg-red-700/40 hover:bg-red-600/40 text-red-300 border border-red-700 rounded-lg font-medium transition-colors"
          >
            Close All ({positions.length})
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : positions.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <div className="text-4xl mb-3">💼</div>
          <div>No open positions</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-4">Instrument</th>
                <th className="text-left py-2 pr-4">Side</th>
                <th className="text-right py-2 pr-4">Qty</th>
                <th className="text-right py-2 pr-4">Entry</th>
                <th className="text-right py-2 pr-4">Current</th>
                <th className="text-right py-2 pr-4">PnL</th>
                <th className="text-right py-2 pr-4">PnL %</th>
                <th className="text-left py-2 pr-4">Age</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const pnl = getPositionPnl(p);
                const entry = p.entry_price || p.avg_price || 0;
                const pnlPct = entry > 0 ? (pnl / (entry * p.quantity)) * 100 : 0;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-gray-800/50 hover:bg-gray-900/50 transition-colors"
                  >
                    <td className="py-2.5 pr-4 font-mono text-white font-medium">{p.instrument}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`font-semibold ${
                          p.side === "LONG" ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {p.side}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono text-gray-300">{p.quantity}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-gray-400">
                      {entry.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono text-gray-400">
                      {p.current_price ? p.current_price.toLocaleString() : "—"}
                    </td>
                    <td
                      className={`py-2.5 pr-4 text-right font-mono font-semibold ${
                        pnl >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(4)}
                    </td>
                    <td
                      className={`py-2.5 pr-4 text-right text-xs ${
                        pnlPct >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {pnlPct >= 0 ? "+" : ""}
                      {pnlPct.toFixed(2)}%
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-gray-600">{getAge(p.timestamp)}</td>
                    <td className="py-2.5">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => closePosition(p.id, p.quantity / 2)}
                          disabled={closing === p.id}
                          className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded transition-colors disabled:opacity-50"
                          title="Close half"
                        >
                          ½
                        </button>
                        <button
                          onClick={() => closePosition(p.id)}
                          disabled={closing === p.id}
                          className="text-xs px-2 py-1 bg-red-900/40 hover:bg-red-800/40 text-red-400 rounded border border-red-800 transition-colors disabled:opacity-50"
                        >
                          {closing === p.id ? "…" : "Close"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
