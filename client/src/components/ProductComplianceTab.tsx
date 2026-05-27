import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MinusCircle,
  Loader2,
  Trash2,
  ChevronRight,
  FileText,
  Play,
  PlayCircle,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function riskBadge(level?: string | null) {
  switch (level) {
    case "critical": return <Badge className="bg-red-600 text-white">🔴 Critical</Badge>;
    case "high": return <Badge className="bg-orange-500 text-white">🟠 High</Badge>;
    case "medium": return <Badge className="bg-yellow-500 text-white">🟡 Medium</Badge>;
    case "low": return <Badge className="bg-green-600 text-white">🟢 Low</Badge>;
    default: return <Badge variant="outline">–</Badge>;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "fulfilled": return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    case "partially_fulfilled": return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
    case "not_fulfilled": return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case "not_applicable": return <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
    default: return <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function criticalityColor(c: string) {
  switch (c) {
    case "critical": return "border-l-red-600 bg-red-50 dark:bg-red-950/20";
    case "high": return "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20";
    case "medium": return "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20";
    case "low": return "border-l-green-500 bg-green-50 dark:bg-green-950/20";
    default: return "border-l-muted bg-muted/20";
  }
}

function scoreRing(score?: number | null, label?: string) {
  if (score == null) return null;
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="41" textAnchor="middle" fontSize="16" fontWeight="bold" fill={color}>{score}</text>
      </svg>
      {label && <span className="text-xs text-muted-foreground text-center">{label}</span>}
    </div>
  );
}

// ─── Check Detail Dialog ──────────────────────────────────────────────────────
function CheckDetailDialog({ checkId, productName, open, onClose }: {
  checkId: number;
  productName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLang();
  const pc = (t as any).productCompliance;

  const { data: items = [], isLoading } = trpc.productComplianceCheck.getItems.useQuery(
    { checkId },
    { enabled: open }
  );

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      fulfilled: pc?.fulfilled ?? "Fulfilled",
      partially_fulfilled: pc?.partially_fulfilled ?? "Partially Fulfilled",
      not_fulfilled: pc?.not_fulfilled ?? "Not Fulfilled",
      not_applicable: pc?.not_applicable ?? "Not Applicable",
      unclear: pc?.unclear ?? "Unclear",
    };
    return map[s] ?? s;
  };

  const critLabel = (c: string) => {
    const map: Record<string, string> = {
      critical: "Critical", high: "High", medium: "Medium", low: "Low", info: "Info",
    };
    return map[c] ?? c;
  };

  const jurisLabel = (j: string) => {
    const map: Record<string, string> = { eu: "EU", de: "DE", ch: "CH", international: "International" };
    return map[j] ?? j;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {pc?.tab_title ?? "Product Compliance"} – {productName}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No items found.</p>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {items.map((item) => (
              <AccordionItem
                key={item.id}
                value={String(item.id)}
                className={`border-l-4 rounded-lg px-3 ${criticalityColor(item.criticality)}`}
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 text-left w-full">
                    {statusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{item.regulationCode}</span>
                        <span className="text-xs text-muted-foreground">{item.regulationName}</span>
                        <Badge variant="outline" className="text-xs">{jurisLabel(item.jurisdiction)}</Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${item.criticality === "critical" ? "border-red-500 text-red-600" : item.criticality === "high" ? "border-orange-500 text-orange-600" : ""}`}
                        >
                          {critLabel(item.criticality)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.finding}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{statusLabel(item.status)}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3 space-y-3">
                  {item.finding && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{pc?.finding ?? "Finding"}</p>
                      <p className="text-sm">{item.finding}</p>
                    </div>
                  )}
                  {item.evidence && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{pc?.evidence ?? "Evidence"}</p>
                      <p className="text-sm">{item.evidence}</p>
                    </div>
                  )}
                  {item.recommendation && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{pc?.recommendation ?? "Recommendation"}</p>
                      <p className="text-sm">{item.recommendation}</p>
                    </div>
                  )}
                  {item.legalRisk && (
                    <div className="bg-orange-50 dark:bg-orange-950/20 rounded p-2">
                      <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-1">{pc?.legal_risk ?? "Legal Risk (DE/EU)"}</p>
                      <p className="text-sm">{item.legalRisk}</p>
                    </div>
                  )}
                  {item.chRisk && (
                    <div className="bg-red-50 dark:bg-red-950/20 rounded p-2">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">{pc?.ch_risk ?? "Risk for us (CH)"}</p>
                      <p className="text-sm">{item.chRisk}</p>
                    </div>
                  )}
                  {item.documentRequired && (
                    <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/20 rounded p-2">
                      <FileText className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">{pc?.document_required ?? "Document Required"}</p>
                        <p className="text-sm">{item.documentRequired}</p>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  supplierId: number;
  productId?: number; // if set, show only for this product
}

export function ProductComplianceTab({ supplierId, productId }: Props) {
  const { t } = useLang();
  const pc = (t as any).productCompliance;

  const [selectedCheckId, setSelectedCheckId] = useState<number | null>(null);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [pollingEnabled, setPollingEnabled] = useState(false);

  const utils = trpc.useUtils();

  // Supplier-level: list all product checks
  const { data: checks = [], isLoading } = trpc.productComplianceCheck.listForSupplier.useQuery(
    { supplierId },
    { refetchInterval: pollingEnabled ? 5000 : false }
  );

  // Auto-stop polling when no more running checks
  const hasRunning = checks.some((c: { check: { status: string } }) => c.check.status === "running" || c.check.status === "pending");
  if (!hasRunning && pollingEnabled) setPollingEnabled(false);

  const triggerBatch = trpc.productComplianceCheck.triggerBatchForSupplier.useMutation({
    onSuccess: (data) => {
      toast.success(`${pc?.batch_started ?? "Batch started"} – ${data.started} ${pc?.products_analyzed ?? "products"}`);
      setPollingEnabled(true);
      utils.productComplianceCheck.listForSupplier.invalidate({ supplierId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCheck = trpc.productComplianceCheck.deleteCheck.useMutation({
    onSuccess: () => {
      utils.productComplianceCheck.listForSupplier.invalidate({ supplierId });
    },
    onError: (e) => toast.error(e.message),
  });

  const runningCount = checks.filter(c => c.check.status === "running" || c.check.status === "pending").length;
  const completedCount = checks.filter(c => c.check.status === "completed").length;

  // Group by product (latest check per product)
  const latestByProduct = new Map<number, typeof checks[0]>();
  for (const c of checks) {
    const existing = latestByProduct.get(c.product.id);
    if (!existing || new Date(c.check.createdAt) > new Date(existing.check.createdAt)) {
      latestByProduct.set(c.product.id, c);
    }
  }
  const displayChecks = Array.from(latestByProduct.values());

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold">{pc?.tab_title ?? "Product Compliance"}</h3>
          {runningCount > 0 && (
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              {runningCount} {pc?.status_running ?? "Running…"} ({completedCount}/{checks.length})
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => triggerBatch.mutate({ supplierId })}
          disabled={triggerBatch.isPending || runningCount > 0}
        >
          {triggerBatch.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{pc?.analysis_running ?? "Running…"}</>
          ) : (
            <><PlayCircle className="h-4 w-4 mr-2" />{pc?.run_batch ?? "Check All Products"}</>
          )}
        </Button>
      </div>

      {/* Progress bar when running */}
      {runningCount > 0 && (
        <div className="space-y-1">
          <Progress value={(completedCount / Math.max(checks.length, 1)) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground">{completedCount} / {checks.length} {pc?.status_completed ?? "completed"}</p>
        </div>
      )}

      {/* No checks yet */}
      {displayChecks.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
          <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>{pc?.no_checks ?? "No product compliance check performed yet."}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => triggerBatch.mutate({ supplierId })}
            disabled={triggerBatch.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            {pc?.run_batch ?? "Check All Products"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {displayChecks.map(({ check, product }) => (
            <Card
              key={check.id}
              className={`border cursor-pointer hover:shadow-md transition-shadow ${
                check.status === "running" || check.status === "pending" ? "opacity-70" : ""
              }`}
              onClick={() => {
                if (check.status === "completed") {
                  setSelectedCheckId(check.id);
                  setSelectedProductName(product.productName);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Score ring */}
                  <div className="shrink-0">
                    {check.status === "completed" ? (
                      scoreRing(check.overallScore)
                    ) : check.status === "running" || check.status === "pending" ? (
                      <div className="w-[72px] h-[72px] flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="w-[72px] h-[72px] flex items-center justify-center">
                        <ShieldX className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{product.productName}</span>
                      {product.brand && <Badge variant="outline" className="text-xs">{product.brand}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {check.status === "completed" && riskBadge(check.riskLevel)}
                      {check.status === "running" && (
                        <Badge variant="outline" className="text-xs">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          {pc?.status_running ?? "Running…"}
                        </Badge>
                      )}
                      {check.status === "pending" && (
                        <Badge variant="outline" className="text-xs">{pc?.status_pending ?? "Pending"}</Badge>
                      )}
                      {check.status === "failed" && (
                        <Badge variant="destructive" className="text-xs">{pc?.status_failed ?? "Failed"}</Badge>
                      )}
                    </div>
                    {check.status === "completed" && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>EU: {check.euScore ?? "–"}</span>
                        <span>DE: {check.deScore ?? "–"}</span>
                        <span>CH: {check.chScore ?? "–"}</span>
                        {(check.criticalIssues as string[] | null)?.length ? (
                          <span className="text-red-600 font-medium">
                            {(check.criticalIssues as string[]).length} critical
                          </span>
                        ) : null}
                      </div>
                    )}
                    {check.status === "completed" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(check.createdAt).toLocaleDateString()} – click to view details
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {check.status === "completed" && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this check?")) {
                          deleteCheck.mutate({ checkId: check.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      {selectedCheckId && (
        <CheckDetailDialog
          checkId={selectedCheckId}
          productName={selectedProductName}
          open={!!selectedCheckId}
          onClose={() => setSelectedCheckId(null)}
        />
      )}
    </div>
  );
}
