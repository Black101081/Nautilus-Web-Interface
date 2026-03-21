import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useWebSocket } from "@/hooks/useWebSocket";

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "WATCH",
    items: [
      { path: "/trader/market-data", label: "Market Data", icon: "📊" },
      { path: "/trader/alerts", label: "Alerts", icon: "🔔" },
    ],
  },
  {
    label: "TRADE",
    items: [
      { path: "/trader/strategies", label: "Strategies", icon: "⚡" },
      { path: "/trader/orders", label: "Orders", icon: "📋" },
      { path: "/trader/positions", label: "Positions", icon: "💼" },
      { path: "/trader/risk", label: "Risk", icon: "⚖️" },
    ],
  },
  {
    label: "ANALYZE",
    items: [
      { path: "/trader/performance", label: "Performance", icon: "📈" },
      { path: "/trader/analytics", label: "Analytics", icon: "🔬" },
      { path: "/trader/backtesting", label: "Backtesting", icon: "🕐" },
      { path: "/trader/catalog", label: "Data Catalog", icon: "🗄️" },
    ],
  },
];

interface TraderLayoutProps {
  children: React.ReactNode;
}

export default function TraderLayout({ children }: TraderLayoutProps) {
  const [location, navigate] = useLocation();
  const { connected: wsConnected, lastMessage } = useWebSocket();
  const [strategiesCount, setStrategiesCount] = useState(0);
  const [positionsCount, setPositionsCount] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);
  const [engineRunning, setEngineRunning] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (lastMessage?.type === "live_data") {
      if (lastMessage.engine?.strategies_count !== undefined) {
        setStrategiesCount(lastMessage.engine.strategies_count);
        // engine is_initialized is the closest proxy for "running"
        setEngineRunning(lastMessage.engine.is_initialized ?? false);
      }
      if (lastMessage.open_positions_count !== undefined) {
        setPositionsCount(lastMessage.open_positions_count);
      }
      // alerts_count is not in WsMessage yet — placeholder
    }
  }, [lastMessage]);

  const getBadge = (path: string): number | null => {
    if (path === "/trader/strategies") return strategiesCount > 0 ? strategiesCount : null;
    if (path === "/trader/positions") return positionsCount > 0 ? positionsCount : null;
    if (path === "/trader/alerts") return alertsCount > 0 ? alertsCount : null;
    return null;
  };

  const isActive = (path: string) => location === path;

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300 ${
          collapsed ? "w-14" : "w-56"
        }`}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 px-3 py-4 border-b border-gray-800 cursor-pointer"
          onClick={() => navigate("/trader")}
        >
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
            N
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold text-sm text-white truncate">Nautilus</div>
              <div className="text-xs text-gray-500 truncate">Trader Panel</div>
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
            className="ml-auto text-gray-500 hover:text-gray-300 shrink-0 text-xs"
          >
            {collapsed ? "▶" : "◀"}
          </button>
        </div>

        {/* Engine Status */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-gray-800">
            <div className="flex items-center gap-2 text-xs">
              <div
                className={`w-2 h-2 rounded-full ${
                  engineRunning ? "bg-green-400 animate-pulse" : "bg-gray-600"
                }`}
              />
              <span className={engineRunning ? "text-green-400" : "text-gray-500"}>
                {engineRunning ? "Engine Live" : "Engine Stopped"}
              </span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-2">
              {!collapsed && (
                <div className="px-3 py-1 text-xs font-semibold text-gray-600 tracking-wider">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const badge = getBadge(item.path);
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors relative ${
                      active
                        ? "bg-blue-600/20 text-blue-400 border-r-2 border-blue-500"
                        : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="text-base shrink-0">{item.icon}</span>
                    {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                    {badge !== null && (
                      <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom links */}
        <div className="border-t border-gray-800 py-2">
          <button
            onClick={() => navigate("/docs")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            title={collapsed ? "Docs" : undefined}
          >
            <span className="text-base">📚</span>
            {!collapsed && <span>Docs</span>}
          </button>
          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            title={collapsed ? "Admin" : undefined}
          >
            <span className="text-base">⚙️</span>
            {!collapsed && <span>Admin Panel</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            {/* Breadcrumb from active route */}
            <span className="text-sm text-gray-400">
              {NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.path === location)?.label ?? "Dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* WS Status */}
            <div
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
                wsConnected ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  wsConnected ? "bg-green-400 animate-pulse" : "bg-red-500"
                }`}
              />
              {wsConnected ? "Live" : "Disconnected"}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  );
}
