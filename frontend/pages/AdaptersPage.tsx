import React, { useState } from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdapterCard, MetricCard } from '@/components/admin';
import { Search, Filter, Plus } from 'lucide-react';
import { useNotification } from '@/contexts/NotificationContext';

/**
 * Adapters Management Page
 * Page 4 of 6 - Manage exchange and broker adapters
 */

interface Adapter {
  id: string;
  name: string;
  type: 'data' | 'execution' | 'both';
  venue: string;
  status: 'active' | 'inactive' | 'error';
  config: {
    apiKey: string;
    testnet: boolean;
  };
  metrics?: {
    connections?: number;
    latency?: string;
    uptime?: string;
    lastSync?: string;
  };
}

const AdaptersPage: React.FC = () => {
  const { success, error, warning, info } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [adapters, setAdapters] = useState<Adapter[]>([
    {
      id: 'binance',
      name: 'Binance Adapter',
      type: 'both',
      venue: 'Binance',
      status: 'active',
      config: {
        apiKey: 'sk_live_1234567890abcdef',
        testnet: false,
      },
      metrics: {
        connections: 3,
        latency: '45ms',
        uptime: '99.8%',
        lastSync: '2s ago',
      },
    },
    {
      id: 'interactive-brokers',
      name: 'Interactive Brokers',
      type: 'execution',
      venue: 'IB',
      status: 'inactive',
      config: {
        apiKey: 'sk_test_abcdef1234567890',
        testnet: true,
      },
    },
    {
      id: 'coinbase',
      name: 'Coinbase Pro',
      type: 'both',
      venue: 'Coinbase',
      status: 'active',
      config: {
        apiKey: 'sk_live_coinbase123456',
        testnet: false,
      },
      metrics: {
        connections: 2,
        latency: '120ms',
        uptime: '98.5%',
        lastSync: '5s ago',
      },
    },
    {
      id: 'kraken',
      name: 'Kraken Adapter',
      type: 'data',
      venue: 'Kraken',
      status: 'active',
      config: {
        apiKey: 'sk_live_kraken789012',
        testnet: false,
      },
      metrics: {
        connections: 1,
        latency: '85ms',
        uptime: '99.2%',
        lastSync: '1s ago',
      },
    },
    {
      id: 'ftx',
      name: 'FTX Adapter',
      type: 'both',
      venue: 'FTX',
      status: 'error',
      config: {
        apiKey: 'sk_live_ftx345678',
        testnet: false,
      },
    },
  ]);

  // Handler functions
  const handleConnect = (id: string) => {
    const adapter = adapters.find(a => a.id === id);
    if (adapter) {
      info(`Connecting ${adapter.name}...`);
      setTimeout(() => {
        setAdapters(adapters.map(a => 
          a.id === id ? { ...a, status: 'active' as const } : a
        ));
        success(`${adapter.name} connected successfully`);
      }, 1500);
    }
  };

  const handleDisconnect = (id: string) => {
    const adapter = adapters.find(a => a.id === id);
    if (adapter) {
      warning(`Disconnecting ${adapter.name}...`);
      setAdapters(adapters.map(a => 
        a.id === id ? { ...a, status: 'inactive' as const } : a
      ));
    }
  };

  const handleTest = (id: string) => {
    const adapter = adapters.find(a => a.id === id);
    if (adapter) {
      info(`Testing ${adapter.name} connection...`);
      setTimeout(() => success(`${adapter.name} connection test passed`), 1500);
    }
  };

  const handleConfigure = (id: string) => {
    const adapter = adapters.find(a => a.id === id);
    if (adapter) {
      info(`Opening ${adapter.name} configuration...`);
    }
  };

  const handleToggle = (id: string, enabled: boolean) => {
    if (enabled) {
      handleConnect(id);
    } else {
      handleDisconnect(id);
    }
  };

  const handleAddAdapter = () => {
    info('Opening new adapter configuration wizard...');
  };

  const handleConnectAll = () => {
    info('Connecting all adapters...');
    setTimeout(() => success('All adapters connected successfully'), 2000);
  };

  const handleDisconnectAll = () => {
    warning('Disconnecting all adapters...');
  };

  const handleTestAll = () => {
    info('Testing all adapter connections...');
    setTimeout(() => success('All connection tests passed'), 2500);
  };

  // Filter adapters
  const filteredAdapters = adapters.filter((adapter) => {
    const matchesSearch = adapter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         adapter.venue.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || adapter.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Calculate metrics
  const activeCount = adapters.filter(a => a.status === 'active').length;
  const inactiveCount = adapters.filter(a => a.status === 'inactive').length;
  const errorCount = adapters.filter(a => a.status === 'error').length;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Exchange & Broker Adapters
            </h1>
            <p className="text-gray-600">
              Manage connections to exchanges and brokers
            </p>
          </div>
          <button
            onClick={handleAddAdapter}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Adapter
          </button>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Adapters"
            value={adapters.length}
            subtitle="Configured adapters"
            color="blue"
          />
          <MetricCard
            title="Active"
            value={activeCount}
            subtitle="Currently connected"
            color="green"
          />
          <MetricCard
            title="Inactive"
            value={inactiveCount}
            subtitle="Disconnected"
            color="gray"
          />
          <MetricCard
            title="Errors"
            value={errorCount}
            subtitle="Connection issues"
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
              placeholder="Search adapters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
            >
              <option value="all">All Types</option>
              <option value="data">Data Only</option>
              <option value="execution">Execution Only</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={handleConnectAll}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Connect All
          </button>
          <button
            onClick={handleDisconnectAll}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Disconnect All
          </button>
          <button
            onClick={handleTestAll}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Test All Connections
          </button>
        </div>

        {/* Adapters Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAdapters.map((adapter) => (
            <AdapterCard
              key={adapter.id}
              name={adapter.name}
              type={adapter.type}
              venue={adapter.venue}
              status={adapter.status}
              config={adapter.config}
              metrics={adapter.metrics}
              onToggle={(enabled) => handleToggle(adapter.id, enabled)}
              onTest={() => handleTest(adapter.id)}
              onConfigure={() => handleConfigure(adapter.id)}
            />
          ))}
        </div>

        {/* No Results */}
        {filteredAdapters.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No adapters found matching your filters</p>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            About Adapters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Adapter Types</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• <strong>Data:</strong> Market data feeds only</li>
                <li>• <strong>Execution:</strong> Order execution only</li>
                <li>• <strong>Both:</strong> Full market data and execution</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Connection Status</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• <strong>Active:</strong> Connected and operational</li>
                <li>• <strong>Inactive:</strong> Disconnected</li>
                <li>• <strong>Error:</strong> Connection issues detected</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdaptersPage;

