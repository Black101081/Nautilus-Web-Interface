import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import {
  MetricCard,
  ComponentCard,
  StatusBadge,
  MetricChart,
} from '@/components/admin';
import type { DataPoint } from '@/components/admin';
import {
  Activity,
  Cpu,
  Database,
  Zap,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { useNotification } from '@/contexts/NotificationContext';

/**
 * Admin Dashboard - System Overview & Quick Actions
 * Page 1 of 6 in the new simplified admin structure
 */
const AdminDashboard: React.FC = () => {
  const { success, error, warning, info } = useNotification();
  const [systemMetrics, setSystemMetrics] = useState({
    activeComponents: 6,
    runningServices: 126,
    activeAdapters: 8,
    systemUptime: '99.9%',
  });

  // Sample chart data
  const cpuData: DataPoint[] = [
    { timestamp: '10:00', value: 45 },
    { timestamp: '10:15', value: 52 },
    { timestamp: '10:30', value: 48 },
    { timestamp: '10:45', value: 65 },
    { timestamp: '11:00', value: 58 },
    { timestamp: '11:15', value: 72 },
    { timestamp: '11:30', value: 68 },
  ];

  const memoryData: DataPoint[] = [
    { timestamp: '10:00', value: 2.1 },
    { timestamp: '10:15', value: 2.3 },
    { timestamp: '10:30', value: 2.2 },
    { timestamp: '10:45', value: 2.5 },
    { timestamp: '11:00', value: 2.4 },
    { timestamp: '11:15', value: 2.6 },
    { timestamp: '11:30', value: 2.5 },
  ];

  // Component action handlers
  const handleStopComponent = (componentName: string) => {
    warning(`Stopping ${componentName}...`);
  };

  const handleRestartComponent = (componentName: string) => {
    success(`${componentName} restarted successfully`);
  };

  const handleConfigureComponent = (componentName: string) => {
    info(`Opening ${componentName} configuration...`);
  };

  // Quick action handlers
  const handleRestartAll = () => {
    info('Restarting all components...');
    setTimeout(() => success('All components restarted successfully'), 2000);
  };

  const handleBackupData = () => {
    info('Creating system backup...');
    setTimeout(() => success('System backup completed'), 2000);
  };

  const handleViewLogs = () => {
    info('Opening system logs...');
  };

  const handleRunDiagnostics = () => {
    info('Running system diagnostics...');
    setTimeout(() => success('Diagnostics completed - All systems healthy'), 3000);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            System Dashboard
          </h1>
          <p className="text-gray-600">
            Overview of Nautilus Trader system status and performance
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Active Components"
            value={systemMetrics.activeComponents}
            subtitle="All systems operational"
            color="green"
            icon={<Cpu />}
            trend={{ value: 0, isPositive: true }}
          />
          <MetricCard
            title="Running Services"
            value={systemMetrics.runningServices}
            subtitle="64 features enabled"
            color="blue"
            icon={<Activity />}
          />
          <MetricCard
            title="Active Adapters"
            value={systemMetrics.activeAdapters}
            subtitle="14 total configured"
            color="purple"
            icon={<Zap />}
          />
          <MetricCard
            title="System Uptime"
            value={systemMetrics.systemUptime}
            subtitle="Last 30 days"
            color="green"
            icon={<TrendingUp />}
            trend={{ value: 0.2, isPositive: true }}
          />
        </div>

        {/* Component Status Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Core Components Status
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ComponentCard
              name="Data Engine"
              description="Manages market data feeds and subscriptions"
              status="running"
              version="1.220.0"
              icon={<Database />}
              metrics={[
                { label: 'Subscriptions', value: 45 },
                { label: 'Updates/sec', value: 1250 },
                { label: 'Latency', value: '2ms' },
                { label: 'Memory', value: '256MB' },
              ]}
              actions={[
                { label: 'Stop', onClick: () => handleStopComponent('Data Engine'), variant: 'danger' },
                { label: 'Restart', onClick: () => handleRestartComponent('Data Engine'), variant: 'primary' },
                { label: 'Configure', onClick: () => handleConfigureComponent('Data Engine') },
              ]}
            />
            <ComponentCard
              name="Execution Engine"
              description="Handles order execution and management"
              status="running"
              version="1.220.0"
              icon={<Zap />}
              metrics={[
                { label: 'Orders/min', value: 125 },
                { label: 'Fill Rate', value: '98.5%' },
                { label: 'Avg Latency', value: '5ms' },
                { label: 'Active Orders', value: 23 },
              ]}
              actions={[
                { label: 'Stop', onClick: () => handleStopComponent('Execution Engine'), variant: 'danger' },
                { label: 'Restart', onClick: () => handleRestartComponent('Execution Engine'), variant: 'primary' },
                { label: 'Configure', onClick: () => handleConfigureComponent('Execution Engine') },
              ]}
            />
            <ComponentCard
              name="Risk Engine"
              description="Monitors and enforces risk limits"
              status="running"
              version="1.220.0"
              icon={<AlertTriangle />}
              metrics={[
                { label: 'Active Limits', value: 12 },
                { label: 'Violations', value: 0 },
                { label: 'Max Exposure', value: '$50K' },
                { label: 'Health', value: '100%' },
              ]}
              actions={[
                { label: 'Stop', onClick: () => handleStopComponent('Risk Engine'), variant: 'danger' },
                { label: 'Restart', onClick: () => handleRestartComponent('Risk Engine'), variant: 'primary' },
                { label: 'Configure', onClick: () => handleConfigureComponent('Risk Engine') },
              ]}
            />
            <ComponentCard
              name="Portfolio Manager"
              description="Manages portfolio state and positions"
              status="running"
              version="1.220.0"
              icon={<TrendingUp />}
              metrics={[
                { label: 'Positions', value: 8 },
                { label: 'Total Value', value: '$125K' },
                { label: 'P&L Today', value: '+$2.5K' },
                { label: 'Health', value: '100%' },
              ]}
              actions={[
                { label: 'Stop', onClick: () => handleStopComponent('Portfolio Manager'), variant: 'danger' },
                { label: 'Restart', onClick: () => handleRestartComponent('Portfolio Manager'), variant: 'primary' },
                { label: 'Configure', onClick: () => handleConfigureComponent('Portfolio Manager') },
              ]}
            />
          </div>
        </div>

        {/* Performance Charts */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            System Performance
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetricChart
              title="CPU Usage"
              data={cpuData}
              type="area"
              color="blue"
              unit="%"
              height="250px"
            />
            <MetricChart
              title="Memory Usage"
              data={memoryData}
              type="area"
              color="green"
              unit="GB"
              height="250px"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button 
              onClick={handleRestartAll}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Cpu className="h-5 w-5 text-blue-600" />
                </div>
                <span className="font-semibold text-gray-900">Restart All</span>
              </div>
              <p className="text-sm text-gray-600">Restart all components</p>
            </button>
            
            <button 
              onClick={handleBackupData}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Database className="h-5 w-5 text-green-600" />
                </div>
                <span className="font-semibold text-gray-900">Backup Data</span>
              </div>
              <p className="text-sm text-gray-600">Create system backup</p>
            </button>
            
            <button 
              onClick={handleViewLogs}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Activity className="h-5 w-5 text-amber-600" />
                </div>
                <span className="font-semibold text-gray-900">View Logs</span>
              </div>
              <p className="text-sm text-gray-600">Check system logs</p>
            </button>
            
            <button 
              onClick={handleRunDiagnostics}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <span className="font-semibold text-gray-900">Run Diagnostics</span>
              </div>
              <p className="text-sm text-gray-600">System health check</p>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {[
              { time: '2 minutes ago', event: 'Data Engine restarted successfully', type: 'success' },
              { time: '15 minutes ago', event: 'New adapter connected: Binance', type: 'info' },
              { time: '1 hour ago', event: 'System backup completed', type: 'success' },
              { time: '2 hours ago', event: 'Risk limit updated for BTC-USD', type: 'warning' },
              { time: '3 hours ago', event: 'Portfolio rebalanced', type: 'info' },
            ].map((activity, idx) => (
              <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge 
                      status={activity.type as any} 
                      size="sm"
                    />
                    <span className="text-sm text-gray-900">{activity.event}</span>
                  </div>
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;

