import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import nautilusService from "@/services/nautilusService";

export default function DatabasePage() {
  const { success, info, warning, error } = useNotification();

  const handleBackup = async (db: string) => {
    try {
      info(`Starting backup for ${db}...`);
      const result = await nautilusService.backupDatabase(db.toLowerCase());
      success(result.message);
    } catch (err) {
      error(`Failed to backup ${db}`);
    }
  };

  const handleOptimize = async (db: string) => {
    try {
      info(`Optimizing ${db}...`);
      const result = await nautilusService.optimizeDatabase(db.toLowerCase());
      success(result.message);
    } catch (err) {
      error(`Failed to optimize ${db}`);
    }
  };

  const handleClean = async (db: string) => {
    try {
      warning(`Cleaning ${db} cache...`);
      const result = await nautilusService.cleanCache(db.toLowerCase());
      success(result.message);
    } catch (err) {
      error(`Failed to clean ${db}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Database Management</h1>
            <Button variant="outline" onClick={() => window.location.href = '/admin'}>
              ← Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          {/* PostgreSQL */}
          <Card>
            <CardHeader>
              <CardTitle>🐘 PostgreSQL</CardTitle>
              <CardDescription>Main database cache</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => handleBackup('PostgreSQL')}>
                Backup Database
              </Button>
              <Button className="w-full" variant="outline" onClick={() => handleOptimize('PostgreSQL')}>
                Optimize Tables
              </Button>
            </CardContent>
          </Card>

          {/* Parquet */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Parquet</CardTitle>
              <CardDescription>Data catalog storage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => handleBackup('Parquet')}>
                Export Catalog
              </Button>
              <Button className="w-full" variant="outline" onClick={() => handleClean('Parquet')}>
                Clean Old Files
              </Button>
            </CardContent>
          </Card>

          {/* Redis */}
          <Card>
            <CardHeader>
              <CardTitle>⚡ Redis</CardTitle>
              <CardDescription>In-memory cache</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => handleClean('Redis')}>
                Flush Cache
              </Button>
              <Button className="w-full" variant="outline" onClick={() => info('Redis stats: 1.2M keys, 85% memory')}>
                View Stats
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Maintenance Actions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>🔧 Maintenance Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <Button onClick={() => handleBackup('All databases')}>
                Full Backup
              </Button>
              <Button variant="outline" onClick={() => handleOptimize('All databases')}>
                Optimize All
              </Button>
              <Button variant="outline" onClick={() => info('Exporting all data...')}>
                Export Data
              </Button>
              <Button variant="outline" onClick={() => info('Opening logs...')}>
                View Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

