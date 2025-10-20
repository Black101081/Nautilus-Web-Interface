import React, { useState } from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { 
  FeatureToggle, 
  ServiceControl, 
  MetricCard,
  StatusBadge 
} from '@/components/admin';
import { Search, Filter, Layers, Activity } from 'lucide-react';
import { useNotification } from '@/contexts/NotificationContext';

/**
 * Features & Services Management Page
 * Page 3 of 6 - Manage 64 features and 126 services
 */

interface Feature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
  dependencies?: string[];
}

interface Service {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'stopped' | 'starting' | 'error';
  component: string;
  metrics?: {
    uptime?: string;
    requests?: number;
    errors?: number;
    latency?: string;
  };
}

const FeaturesPage: React.FC = () => {
  const { success, error, warning, info } = useNotification();
  const [activeTab, setActiveTab] = useState<'features' | 'services'>('features');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Sample features (in production, this would come from API)
  const [features, setFeatures] = useState<Feature[]>([
    {
      id: 'realtime-data',
      name: 'Real-time Market Data',
      description: 'Enable live market data streaming from exchanges',
      enabled: true,
      category: 'Data',
      dependencies: ['Data Engine'],
    },
    {
      id: 'historical-data',
      name: 'Historical Data Access',
      description: 'Access to historical market data and backtesting data',
      enabled: true,
      category: 'Data',
    },
    {
      id: 'order-book',
      name: 'Order Book Processing',
      description: 'Process and maintain order book data',
      enabled: true,
      category: 'Data',
      dependencies: ['Real-time Market Data'],
    },
    {
      id: 'advanced-orders',
      name: 'Advanced Order Types',
      description: 'Support for OCO, Bracket, Trailing Stop orders',
      enabled: false,
      category: 'Execution',
      dependencies: ['Order Management', 'Risk Engine'],
    },
    {
      id: 'smart-routing',
      name: 'Smart Order Routing',
      description: 'Intelligent order routing across multiple venues',
      enabled: false,
      category: 'Execution',
      dependencies: ['Execution Engine'],
    },
    {
      id: 'position-limits',
      name: 'Position Limits',
      description: 'Enforce position size limits per instrument',
      enabled: true,
      category: 'Risk',
      dependencies: ['Risk Engine'],
    },
    {
      id: 'risk-alerts',
      name: 'Risk Alerts',
      description: 'Real-time alerts for risk limit breaches',
      enabled: true,
      category: 'Risk',
      dependencies: ['Risk Engine'],
    },
    {
      id: 'portfolio-analytics',
      name: 'Portfolio Analytics',
      description: 'Advanced portfolio analysis and reporting',
      enabled: true,
      category: 'Analytics',
      dependencies: ['Portfolio Manager'],
    },
  ]);

  // Sample services (in production, this would come from API)
  const [services, setServices] = useState<Service[]>([
    {
      id: 'market-data-service',
      name: 'Market Data Service',
      description: 'Handles real-time market data subscriptions and updates',
      status: 'running',
      component: 'Data Engine',
      metrics: {
        uptime: '5d 12h',
        requests: 1250000,
        errors: 3,
        latency: '2.5ms',
      },
    },
    {
      id: 'order-execution-service',
      name: 'Order Execution Service',
      description: 'Manages order submission and execution',
      status: 'running',
      component: 'Execution Engine',
      metrics: {
        uptime: '5d 12h',
        requests: 45000,
        errors: 0,
        latency: '5.2ms',
      },
    },
    {
      id: 'risk-monitoring-service',
      name: 'Risk Monitoring Service',
      description: 'Monitors positions and enforces risk limits',
      status: 'running',
      component: 'Risk Engine',
      metrics: {
        uptime: '5d 12h',
        requests: 890000,
        errors: 0,
        latency: '1.8ms',
      },
    },
    {
      id: 'portfolio-service',
      name: 'Portfolio Service',
      description: 'Tracks portfolio state and positions',
      status: 'running',
      component: 'Portfolio Manager',
      metrics: {
        uptime: '5d 12h',
        requests: 320000,
        errors: 1,
        latency: '3.1ms',
      },
    },
    {
      id: 'strategy-execution-service',
      name: 'Strategy Execution Service',
      description: 'Executes trading strategies',
      status: 'running',
      component: 'Strategy Engine',
      metrics: {
        uptime: '5d 12h',
        requests: 125000,
        errors: 0,
        latency: '4.5ms',
      },
    },
    {
      id: 'cache-service',
      name: 'Cache Service',
      description: 'Manages data caching and persistence',
      status: 'running',
      component: 'Cache Manager',
      metrics: {
        uptime: '5d 12h',
        requests: 2100000,
        errors: 5,
        latency: '0.8ms',
      },
    },
  ]);

  const handleToggleFeature = async (featureId: string, enabled: boolean) => {
    const feature = features.find(f => f.id === featureId);
    setFeatures(features.map(f => 
      f.id === featureId ? { ...f, enabled } : f
    ));
    if (enabled) {
      success(`Feature "${feature?.name}" enabled successfully`);
    } else {
      info(`Feature "${feature?.name}" disabled`);
    }
  };

  const handleStartService = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      info(`Starting ${service.name}...`);
      setTimeout(() => success(`${service.name} started successfully`), 1500);
    }
  };

  const handleStopService = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      warning(`Stopping ${service.name}...`);
    }
  };

  const handleRestartService = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      info(`Restarting ${service.name}...`);
      setTimeout(() => success(`${service.name} restarted successfully`), 1500);
    }
  };

  // Filter features
  const filteredFeatures = features.filter((feature) => {
    const matchesSearch = feature.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         feature.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || feature.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filter services
  const filteredServices = services.filter((service) => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || service.component === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Calculate metrics
  const enabledFeatures = features.filter(f => f.enabled).length;
  const runningServices = services.filter(s => s.status === 'running').length;

  // Get unique categories
  const featureCategories = ['all', ...Array.from(new Set(features.map(f => f.category)))];
  const serviceComponents = ['all', ...Array.from(new Set(services.map(s => s.component)))];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Features & Services
          </h1>
          <p className="text-gray-600">
            Manage 64 features and 126 services across all components
          </p>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Features"
            value={features.length}
            subtitle="System features"
            color="blue"
            icon={<Layers />}
          />
          <MetricCard
            title="Enabled Features"
            value={enabledFeatures}
            subtitle={`${((enabledFeatures / features.length) * 100).toFixed(0)}% active`}
            color="green"
            icon={<Layers />}
          />
          <MetricCard
            title="Total Services"
            value={services.length}
            subtitle="System services"
            color="purple"
            icon={<Activity />}
          />
          <MetricCard
            title="Running Services"
            value={runningServices}
            subtitle={`${((runningServices / services.length) * 100).toFixed(0)}% active`}
            color="green"
            icon={<Activity />}
          />
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('features')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'features'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Features ({features.length})
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'services'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Services ({services.length})
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white min-w-[200px]"
            >
              {activeTab === 'features' ? (
                featureCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))
              ) : (
                serviceComponents.map(comp => (
                  <option key={comp} value={comp}>
                    {comp === 'all' ? 'All Components' : comp}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'features' ? (
          <>
            {/* Bulk Actions */}
            <div className="mb-6 flex gap-3">
              <button 
                onClick={() => features.forEach(f => handleToggleFeature(f.id, true))}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                Enable All
              </button>
              <button 
                onClick={() => features.forEach(f => handleToggleFeature(f.id, false))}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Disable All
              </button>
              <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors">
                Export Config
              </button>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredFeatures.map((feature) => (
                <FeatureToggle
                  key={feature.id}
                  featureName={feature.name}
                  description={feature.description}
                  enabled={feature.enabled}
                  onToggle={(enabled) => handleToggleFeature(feature.id, enabled)}
                  category={feature.category}
                  dependencies={feature.dependencies}
                />
              ))}
            </div>

            {filteredFeatures.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No features found matching your filters</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Bulk Actions */}
            <div className="mb-6 flex gap-3">
              <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                Start All
              </button>
              <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
                Stop All
              </button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                Restart All
              </button>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 gap-4">
              {filteredServices.map((service) => (
                <ServiceControl
                  key={service.id}
                  serviceName={service.name}
                  description={service.description}
                  status={service.status}
                  component={service.component}
                  metrics={service.metrics}
                  onStart={() => handleStartService(service.id)}
                  onStop={() => handleStopService(service.id)}
                  onRestart={() => handleRestartService(service.id)}
                  onConfigure={() => console.log('Configure', service.id)}
                />
              ))}
            </div>

            {filteredServices.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No services found matching your filters</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default FeaturesPage;

