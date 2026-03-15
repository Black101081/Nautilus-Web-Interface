import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useEffect, useState } from "react";
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
import LoginPage from "./pages/LoginPage";

function Router() {
  useEffect(() => {
    loadApiConfig();
  }, []);

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/database" component={DatabasePage} />
      <Route path="/admin/components" component={ComponentsPage} />
      <Route path="/admin/features" component={FeaturesPage} />
      <Route path="/admin/adapters" component={AdaptersPage} />
      <Route path="/admin/monitoring" component={MonitoringPage} />
      <Route path="/admin/settings" component={SettingsPage} />
      <Route path="/admin/database-management" component={AdminDBPage} />
      <Route path="/admin/api-config" component={ApiConfigPage} />
      <Route path="/admin/db-management" component={DatabaseManagementPage} />
      <Route path="/trader" component={TraderDashboard} />
      <Route path="/trader/strategies" component={StrategiesPage} />
      <Route path="/trader/orders" component={OrdersPage} />
      <Route path="/trader/positions" component={PositionsPage} />
      <Route path="/trader/risk" component={RiskPage} />
      <Route path="/trader/market-data" component={MarketDataPage} />
      <Route path="/trader/performance" component={PerformancePage} />
      <Route path="/trader/alerts" component={AlertsPage} />
      <Route path="/trader/backtesting" component={BacktestingPage} />
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
    // Persist auth across page refreshes via localStorage
    const stored = localStorage.getItem('nautilus_auth');
    setAuthenticated(stored === 'true');
  }, []);

  const handleLogin = (apiKey: string) => {
    if (apiKey) {
      localStorage.setItem('nautilus_api_key', apiKey);
    }
    localStorage.setItem('nautilus_auth', 'true');
    setAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('nautilus_auth');
    localStorage.removeItem('nautilus_api_key');
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
