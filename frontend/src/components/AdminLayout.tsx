import { useState } from "react";
import { useLocation } from "wouter";

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/admin", label: "Dashboard", icon: "🏠" },
  { path: "/admin/users", label: "Users", icon: "👥" },
  { path: "/admin/adapters", label: "Adapters", icon: "🔌" },
  { path: "/admin/components", label: "Components", icon: "⚙️" },
  { path: "/admin/monitoring", label: "Monitoring", icon: "📡" },
  { path: "/admin/features", label: "Features", icon: "🧩" },
  { path: "/admin/database", label: "Database", icon: "🗄️" },
  { path: "/admin/db-management", label: "DB Mgmt", icon: "🔧" },
  { path: "/admin/api-config", label: "API Config", icon: "🔑" },
  { path: "/admin/settings", label: "Settings", icon: "⚙️" },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) =>
    path === "/admin" ? location === "/admin" : location.startsWith(path) && path !== "/admin";

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300 ${
          collapsed ? "w-14" : "w-52"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-gray-800">
          <div className="w-8 h-8 bg-purple-700 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
            A
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold text-sm text-white truncate">Nautilus</div>
              <div className="text-xs text-gray-500 truncate">Admin Panel</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-gray-500 hover:text-gray-300 shrink-0 text-xs"
          >
            {collapsed ? "▶" : "◀"}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-purple-700/20 text-purple-400 border-r-2 border-purple-500"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                {!collapsed && <span className="text-left">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Back to Trader */}
        <div className="border-t border-gray-800 py-2">
          <button
            onClick={() => navigate("/trader")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            title={collapsed ? "Trader" : undefined}
          >
            <span className="text-base">📈</span>
            {!collapsed && <span>Trader Panel</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          <span className="text-sm text-gray-400">
            {NAV_ITEMS.find((i) => isActive(i.path))?.label ?? "Admin"}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  );
}
