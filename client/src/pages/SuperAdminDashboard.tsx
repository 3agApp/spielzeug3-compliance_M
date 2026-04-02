import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLang} from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
import ComplianceLayout from "@/components/ComplianceLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Building2,
  Package,
  Users,
  Truck,
  Plus,
  Pencil,
  Globe,
  CheckCircle2,
  XCircle,
  Crown,
  Euro,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Plan = "starter" | "professional" | "enterprise";
type TenantRow = {
  id: number;
  slug: string;
  name: string;
  plan: string;
  modulesEnabled: unknown;
  isActive: boolean;
  primaryColor: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  monthlyFee?: number | null;
  revenueSharePct?: number | null;
  createdAt?: Date | null;
  productCount: number;
  supplierCount: number;
  userCount: number;
  verifiedCount?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PLAN_COLORS: Record<Plan, string> = {
  starter: "bg-slate-100 text-slate-700 border-slate-200",
  professional: "bg-blue-50 text-blue-700 border-blue-200",
  enterprise: "bg-amber-50 text-amber-700 border-amber-200",
};

function useModuleOptions() {
  const { lang, t } = useLang();
  return [
    { id: "compliance", label: "Compliance" },
    { id: "seal", label: t.inline.siegel_qr },
    { id: "ai_analysis", label: t.inline.kianalyse },
    { id: "bunnydoc", label: t.inline.digitale_signaturen },
    { id: "api_access", label: t.inline.apizugang },
  ];
}

function PlanBadge({ plan }: { plan: string }) {
  const cls = PLAN_COLORS[plan as Plan] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {plan === "enterprise" && <Crown className="h-3 w-3" />}
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}

function ModuleChips({ modules }: { modules: unknown }) {
  const list = Array.isArray(modules) ? (modules as string[]) : [];
  const moduleOptions = useModuleOptions();
  if (list.length === 0) return <span className="text-muted-foreground text-xs">–</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((m) => (
        <span key={m} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
          {moduleOptions.find((o: {id:string;label:string}) => o.id === m)?.label ?? m}
        </span>
      ))}
    </div>
  );
}

// ─── Create Tenant Dialog ─────────────────────────────────────────────────────
function CreateTenantDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { lang, t } = useLang();
  const moduleOptions = useModuleOptions();
  const utils = trpc.useUtils();
  const createMutation = trpc.tenant.create.useMutation({
    onSuccess: () => {
      utils.tenant.list.invalidate();
      toast.success(
        t.inline.mandant_angelegt,
        { description: t.inline.der_neue_mandant_wurde_erfolgreich_erstellt }
      );
      onCreated();
    },
    onError: (err) => {
      toast.error(translateError(err.message, lang));
    },
  });

  const [form, setForm] = useState({
    slug: "",
    name: "",
    plan: "starter" as Plan,
    contactEmail: "",
    primaryColor: "#C8102E",
    modulesEnabled: ["compliance"] as string[],
    monthlyFee: "",
    revenueSharePct: "",
  });

  const toggleModule = (id: string) => {
    setForm((f) => ({
      ...f,
      modulesEnabled: f.modulesEnabled.includes(id)
        ? f.modulesEnabled.filter((m) => m !== id)
        : [...f.modulesEnabled, id],
    }));
  };

  const handleSubmit = () => {
    if (!form.slug || !form.name) {
      toast.error("Pflichtfelder fehlen: Slug und Name sind erforderlich.");
      return;
    }
    createMutation.mutate({
      slug: form.slug,
      name: form.name,
      plan: form.plan,
      contactEmail: form.contactEmail || undefined,
      primaryColor: form.primaryColor,
      modulesEnabled: form.modulesEnabled,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Neuen Mandanten anlegen
          </DialogTitle>
          <DialogDescription>
            Erstellen Sie ein neues Mandanten-Konto auf der Swiss Product Seal Platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Slug + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug <span className="text-destructive">*</span></Label>
              <Input
                id="slug"
                placeholder="z.b. musterfirma-ag"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
              />
              <p className="text-[11px] text-muted-foreground">Nur Kleinbuchstaben, Zahlen und Bindestriche</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Firmenname <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                placeholder="Musterfirma AG"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
          </div>

          {/* Plan + Kontakt */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={form.plan} onValueChange={(v) => setForm((f) => ({ ...f, plan: v as Plan }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail">Kontakt-E-Mail</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="info@firma.ch"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              />
            </div>
          </div>

          {/* Primärfarbe */}
          <div className="space-y-1.5">
            <Label>Primärfarbe (Siegel-Farbe)</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                className="h-9 w-14 rounded border border-input cursor-pointer"
              />
              <Input
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                className="font-mono w-32"
                maxLength={7}
              />
              <div className="h-9 w-9 rounded-md border" style={{ backgroundColor: form.primaryColor }} />
            </div>
          </div>

          {/* Tarif */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Euro className="h-3.5 w-3.5" />
              Tarif
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="monthlyFee" className="text-xs text-muted-foreground">Monatliche Grundgebühr (CHF)</Label>
                <Input
                  id="monthlyFee"
                  type="number"
                  min="0"
                  step="10"
                  placeholder="0"
                  value={form.monthlyFee}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyFee: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="revenueShare" className="text-xs text-muted-foreground">Umsatzprovision (%)</Label>
                <Input
                  id="revenueShare"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="0"
                  value={form.revenueSharePct}
                  onChange={(e) => setForm((f) => ({ ...f, revenueSharePct: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Tarif-Informationen werden gespeichert, aber nicht an den Mandanten weitergegeben.</p>
          </div>

          {/* Module */}
          <div className="space-y-2">
            <Label>{t.inline.freigeschaltete_module}</Label>
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border bg-muted/30">
              {moduleOptions.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`mod-${opt.id}`}
                    checked={form.modulesEnabled.includes(opt.id)}
                    onCheckedChange={() => toggleModule(opt.id)}
                    disabled={opt.id === "compliance"} // compliance always required
                  />
                  <Label htmlFor={`mod-${opt.id}`} className="text-sm font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Das Compliance-Modul ist immer aktiviert und kann nicht deaktiviert werden.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Wird angelegt…" : "Mandant anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Tenant Dialog ───────────────────────────────────────────────────────
function EditTenantDialog({
  tenant,
  onClose,
}: {
  tenant: TenantRow;
  onClose: () => void;
}) {
  const { lang, t } = useLang();
  const moduleOptions = useModuleOptions();
  const utils = trpc.useUtils();
  const updateMutation = trpc.tenant.update.useMutation({
    onSuccess: () => {
      utils.tenant.list.invalidate();
      toast.success(
        t.inline.gespeichert,
        { description: t.inline.mandant_wurde_aktualisiert }
      );
      onClose();
    },
    onError: (err) => {
      toast.error(translateError(err.message, lang));
    },
  });

  const initialModules = Array.isArray(tenant.modulesEnabled) ? (tenant.modulesEnabled as string[]) : [];
  const [form, setForm] = useState({
    name: tenant.name,
    plan: tenant.plan as Plan,
    contactEmail: tenant.contactEmail ?? "",
    primaryColor: tenant.primaryColor ?? "#C8102E",
    modulesEnabled: initialModules,
    isActive: tenant.isActive,
  });

  const toggleModule = (id: string) => {
    setForm((f) => ({
      ...f,
      modulesEnabled: f.modulesEnabled.includes(id)
        ? f.modulesEnabled.filter((m) => m !== id)
        : [...f.modulesEnabled, id],
    }));
  };

  const handleSubmit = () => {
    updateMutation.mutate({
      id: tenant.id,
      name: form.name,
      plan: form.plan,
      contactEmail: form.contactEmail || null,
      primaryColor: form.primaryColor,
      modulesEnabled: form.modulesEnabled,
      isActive: form.isActive,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Mandant bearbeiten: {tenant.name}
          </DialogTitle>
          <DialogDescription>
            Slug: <code className="text-xs bg-muted px-1 rounded">{tenant.slug}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Firmenname</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Kontakt-E-Mail</Label>
              <Input
                id="edit-email"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={form.plan} onValueChange={(v) => setForm((f) => ({ ...f, plan: v as Plan }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Primärfarbe</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  className="h-9 w-12 rounded border border-input cursor-pointer"
                />
                <Input
                  value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  className="font-mono"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {/* Module */}
          <div className="space-y-2">
            <Label>{t.inline.freigeschaltete_module}</Label>
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border bg-muted/30">
              {moduleOptions.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`edit-mod-${opt.id}`}
                    checked={form.modulesEnabled.includes(opt.id)}
                    onCheckedChange={() => toggleModule(opt.id)}
                    disabled={opt.id === "compliance"}
                  />
                  <Label htmlFor={`edit-mod-${opt.id}`} className="text-sm font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Aktiv/Inaktiv */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="text-sm font-medium">Mandant aktiv</p>
              <p className="text-xs text-muted-foreground">Inaktive Mandanten können sich nicht einloggen.</p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Wird gespeichert…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────
function SummaryCards({ tenants }: { tenants: TenantRow[] }) {
  const total = tenants.length;
  const active = tenants.filter((t) => t.isActive).length;
  const totalProducts = tenants.reduce((s, t) => s + (t.productCount ?? 0), 0);
  const totalUsers = tenants.reduce((s, t) => s + (t.userCount ?? 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Mandanten gesamt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{total}</p>
          <p className="text-xs text-muted-foreground mt-1">{active} aktiv</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Package className="h-4 w-4" /> Produkte gesamt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{totalProducts}</p>
          <p className="text-xs text-muted-foreground mt-1">Plattformweit</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" /> Nutzer gesamt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{totalUsers}</p>
          <p className="text-xs text-muted-foreground mt-1">Alle Mandanten</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Crown className="h-4 w-4" /> Enterprise-Kunden
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{tenants.filter((t) => t.plan === "enterprise").length}</p>
          <p className="text-xs text-muted-foreground mt-1">von {total} Mandanten</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantRow | null>(null);

  const { data: tenants, isLoading, error } = trpc.tenant.list.useQuery(undefined, {
    retry: false,
  });

  // Guard: only super_admin
  const role = (user as any)?.complianceRole;
  if (role !== "super_admin") {
    return (
      <ComplianceLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <XCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">Zugriff verweigert</h2>
          <p className="text-muted-foreground text-sm">Diese Seite ist nur für Super-Administratoren zugänglich.</p>
        </div>
      </ComplianceLayout>
    );
  }

  return (
    <ComplianceLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Crown className="h-6 w-6 text-amber-500" />
              Super-Admin-Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Plattformweite Mandantenverwaltung der Swiss Product Seal Platform
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Neuer Mandant
          </Button>
        </div>

        {/* Summary Cards */}
        {tenants && <SummaryCards tenants={tenants as unknown as TenantRow[]} />}

        {/* Tenant Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mandanten-Übersicht</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Wird geladen…</div>
            ) : error ? (
              <div className="p-8 text-center text-destructive text-sm">{error.message}</div>
            ) : !tenants || tenants.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Noch keine Mandanten angelegt.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mandant</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead className="text-center">
                      <Package className="h-3.5 w-3.5 inline" /> Produkte
                    </TableHead>
                    <TableHead className="text-center">
                      <Truck className="h-3.5 w-3.5 inline" /> Lieferanten
                    </TableHead>
                    <TableHead className="text-center">
                      <Users className="h-3.5 w-3.5 inline" /> Nutzer
                    </TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(tenants as unknown as TenantRow[]).map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: t.primaryColor ?? "#C8102E" }}
                          >
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{t.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {t.slug}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PlanBadge plan={t.plan} />
                      </TableCell>
                      <TableCell>
                        <ModuleChips modules={t.modulesEnabled} />
                      </TableCell>
                      <TableCell className="text-center font-medium">{t.productCount ?? 0}</TableCell>
                      <TableCell className="text-center font-medium">{t.supplierCount ?? 0}</TableCell>
                      <TableCell className="text-center font-medium">{t.userCount ?? 0}</TableCell>
                      <TableCell className="text-center">
                        {t.isActive ? (
                          <Badge variant="outline" className="gap-1 text-green-700 border-green-200 bg-green-50">
                            <CheckCircle2 className="h-3 w-3" /> Aktiv
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-slate-500 border-slate-200 bg-slate-50">
                            <XCircle className="h-3 w-3" /> Inaktiv
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setEditTenant(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Bearbeiten
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Billing Note */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-4 flex items-start gap-3">
            <Euro className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Datenschutz-Hinweis zur Abrechnung</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Aus Datenschutzgründen werden im Super-Admin-Bereich ausschliesslich aggregierte Metriken (Produkte, Lieferanten, Nutzer) angezeigt.
                Detaillierte Buchungsdaten der Mandanten sind nicht einsehbar. Tarife (Grundgebühr und Provision) werden intern gespeichert
                und nicht an Mandanten kommuniziert.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      {createOpen && (
        <CreateTenantDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={() => setCreateOpen(false)}
        />
      )}
      {editTenant && (
        <EditTenantDialog
          tenant={editTenant}
          onClose={() => setEditTenant(null)}
        />
      )}
    </ComplianceLayout>
  );
}
