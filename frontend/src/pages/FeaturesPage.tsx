import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import { useState } from "react";

export default function FeaturesPage() {
  const { success, info } = useNotification();
  const [features] = useState([
    { id: 1, name: 'Live Trading', enabled: true },
    { id: 2, name: 'Backtesting', enabled: true },
    { id: 3, name: 'Paper Trading', enabled: false },
    { id: 4, name: 'Risk Management', enabled: true },
    { id: 5, name: 'Advanced Analytics', enabled: false },
    { id: 6, name: 'Multi-Exchange', enabled: true },
  ]);

  const [services] = useState([
    { id: 1, name: 'Market Data Service', status: 'running' },
    { id: 2, name: 'Order Execution Service', status: 'running' },
    { id: 3, name: 'Risk Service', status: 'stopped' },
    { id: 4, name: 'Analytics Service', status: 'running' },
  ]);

  const handleToggleFeature = (feature: string) => {
    info(`Toggling ${feature}...`);
    setTimeout(() => success(`${feature} toggled successfully!`), 1000);
  };

  const handleServiceAction = (service: string, action: string) => {
    info(`${action} ${service}...`);
    setTimeout(() => success(`${service} ${action.toLowerCase()} successfully!`), 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Features & Services</h1>
            <Button variant="outline" onClick={() => window.location.href = '/admin'}>
              ← Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Features Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Feature Flags</h2>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleToggleFeature('All features')}>
                Enable All
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleToggleFeature('All features')}>
                Disable All
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(feature => (
              <Card key={feature.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{feature.name}</CardTitle>
                    <span className={`text-xs px-2 py-1 rounded ${
                      feature.enabled 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {feature.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button 
                    size="sm" 
                    className="w-full" 
                    variant={feature.enabled ? 'outline' : 'default'}
                    onClick={() => handleToggleFeature(feature.name)}
                  >
                    {feature.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Services Section */}
        <div>
          <h2 className="text-xl font-bold mb-4">Services</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {services.map(service => (
              <Card key={service.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {service.name}
                    <span className={`text-xs px-2 py-1 rounded ${
                      service.status === 'running' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {service.status}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2">
                    <Button size="sm" onClick={() => handleServiceAction(service.name, 'Start')}>
                      Start
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleServiceAction(service.name, 'Stop')}>
                      Stop
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleServiceAction(service.name, 'Restart')}>
                      Restart
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => info(`Opening ${service.name} config...`)}>
                      Config
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

