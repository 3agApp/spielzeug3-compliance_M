import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./lib/i18n";
import ComplianceLayout from "./components/ComplianceLayout";

// Pages
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import ReviewQueue from "./pages/ReviewQueue";
import Suppliers from "./pages/Suppliers";
import AdminUsers from "./pages/AdminUsers";
import AdminRequirements from "./pages/AdminRequirements";
import AuditLog from "./pages/AuditLog";
import AdminSettings from "./pages/AdminSettings";
import Notifications from "./pages/Notifications";
import SyncPage from "./pages/SyncPage";

// Wrapper that applies the ComplianceLayout to protected routes
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <ComplianceLayout>
      <Component />
    </ComplianceLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />

      {/* Protected – wrapped in ComplianceLayout */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/products">
        {() => <ProtectedRoute component={Products} />}
      </Route>
      <Route path="/products/:id">
        {() => <ProtectedRoute component={ProductDetail} />}
      </Route>
      <Route path="/review-queue">
        {() => <ProtectedRoute component={ReviewQueue} />}
      </Route>
      <Route path="/suppliers">
        {() => <ProtectedRoute component={Suppliers} />}
      </Route>
      <Route path="/sync">
        {() => <ProtectedRoute component={SyncPage} />}
      </Route>
      <Route path="/notifications">
        {() => <ProtectedRoute component={Notifications} />}
      </Route>
      <Route path="/admin/users">
        {() => <ProtectedRoute component={AdminUsers} />}
      </Route>
      <Route path="/admin/requirements">
        {() => <ProtectedRoute component={AdminRequirements} />}
      </Route>
      <Route path="/admin/audit">
        {() => <ProtectedRoute component={AuditLog} />}
      </Route>
      <Route path="/admin/settings">
        {() => <ProtectedRoute component={AdminSettings} />}
      </Route>

      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
