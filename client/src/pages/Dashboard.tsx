import { useAuth } from "@/_core/hooks/useAuth";
import { StatusBadge, CompletenessBar } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useLocation } from "wouter";

function StatCard({
  title,
  value,
  icon: Icon,
  color = "text-foreground",
  onClick,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
          <div className={`p-2.5 rounded-lg bg-muted ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [, setLocation] = useLocation();
  const role = (user as any)?.complianceRole ?? "internal_employee";

  const statsQuery = trpc.products.getDashboardStats.useQuery();
  const stats = statsQuery.data as any ?? {};

  const productsQuery = trpc.products.list.useQuery({});
  const recentProducts = (productsQuery.data ?? []).slice(0, 5);

  if (role === "supplier") {
    return <SupplierDashboard stats={stats} recentProducts={recentProducts} t={t} lang={lang} setLocation={setLocation} />;
  }

  if (role === "compliance_manager") {
    return <ComplianceManagerDashboard stats={stats} recentProducts={recentProducts} t={t} lang={lang} setLocation={setLocation} />;
  }

  return <InternalDashboard stats={stats} recentProducts={recentProducts} t={t} lang={lang} setLocation={setLocation} />;
}

function SupplierDashboard({ stats, recentProducts, t, lang, setLocation }: any) {
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">{t.nav.dashboard}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.inline.uebersicht_ihrer_complianceaufgaben}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t.dashboard.openItems}
          value={stats.open ?? 0}
          icon={AlertCircle}
          color="text-amber-600"
          onClick={() => setLocation("/products?status=open")}
        />
        <StatCard
          title={t.dashboard.submittedItems}
          value={stats.submitted ?? 0}
          icon={Clock}
          color="text-blue-600"
          onClick={() => setLocation("/products?status=submitted")}
        />
        <StatCard
          title={t.dashboard.clarificationItems}
          value={stats.clarification ?? 0}
          icon={AlertCircle}
          color="text-orange-600"
          onClick={() => setLocation("/products?status=clarification_needed")}
        />
        <StatCard
          title={t.dashboard.completedItems}
          value={stats.completed ?? 0}
          icon={CheckCircle2}
          color="text-emerald-600"
          onClick={() => setLocation("/products?status=completed")}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t.dashboard.recentActivity}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/products")}>
            {t.common.all} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ProductTable products={recentProducts} t={t} setLocation={setLocation} />
        </CardContent>
      </Card>
    </div>
  );
}

function InternalDashboard({ stats, recentProducts, t, lang, setLocation }: any) {
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">{t.nav.dashboard}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.inline.interne_uebersicht_aller_complianceartikel}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t.dashboard.totalProducts}
          value={stats.totalProducts ?? 0}
          icon={Package}
          onClick={() => setLocation("/products")}
        />
        <StatCard
          title={t.dashboard.openItems}
          value={stats.openItems ?? 0}
          icon={AlertCircle}
          color="text-amber-600"
          onClick={() => setLocation("/products?status=open")}
        />
        <StatCard
          title={t.dashboard.awaitingReview}
          value={stats.awaitingReview ?? 0}
          icon={Clock}
          color="text-blue-600"
          onClick={() => setLocation("/review-queue")}
        />
        <StatCard
          title={t.dashboard.completedItems}
          value={stats.completed ?? 0}
          icon={CheckCircle2}
          color="text-emerald-600"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t.dashboard.clarificationItems}
          value={stats.clarificationNeeded ?? 0}
          icon={AlertCircle}
          color="text-orange-600"
        />
        <StatCard
          title={t.dashboard.rejectedItems}
          value={stats.rejected ?? 0}
          icon={XCircle}
          color="text-red-600"
        />
        <StatCard
          title={t.dashboard.totalSuppliers}
          value={stats.totalSuppliers ?? 0}
          icon={Users}
          onClick={() => setLocation("/suppliers")}
        />
        <StatCard
          title={t.dashboard.activeSuppliers}
          value={stats.activeSuppliers ?? 0}
          icon={TrendingUp}
          color="text-emerald-600"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t.dashboard.recentActivity}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/products")}>
            {t.common.all} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ProductTable products={recentProducts} t={t} setLocation={setLocation} />
        </CardContent>
      </Card>
    </div>
  );
}

function ComplianceManagerDashboard({ stats, recentProducts, t, lang, setLocation }: any) {
  const syncLogsQuery = trpc.sync.getLogs.useQuery({ limit: 3 });
  const syncLogs = syncLogsQuery.data ?? [];

  const completenessRate =
    stats.totalProducts > 0
      ? Math.round(((stats.completed + stats.approved) / stats.totalProducts) * 100)
      : 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">{t.nav.dashboard}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.inline.compliance_manager_uebersicht}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t.dashboard.approvalQueue}
          value={stats.awaitingReview ?? 0}
          icon={Clock}
          color="text-blue-600"
          onClick={() => setLocation("/review-queue")}
        />
        <StatCard
          title={t.dashboard.completedItems}
          value={stats.completed ?? 0}
          icon={CheckCircle2}
          color="text-emerald-600"
        />
        <StatCard
          title={t.dashboard.rejectedItems}
          value={stats.rejected ?? 0}
          icon={XCircle}
          color="text-red-600"
        />
        <StatCard
          title={t.dashboard.clarificationItems}
          value={stats.clarificationNeeded ?? 0}
          icon={AlertCircle}
          color="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Completeness Rate */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t.dashboard.completenessRate}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{completenessRate}%</span>
                <span className="text-sm text-muted-foreground">
                  {stats.completed ?? 0} / {stats.totalProducts ?? 0} {t.common.items}
                </span>
              </div>
              <CompletenessBar score={completenessRate} showLabel={false} />
            </div>
          </CardContent>
        </Card>

        {/* Sync Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              {t.dashboard.syncStatus}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/sync")}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {syncLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.inline.noch_kein_sync_durchgefuehrt}</p>
            ) : (
              <div className="space-y-2">
                {syncLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {log.direction === "import" ? t.sync.direction.import : t.sync.direction.export}
                      </span>
                    </div>
                    <Badge
                      variant={log.status === "success" ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t.dashboard.approvalQueue}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/review-queue")}>
            {t.common.all} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ProductTable products={recentProducts} t={t} setLocation={setLocation} />
        </CardContent>
      </Card>
    </div>
  );
}

function ProductTable({ products, t, setLocation }: any) {
  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        <Package className="h-5 w-5 mr-2" />
        {t.msg.noProducts}
      </div>
    );
  }

  return (
    <table className="w-full data-table">
      <thead>
        <tr>
          <th>{t.product.productName}</th>
          <th>{t.product.internalArticleNumber}</th>
          <th>{t.product.brand}</th>
          <th>{t.product.status}</th>
          <th>{t.product.completenessScore}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {products.map((p: any) => (
          <tr key={p.id} className="cursor-pointer" onClick={() => setLocation(`/products/${p.id}`)}>
            <td className="font-medium">{p.productName}</td>
            <td className="text-muted-foreground text-xs">{p.internalArticleNumber ?? "–"}</td>
            <td className="text-muted-foreground text-xs">{p.brand ?? "–"}</td>
            <td><StatusBadge status={p.status} /></td>
            <td>
              <CompletenessBar
                score={parseFloat(p.completenessScore ?? "0")}
                className="min-w-24"
              />
            </td>
            <td>
              <Button variant="ghost" size="sm">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
