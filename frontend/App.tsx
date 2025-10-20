import "@/index.css";
import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider, useNotification } from "./contexts/NotificationContext";
import { NotificationContainer } from "./components/NotificationContainer";
import { initTestHelper } from "./utils/testHelper";

// Landing Pages
import Home from "./pages/landing/Home";
import Landing from "./pages/landing/Landing";
import Demo from "./pages/landing/Demo";

// Dashboards
import Dashboard from "./pages/dashboards/Dashboard";
import TraderDashboard from "./pages/dashboards/TraderDashboard";
import NautilusDemo from "./pages/dashboards/NautilusDemo";

// Trading Pages
import LiveTrading from "./pages/trading/LiveTrading";
import LiveTradingNew from "./pages/trading/LiveTradingNew";
import AdvancedBacktest from "./pages/trading/AdvancedBacktest";
import Portfolio from "./pages/trading/Portfolio";
import MarketWatch from "./pages/trading/MarketWatch";
import Positions from "./pages/trading/Positions";
import Orders from "./pages/trading/Orders";
import TradeHistory from "./pages/trading/TradeHistory";
import WalkForward from "./pages/trading/WalkForward";
import Optimization from "./pages/trading/Optimization";
import Performance from "./pages/trading/Performance";
import RiskAnalysis from "./pages/trading/RiskAnalysis";

// Strategy Tools
import StrategyBuilder from "./pages/strategies/StrategyBuilder";
import StrategyLibrary from "./pages/strategies/StrategyLibrary";
import DeployStrategy from "./pages/strategies/DeployStrategy";
import TradeJournal from "./pages/strategies/TradeJournal";

// Documentation Pages
import Docs from "./pages/docs/Docs";
import DocsGettingStarted from "./pages/docs/DocsGettingStarted";
import DocsArchitecture from "./pages/docs/DocsArchitecture";
import DocsDatabase from "./pages/docs/DocsDatabase";
import DocsAPI from "./pages/docs/DocsAPI";
import DocsUserGuide from "./pages/docs/DocsUserGuide";
import DocsTroubleshooting from "./pages/docs/DocsTroubleshooting";

// Admin Pages (New)
import AdminDashboard from "./pages/admin/AdminDashboard";
import ComponentsPage from "./pages/admin/ComponentsPage";
import FeaturesPage from "./pages/admin/FeaturesPage";
import AdaptersPage from "./pages/admin/AdaptersPage";
import MonitoringPage from "./pages/admin/MonitoringPage";
import SettingsPage from "./pages/admin/SettingsPage";
import DatabasePage from "./pages/admin/DatabasePage";
import ComponentShowcase from "./pages/admin/ComponentShowcase";
import ToastTest from "./pages/admin/ToastTest";
import NotificationTest from "./pages/admin/NotificationTest";
import DirectEventTest from "./pages/admin/DirectEventTest";

// Other Pages
import Reports from "./pages/Reports";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      {/* Landing Pages */}
      <Route path={"/"} component={Landing} />
      <Route path={"/home"} component={Home} />
      <Route path={"/demo"} component={Demo} />
      
      {/* Dashboards */}
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/trader"} component={TraderDashboard} />
      <Route path={"/nautilus-demo"} component={NautilusDemo} />
      
      {/* Strategy Tools */}
      <Route path={"/strategies"} component={StrategyBuilder} />
      <Route path={"/library"} component={StrategyLibrary} />
      <Route path={"/deploy"} component={DeployStrategy} />
      <Route path={"/journal"} component={TradeJournal} />
      
      {/* Documentation */}
      <Route path={"/docs"} component={Docs} />
      <Route path={"/admin/docs/getting-started"} component={DocsGettingStarted} />
      <Route path={"/admin/docs/architecture"} component={DocsArchitecture} />
      <Route path={"/admin/docs/database"} component={DocsDatabase} />
      <Route path={"/admin/docs/api"} component={DocsAPI} />
      <Route path={"/admin/docs/user-guide"} component={DocsUserGuide} />
      <Route path={"/admin/docs/troubleshooting"} component={DocsTroubleshooting} />
      
      {/* Admin Pages - Specific routes MUST come before generic /admin route */}
      <Route path="/admin/components-page" component={ComponentsPage} />
      <Route path="/admin/features" component={FeaturesPage} />
      <Route path="/admin/adapters" component={AdaptersPage} />
      <Route path="/admin/monitoring" component={MonitoringPage} />
      <Route path="/admin/settings-page" component={SettingsPage} />
      <Route path="/admin/database" component={DatabasePage} />
      <Route path="/admin/components" component={ComponentShowcase} />
      <Route path="/admin/toast-test" component={ToastTest} />
      <Route path="/admin/notification-test" component={NotificationTest} />
      <Route path="/admin/direct-event-test" component={DirectEventTest} />
      <Route path="/admin" component={AdminDashboard} />
      
      {/* Trading Pages */}
      <Route path={"/live"} component={LiveTradingNew} />
      <Route path={"/live-old"} component={LiveTrading} />
      <Route path={"/advanced-backtest"} component={AdvancedBacktest} />
      <Route path={"/portfolio"} component={Portfolio} />
      <Route path={"/market"} component={MarketWatch} />
      <Route path={"/positions"} component={Positions} />
      <Route path={"/orders"} component={Orders} />
      <Route path={"/trades"} component={TradeHistory} />
      <Route path={"/walk-forward"} component={WalkForward} />
      <Route path={"/optimization"} component={Optimization} />
      <Route path={"/performance"} component={Performance} />
      <Route path={"/risk"} component={RiskAnalysis} />
      
      {/* Other Pages */}
      <Route path={"/reports"} component={Reports} />
      
      {/* 404 Not Found */}
      <Route component={NotFound} />
    </Switch>
  );
}

function TestHelperInit() {
  try {
    const notifications = useNotification();
    
    React.useEffect(() => {
      try {
        initTestHelper(notifications);
      } catch (error) {
        console.warn('[TestHelperInit] Failed to initialize test helper:', error);
      }
    }, [notifications]);
    
    return null;
  } catch (error) {
    // Fail silently - test helper is optional
    console.warn('[TestHelperInit] Component error:', error);
    return null;
  }
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <TestHelperInit />
            <Router />
            <NotificationContainer />
          </ErrorBoundary>
        </TooltipProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;

