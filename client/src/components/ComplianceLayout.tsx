import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Globe,
  Layers,
  LayoutDashboard,
  LogOut,
  Package,
  PanelLeft,
  Settings,
  Shield,
  UserPlus,
  Users,
  Activity,
  RefreshCw,
  Crown,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const SIDEBAR_WIDTH_KEY = "compliance-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 380;

type ComplianceRole = "supplier" | "internal_employee" | "compliance_manager" | "administrator" | "super_admin";

function getMenuItems(role: ComplianceRole, t: any) {
  const supplier = [
    { icon: LayoutDashboard, label: t.nav.dashboard, path: "/dashboard" },
    { icon: Package, label: t.nav.products, path: "/products" },
    { icon: Bell, label: t.nav.notifications, path: "/notifications" },
  ];

  const internal = [
    { icon: LayoutDashboard, label: t.nav.dashboard, path: "/dashboard" },
    { icon: Package, label: t.nav.products, path: "/products" },
    { icon: ClipboardList, label: t.nav.reviewQueue, path: "/review-queue" },
    { icon: Building2, label: t.nav.suppliers, path: "/suppliers" },
    { icon: CalendarClock, label: t.nav.expiryTracker, path: "/expiry" },
    { icon: Bell, label: t.nav.notifications, path: "/notifications" },
  ];

  const compliance = [
    { icon: LayoutDashboard, label: t.nav.dashboard, path: "/dashboard" },
    { icon: Package, label: t.nav.products, path: "/products" },
    { icon: ClipboardList, label: t.nav.reviewQueue, path: "/review-queue" },
    { icon: Building2, label: t.nav.suppliers, path: "/suppliers" },
    { icon: CheckCircle2, label: t.nav.approvals, path: "/approvals" },
    { icon: CalendarClock, label: t.nav.expiryTracker, path: "/expiry" },
    { icon: Layers, label: t.nav.templates, path: "/admin/templates" },
    { icon: RefreshCw, label: t.nav.syncLogs, path: "/sync" },
    { icon: Bell, label: t.nav.notifications, path: "/notifications" },
  ];

  const admin = [
    { icon: LayoutDashboard, label: t.nav.dashboard, path: "/dashboard" },
    { icon: Package, label: t.nav.products, path: "/products" },
    { icon: ClipboardList, label: t.nav.reviewQueue, path: "/review-queue" },
    { icon: Building2, label: t.nav.suppliers, path: "/suppliers" },
    { icon: CalendarClock, label: t.nav.expiryTracker, path: "/expiry" },
    { icon: Users, label: t.nav.users, path: "/admin/users" },
    { icon: UserPlus, label: t.nav.invitations, path: "/admin/invitations" },
    { icon: Layers, label: t.nav.templates, path: "/admin/templates" },
    { icon: FileText, label: t.nav.requirements, path: "/admin/requirements" },
    { icon: RefreshCw, label: t.nav.syncLogs, path: "/sync" },
    { icon: Activity, label: t.nav.auditLog, path: "/admin/audit" },
    { icon: Settings, label: t.nav.settings, path: "/admin/settings" },
    { icon: Bell, label: t.nav.notifications, path: "/notifications" },
  ];

  const superAdmin = [
    { icon: Crown, label: t.nav.superAdmin, path: "/super-admin" },
    { icon: LayoutDashboard, label: t.nav.dashboard, path: "/dashboard" },
    { icon: Package, label: t.nav.products, path: "/products" },
    { icon: Building2, label: t.nav.suppliers, path: "/suppliers" },
    { icon: Settings, label: t.nav.settings, path: "/admin/settings" },
  ];

  switch (role) {
    case "supplier": return supplier;
    case "internal_employee": return internal;
    case "compliance_manager": return compliance;
    case "administrator": return admin;
    case "super_admin": return superAdmin;
    default: return internal;
  }
}

export default function ComplianceLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const { t } = useLang();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mb-2">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              {t.auth.loginTitle}
            </h1>
            <p className="text-sm text-muted-foreground text-center">
              {t.auth.loginSubtitle}
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full"
          >
            {t.auth.loginButton}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <ComplianceLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </ComplianceLayoutContent>
    </SidebarProvider>
  );
}

function ComplianceLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { lang, setLang, t } = useLang();

  const role = (user as any)?.complianceRole as ComplianceRole ?? "internal_employee";
  const menuItems = getMenuItems(role, t);

  const notificationsQuery = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const unreadCount = notificationsQuery.data?.filter((n) => !n.isRead).length ?? 0;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const roleLabel = (t.role as any)[role] ?? role;

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-2">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center shrink-0">
                    <Shield className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-sidebar-foreground truncate leading-none">
                      spielzeug3 AG
                    </p>
                    <p className="text-xs text-sidebar-foreground/50 truncate mt-0.5">
                      Compliance Portal
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Navigation */}
          <SidebarContent className="gap-0 pt-2">
            <SidebarMenu className="px-2">
              {menuItems.map((item) => {
                const isActive = location === item.path || location.startsWith(item.path + "/");
                const isNotifications = item.path === "/notifications";
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 transition-all"
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                      <span className="flex-1">{item.label}</span>
                      {isNotifications && unreadCount > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 text-xs px-1 ml-auto">
                          {unreadCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t border-sidebar-border">
            {/* Language switcher */}
            {!isCollapsed && (
              <div className="flex items-center gap-1 mb-2 px-1">
                <Globe className="h-3.5 w-3.5 text-sidebar-foreground/40" />
                <button
                  onClick={() => setLang("de")}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                    lang === "de"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
                  }`}
                >
                  DE
                </button>
                <button
                  onClick={() => setLang("en")}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                    lang === "en"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
                  }`}
                >
                  EN
                </button>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-sidebar-accent/50 transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 shrink-0 border border-sidebar-border">
                    <AvatarFallback className="text-xs font-medium bg-primary/20 text-primary">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-sidebar-foreground truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      <p className="text-xs text-sidebar-foreground/50 truncate mt-1">
                        {roleLabel}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t.auth.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <main className="flex-1 min-h-screen bg-background">{children}</main>
      </SidebarInset>
    </>
  );
}
