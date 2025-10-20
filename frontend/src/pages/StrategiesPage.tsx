import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../config';

interface Strategy {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string;
  config: Record<string, any>;
  performance: {
    total_pnl: number;
    total_trades: number;
    win_rate: number;
  };
}

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    type: 'momentum',
    description: '',
    config: {}
  });

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    try {
      const response = await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/strategies`);
      const data = await response.json();
      setStrategies(data.strategies || []);
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStrategy = async () => {
    try {
      const response = await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/strategies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStrategy)
      });
      
      if (response.ok) {
        setShowAddModal(false);
        setNewStrategy({ name: '', type: 'momentum', description: '', config: {} });
        fetchStrategies();
      }
    } catch (error) {
      console.error('Failed to add strategy:', error);
    }
  };

  const handleStartStrategy = async (strategyId: string) => {
    try {
      await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/strategies/${strategyId}/start`, {
        method: 'POST'
      });
      fetchStrategies();
    } catch (error) {
      console.error('Failed to start strategy:', error);
    }
  };

  const handleStopStrategy = async (strategyId: string) => {
    try {
      await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/strategies/${strategyId}/stop`, {
        method: 'POST'
      });
      fetchStrategies();
    } catch (error) {
      console.error('Failed to stop strategy:', error);
    }
  };

  const handleDeleteStrategy = async (strategyId: string) => {
    if (!confirm('Are you sure you want to delete this strategy?')) return;
    
    try {
      await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/strategies/${strategyId}`, {
        method: 'DELETE'
      });
      fetchStrategies();
    } catch (error) {
      console.error('Failed to delete strategy:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
        <div className="text-center">Loading strategies...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">📈 Strategy Management</h1>
            <p className="text-gray-600">Manage and monitor your trading strategies</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.href = '/admin'}
              className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-semibold"
            >
              ← Back to Dashboard
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold"
            >
              + Add Strategy
            </button>
          </div>
        </div>

        {/* Strategies Grid */}
        {strategies.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Strategies Yet</h3>
            <p className="text-gray-600 mb-6">Add your first trading strategy to get started</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold"
            >
              + Add Strategy
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {strategies.map((strategy) => (
              <div key={strategy.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{strategy.name}</h3>
                    <p className="text-sm text-gray-500">{strategy.type}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    strategy.status === 'running' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {strategy.status}
                  </span>
                </div>

                <p className="text-gray-600 text-sm mb-4">{strategy.description || 'No description'}</p>

                {/* Performance Metrics */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs text-gray-500">P&L</div>
                      <div className={`font-bold ${strategy.performance.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${strategy.performance.total_pnl.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Trades</div>
                      <div className="font-bold text-gray-900">{strategy.performance.total_trades}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Win Rate</div>
                      <div className="font-bold text-blue-600">{(strategy.performance.win_rate * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {strategy.status === 'stopped' ? (
                    <button
                      onClick={() => handleStartStrategy(strategy.id)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold text-sm"
                    >
                      ▶ Start
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStopStrategy(strategy.id)}
                      className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all font-semibold text-sm"
                    >
                      ⏸ Stop
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteStrategy(strategy.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Strategy Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Strategy</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Strategy Name</label>
                  <input
                    type="text"
                    value={newStrategy.name}
                    onChange={(e) => setNewStrategy({ ...newStrategy, name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="My Trading Strategy"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Strategy Type</label>
                  <select
                    value={newStrategy.type}
                    onChange={(e) => setNewStrategy({ ...newStrategy, type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="momentum">Momentum</option>
                    <option value="mean_reversion">Mean Reversion</option>
                    <option value="arbitrage">Arbitrage</option>
                    <option value="market_making">Market Making</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={newStrategy.description}
                    onChange={(e) => setNewStrategy({ ...newStrategy, description: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    rows={3}
                    placeholder="Describe your strategy..."
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStrategy}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold"
                  disabled={!newStrategy.name}
                >
                  Add Strategy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

