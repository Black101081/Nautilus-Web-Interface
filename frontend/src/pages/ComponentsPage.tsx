import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import { useState } from "react";

export default function ComponentsPage() {
  const { success, info } = useNotification();
  const [components] = useState([
    { id: 1, name: 'DataEngine', status: 'running', type: 'Engine' },
    { id: 2, name: 'ExecutionEngine', status: 'running', type: 'Engine' },
    { id: 3, name: 'RiskEngine', status: 'running', type: 'Engine' },
    { id: 4, name: 'Portfolio', status: 'running', type: 'Component' },
    { id: 5, name: 'Cache', status: 'running', type: 'Component' },
    { id: 6, name: 'MessageBus', status: 'running', type: 'Component' },
  ]);

  const handleAction = (component: string, action: string) => {
    info(`${action} ${component}...`);
    setTimeout(() => success(`${component} ${action.toLowerCase()} successfully!`), 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Components Management</h1>
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
              <Button onClick={() => handleAction('All components', 'Start')}>
                Start All
              </Button>
              <Button variant="outline" onClick={() => handleAction('All components', 'Stop')}>
                Stop All
              </Button>
              <Button variant="outline" onClick={() => handleAction('All components', 'Restart')}>
                Restart All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Components Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {components.map(comp => (
            <Card key={comp.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {comp.name}
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                    {comp.status}
                  </span>
                </CardTitle>
                <CardDescription>{comp.type}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleAction(comp.name, 'Stop')}>
                    Stop
                  </Button>
                  <Button size="sm" onClick={() => handleAction(comp.name, 'Restart')}>
                    Restart
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => info(`Opening ${comp.name} config...`)}>
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

