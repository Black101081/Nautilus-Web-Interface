import React, { useState } from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { ComponentCard, MetricCard, StatusBadge } from '@/components/admin';
import {
  Database,
  Zap,
  AlertTriangle,
  TrendingUp,
  Clock,
  Cpu,
  Search,
  Filter,
} from 'lucide-react';
import { useNotification } from '@/contexts/NotificationContext';

/**
 * Components Management Page
 * Page 2 of 6 - Manage 6 core Nautilus Trader components
 */

interface Component {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'stopped' | 'starting' | 'error';
  version: string;
  icon: any;
  metrics: {
    label: string;
    value: string | number;
  }[];
  uptime: string;
  lastRestart: string;
}

const ComponentsPage: React.FC = () => {
  const { success, error, warning, info } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 6 Core Nautilus Trader Components
  const [components, setComponents] = useState<Component[]>([
    {
      id: 'data-engine',
      name: 'Data Engine',
      description: 'Manages market data feeds, subscriptions, and data distribution',
      status: 'running',
      version: '1.220.0',
      icon: Database,
      uptime: '5d 12h 34m',
      lastRestart: '2025-10-14 08:30:00',
      metrics: [
        { label: 'Subscriptions', value: 45 },
        { label: 'Updates/sec', value: 1250 },
        { label: 'Latency', value: '2ms' },
        { label: 'Memory', value: '256MB' },
      ],
    },
    {
      id: 'execution-engine',
      name: 'Execution Engine',
      description: 'Handles order execution, order management, and trade reporting',
      status: 'running',
      version: '1.220.0',
      icon: Zap,
      uptime: '5d 12h 34m',
      lastRestart: '2025-10-14 08:30:00',
      metrics: [
        { label: 'Orders/min', value: 125 },
        { label: 'Fill Rate', value: '98.5%' },
        { label: 'Avg Latency', value: '5ms' },
        { label: 'Active Orders', value: 23 },
      ],
    },
    {
      id: 'risk-engine',
      name: 'Risk Engine',
      description: 'Monitors and enforces risk limits, position limits, and trading rules',
      status: 'running',
      version: '1.220.0',
      icon: AlertTriangle,
      uptime: '5d 12h 34m',
      lastRestart: '2025-10-14 08:30:00',
      metrics: [
        { label: 'Active Limits', value: 12 },
        { label: 'Violations', value: 0 },
        { label: 'Max Exposure', value: '$50K' },
        { label: 'Health', value: '100%' },
      ],
    },
    {
      id: 'portfolio-manager',
      name: 'Portfolio Manager',
      description: 'Manages portfolio state, positions, and account balances',
      status: 'running',
      version: '1.220.0',
      icon: TrendingUp,
      uptime: '5d 12h 34m',
      lastRestart: '2025-10-14 08:30:00',
      metrics: [
        { label: 'Positions', value: 8 },
        { label: 'Total Value', value: '$125K' },
        { label: 'P&L Today', value: '+$2.5K' },
        { label: 'Health', value: '100%' },
      ],
    },
    {
      id: 'strategy-engine',
      name: 'Strategy Engine',
      description: 'Executes trading strategies and manages strategy lifecycle',
      status: 'running',
      version: '1.220.0',
      icon: Cpu,
      uptime: '5d 12h 34m',
      lastRestart: '2025-10-14 08:30:00',
      metrics: [
        { label: 'Active Strategies', value: 3 },
        { label: 'Signals/min', value: 45 },
        { label: 'CPU Usage', value: '12%' },
        { label: 'Memory', value: '512MB' },
      ],
    },
    {
      id: 'cache-manager',
      name: 'Cache Manager',
      description: 'Manages data caching, persistence, and historical data access',
      status: 'running',
      version: '1.220.0',
      icon: Clock,
      uptime: '5d 12h 34m',
      lastRestart: '2025-10-14 08:30:00',
      metrics: [
        { label: 'Cache Size', value: '1.2GB' },
        { label: 'Hit Rate', value: '95%' },
        { label: 'Records', value: '2.5M' },
        { label: 'Memory', value: '1.5GB' },
      ],
    },
  ]);

  // Component action handlers
  const handleStart = (id: string) => {
    const component = components.find(c => c.id === id);
    if (component) {
      info(`Starting ${component.name}...`);
      setTimeout(() => success(`${component.name} started successfully`), 1500);
    }
  };

  const handleStop = (id: string) => {
    const component = components.find(c => c.id === id);
    if (component) {
      warning(`Stopping ${component.name}...`);
    }
  };

  const handleRestart = (id: string) => {
    const component = components.find(c => c.id === id);
    if (component) {
      info(`Restarting ${component.name}...`);
      setTimeout(() => success(`${component.name} restarted successfully`), 1500);
    }
  };

  const handleConfigure = (id: string) => {
    const component = components.find(c => c.id === id);
    if (component) {
      info(`Opening ${component.name} configuration...`);
    }
  };

  // Bulk action handlers
  const handleStartAll = () => {
    info('Starting all components...');
    setTimeout(() => success('All components started successfully'), 2000);
  };

  const handleStopAll = () => {
    warning('Stopping all components...');
  };

  const handleRestartAll = () => {
    info('Restarting all components...');
    setTimeout(() => success('All components restarted successfully'), 2000);
  };

  const handleExportConfig = () => {
    info('Exporting component configuration...');
    setTimeout(() => success('Configuration exported successfully'), 1500);
  };

  // Filter components
  const filteredComponents = components.filter((component) => {
    const matchesSearch = component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         component.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || component.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate summary metrics
  const runningCount = components.filter(c => c.status === 'running').length;
  const stoppedCount = components.filter(c => c.status === 'stopped').length;
  const errorCount = components.filter(c => c.status === 'error').length;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Core Components
          </h1>
          <p className="text-gray-600">
            Manage the 6 core components of Nautilus Trader
          </p>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Components"
            value={components.length}
            subtitle="Core system components"
            color="blue"
          />
          <MetricCard
            title="Running"
            value={runningCount}
            subtitle="Active components"
            color="green"
          />
          <MetricCard
            title="Stopped"
            value={stoppedCount}
            subtitle="Inactive components"
            color="gray"
          />
          <MetricCard
            title="Errors"
            value={errorCount}
            subtitle="Components with issues"
            color="red"
          />
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search components..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="stopped">Stopped</option>
              <option value="starting">Starting</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="mb-6 flex gap-3">
          <button 
            onClick={handleStartAll}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Start All
          </button>
          <button 
            onClick={handleStopAll}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Stop All
          </button>
          <button 
            onClick={handleRestartAll}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Restart All
          </button>
          <button 
            onClick={handleExportConfig}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
          >
            Export Config
          </button>
        </div>

        {/* Components Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredComponents.map((component) => {
            const Icon = component.icon;
            return (
              <ComponentCard
                key={component.id}
                name={component.name}
                description={component.description}
                status={component.status}
                version={component.version}
                icon={<Icon />}
                metrics={component.metrics}
                actions={[
                  { 
                    label: 'Stop', 
                    onClick: () => handleStop(component.id), 
                    variant: 'danger',
                    disabled: component.status !== 'running'
                  },
                  { 
                    label: 'Restart', 
                    onClick: () => handleRestart(component.id), 
                    variant: 'primary',
                    disabled: component.status !== 'running'
                  },
                  { 
                    label: 'Configure', 
                    onClick: () => handleConfigure(component.id)
                  },
                ]}
              />
            );
          })}
        </div>

        {/* No Results */}
        {filteredComponents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No components found matching your filters</p>
          </div>
        )}

        {/* Component Details */}
        <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Component Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">About Core Components</h3>
              <p className="text-sm text-gray-600 mb-4">
                Nautilus Trader consists of 6 core components that work together to provide a complete trading system. 
                Each component can be independently started, stopped, and configured.
              </p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• <strong>Data Engine:</strong> Handles all market data operations</li>
                <li>• <strong>Execution Engine:</strong> Manages order execution</li>
                <li>• <strong>Risk Engine:</strong> Enforces risk limits</li>
                <li>• <strong>Portfolio Manager:</strong> Tracks positions and P&L</li>
                <li>• <strong>Strategy Engine:</strong> Runs trading strategies</li>
                <li>• <strong>Cache Manager:</strong> Manages data persistence</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Component Dependencies</h3>
              <p className="text-sm text-gray-600 mb-4">
                Components have dependencies and should be started in the correct order:
              </p>
              <ol className="text-sm text-gray-600 space-y-2">
                <li>1. <strong>Cache Manager</strong> (no dependencies)</li>
                <li>2. <strong>Data Engine</strong> (requires Cache Manager)</li>
                <li>3. <strong>Risk Engine</strong> (requires Data Engine)</li>
                <li>4. <strong>Portfolio Manager</strong> (requires Data Engine)</li>
                <li>5. <strong>Execution Engine</strong> (requires Risk & Portfolio)</li>
                <li>6. <strong>Strategy Engine</strong> (requires all others)</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ComponentsPage;

