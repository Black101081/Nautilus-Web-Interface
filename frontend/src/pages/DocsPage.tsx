import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState("getting-started");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📚 Documentation</h1>
              <p className="text-sm text-gray-600 mt-1">Complete guide to Nautilus Web Interface</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.location.href = '/'}>
                ← Home
              </Button>
              <Button onClick={() => window.location.href = '/admin'}>
                Admin Panel
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
            <TabsTrigger value="api-reference">API Reference</TabsTrigger>
            <TabsTrigger value="user-guide">User Guide</TabsTrigger>
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
            <TabsTrigger value="deployment">Deployment</TabsTrigger>
          </TabsList>

          {/* Getting Started */}
          <TabsContent value="getting-started" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>🚀 Getting Started</CardTitle>
                <CardDescription>Quick start guide for Nautilus Web Interface</CardDescription>
              </CardHeader>
              <CardContent className="prose max-w-none">
                <h3>Prerequisites</h3>
                <ul>
                  <li>Python 3.11+</li>
                  <li>Node.js 18+</li>
                  <li>pnpm (or npm)</li>
                </ul>

                <h3>Backend Setup</h3>
                <pre className="bg-gray-100 p-4 rounded">
{`# Install Nautilus Trader
pip install nautilus_trader

# Install FastAPI
pip install fastapi uvicorn

# Run Nautilus API server
python nautilus_api.py

# Run Admin DB API server
python admin_db_api.py`}
                </pre>

                <h3>Frontend Setup</h3>
                <pre className="bg-gray-100 p-4 rounded">
{`# Install dependencies
cd frontend
pnpm install

# Run development server
pnpm run dev

# Build for production
pnpm run build`}
                </pre>

                <h3>Access the Application</h3>
                <ul>
                  <li><strong>Development:</strong> http://localhost:3000</li>
                  <li><strong>Production:</strong> https://master.nautilus-web-interface.pages.dev</li>
                  <li><strong>Nautilus API:</strong> Port 8000</li>
                  <li><strong>Admin DB API:</strong> Port 8001</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Reference */}
          <TabsContent value="api-reference" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>🔌 API Reference</CardTitle>
                <CardDescription>Complete API endpoint documentation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Nautilus Trader API (Port 8000)</h3>
                  
                  <div className="space-y-4">
                    {/* GET /api/health */}
                    <div className="border-l-4 border-blue-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">GET /api/health</div>
                      <p className="text-sm text-gray-600 mt-2">Health check endpoint.</p>
                    </div>
                    {/* GET /api/nautilus/engine/info */}
                    <div className="border-l-4 border-blue-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">GET /api/nautilus/engine/info</div>
                      <p className="text-sm text-gray-600 mt-2">Get Nautilus engine information.</p>
                    </div>
                    {/* POST /api/nautilus/database/optimize-postgresql */}
                    <div className="border-l-4 border-green-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">POST /api/nautilus/database/optimize-postgresql</div>
                      <p className="text-sm text-gray-600 mt-2">Optimize PostgreSQL database.</p>
                    </div>
                    {/* POST /api/nautilus/database/backup-postgresql */}
                    <div className="border-l-4 border-green-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">POST /api/nautilus/database/backup-postgresql</div>
                      <p className="text-sm text-gray-600 mt-2">Backup PostgreSQL database.</p>
                    </div>
                    {/* POST /api/nautilus/database/export-parquet */}
                    <div className="border-l-4 border-green-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">POST /api/nautilus/database/export-parquet</div>
                      <p className="text-sm text-gray-600 mt-2">Export Parquet catalog.</p>
                    </div>
                    {/* POST /api/nautilus/database/clean-parquet */}
                    <div className="border-l-4 border-green-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">POST /api/nautilus/database/clean-parquet</div>
                      <p className="text-sm text-gray-600 mt-2">Clean Parquet catalog.</p>
                    </div>
                    {/* POST /api/nautilus/database/flush-redis */}
                    <div className="border-l-4 border-green-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">POST /api/nautilus/database/flush-redis</div>
                      <p className="text-sm text-gray-600 mt-2">Flush Redis cache.</p>
                    </div>
                    {/* GET /api/nautilus/database/redis-stats */}
                    <div className="border-l-4 border-blue-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">GET /api/nautilus/database/redis-stats</div>
                      <p className="text-sm text-gray-600 mt-2">Get Redis statistics.</p>
                    </div>
                    {/* POST /api/nautilus/components/{component_id}/stop */}
                    <div className="border-l-4 border-yellow-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">POST /api/nautilus/components/&#123;component_id&#125;/stop</div>
                      <p className="text-sm text-gray-600 mt-2">Stop a component.</p>
                    </div>
                    {/* POST /api/nautilus/components/{component_id}/restart */}
                    <div className="border-l-4 border-yellow-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">POST /api/nautilus/components/&#123;component_id&#125;/restart</div>
                      <p className="text-sm text-gray-600 mt-2">Restart a component.</p>
                    </div>
                    {/* POST /api/nautilus/components/{component_id}/configure */}
                    <div className="border-l-4 border-yellow-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">POST /api/nautilus/components/&#123;component_id&#125;/configure</div>
                      <p className="text-sm text-gray-600 mt-2">Configure a component.</p>
                    </div>
                    {/* GET /api/nautilus/instruments */}
                    <div className="border-l-4 border-blue-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">GET /api/nautilus/instruments</div>
                      <p className="text-sm text-gray-600 mt-2">Get all instruments.</p>
                    </div>
                    {/* GET /api/nautilus/cache/stats */}
                    <div className="border-l-4 border-blue-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">GET /api/nautilus/cache/stats</div>
                      <p className="text-sm text-gray-600 mt-2">Get cache statistics.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Admin Database API (Port 8001)</h3>
                  
                  <div className="space-y-4">
                    {/* GET /api/admin/health */}
                    <div className="border-l-4 border-purple-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">GET /api/admin/health</div>
                      <p className="text-sm text-gray-600 mt-2">Health check for the admin database API.</p>
                    </div>
                    {/* GET /api/admin/settings */}
                    <div className="border-l-4 border-purple-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">GET /api/admin/settings</div>
                      <p className="text-sm text-gray-600 mt-2">Get all system settings.</p>
                    </div>
                    {/* GET /api/admin/settings/{key} */}
                    <div className="border-l-4 border-purple-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">GET /api/admin/settings/&#123;key&#125;</div>
                      <p className="text-sm text-gray-600 mt-2">Get a specific setting by key.</p>
                    </div>
                    {/* POST /api/admin/settings */}
                    <div className="border-l-4 border-red-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">POST /api/admin/settings</div>
                      <p className="text-sm text-gray-600 mt-2">Create a new setting.</p>
                    </div>
                    {/* PUT /api/admin/settings/{key} */}
                    <div className="border-l-4 border-red-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">PUT /api/admin/settings/&#123;key&#125;</div>
                      <p className="text-sm text-gray-600 mt-2">Update a setting.</p>
                    </div>
                    {/* DELETE /api/admin/settings/{key} */}
                    <div className="border-l-4 border-red-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">DELETE /api/admin/settings/&#123;key&#125;</div>
                      <p className="text-sm text-gray-600 mt-2">Delete a setting.</p>
                    </div>
                    {/* GET /api/admin/users */}
                    <div className="border-l-4 border-purple-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">GET /api/admin/users</div>
                      <p className="text-sm text-gray-600 mt-2">Get all users.</p>
                    </div>
                    {/* POST /api/admin/users */}
                    <div className="border-l-4 border-red-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">POST /api/admin/users</div>
                      <p className="text-sm text-gray-600 mt-2">Create a new user.</p>
                    </div>
                    {/* GET /api/admin/api-configs */}
                    <div className="border-l-4 border-purple-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">GET /api/admin/api-configs</div>
                      <p className="text-sm text-gray-600 mt-2">Get API configurations.</p>
                    </div>
                    {/* POST /api/admin/api-configs */}
                    <div className="border-l-4 border-red-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">POST /api/admin/api-configs</div>
                      <p className="text-sm text-gray-600 mt-2">Create a new API configuration.</p>
                    </div>
                    {/* GET /api/admin/tasks */}
                    <div className="border-l-4 border-purple-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">GET /api/admin/tasks</div>
                      <p className="text-sm text-gray-600 mt-2">Get all scheduled tasks.</p>
                    </div>
                    {/* POST /api/admin/tasks */}
                    <div className="border-l-4 border-red-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">POST /api/admin/tasks</div>
                      <p className="text-sm text-gray-600 mt-2">Create a new scheduled task.</p>
                    </div>
                    {/* GET /api/admin/audit-logs */}
                    <div className="border-l-4 border-purple-500 pl-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 inline-block rounded">GET /api/admin/audit-logs</div>
                      <p className="text-sm text-gray-600 mt-2">Get audit logs.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Guide */}
          <TabsContent value="user-guide" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>📖 User Guide</CardTitle>
                <CardDescription>How to use the admin panel</CardDescription>
              </CardHeader>
              <CardContent className="prose max-w-none">
                <h3>Dashboard</h3>
                <p>The main dashboard provides an overview of your Nautilus Trader system with quick access to all admin pages.</p>

                <h3>Database Page</h3>
                <p>Manage PostgreSQL, Parquet, and Redis databases:</p>
                <ul>
                  <li><strong>Backup:</strong> Create database backups</li>
                  <li><strong>Optimize:</strong> Optimize database performance</li>
                  <li><strong>Export:</strong> Export data to Parquet format</li>
                  <li><strong>Clean:</strong> Clean up old data</li>
                </ul>

                <h3>Components Page</h3>
                <p>Control Nautilus Trader components:</p>
                <ul>
                  <li><strong>Stop:</strong> Stop a component</li>
                  <li><strong>Restart:</strong> Restart a component</li>
                  <li><strong>Configure:</strong> Configure component settings</li>
                </ul>

                <h3>Features Page</h3>
                <p>Manage feature flags and services:</p>
                <ul>
                  <li><strong>Toggle Features:</strong> Enable/disable features</li>
                  <li><strong>Service Control:</strong> Start/stop services</li>
                </ul>

                <h3>Adapters Page</h3>
                <p>Manage exchange and broker connections:</p>
                <ul>
                  <li><strong>Connect/Disconnect:</strong> Control adapter connections</li>
                  <li><strong>Test:</strong> Test adapter connectivity</li>
                  <li><strong>Configure:</strong> Configure adapter settings</li>
                </ul>

                <h3>Monitoring Page</h3>
                <p>View system metrics and logs:</p>
                <ul>
                  <li><strong>Metrics:</strong> Real-time system metrics</li>
                  <li><strong>Logs:</strong> System logs and errors</li>
                  <li><strong>Alerts:</strong> Configure and view alerts</li>
                </ul>

                <h3>Settings Page</h3>
                <p>Configure system settings:</p>
                <ul>
                  <li><strong>General:</strong> Application settings</li>
                  <li><strong>Notifications:</strong> Notification preferences</li>
                  <li><strong>Security:</strong> Security settings</li>
                  <li><strong>Performance:</strong> Performance tuning</li>
                </ul>

                <h3>Database Management</h3>
                <p>Manage admin panel database:</p>
                <ul>
                  <li><strong>Users:</strong> Manage admin users</li>
                  <li><strong>API Configs:</strong> Configure external APIs</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Architecture */}
          <TabsContent value="architecture" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>🏗️ Architecture</CardTitle>
                <CardDescription>System architecture and tech stack</CardDescription>
              </CardHeader>
              <CardContent className="prose max-w-none">
                <h3>System Overview</h3>
                <p>Nautilus Web Interface is a full-stack application consisting of:</p>
                <ul>
                  <li><strong>Frontend:</strong> React 19 + TypeScript + Tailwind CSS</li>
                  <li><strong>Backend:</strong> Python FastAPI + Nautilus Trader</li>
                  <li><strong>Database:</strong> SQLite (Admin Panel) + PostgreSQL (Nautilus)</li>
                  <li><strong>Deployment:</strong> Cloudflare Pages (Frontend) + Self-hosted (Backend)</li>
                </ul>

                <h3>Tech Stack</h3>
                <div className="grid grid-cols-2 gap-4 not-prose">
                  <div className="border p-4 rounded">
                    <h4 className="font-semibold mb-2">Frontend</h4>
                    <ul className="text-sm space-y-1">
                      <li>• React 19</li>
                      <li>• TypeScript</li>
                      <li>• Vite</li>
                      <li>• Tailwind CSS</li>
                      <li>• shadcn/ui</li>
                      <li>• Wouter (routing)</li>
                    </ul>
                  </div>
                  <div className="border p-4 rounded">
                    <h4 className="font-semibold mb-2">Backend</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Python 3.11</li>
                      <li>• FastAPI</li>
                      <li>• Nautilus Trader</li>
                      <li>• SQLite</li>
                      <li>• Uvicorn</li>
                    </ul>
                  </div>
                </div>

                <h3>Architecture Diagram</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm">
{`┌─────────────────────────────────────────────┐
│         Cloudflare Pages (Frontend)         │
│  React + TypeScript + Tailwind CSS          │
└──────────────┬──────────────────────────────┘
               │ HTTPS
               ├──────────────┬────────────────┐
               │              │                │
               ▼              ▼                ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
│  Nautilus API    │ │  Admin DB    │ │  Nautilus    │
│  (Port 8000)     │ │  API         │ │  Trader      │
│                  │ │  (Port 8001) │ │  Core        │
│  FastAPI         │ │  FastAPI     │ │  (Rust)      │
└────────┬─────────┘ └──────┬───────┘ └──────┬───────┘
         │                  │                │
         ▼                  ▼                ▼
┌──────────────┐   ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │   │   SQLite     │  │   Cache      │
│  Database    │   │   Database   │  │   (Redis)    │
└──────────────┘   └──────────────┘  └──────────────┘`}
                </pre>

                <h3>Data Flow</h3>
                <ol>
                  <li>User interacts with React frontend</li>
                  <li>Frontend makes API calls to backend</li>
                  <li>Backend processes requests via Nautilus Trader</li>
                  <li>Data is stored/retrieved from databases</li>
                  <li>Results are returned to frontend</li>
                  <li>UI updates with real-time data</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deployment */}
          <TabsContent value="deployment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>🚀 Deployment</CardTitle>
                <CardDescription>How to deploy to production</CardDescription>
              </CardHeader>
              <CardContent className="prose max-w-none">
                <h3>Frontend Deployment (Cloudflare Pages)</h3>
                <ol>
                  <li>Push code to GitHub</li>
                  <li>Connect repo to Cloudflare Pages</li>
                  <li>Configure build settings:
                    <pre className="bg-gray-100 p-2 rounded text-sm">
{`Build command: cd frontend && npm install && npm run build
Build output: frontend/dist
Environment variables:
  VITE_API_URL=https://your-backend-url.com
  VITE_ADMIN_DB_API_URL=https://your-admin-api-url.com`}
                    </pre>
                  </li>
                  <li>Deploy!</li>
                </ol>

                <h3>Backend Deployment</h3>
                <p>Deploy to your preferred platform:</p>
                <ul>
                  <li><strong>VPS (DigitalOcean, AWS, etc.):</strong>
                    <pre className="bg-gray-100 p-2 rounded text-sm">
{`# Install dependencies
pip install -r requirements.txt

# Run with systemd or supervisor
python nautilus_api.py
python admin_db_api.py`}
                    </pre>
                  </li>
                  <li><strong>Docker:</strong>
                    <pre className="bg-gray-100 p-2 rounded text-sm">
{`# Build image
docker build -t nautilus-api .

# Run container
docker run -p 8000:8000 nautilus-api`}
                    </pre>
                  </li>
                </ul>

                <h3>Environment Variables</h3>
                <p>Configure these environment variables:</p>
                <ul>
                  <li><code>VITE_API_URL</code> - Nautilus API URL</li>
                  <li><code>VITE_ADMIN_DB_API_URL</code> - Admin DB API URL</li>
                </ul>

                <h3>Production Checklist</h3>
                <ul>
                  <li>✅ Set up SSL certificates</li>
                  <li>✅ Configure CORS properly</li>
                  <li>✅ Set up monitoring and logging</li>
                  <li>✅ Configure backups</li>
                  <li>✅ Set up CI/CD pipeline</li>
                  <li>✅ Test all endpoints</li>
                  <li>✅ Configure rate limiting</li>
                  <li>✅ Set up error tracking</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

