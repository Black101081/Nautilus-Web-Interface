import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import { API_CONFIG } from "@/config";

interface Component {
  id: string;
  name: string;
  type: string;
  status: string;
}

const STATUS_STYLE: Record<string, string> = {
  running: "bg-green-100 text-green-700",
  active:  "bg-green-100 text-green-700",
  stopped: "bg-red-100 text-red-700",
  error:   "bg-red-100 text-red-700",
  paused:  "bg-yellow-100 text-yellow-700",
};

export default function ComponentsPage() {
  const { success, info, error: notifyError } = useNotification();
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchComponents = useCallback(async () => {
    try {
      const res = await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/components`);
      const data = await res.json();
      setComponents(data.components ?? []);
    } catch {
      notifyError("Failed to load components");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComponents();
    const interval = setInterval(fetchComponents, 5000);
    return () => clearInterval(interval);
  }, [fetchComponents]);

  const callAction = async (action: string, componentId?: string) => {
    const key = componentId ?? "all";
    setActing(key + action);
    const label = componentId ?? "All components";
    info(`${action} ${label}…`);
    try {
      const endpoint = action === "Restart"
        ? "/api/component/restart"
        : action === "Stop"
        ? "/api/component/stop"
        : "/api/component/start";

      await fetch(`${API_CONFIG.NAUTILUS_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ component: label }),
      });
      success(`${label} ${action.toLowerCase()}ed successfully`);
      await fetchComponents();
    } catch {
      notifyError(`Failed to ${action.toLowerCase()} ${label}`);
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Components Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? "Loading…" : `${components.length} components · auto-refresh every 5s`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchComponents}>⟳ Refresh</Button>
            <Button variant="outline" onClick={() => window.location.href = "/admin"}>
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
            <CardDescription>Apply an action to all components at once</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button onClick={() => callAction("Start")} disabled={acting !== null}>
                Start All
              </Button>
              <Button variant="outline" onClick={() => callAction("Stop")} disabled={acting !== null}>
                Stop All
              </Button>
              <Button variant="outline" onClick={() => callAction("Restart")} disabled={acting !== null}>
                Restart All
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-16 text-gray-500 animate-pulse">Loading components…</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {components.map(comp => {
              const statusStyle = STATUS_STYLE[comp.status] ?? "bg-gray-100 text-gray-600";
              const isActing = acting === comp.id + "Restart" || acting === comp.id + "Stop";
              return (
                <Card key={comp.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      {comp.name}
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyle}`}>
                        {comp.status}
                      </span>
                    </CardTitle>
                    <CardDescription>{comp.type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isActing}
                        onClick={() => callAction("Stop", comp.id)}
                      >
                        Stop
                      </Button>
                      <Button
                        size="sm"
                        disabled={isActing}
                        onClick={() => callAction("Restart", comp.id)}
                      >
                        {isActing ? "…" : "Restart"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => info(`Opening ${comp.name} config…`)}
                      >
                        Config
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
