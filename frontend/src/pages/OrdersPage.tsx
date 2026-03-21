import { useState, useEffect, useRef } from "react";
import api from "../lib/api";
import { useWebSocket } from "../hooks/useWebSocket";

interface Order {
  id: string;
  instrument: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP";
  quantity: number;
  price?: number;
  status: "PENDING" | "FILLED" | "CANCELLED" | "REJECTED";
  filled_qty: number;
  pnl?: number;
  timestamp: string;
}

const INSTRUMENTS = [
  "BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT",
  "ADAUSDT","DOGEUSDT","AVAXUSDT","LINKUSDT","MATICUSDT",
  "DOTUSDT","LTCUSDT","UNIUSDT","ATOMUSDT","FILUSDT",
];

const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-yellow-400 bg-yellow-900/30",
  FILLED: "text-green-400 bg-green-900/30",
  CANCELLED: "text-gray-500 bg-gray-800",
  REJECTED: "text-red-400 bg-red-900/30",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [form, setForm] = useState({
    instrument: "BTCUSDT",
    side: "BUY" as "BUY" | "SELL",
    type: "LIMIT" as "MARKET" | "LIMIT" | "STOP",
    quantity: 0.001,
    price: 0,
  });
  const [confirmStep, setConfirmStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
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
      const data = await api.get<{ orders: Order[] }>("/api/orders");
      setOrders(data.orders ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const cancel = async (id: string) => {
    await api.delete(`/api/orders/${id}`);
    load();
  };

  const openTicket = () => {
    setForm({ instrument: "BTCUSDT", side: "BUY", type: "LIMIT", quantity: 0.001, price: 0 });
    setSubmitError(null);
    setConfirmStep(false);
    setShowTicket(true);
  };

  const submitOrder = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        instrument: form.instrument,
        side: form.side,
        type: form.type,
        quantity: form.quantity,
      };
      if (form.type !== "MARKET") payload.price = form.price;
      await api.post("/api/orders", payload);
      setShowTicket(false);
      load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to place order");
      setConfirmStep(false);
    } finally {
      setSubmitting(false);
    }
  };

  const notional = form.quantity * (form.price || 1);
  const filtered = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Orders</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {orders.filter((o) => o.status === "PENDING").length} pending /{" "}
            {orders.filter((o) => o.status === "FILLED").length} filled
          </p>
        </div>
        <button
          onClick={openTicket}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Order
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {["ALL", "PENDING", "FILLED", "CANCELLED", "REJECTED"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Orders table */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <div className="text-4xl mb-3">📋</div>
          <div>No orders{filter !== "ALL" ? ` with status ${filter}` : ""}</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-4">Instrument</th>
                <th className="text-left py-2 pr-4">Side</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-right py-2 pr-4">Qty</th>
                <th className="text-right py-2 pr-4">Price</th>
                <th className="text-right py-2 pr-4">Filled</th>
                <th className="text-right py-2 pr-4">PnL</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-left py-2 pr-4">Time</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const pnl = o.pnl ?? 0;
                return (
                  <tr
                    key={o.id}
                    className="border-b border-gray-800/50 hover:bg-gray-900/50 transition-colors"
                  >
                    <td className="py-2.5 pr-4 font-mono text-white font-medium">{o.instrument}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`font-semibold ${
                          o.side === "BUY" ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {o.side}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400">{o.type}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-300 font-mono">{o.quantity}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-300 font-mono">
                      {o.price ? o.price.toLocaleString() : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-400 font-mono">{o.filled_qty}</td>
                    <td className={`py-2.5 pr-4 text-right font-mono ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {pnl !== 0 ? (pnl >= 0 ? "+" : "") + pnl.toFixed(4) : "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] ?? ""}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-gray-600">
                      {new Date(o.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5">
                      {o.status === "PENDING" && (
                        <button
                          onClick={() => cancel(o.id)}
                          className="text-xs text-red-500 hover:text-red-300 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Trade Ticket */}
      {showTicket && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && !confirmStep && setShowTicket(false)}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            {!confirmStep ? (
              <>
                <h3 className="text-white font-semibold text-lg mb-4">Trade Ticket</h3>

                {submitError && (
                  <div className="mb-3 p-2 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-xs">
                    {submitError}
                  </div>
                )}

                {/* BUY / SELL toggle */}
                <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-4">
                  {(["BUY", "SELL"] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setForm((p) => ({ ...p, side }))}
                      className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                        form.side === side
                          ? side === "BUY"
                            ? "bg-green-600 text-white"
                            : "bg-red-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {side}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Instrument</label>
                    <select
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      value={form.instrument}
                      onChange={(e) => setForm((p) => ({ ...p, instrument: e.target.value }))}
                    >
                      {INSTRUMENTS.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Order Type</label>
                    <div className="flex gap-1">
                      {(["MARKET", "LIMIT", "STOP"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setForm((p) => ({ ...p, type: t }))}
                          className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                            form.type === t
                              ? "bg-blue-700 text-white"
                              : "bg-gray-800 text-gray-400 hover:text-gray-200"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Quantity</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      value={form.quantity}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))
                      }
                    />
                  </div>

                  {form.type !== "MARKET" && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Price (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        value={form.price}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))
                        }
                      />
                    </div>
                  )}

                  {/* Notional preview */}
                  {form.type !== "MARKET" && form.price > 0 && (
                    <div className="flex justify-between text-xs text-gray-500 bg-gray-800 rounded-lg p-2">
                      <span>Notional</span>
                      <span className="text-gray-300">${notional.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setShowTicket(false)}
                    className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setConfirmStep(true)}
                    className={`flex-1 py-2 text-white text-sm font-semibold rounded-lg transition-colors ${
                      form.side === "BUY"
                        ? "bg-green-600 hover:bg-green-500"
                        : "bg-red-600 hover:bg-red-500"
                    }`}
                  >
                    Review Order
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-white font-semibold text-lg mb-4">Confirm Order</h3>
                <div className="bg-gray-800 rounded-xl p-4 space-y-3 mb-5 text-sm">
                  {[
                    ["Direction", form.side],
                    ["Instrument", form.instrument],
                    ["Type", form.type],
                    ["Quantity", String(form.quantity)],
                    ...(form.type !== "MARKET" ? [["Price", `$${form.price.toLocaleString()}`]] : []),
                    ...(form.type !== "MARKET" && form.price > 0
                      ? [["Notional", `$${notional.toLocaleString()}`]]
                      : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-500">{k}</span>
                      <span
                        className={`font-medium ${
                          k === "Direction"
                            ? v === "BUY"
                              ? "text-green-400"
                              : "text-red-400"
                            : "text-white"
                        }`}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
                {submitError && (
                  <div className="mb-3 p-2 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-xs">
                    {submitError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmStep(false)}
                    className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={submitOrder}
                    disabled={submitting}
                    className={`flex-1 py-2 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                      form.side === "BUY"
                        ? "bg-green-600 hover:bg-green-500"
                        : "bg-red-600 hover:bg-red-500"
                    }`}
                  >
                    {submitting ? "Placing…" : `Place ${form.side}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
