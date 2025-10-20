import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Nautilus Web Interface
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Professional admin interface for Nautilus Trader
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => window.location.href = '/admin'}>
              Enter Admin Panel
            </Button>
            <Button size="lg" variant="outline" onClick={() => window.open('https://github.com/Black101081/Nautilus-Web-Interface', '_blank')}>
              View on GitHub
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>🚀 FastAPI Backend</CardTitle>
              <CardDescription>RESTful API with 15+ endpoints</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Nautilus Trader integration</li>
                <li>✓ Database operations</li>
                <li>✓ Component management</li>
                <li>✓ Real-time monitoring</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>⚛️ React Frontend</CardTitle>
              <CardDescription>Modern TypeScript UI</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ 8 admin pages</li>
                <li>✓ 140+ operations</li>
                <li>✓ Notification system</li>
                <li>✓ Responsive design</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📊 Full Stack</CardTitle>
              <CardDescription>Production-ready system</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ End-to-end tested</li>
                <li>✓ CI/CD pipeline</li>
                <li>✓ Complete docs</li>
                <li>✓ MIT License</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            Built with ❤️ for the Nautilus Trader community
          </p>
          <div className="flex gap-4 justify-center text-sm text-gray-500">
            <a href="https://github.com/Black101081/Nautilus-Web-Interface" className="hover:text-gray-900">
              GitHub
            </a>
            <span>•</span>
            <a href="https://nautilustrader.io" className="hover:text-gray-900">
              Nautilus Trader
            </a>
            <span>•</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

