import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AlertsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Alerts & Notifications</h1>
            <p className="text-gray-600 mt-2">Configure price alerts and system notifications</p>
          </div>
          <Button variant="outline" onClick={() => window.location.href = '/trader'}>
            ← Back to Trader Panel
          </Button>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>🔔 Alert Management</CardTitle>
              <CardDescription>Manage trading alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Alerts feature coming soon...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
