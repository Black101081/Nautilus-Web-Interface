import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MarketDataPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Market Data</h1>
            <p className="text-gray-600 mt-2">Real-time market feeds and quotes</p>
          </div>
          <Button variant="outline" onClick={() => window.location.href = '/trader'}>
            ← Back to Trader Panel
          </Button>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>📊 Market Data Subscriptions</CardTitle>
              <CardDescription>Manage real-time data feeds</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Market data feature coming soon...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
