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
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLang} from "@/lib/i18n";
import { translateError } from "@/lib/translateError";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  MessageSquare,
  Package,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Status badge helper ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const { lang } = useLang();
  const map: Record<string, { label: string; className: string }> = {
    submitted:           { label: lang === "de" ? "Eingereicht" : "Submitted",  className: "bg-blue-100 text-blue-800 border-blue-300" },
    under_review:        { label: lang === "de" ? "In Prüfung" : "Under Review",   className: "bg-purple-100 text-purple-800 border-purple-300" },
    clarification_needed:{ label: lang === "de" ? "Rückfrage" : "Clarification",    className: "bg-amber-100 text-amber-800 border-amber-300" },
    approved:            { label: lang === "de" ? "Genehmigt" : "Approved",    className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    rejected:            { label: lang === "de" ? "Abgelehnt" : "Rejected",    className: "bg-red-100 text-red-800 border-red-300" },
    completed:           { label: lang === "de" ? "Vollständig" : "Completed",  className: "bg-teal-100 text-teal-800 border-teal-300" },
    open:                { label: lang === "de" ? "Offen" : "Open",         className: "bg-slate-100 text-slate-700 border-slate-300" },
    in_progress:         { label: lang === "de" ? "In Bearbeitung" : "In Progress",className: "bg-orange-100 text-orange-800 border-orange-300" },
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
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{score}%</span>
    </div>
  );
}

// ─── Workflow action dialog ───────────────────────────────────────────────────
type ActionType = "approve" | "reject" | "clarification" | "complete" | null;

interface ActionDialogProps {
  action: ActionType;
  product: any;
  onClose: () => void;
  onSuccess: () => void;
}

function ActionDialog({ action, product, onClose, onSuccess }: ActionDialogProps) {
  const [note, setNote] = useState("");
  const { lang } = useLang();
  const utils = trpc.useUtils();

  const approveMutation   = trpc.products.approve.useMutation({ onSuccess: handleSuccess, onError: handleError });
  const rejectMutation    = trpc.products.reject.useMutation({ onSuccess: handleSuccess, onError: handleError });
  const clarifyMutation   = trpc.products.requestClarification.useMutation({ onSuccess: handleSuccess, onError: handleError });
  const completeMutation  = trpc.products.markComplete.useMutation({ onSuccess: handleSuccess, onError: handleError });

  function handleSuccess() {
    utils.products.list.invalidate();
    utils.products.getDashboardStats.invalidate();
    toast.success(
      action === "approve"       ? (lang === "de" ? "Produkt genehmigt" : "Product approved")
      : action === "reject"      ? (lang === "de" ? "Produkt abgelehnt" : "Product rejected")
      : action === "clarification" ? (lang === "de" ? "Rückfrage gestellt" : "Clarification requested")
      : (lang === "de" ? "Produkt als vollständig markiert" : "Product marked as complete")
    );
    onSuccess();
    onClose();
  }
  function handleError(e: any) { toast.error(translateError(e.message, lang)); }

  const isPending =
    approveMutation.isPending ||
    rejectMutation.isPending  ||
    clarifyMutation.isPending ||
    completeMutation.isPending;

  const needsNote = action === "reject" || action === "clarification";

  const cfg: Record<NonNullable<ActionType>, { title: string; desc: string; btnLabel: string; btnClass: string }> = {
    approve:       { title: lang === "de" ? "Produkt genehmigen" : "Approve Product",         desc: lang === "de" ? "Das Produkt wird als compliance-konform genehmigt. Der Lieferant wird benachrichtigt." : "The product will be approved as compliant. The supplier will be notified.",                btnLabel: lang === "de" ? "Genehmigen" : "Approve",       btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    reject:        { title: lang === "de" ? "Produkt ablehnen" : "Reject Product",           desc: lang === "de" ? "Das Produkt wird abgelehnt. Bitte geben Sie einen Ablehnungsgrund an, der an den Lieferanten übermittelt wird." : "The product will be rejected. Please provide a reason that will be sent to the supplier.", btnLabel: lang === "de" ? "Ablehnen" : "Reject",         btnClass: "bg-red-600 hover:bg-red-700 text-white" },
    clarification: { title: lang === "de" ? "Rückfrage stellen" : "Request Clarification",          desc: lang === "de" ? "Der Lieferant wird aufgefordert, fehlende oder unklare Informationen zu ergänzen." : "The supplier will be asked to provide missing or unclear information.",                    btnLabel: lang === "de" ? "Rückfrage senden" : "Send Request", btnClass: "bg-amber-600 hover:bg-amber-700 text-white" },
    complete:      { title: lang === "de" ? "Als vollständig markieren" : "Mark as Complete",  desc: lang === "de" ? "Das Produkt wird als vollständig und abgeschlossen markiert." : "The product will be marked as complete and closed.",                                         btnLabel: lang === "de" ? "Abschließen" : "Complete",      btnClass: "bg-teal-600 hover:bg-teal-700 text-white" },
  };

  if (!action) return null;
  const c = cfg[action];

  function handleSubmit() {
    if (needsNote && !note.trim()) { toast.error(lang === "de" ? "Bitte geben Sie eine Begründung ein." : "Please provide a reason."); return; }
    const pid = product.id;
    if (action === "approve")       approveMutation.mutate({ productId: pid, note: note || undefined });
    if (action === "reject")        rejectMutation.mutate({ productId: pid, note });
    if (action === "clarification") clarifyMutation.mutate({ productId: pid, note });
    if (action === "complete")      completeMutation.mutate({ productId: pid, note: note || undefined });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{c.title}</DialogTitle>
          <DialogDescription>{c.desc}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Product summary */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="text-sm font-medium">{product.productName}</p>
            <p className="text-xs text-muted-foreground">
              {product.internalArticleNumber && `${product.internalArticleNumber} · `}
              {lang === "de" ? "Vollständigkeit" : "Completeness"}: {Number(product.completenessScore ?? 0).toFixed(0)}%
            </p>
          </div>

          {/* Note field */}
          <div className="space-y-1.5">
            <Label htmlFor="action-note">
              {needsNote ? (lang === "de" ? "Begründung *" : "Reason *") : (lang === "de" ? "Anmerkung (optional)" : "Note (optional)")}
            </Label>
            <Textarea
              id="action-note"
              placeholder={
                action === "reject"        ? (lang === "de" ? "Bitte geben Sie den Ablehnungsgrund an…" : "Please provide the reason for rejection…")
                : action === "clarification" ? (lang === "de" ? "Welche Informationen werden benötigt?" : "What information is needed?")
                : (lang === "de" ? "Optionale Anmerkung…" : "Optional note…")
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {lang === "de" ? "Abbrechen" : "Cancel"}
          </Button>
          <Button className={c.btnClass} onClick={handleSubmit} disabled={isPending}>
            {isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            {c.btnLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product detail panel ─────────────────────────────────────────────────────
function ProductPanel({
  product,
  onAction,
}: {
  product: any;
  onAction: (a: ActionType) => void;
}) {
  const [, setLocation] = useLocation();
  const { lang } = useLang();
  const docsQuery     = trpc.documents.listByProduct.useQuery({ productId: product.id });
  const reqsQuery     = trpc.products.getMissingRequirements.useQuery({ productId: product.id });
  const timelineQuery = trpc.products.getTimeline.useQuery({ productId: product.id });

  const docs     = docsQuery.data     ?? [];
  const reqs     = reqsQuery.data     ?? [];
  const timeline = timelineQuery.data ?? { history: [], comments: [] };

  const score = Number(product.completenessScore ?? 0);
  const canApprove = ["submitted", "under_review"].includes(product.status);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-base leading-tight">{product.productName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {product.internalArticleNumber ?? "–"} · {product.brand ?? "–"}
            </p>
          </div>
          <StatusBadge status={product.status} />
        </div>

        <CompletenessBar score={score} />

        {/* Action buttons */}
        {canApprove && (
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              onClick={() => onAction("approve")}
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              {lang === "de" ? "Genehmigen" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-700 hover:bg-amber-50 text-xs"
              onClick={() => onAction("clarification")}
            >
              <MessageSquare className="mr-1 h-3.5 w-3.5" />
              {lang === "de" ? "Rückfrage" : "Clarify"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-400 text-red-700 hover:bg-red-50 text-xs"
              onClick={() => onAction("reject")}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" />
              {lang === "de" ? "Ablehnen" : "Reject"}
            </Button>
          </div>
        )}
        {product.status === "approved" && (
          <Button
            size="sm"
            className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs"
            onClick={() => onAction("complete")}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              {lang === "de" ? "Als vollständig abschließen" : "Mark as Complete"}
            </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="w-full text-xs text-muted-foreground"
          onClick={() => setLocation(`/products/${product.id}`)}
        >
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          {lang === "de" ? "Vollständige Produktdetails öffnen" : "Open full product details"}
        </Button>
      </div>

      {/* Tabs: Dokumente / Anforderungen / Timeline */}
      <Tabs defaultValue="docs" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-3 grid grid-cols-3 h-8">
          <TabsTrigger value="docs" className="text-xs">
            {lang === "de" ? "Dokumente" : "Documents"} ({docs.length})
          </TabsTrigger>
          <TabsTrigger value="reqs" className="text-xs">
            {lang === "de" ? "Anforderungen" : "Requirements"} ({reqs.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">
            Timeline
          </TabsTrigger>
        </TabsList>

        {/* ── Documents ── */}
        <TabsContent value="docs" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full px-4 py-3">
            {docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <FileText className="h-8 w-8 opacity-30" />
                <p className="text-xs">{lang === "de" ? "Keine Dokumente hochgeladen" : "No documents uploaded"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((doc: any) => (
                  <div key={doc.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium truncate">{doc.fileName}</span>
                      </div>
                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{doc.documentType}</Badge>
                      {doc.version && (
                        <span className="text-xs text-muted-foreground">v{doc.version}</span>
                      )}
                      {doc.expiryDate && (
                        <span className="text-xs text-muted-foreground">
                          {lang === "de" ? "Ablauf" : "Expires"}: {new Date(doc.expiryDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lang === "de" ? "Hochgeladen" : "Uploaded"}: {new Date(doc.uploadedAt ?? doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* ── Requirements ── */}
        <TabsContent value="reqs" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full px-4 py-3">
            {reqs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <CheckCircle2 className="h-8 w-8 opacity-30" />
                <p className="text-xs">{lang === "de" ? "Alle Anforderungen erfüllt" : "All requirements met"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reqs.map((req: any) => (
                  <div key={req.id} className="rounded-lg border p-3 flex items-start gap-2">
                    {req.isMissing ? (
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{req.requirementKey}</p>
                      {req.note && (
                        <p className="text-xs text-muted-foreground mt-0.5">{req.note}</p>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs mt-1 ${
                          req.status === "missing"
                            ? "border-red-300 text-red-700"
                            : req.status === "provided"
                            ? "border-blue-300 text-blue-700"
                            : req.status === "approved"
                            ? "border-emerald-300 text-emerald-700"
                            : "border-slate-300 text-slate-700"
                        }`}
                      >
                        {req.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* ── Timeline ── */}
        <TabsContent value="timeline" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full px-4 py-3">
            {(timeline.history?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Clock className="h-8 w-8 opacity-30" />
                <p className="text-xs">{lang === "de" ? "Noch keine Aktivitäten" : "No activities yet"}</p>
              </div>
            ) : (
              <div className="relative space-y-0">
                {timeline.history.map((entry: any, i: number) => (
                  <div key={entry.id} className="flex gap-3 pb-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                        entry.action === "approved"  ? "bg-emerald-500"
                        : entry.action === "rejected" ? "bg-red-500"
                        : entry.action === "clarification_requested" ? "bg-amber-500"
                        : entry.action === "submitted" ? "bg-blue-500"
                        : "bg-slate-400"
                      }`} />
                      {i < timeline.history.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>
                    <div className="pb-1 min-w-0">
                      <p className="text-xs font-medium">{entry.action}</p>
                      {entry.note && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.note}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Approvals() {
  const { t, lang } = useLang();
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [pendingAction, setPendingAction]     = useState<ActionType>(null);

  const productsQuery = trpc.products.list.useQuery({
    status: statusFilter === "pending" ? undefined : statusFilter === "all" ? undefined : statusFilter,
  });
  const allProducts = productsQuery.data ?? [];

  // Filter: "pending" = submitted + under_review + clarification_needed
  const PENDING_STATUSES = ["submitted", "under_review", "clarification_needed"];
  const filtered = allProducts.filter((p: any) => {
    const matchStatus =
      statusFilter === "all"     ? true
      : statusFilter === "pending" ? PENDING_STATUSES.includes(p.status)
      : p.status === statusFilter;
    const matchSearch = !search ||
      p.productName?.toLowerCase().includes(search.toLowerCase()) ||
      p.internalArticleNumber?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Stats
  const submitted   = allProducts.filter((p: any) => p.status === "submitted").length;
  const underReview = allProducts.filter((p: any) => p.status === "under_review").length;
  const clarNeeded  = allProducts.filter((p: any) => p.status === "clarification_needed").length;
  const approved    = allProducts.filter((p: any) => p.status === "approved").length;

  const FILTER_TABS = [
    { key: "pending",              label: lang === "de" ? "Ausstehend" : "Pending",    count: submitted + underReview + clarNeeded },
    { key: "submitted",            label: lang === "de" ? "Eingereicht" : "Submitted",   count: submitted },
    { key: "under_review",         label: lang === "de" ? "In Prüfung" : "Under Review",    count: underReview },
    { key: "clarification_needed", label: lang === "de" ? "Rückfrage" : "Clarification",     count: clarNeeded },
    { key: "approved",             label: lang === "de" ? "Genehmigt" : "Approved",     count: approved },
    { key: "all",                  label: lang === "de" ? "Alle" : "All",          count: allProducts.length },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 border-b space-y-4">
        <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6" />
            {lang === "de" ? "Genehmigungen" : "Approvals"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {lang === "de" ? "Compliance-Prüfung und Freigabe von Lieferanten-Produkten" : "Compliance review and approval of supplier products"}
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: lang === "de" ? "Eingereicht" : "Submitted",  value: submitted,   icon: Clock,         color: "text-blue-600" },
            { label: lang === "de" ? "In Prüfung" : "Under Review",   value: underReview, icon: RefreshCw,     color: "text-purple-600" },
            { label: lang === "de" ? "Rückfragen" : "Clarifications",   value: clarNeeded,  icon: AlertTriangle, color: "text-amber-600" },
            { label: lang === "de" ? "Genehmigt" : "Approved",    value: approved,    icon: CheckCircle2,  color: "text-emerald-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="py-3">
              <CardContent className="px-4 py-0 flex items-center gap-3">
                <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                <div>
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Main content: list + detail panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: filter + list */}
        <div className="w-full lg:w-[420px] xl:w-[480px] flex flex-col border-r shrink-0">
          {/* Search + filter */}
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={lang === "de" ? "Produkt suchen…" : "Search product…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setStatusFilter(tab.key); setSelectedProduct(null); }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                      statusFilter === tab.key ? "bg-white/20" : "bg-background"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Product list */}
          <ScrollArea className="flex-1">
            {productsQuery.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Package className="h-10 w-10 opacity-30" />
                <p className="text-sm">{lang === "de" ? "Keine Produkte gefunden" : "No products found"}</p>
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((product: any) => {
                  const score = Number(product.completenessScore ?? 0);
                  const isSelected = selectedProduct?.id === product.id;
                  return (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors ${
                        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{product.productName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {product.internalArticleNumber ?? "–"} · {product.brand ?? "–"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={product.status} />
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="mt-2">
                        <CompletenessBar score={score} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 min-w-0 hidden lg:flex flex-col">
          {selectedProduct ? (
            <ProductPanel
              product={selectedProduct}
              onAction={(action) => setPendingAction(action)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <CheckCircle2 className="h-14 w-14 opacity-20" />
              <p className="text-sm">{lang === "de" ? "Produkt aus der Liste auswählen" : "Select a product from the list"}</p>
              <p className="text-xs max-w-xs text-center">
                {lang === "de" ? "Klicken Sie auf ein Produkt, um Dokumente, Anforderungen und die Timeline zu prüfen." : "Click on a product to review documents, requirements and the timeline."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action dialog */}
      {pendingAction && selectedProduct && (
        <ActionDialog
          action={pendingAction}
          product={selectedProduct}
          onClose={() => setPendingAction(null)}
          onSuccess={() => {
            // Refresh selected product data
            productsQuery.refetch().then((res) => {
              const updated = res.data?.find((p: any) => p.id === selectedProduct.id);
              if (updated) setSelectedProduct(updated);
            });
          }}
        />
      )}
    </div>
  );
}
