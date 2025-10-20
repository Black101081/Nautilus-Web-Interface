import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { loadApiConfig } from "./config";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { NotificationContainer } from "./components/NotificationContainer";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
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

function Router() {
  // Load API config from database on mount
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
      <Route path="/docs" component={DocsPage} />
      <Route path="/admin/strategies" component={StrategiesPage} />
      <Route path="/admin/orders" component={OrdersPage} />
      <Route path="/admin/positions" component={PositionsPage} />
      <Route path="/admin/risk" component={RiskPage} />
      <Route path="/admin/api-config" component={ApiConfigPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <NotificationProvider>
          <TooltipProvider>
            <Toaster />
            <NotificationContainer />
            <Router />
          </TooltipProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

