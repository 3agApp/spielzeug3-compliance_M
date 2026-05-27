import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe,
  Mail,
  Package,
  Phone,
  RefreshCw,
  Search,
  Tag,
  Upload,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ProductImportDialog } from "@/components/ProductImportDialog";
import { SupplierWebsiteCheckTab } from "@/components/SupplierWebsiteCheckTab";
import { SupplierDocumentsTab } from "@/components/SupplierDocumentsTab";
import { ProductComplianceTab } from "@/components/ProductComplianceTab";

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const { lang: statusLang } = useLang();
  const map: Record<string, { label: string; className: string }> = {
    submitted:            { label: statusLang === "de" ? "Eingereicht" : "Submitted",   className: "bg-blue-100 text-blue-800 border-blue-300" },
    under_review:         { label: statusLang === "de" ? "In Prüfung" : "Under review",    className: "bg-purple-100 text-purple-800 border-purple-300" },
    clarification_needed: { label: statusLang === "de" ? "Rückfrage" : "Clarification needed",     className: "bg-amber-100 text-amber-800 border-amber-300" },
    approved:             { label: statusLang === "de" ? "Genehmigt" : "Approved",     className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    rejected:             { label: statusLang === "de" ? "Abgelehnt" : "Rejected",     className: "bg-red-100 text-red-800 border-red-300" },
    completed:            { label: statusLang === "de" ? "Vollständig" : "Completed",   className: "bg-teal-100 text-teal-800 border-teal-300" },
    open:                 { label: statusLang === "de" ? "Offen" : "Open",          className: "bg-slate-100 text-slate-700 border-slate-300" },
    in_progress:          { label: statusLang === "de" ? "In Bearbeitung" : "In progress", className: "bg-orange-100 text-orange-800 border-orange-300" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-slate-100 text-slate-700 border-slate-300" };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

// ─── Completeness bar ─────────────────────────────────────────────────────────
function CompletenessBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{score}%</span>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  color = "text-foreground",
  onClick,
  active,
}: {
  label: string;
  value: number;
  color?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all w-full ${
        active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-muted/40"
      }`}
    >
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const supplierId = Number(id);
  const [, setLocation] = useLocation();
  const { t, lang } = useLang();

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const utils = trpc.useUtils();

  const supplierQuery = trpc.suppliers.getById.useQuery({ id: supplierId });
  const productsQuery = trpc.products.list.useQuery({ supplierId });

  const supplier = supplierQuery.data;
  const allProducts = productsQuery.data ?? [];

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total      = allProducts.length;
    const open       = allProducts.filter((p: any) => ["open", "in_progress"].includes(p.status)).length;
    const submitted  = allProducts.filter((p: any) => ["submitted", "under_review"].includes(p.status)).length;
    const clarify    = allProducts.filter((p: any) => p.status === "clarification_needed").length;
    const approved   = allProducts.filter((p: any) => p.status === "approved").length;
    const rejected   = allProducts.filter((p: any) => p.status === "rejected").length;
    const completed  = allProducts.filter((p: any) => p.status === "completed").length;

    const scores = allProducts
      .map((p: any) => Number(p.completenessScore ?? 0))
      .filter((s: number) => s > 0);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;

    const brands = Array.from(new Set(allProducts.map((p: any) => p.brand).filter(Boolean))) as string[];

    return { total, open, submitted, clarify, approved, rejected, completed, avgScore, brands };
  }, [allProducts]);

  // ── Filtered product list ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allProducts.filter((p: any) => {
      const matchStatus = !statusFilter || (() => {
        if (statusFilter === "open")      return ["open", "in_progress"].includes(p.status);
        if (statusFilter === "submitted") return ["submitted", "under_review"].includes(p.status);
        return p.status === statusFilter;
      })();
      const matchSearch = !search ||
        p.productName?.toLowerCase().includes(search.toLowerCase()) ||
        p.internalArticleNumber?.toLowerCase().includes(search.toLowerCase()) ||
        p.brand?.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [allProducts, statusFilter, search]);

  if (supplierQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Building2 className="h-12 w-12 opacity-30" />
        <p>{t.inline.lieferant_nicht_gefunden}</p>
        <Button variant="outline" size="sm" onClick={() => setLocation("/suppliers")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.inline.zurueck_zur_uebersicht}
        </Button>
      </div>
    );
  }

  const scoreColor =
    stats.avgScore >= 80 ? "text-emerald-600"
    : stats.avgScore >= 50 ? "text-amber-600"
    : "text-red-600";

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* ── Back + header ── */}
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2"
          onClick={() => setLocation("/suppliers")}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t.inline.alle_lieferanten}
        </Button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{supplier.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs font-mono">
                  {supplier.supplierCode}
                </Badge>
                {supplier.country && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {supplier.country}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={supplier.active
                    ? "text-xs border-emerald-300 text-emerald-700 bg-emerald-50"
                    : "text-xs border-red-300 text-red-700 bg-red-50"}
                >
                  {supplier.active ? (t.inline.aktiv) : (t.inline.inaktiv)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Import button + Overall compliance score */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportDialog(true)}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {lang === "de" ? "Produkte importieren" : "Import Products"}
            </Button>
            <div className="rounded-xl border p-4 text-center min-w-[120px]">
            <p className={`text-3xl font-bold ${scoreColor}`}>{stats.avgScore}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.inline.compliancescore}</p>
            <div className="mt-2">
              <CompletenessBar score={stats.avgScore} />
            </div>
          </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t.inline.uebersicht}</TabsTrigger>
          <TabsTrigger value="products">{t.inline.produkte} ({stats.total})</TabsTrigger>
          <TabsTrigger value="contact">{t.inline.kontakt}</TabsTrigger>
          <TabsTrigger value="website-check">{t.inline.website_compliance_check}</TabsTrigger>
          <TabsTrigger value="documents">{(t as any).supplierDocs?.tab_title ?? "Documents"}</TabsTrigger>
          <TabsTrigger value="product-compliance">{(t as any).productCompliance?.tab_title ?? "Product Compliance"}</TabsTrigger>
        </TabsList>

        {/* ── Overview tab ── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Status distribution */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {t.inline.produktstatus}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard
                label={t.inline.offen}
                value={stats.open}
                color="text-slate-700"
                active={statusFilter === "open"}
                onClick={() => setStatusFilter(statusFilter === "open" ? null : "open")}
              />
              <StatCard
                label={t.inline.eingereicht}
                value={stats.submitted}
                color="text-blue-600"
                active={statusFilter === "submitted"}
                onClick={() => setStatusFilter(statusFilter === "submitted" ? null : "submitted")}
              />
              <StatCard
                label={t.inline.rueckfragen}
                value={stats.clarify}
                color="text-amber-600"
                active={statusFilter === "clarification_needed"}
                onClick={() => setStatusFilter(statusFilter === "clarification_needed" ? null : "clarification_needed")}
              />
              <StatCard
                label={t.inline.genehmigt}
                value={stats.approved}
                color="text-emerald-600"
                active={statusFilter === "approved"}
                onClick={() => setStatusFilter(statusFilter === "approved" ? null : "approved")}
              />
              <StatCard
                label={lang === "de" ? "Abgelehnt" : "Rejected"}
                value={stats.rejected}
                color="text-red-600"
                active={statusFilter === "rejected"}
                onClick={() => setStatusFilter(statusFilter === "rejected" ? null : "rejected")}
              />
              <StatCard
                label={t.inline.abgeschlossen}
                value={stats.completed}
                color="text-teal-600"
                active={statusFilter === "completed"}
                onClick={() => setStatusFilter(statusFilter === "completed" ? null : "completed")}
              />
            </div>
            {statusFilter && (
              <button
                onClick={() => setStatusFilter(null)}
                className="mt-2 text-xs text-primary hover:underline"
              >
                {t.inline.filter_aufheben}
              </button>
            )}
          </div>

          {/* Compliance score breakdown per brand */}
          {stats.brands.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  {t.inline.compliancescore_nach_marke}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.brands.map((brand) => {
                  const brandProducts = allProducts.filter((p: any) => p.brand === brand);
                  const scores = brandProducts
                    .map((p: any) => Number(p.completenessScore ?? 0));
                  const avg = scores.length > 0
                    ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
                    : 0;
                  return (
                    <div key={brand} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{brand}</span>
                        <span className="text-muted-foreground text-xs">
                          {brandProducts.length} {lang === "de" ? `Produkt${brandProducts.length !== 1 ? "e" : ""}` : `product${brandProducts.length !== 1 ? "s" : ""}`}
                        </span>
                      </div>
                      <CompletenessBar score={avg} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Recent products preview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                  {t.inline.zuletzt_aktualisierte_produkte}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t.inline.keine_produkte_vorhanden}
                </p>
              ) : (
                <div className="divide-y">
                  {allProducts.slice(0, 5).map((product: any) => (
                    <div
                      key={product.id}
                      className="py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                      onClick={() => setLocation(`/products/${product.id}`)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{product.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.internalArticleNumber ?? "–"}
                          {product.brand ? ` · ${product.brand}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-24 hidden sm:block">
                          <CompletenessBar score={Number(product.completenessScore ?? 0)} />
                        </div>
                        <StatusBadge status={product.status} />
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {allProducts.length > 5 && (
                <button
                  className="mt-2 text-xs text-primary hover:underline"
                  onClick={() => {
                    // switch to products tab programmatically via DOM
                    const tab = document.querySelector<HTMLButtonElement>('[data-value="products"]');
                    tab?.click();
                  }}
                >
                  {lang === "de" ? `Alle ${allProducts.length} Produkte anzeigen →` : `Show all ${allProducts.length} products →`}
                </button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Products tab ── */}
        <TabsContent value="products" className="mt-4 space-y-4">
          {/* Search + filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.inline.produkt_suchen}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            {statusFilter && (
                <Button variant="outline" size="sm" onClick={() => setStatusFilter(null)}>
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  {t.inline.filter_aufheben}
                </Button>
            )}
          </div>

          {/* Product table */}
          {productsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Package className="h-10 w-10 opacity-30" />
              <p className="text-sm">{t.inline.keine_produkte_gefunden}</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t.inline.produkt}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">{t.inline.artikelnr}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">{t.inline.marke}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">{t.inline.vollstaendigkeit}</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((product: any) => (
                    <tr
                      key={product.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/products/${product.id}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{product.productName}</p>
                        {product.ean && (
                          <p className="text-xs text-muted-foreground">EAN: {product.ean}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {product.internalArticleNumber ?? "–"}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {product.brand ? (
                          <Badge variant="outline" className="text-xs">{product.brand}</Badge>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={product.status} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell w-40">
                        <CompletenessBar score={Number(product.completenessScore ?? 0)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ExternalLink className="h-4 w-4 text-muted-foreground inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Contact tab ── */}
        <TabsContent value="contact" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {t.inline.unternehmensdaten}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{supplier.name}</span>

                  <span className="text-muted-foreground">{t.inline.lieferantencode}</span>
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded w-fit">
                    {supplier.supplierCode}
                  </span>

                  {supplier.address && (
                    <>
                      <span className="text-muted-foreground">{t.inline.adresse}</span>
                      <span>{supplier.address}</span>
                    </>
                  )}

                  {supplier.country && (
                    <>
                      <span className="text-muted-foreground">{t.inline.land}</span>
                      <span className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        {supplier.country}
                      </span>
                    </>
                  )}

                  {supplier.kontorId && (
                    <>
                      <span className="text-muted-foreground">Kontor-ID</span>
                      <span className="font-mono text-xs">{supplier.kontorId}</span>
                    </>
                  )}

                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant="outline"
                    className={supplier.active
                      ? "text-xs border-emerald-300 text-emerald-700 bg-emerald-50 w-fit"
                      : "text-xs border-red-300 text-red-700 bg-red-50 w-fit"}
                  >
                    {supplier.active ? (t.inline.aktiv) : (t.inline.inaktiv)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t.inline.kontaktinformationen}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {supplier.email ? (
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">E-Mail</p>
                      <a
                        href={`mailto:${supplier.email}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {supplier.email}
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t.inline.keine_email_hinterlegt}</p>
                )}

                {supplier.phone && (
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <Phone className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Telefon</p>
                      <a
                        href={`tel:${supplier.phone}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {supplier.phone}
                      </a>
                    </div>
                  </div>
                )}

                  {!supplier.email && !supplier.phone && (
                  <p className="text-sm text-muted-foreground py-2">
                    {t.inline.keine_kontaktdaten_hinterlegt}
                  </p>
                )}

                <Separator />

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    {t.inline.erstellt}{" "}
                    {supplier.createdAt
                      ? new Date(supplier.createdAt).toLocaleDateString(t.inline.dede)
                      : "–"}
                  </p>
                  {supplier.updatedAt && (
                    <p>
                      {t.inline.zuletzt_aktualisiert}{" "}
                      {new Date(supplier.updatedAt).toLocaleDateString(t.inline.dede)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Website Compliance Check tab ── */}
        <TabsContent value="website-check" className="mt-4">
          <SupplierWebsiteCheckTab
            supplierId={supplier.id}
            supplierWebsite={(supplier as any).website ?? null}
          />
        </TabsContent>

        {/* ── Supplier Documents tab ── */}
        <TabsContent value="documents" className="mt-4">
          <SupplierDocumentsTab supplierId={supplier.id} />
        </TabsContent>

        {/* ── Product Compliance tab ── */}
        <TabsContent value="product-compliance" className="mt-4">
          <ProductComplianceTab supplierId={supplier.id} />
        </TabsContent>
      </Tabs>

      <ProductImportDialog
        supplierId={supplier.id}
        supplierName={supplier.name}
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImported={() => utils.products.list.invalidate()}
      />
    </div>
  );
}
