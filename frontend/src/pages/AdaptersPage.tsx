import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import { useState } from "react";

export default function AdaptersPage() {
  const { success, info } = useNotification();
  const [adapters] = useState([
    { id: 1, name: 'Binance', status: 'connected', type: 'Exchange' },
    { id: 2, name: 'Interactive Brokers', status: 'disconnected', type: 'Broker' },
    { id: 3, name: 'Coinbase', status: 'connected', type: 'Exchange' },
    { id: 4, name: 'FTX', status: 'disconnected', type: 'Exchange' },
    { id: 5, name: 'Kraken', status: 'connected', type: 'Exchange' },
  ]);

  const handleToggle = (adapter: string) => {
    info(`Toggling ${adapter} connection...`);
    setTimeout(() => success(`${adapter} connection toggled!`), 1000);
  };

  const handleTest = (adapter: string) => {
    info(`Testing ${adapter} connection...`);
    setTimeout(() => success(`${adapter} connection test passed!`), 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Adapters & Connections</h1>
            <Button variant="outline" onClick={() => window.location.href = '/admin'}>
              ← Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Bulk Actions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Bulk Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button onClick={() => handleToggle('All adapters')}>
                Connect All
              </Button>
              <Button variant="outline" onClick={() => handleToggle('All adapters')}>
                Disconnect All
              </Button>
              <Button variant="outline" onClick={() => handleTest('All adapters')}>
                Test All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Adapters Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adapters.map(adapter => (
            <Card key={adapter.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {adapter.name}
                  <span className={`text-xs px-2 py-1 rounded ${
                    adapter.status === 'connected' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {adapter.status}
                  </span>
                </CardTitle>
                <CardDescription>{adapter.type}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Button size="sm" onClick={() => handleToggle(adapter.name)}>
                    Toggle
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleTest(adapter.name)}>
                    Test
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => info(`Opening ${adapter.name} config...`)}>
                    Config
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

