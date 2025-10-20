import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";

export default function MonitoringPage() {
  const { success, info } = useNotification();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">System Monitoring</h1>
            <Button variant="outline" onClick={() => window.location.href = '/admin'}>
              ← Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Metrics */}
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>CPU Usage</CardDescription>
              <CardTitle className="text-3xl">45%</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Memory</CardDescription>
              <CardTitle className="text-3xl">2.1GB</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Requests/sec</CardDescription>
              <CardTitle className="text-3xl">1,234</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Uptime</CardDescription>
              <CardTitle className="text-3xl">99.9%</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>📊 Metrics</CardTitle>
              <CardDescription>System performance metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => info('Refreshing metrics...')}>
                Refresh Metrics
              </Button>
              <Button className="w-full" variant="outline" onClick={() => success('Metrics exported!')}>
                Export Metrics
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📝 Logs</CardTitle>
              <CardDescription>Application logs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => info('Refreshing logs...')}>
                Refresh Logs
              </Button>
              <Button className="w-full" variant="outline" onClick={() => success('Logs exported!')}>
                Export Logs
              </Button>
              <Button className="w-full" variant="outline" onClick={() => success('Logs cleared!')}>
                Clear Logs
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔔 Alerts</CardTitle>
              <CardDescription>System alerts & warnings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => info('Viewing alerts...')}>
                View Alerts
              </Button>
              <Button className="w-full" variant="outline" onClick={() => info('Opening alert config...')}>
                Configure Alerts
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📈 Reports</CardTitle>
              <CardDescription>Performance reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => success('Generating report...')}>
                Generate Report
              </Button>
              <Button className="w-full" variant="outline" onClick={() => success('Report downloaded!')}>
                Download Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

