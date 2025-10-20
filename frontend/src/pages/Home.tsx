import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            Nautilus Web Interface
          </h1>
          <p className="text-2xl text-gray-600 mb-8">
            Professional trading platform with comprehensive administration
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-16">
          <Card className="border-2 border-blue-200 hover:border-blue-400 transition-all hover:shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <CardTitle className="text-3xl">📈 Trader Panel</CardTitle>
              <CardDescription className="text-blue-100 text-lg">
                Algorithmic trading operations
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-700 mb-6">
                Access all trading features powered by Nautilus Trader.
              </p>
              <Button 
                size="lg" 
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => window.location.href = '/trader'}
              >
                Enter Trader Panel →
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-300 hover:border-gray-500 transition-all hover:shadow-xl">
            <CardHeader className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
              <CardTitle className="text-3xl">⚙️ Admin Panel</CardTitle>
              <CardDescription className="text-gray-300 text-lg">
                System administration
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-700 mb-6">
                Comprehensive system administration tools.
              </p>
              <Button 
                size="lg" 
                variant="outline"
                className="w-full border-2"
                onClick={() => window.location.href = '/admin'}
              >
                Enter Admin Panel →
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
