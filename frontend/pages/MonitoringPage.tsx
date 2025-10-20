import React, { useState } from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { MetricCard, MetricChart, LogViewer, StatusBadge } from '@/components/admin';
import type { LogEntry, DataPoint } from '@/components/admin';
import { RefreshCw, Download, AlertTriangle, Activity } from 'lucide-react';
import { useNotification } from '@/contexts/NotificationContext';

/**
 * Monitoring & Logs Page
 * Page 5 of 6 - System monitoring, metrics, and logs
 */

const MonitoringPage: React.FC = () => {
  const { success, error, warning, info } = useNotification();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Sample metrics data
  const [cpuData] = useState<DataPoint[]>([
    { timestamp: '10:00', value: 45 },
    { timestamp: '10:15', value: 52 },
    { timestamp: '10:30', value: 48 },
    { timestamp: '10:45', value: 65 },
    { timestamp: '11:00', value: 58 },
    { timestamp: '11:15', value: 72 },
    { timestamp: '11:30', value: 68 },
  ]);

  const [memoryData] = useState<DataPoint[]>([
    { timestamp: '10:00', value: 2.1 },
    { timestamp: '10:15', value: 2.3 },
    { timestamp: '10:30', value: 2.2 },
    { timestamp: '10:45', value: 2.8 },
    { timestamp: '11:00', value: 2.6 },
    { timestamp: '11:15', value: 3.1 },
    { timestamp: '11:30', value: 2.9 },
  ]);

  const [networkData] = useState<DataPoint[]>([
    { timestamp: '10:00', value: 12 },
    { timestamp: '10:15', value: 18 },
    { timestamp: '10:30', value: 15 },
    { timestamp: '10:45', value: 25 },
    { timestamp: '11:00', value: 22 },
    { timestamp: '11:15', value: 28 },
    { timestamp: '11:30', value: 24 },
  ]);

  // Sample logs
  const [logs] = useState<LogEntry[]>([
    {
      timestamp: '2025-10-19 10:30:15',
      level: 'info',
      component: 'DataEngine',
      message: 'Market data feed connected successfully',
    },
    {
      timestamp: '2025-10-19 10:30:16',
      level: 'debug',
      component: 'OrderEngine',
      message: 'Processing order queue',
      metadata: { queueSize: 5 },
    },
    {
      timestamp: '2025-10-19 10:30:17',
      level: 'warning',
      component: 'RiskEngine',
      message: 'Position limit approaching threshold',
      metadata: { current: 95, limit: 100 },
    },
    {
      timestamp: '2025-10-19 10:30:18',
      level: 'error',
      component: 'ExecutionEngine',
      message: 'Failed to submit order',
      metadata: { orderId: 'ORD-123', reason: 'Insufficient margin' },
    },
    {
      timestamp: '2025-10-19 10:30:19',
      level: 'info',
      component: 'PortfolioManager',
      message: 'Position updated',
      metadata: { symbol: 'BTCUSDT', quantity: 0.5 },
    },
  ]);

  // Handler functions
  const handleRefreshMetrics = () => {
    info('Refreshing system metrics...');
    setTimeout(() => success('Metrics refreshed successfully'), 1000);
  };

  const handleRefreshLogs = () => {
    info('Refreshing logs...');
    setTimeout(() => success('Logs refreshed successfully'), 1000);
  };

  const handleExportMetrics = () => {
    info('Exporting metrics data...');
    setTimeout(() => success('Metrics exported to CSV successfully'), 1500);
  };

  const handleExportLogs = () => {
    info('Exporting logs...');
    setTimeout(() => success('Logs exported to file successfully'), 1500);
  };

  const handleClearLogs = () => {
    warning('Clearing all logs...');
    setTimeout(() => info('Logs cleared'), 1000);
  };

  const handleToggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
    if (!autoRefresh) {
      success('Auto-refresh enabled');
    } else {
      info('Auto-refresh disabled');
    }
  };

  const handleViewAlerts = () => {
    info('Opening alerts panel...');
  };

  const handleConfigureAlerts = () => {
    info('Opening alert configuration...');
  };

  const handleDownloadReport = () => {
    info('Generating system report...');
    setTimeout(() => success('System report downloaded successfully'), 2000);
  };

  const handleRestartMonitoring = () => {
    warning('Restarting monitoring service...');
    setTimeout(() => success('Monitoring service restarted successfully'), 2000);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              System Monitoring
            </h1>
            <p className="text-gray-600">
              Real-time metrics, logs, and system health
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleToggleAutoRefresh}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                autoRefresh
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
            >
              <RefreshCw className={`h-5 w-5 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto-Refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Download className="h-5 w-5" />
              Download Report
            </button>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="System Uptime"
            value="99.9%"
            subtitle="Last 30 days"
            color="green"
            trend={{ value: 0.2, isPositive: true }}
          />
          <MetricCard
            title="Active Alerts"
            value={3}
            subtitle="Requires attention"
            color="yellow"
          />
          <MetricCard
            title="Error Rate"
            value="0.01%"
            subtitle="Last hour"
            color="green"
            trend={{ value: 0.5, isPositive: false }}
          />
          <MetricCard
            title="Avg Response Time"
            value="45ms"
            subtitle="Last 5 minutes"
            color="blue"
          />
        </div>

        {/* Charts */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Performance Metrics</h2>
            <div className="flex gap-3">
              <button
                onClick={handleRefreshMetrics}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                onClick={handleExportMetrics}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <MetricChart
              title="CPU Usage"
              data={cpuData}
              type="line"
              color="blue"
              unit="%"
            />
            <MetricChart
              title="Memory Usage"
              data={memoryData}
              type="area"
              color="green"
              unit="GB"
            />
            <MetricChart
              title="Network Traffic"
              data={networkData}
              type="bar"
              color="purple"
              unit="MB/s"
            />
          </div>
        </div>

        {/* Alerts Section */}
        <div className="mb-8 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <h2 className="text-xl font-semibold text-gray-900">Active Alerts</h2>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleViewAlerts}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                View All
              </button>
              <button
                onClick={handleConfigureAlerts}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Configure
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-3">
                <StatusBadge status="warning" />
                <div>
                  <p className="font-medium text-gray-900">High CPU Usage</p>
                  <p className="text-sm text-gray-600">CPU usage above 70% for 5 minutes</p>
                </div>
              </div>
              <span className="text-sm text-gray-500">2 min ago</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-3">
                <StatusBadge status="warning" />
                <div>
                  <p className="font-medium text-gray-900">Memory Threshold</p>
                  <p className="text-sm text-gray-600">Memory usage approaching 80%</p>
                </div>
              </div>
              <span className="text-sm text-gray-500">5 min ago</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-3">
                <StatusBadge status="error" />
                <div>
                  <p className="font-medium text-gray-900">Connection Error</p>
                  <p className="text-sm text-gray-600">Failed to connect to Binance adapter</p>
                </div>
              </div>
              <span className="text-sm text-gray-500">10 min ago</span>
            </div>
          </div>
        </div>

        {/* Logs Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">System Logs</h2>
            <div className="flex gap-3">
              <button
                onClick={handleRefreshLogs}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                onClick={handleExportLogs}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                onClick={handleClearLogs}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Clear Logs
              </button>
            </div>
          </div>
          <LogViewer
            logs={logs}
            maxHeight="500px"
            autoScroll={autoRefresh}
            showFilters={true}
            onRefresh={handleRefreshLogs}
          />
        </div>

        {/* Actions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Monitoring Actions
          </h2>
          <div className="flex gap-3">
            <button
              onClick={handleRestartMonitoring}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Activity className="h-5 w-5" />
              Restart Monitoring Service
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MonitoringPage;

