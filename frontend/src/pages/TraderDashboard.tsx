import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNotification } from "@/contexts/NotificationContext";
import { nautilusService } from '@/services/nautilusService';

export default function TraderDashboard() {
  const { success, error: showError } = useNotification();
  const [engineInfo, setEngineInfo] = useState<any>(null);
  const [components, setComponents] = useState<any[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [engine, comps, risk] = await Promise.all([
        nautilusService.getEngineInfo(),
        nautilusService.getComponents(),
        nautilusService.getRiskMetrics()
      ]);
      setEngineInfo(engine);
      setComponents(comps);
      setRiskMetrics(risk);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'running': 'bg-green-500',
      'active': 'bg-green-500',
      'stopped': 'bg-red-500',
      'paused': 'bg-yellow-500',
      'error': 'bg-red-500'
    };
    return colors[status.toLowerCase()] || 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">📈 Nautilus Trader Panel</h1>
              <p className="text-blue-100 mt-1">Professional algorithmic trading platform</p>
            </div>
            <div className="flex items-center gap-4">
              {engineInfo && (
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${engineInfo.is_running ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                  <div>
                    <div className="text-xs text-blue-100">Status</div>
                    <div className="font-semibold">{engineInfo.is_running ? 'Live' : 'Stopped'}</div>
                  </div>
                </div>
              )}
              <Button onClick={() => window.location.href = '/'} variant="outline" className="bg-white text-blue-600">
                ← Home
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Engine Status */}
        {engineInfo && (
          <Card className="mb-6 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${engineInfo.is_running ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
                Trading Engine: {engineInfo.trader_id}
              </CardTitle>
              <CardDescription>
                {engineInfo.engine_type} | Status: {engineInfo.status}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{engineInfo.strategies_count || 0}</div>
                  <div className="text-sm text-gray-600">Active Strategies</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{components.filter(c => c.status === 'running' || c.status === 'active').length}</div>
                  <div className="text-sm text-gray-600">Components Online</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{riskMetrics?.position_count || 0}</div>
                  <div className="text-sm text-gray-600">Open Positions</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    ${(riskMetrics?.total_exposure || 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Total Exposure</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trading Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Strategies Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>📈 Strategies</CardTitle>
              <CardDescription>Manage trading strategies</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Create, configure, and monitor your algorithmic trading strategies.
              </p>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => window.location.href = '/trader/strategies'}>
                Manage Strategies
              </Button>
            </CardContent>
          </Card>

          {/* Orders Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>📋 Orders</CardTitle>
              <CardDescription>Order management</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Create, modify, and cancel orders. View order history and execution details.
              </p>
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => window.location.href = '/trader/orders'}>
                Manage Orders
              </Button>
            </CardContent>
          </Card>

          {/* Positions Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>💼 Positions</CardTitle>
              <CardDescription>Position tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Monitor open positions, P&L, and position sizing across all instruments.
              </p>
              <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => window.location.href = '/trader/positions'}>
                View Positions
              </Button>
            </CardContent>
          </Card>

          {/* Risk Management Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>⚖️ Risk Management</CardTitle>
              <CardDescription>Risk controls & limits</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Configure risk limits, monitor exposure, and manage risk parameters.
              </p>
              <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => window.location.href = '/trader/risk'}>
                Risk Dashboard
              </Button>
            </CardContent>
          </Card>

          {/* Market Data Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>📊 Market Data</CardTitle>
              <CardDescription>Real-time market feeds</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Subscribe to market data, view quotes, and analyze market conditions.
              </p>
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => window.location.href = '/trader/market-data'}>
                Market Data
              </Button>
            </CardContent>
          </Card>

          {/* Performance Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>📉 Performance</CardTitle>
              <CardDescription>Analytics & reporting</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Analyze trading performance, view P&L reports, and track metrics.
              </p>
              <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={() => window.location.href = '/trader/performance'}>
                View Analytics
              </Button>
            </CardContent>
          </Card>

          {/* Alerts Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>🔔 Alerts</CardTitle>
              <CardDescription>Notifications & alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Configure price alerts, system notifications, and trading signals.
              </p>
              <Button className="w-full bg-yellow-600 hover:bg-yellow-700" onClick={() => window.location.href = '/trader/alerts'}>
                Manage Alerts
              </Button>
            </CardContent>
          </Card>

          {/* Backtesting Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>🔬 Backtesting</CardTitle>
              <CardDescription>Strategy testing</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Test strategies on historical data and analyze backtest results.
              </p>
              <Button className="w-full bg-cyan-600 hover:bg-cyan-700" onClick={() => window.location.href = '/trader/backtest'}>
                Run Backtest
              </Button>
            </CardContent>
          </Card>

          {/* Documentation Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>📚 Documentation</CardTitle>
              <CardDescription>Help & guides</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Access trading guides, API documentation, and tutorials.
              </p>
              <Button className="w-full bg-gray-600 hover:bg-gray-700" onClick={() => window.location.href = '/docs'}>
                View Docs
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* System Components Status */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>🔧 System Components</CardTitle>
            <CardDescription>Real-time component status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {components.map((component) => (
                <div key={component.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(component.status)}`}></div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{component.name}</div>
                    <div className="text-xs text-gray-500">{component.type}</div>
                  </div>
                  <div className="text-xs px-2 py-1 bg-gray-100 rounded">
                    {component.status}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk Metrics */}
        {riskMetrics && (
          <Card className="mt-6 border-orange-200">
            <CardHeader className="bg-orange-50">
              <CardTitle>⚠️ Risk Metrics</CardTitle>
              <CardDescription>Current risk exposure and limits</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">
                    ${(riskMetrics.total_exposure || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">Total Exposure</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">
                    ${(riskMetrics.margin_used || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">Margin Used</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    ${(riskMetrics.margin_available || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">Available Margin</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">
                    {(riskMetrics.max_drawdown || 0).toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-600">Max Drawdown</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">
                    ${(riskMetrics.var_1d || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">VaR (1D)</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-indigo-600">
                    {riskMetrics.position_count || 0}
                  </div>
                  <div className="text-xs text-gray-600">Positions</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

