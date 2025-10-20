import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../config';

interface Position {
  id: string;
  instrument: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entry_price: number;
  current_price: number;
  unrealized_pnl: number;
  realized_pnl: number;
  timestamp: string;
}

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPnL, setTotalPnL] = useState(0);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 3000); // Refresh every 3s
    return () => clearInterval(interval);
  }, []);

  const fetchPositions = async () => {
    try {
      const response = await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/positions`);
      const data = await response.json();
      setPositions(data.positions || []);
      
      // Calculate total P&L
      const total = (data.positions || []).reduce((sum: number, pos: Position) => 
        sum + pos.unrealized_pnl + pos.realized_pnl, 0
      );
      setTotalPnL(total);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClosePosition = async (positionId: string) => {
    if (!confirm('Close this position?')) return;
    
    try {
      await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/positions/${positionId}/close`, {
        method: 'POST'
      });
      fetchPositions();
    } catch (error) {
      console.error('Failed to close position:', error);
    }
  };

  const getSideColor = (side: string) => {
    return side === 'LONG' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getPnLColor = (pnl: number) => {
    return pnl >= 0 ? 'text-green-600' : 'text-red-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
        <div className="text-center">Loading positions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">💼 Position Management</h1>
            <p className="text-gray-600">Monitor your open positions and P&L</p>
          </div>
          <button
            onClick={() => window.location.href = '/admin'}
            className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-semibold"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-500 mb-2">Open Positions</div>
            <div className="text-3xl font-bold text-gray-900">{positions.length}</div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-500 mb-2">Total P&L</div>
            <div className={`text-3xl font-bold ${getPnLColor(totalPnL)}`}>
              ${totalPnL.toFixed(2)}
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-500 mb-2">Long Positions</div>
            <div className="text-3xl font-bold text-green-600">
              {positions.filter(p => p.side === 'LONG').length}
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-500 mb-2">Short Positions</div>
            <div className="text-3xl font-bold text-red-600">
              {positions.filter(p => p.side === 'SHORT').length}
            </div>
          </div>
        </div>

        {/* Positions Table */}
        {positions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">💼</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Open Positions</h3>
            <p className="text-gray-600 mb-6">You don't have any open positions at the moment</p>
            <button
              onClick={() => window.location.href = '/admin/orders'}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold"
            >
              Create Order
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Position ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Instrument</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Side</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Quantity</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Entry Price</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Current Price</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Unrealized P&L</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Realized P&L</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {positions.map((position) => (
                    <tr key={position.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-gray-900">{position.id}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{position.instrument}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSideColor(position.side)}`}>
                          {position.side}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">{position.quantity}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">${position.entry_price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">${position.current_price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-right">
                        <span className={`font-bold ${getPnLColor(position.unrealized_pnl)}`}>
                          ${position.unrealized_pnl.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <span className={`font-bold ${getPnLColor(position.realized_pnl)}`}>
                          ${position.realized_pnl.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleClosePosition(position.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-all text-xs font-semibold"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

