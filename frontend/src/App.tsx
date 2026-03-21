import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import React, { useEffect, useState } from "react";
import { loadApiConfig } from "./config";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { NotificationContainer } from "./components/NotificationContainer";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import TraderDashboard from "./pages/TraderDashboard";
import DatabasePage from "./pages/DatabasePage";
import ComponentsPage from "./pages/ComponentsPage";
import FeaturesPage from "./pages/FeaturesPage";
import AdaptersPage from "./pages/AdaptersPage";
import MonitoringPage from "./pages/MonitoringPage";
import SettingsPage from "./pages/SettingsPage";
import AdminDBPage from "./pages/AdminDBPage";
import DocsPage from "./pages/DocsPage";
import StrategiesPage from "./pages/StrategiesPage";
import OrdersPage from "./pages/OrdersPage";
import PositionsPage from "./pages/PositionsPage";
import RiskPage from "./pages/RiskPage";
import ApiConfigPage from "./pages/ApiConfigPage";
import DatabaseManagementPage from "./pages/DatabaseManagementPage";
import MarketDataPage from "./pages/MarketDataPage";
import PerformancePage from "./pages/PerformancePage";
import AlertsPage from "./pages/AlertsPage";
import BacktestingPage from "./pages/BacktestingPage";
import UsersPage from "./pages/UsersPage";
import LoginPage from "./pages/LoginPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CatalogPage from "./pages/CatalogPage";
import { API_CONFIG } from "./config";
import TraderLayout from "./components/TraderLayout";
import AdminLayout from "./components/AdminLayout";

function Router() {
  useEffect(() => {
    loadApiConfig();
  }, []);

  const T = (Page: React.ComponentType) => () => <TraderLayout><Page /></TraderLayout>;
  const A = (Page: React.ComponentType) => () => <AdminLayout><Page /></AdminLayout>;

  return (
    <Switch>
      <Route path="/" component={Home} />
      {/* Admin routes — wrapped in AdminLayout */}
      <Route path="/admin" component={A(AdminDashboard)} />
      <Route path="/admin/database" component={A(DatabasePage)} />
      <Route path="/admin/components" component={A(ComponentsPage)} />
      <Route path="/admin/features" component={A(FeaturesPage)} />
      <Route path="/admin/adapters" component={A(AdaptersPage)} />
      <Route path="/admin/monitoring" component={A(MonitoringPage)} />
      <Route path="/admin/settings" component={A(SettingsPage)} />
      <Route path="/admin/database-management" component={A(AdminDBPage)} />
      <Route path="/admin/api-config" component={A(ApiConfigPage)} />
      <Route path="/admin/db-management" component={A(DatabaseManagementPage)} />
      <Route path="/admin/users" component={A(UsersPage)} />
      {/* Trader routes — wrapped in TraderLayout */}
      <Route path="/trader" component={T(TraderDashboard)} />
      <Route path="/trader/strategies" component={T(StrategiesPage)} />
      <Route path="/trader/orders" component={T(OrdersPage)} />
      <Route path="/trader/positions" component={T(PositionsPage)} />
      <Route path="/trader/risk" component={T(RiskPage)} />
      <Route path="/trader/market-data" component={T(MarketDataPage)} />
      <Route path="/trader/performance" component={T(PerformancePage)} />
      <Route path="/trader/alerts" component={T(AlertsPage)} />
      <Route path="/trader/backtesting" component={T(BacktestingPage)} />
      <Route path="/trader/analytics" component={T(AnalyticsPage)} />
      <Route path="/trader/catalog" component={T(CatalogPage)} />
      <Route path="/docs" component={DocsPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <button
      onClick={onLogout}
      title="Logout"
      className="fixed bottom-4 right-4 z-50 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs font-medium hover:bg-red-700 hover:text-white transition-colors shadow-lg opacity-60 hover:opacity-100"
    >
      Logout
    </button>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Listen for 401 events dispatched by api.ts — triggers soft logout
    const onUnauthorized = () => {
      setAuthenticated(false);
    };
    window.addEventListener('nautilus:unauthorized', onUnauthorized);
    return () => window.removeEventListener('nautilus:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    // Check if stored token is still valid by verifying it hasn't expired
    const token = localStorage.getItem('nautilus_token');
    if (!token) {
      setAuthenticated(false);
      return;
    }
    // Decode JWT payload to check expiry (no library needed for exp check)
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Malformed token');
      // JWT uses base64url encoding; atob needs standard base64
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      const exp = typeof payload.exp === 'number' ? payload.exp : null;
      if (exp !== null && exp * 1000 < Date.now()) {
        // Token expired — clear and show login
        localStorage.removeItem('nautilus_token');
        localStorage.removeItem('nautilus_role');
        setAuthenticated(false);
      } else {
        setAuthenticated(true);
      }
    } catch {
      localStorage.removeItem('nautilus_token');
      localStorage.removeItem('nautilus_role');
      setAuthenticated(false);
    }
  }, []);

  const handleLogin = (token: string, role: string) => {
    localStorage.setItem('nautilus_token', token);
    localStorage.setItem('nautilus_role', role);
    setAuthenticated(true);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('nautilus_token');
    if (token) {
      // Notify backend to blacklist the token
      try {
        await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore network errors — local logout still proceeds
      }
    }
    localStorage.removeItem('nautilus_token');
    localStorage.removeItem('nautilus_role');
    setAuthenticated(false);
  };

  // Still loading auth state
  if (authenticated === null) return null;

  // Show login page if not authenticated
  if (!authenticated) {
    return (
      <ErrorBoundary>
        <LoginPage onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <NotificationProvider>
          <TooltipProvider>
            <Toaster />
            <NotificationContainer />
            <Router />
            <LogoutButton onLogout={handleLogout} />
          </TooltipProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
