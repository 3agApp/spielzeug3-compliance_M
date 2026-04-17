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
import Approvals from "./pages/Approvals";
import SupplierDetail from "./pages/SupplierDetail";
import Notifications from "./pages/Notifications";
import SyncPage from "./pages/SyncPage";
import ExpiryTracker from "./pages/ExpiryTracker";
import InvitationsManager from "./pages/InvitationsManager";
import TemplatesManager from "./pages/TemplatesManager";
import AcceptInvite from "./pages/AcceptInvite";
import PublicProductPage from "./pages/PublicProductPage";
import AboutSealPage from "./pages/AboutSealPage";
import SealInfoPage from "./pages/SealInfoPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import ManufacturerPortal from "./pages/ManufacturerPortal";
import IncidentList from "./pages/IncidentList";
import IncidentDetail from "./pages/IncidentDetail";

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
      <Route path="/suppliers/:id">
        {() => <ProtectedRoute component={SupplierDetail} />}
      </Route>
      <Route path="/sync">
        {() => <ProtectedRoute component={SyncPage} />}
      </Route>
      <Route path="/approvals">
        {() => <ProtectedRoute component={Approvals} />}
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

      {/* Feature routes */}
      <Route path="/expiry">
        {() => <ProtectedRoute component={ExpiryTracker} />}
      </Route>
      <Route path="/admin/invitations">
        {() => <ProtectedRoute component={InvitationsManager} />}
      </Route>
      <Route path="/admin/templates">
        {() => <ProtectedRoute component={TemplatesManager} />}
      </Route>
      {/* Incidents & Recalls */}
      <Route path="/incidents">
        {() => <ProtectedRoute component={IncidentList} />}
      </Route>
      <Route path="/incidents/:id">
        {() => <ProtectedRoute component={IncidentDetail} />}
      </Route>
      {/* Super-Admin */}
      <Route path="/super-admin">
        {() => <ProtectedRoute component={SuperAdminDashboard} />}
      </Route>

      {/* Public invite accept page */}
      <Route path="/invite/accept" component={AcceptInvite} />
      {/* Public manufacturer portal for DoC signing (no auth) */}
      <Route path="/declaration/portal/:token" component={ManufacturerPortal} />
      {/* Public product seal page (no auth) */}
      <Route path="/p/:uuid" component={PublicProductPage} />
      {/* About the Swiss Product Seal (no auth) */}
      <Route path="/about-seal" component={AboutSealPage} />
      <Route path="/seal-info" component={SealInfoPage} />

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
