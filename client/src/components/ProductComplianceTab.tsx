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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
  Euro,
  AlertOctagon,
  Info,
  Flag,
  ArrowRight,
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

// ─── Penalty Card ─────────────────────────────────────────────────────────────
function PenaltyCard({ penalty }: { penalty: any }) {
  const [expanded, setExpanded] = useState(false);
  if (!penalty) return null;
  return (
    <div className="mt-3 border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <Euro className="h-4 w-4 text-orange-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">
            Max. Busse: {penalty.maxFine}
          </span>
          <span className="text-xs text-muted-foreground ml-2">({penalty.fineRange})</span>
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <div className="px-3 py-3 space-y-3 bg-white dark:bg-background">
          {penalty.concreteExamples?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Konkrete Beispiele aus der Praxis
              </p>
              <ul className="space-y-1.5">
                {penalty.concreteExamples.map((ex: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <AlertOctagon className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {penalty.maxConsequences?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Maximale Folgen
              </p>
              <ul className="space-y-1.5">
                {penalty.maxConsequences.map((c: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <ShieldX className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CH Residual Risk Panel ───────────────────────────────────────────────────
function ChResidualRiskPanel({ checkId }: { checkId: number }) {
  const { data, isLoading } = trpc.productComplianceCheck.getChResidualRiskSimulation.useQuery({ checkId });

  if (isLoading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">{data.summary.totalDeEuIssues}</p>
          <p className="text-xs text-muted-foreground mt-1">Offene DE/EU-Punkte</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{data.summary.totalChIssues}</p>
          <p className="text-xs text-muted-foreground mt-1">Offene CH-Punkte</p>
        </div>
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 p-3 text-center bg-blue-50 dark:bg-blue-950/20">
          <p className="text-2xl font-bold text-blue-600">{data.summary.chRisksIfDeClean}</p>
          <p className="text-xs text-muted-foreground mt-1">CH-Restrisiken wenn DE sauber</p>
        </div>
      </div>

      {/* Scenario: if DE/EU is fully compliant */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Flag className="h-4 w-4 text-blue-600" />
            Szenario: Wenn alle DE/EU-Anforderungen erfüllt wären – was bleibt für CH?
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Zeigt die CH-Restrisiken für spielzeug3 AG, die auch bei vollständiger DE/EU-Konformität bestehen bleiben.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.chResidualFromDeEu.filter((r: any) => r.residualRisk).map((r: any, i: number) => (
            <div key={i} className={`rounded-lg border p-3 ${r.reducedByDeCompliance ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"}`}>
              <div className="flex items-start gap-2">
                <ArrowRight className={`h-4 w-4 mt-0.5 shrink-0 ${r.reducedByDeCompliance ? "text-yellow-600" : "text-red-600"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold">{r.name}</span>
                    {r.reducedByDeCompliance ? (
                      <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">Reduziert durch DE-Compliance</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs border-red-500 text-red-700">Bleibt unabhängig von DE</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{r.residualRisk}</p>
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-400 mt-1">Max. Busse: {r.maxFine}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CH-only risks that always remain */}
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            CH-spezifische Risiken (immer vorhanden, unabhängig von DE/EU)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.alwaysChRisks.map((r: any, i: number) => (
            <div key={i} className={`rounded-lg border p-3 ${r.reducedByDeCompliance ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold">{r.name}</span>
                    {!r.reducedByDeCompliance && (
                      <Badge variant="outline" className="text-xs border-red-500 text-red-700">CH-spezifisch</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{r.risk}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs font-medium text-orange-700 dark:text-orange-400">Max. Busse: {r.maxFine}</span>
                    {r.residualRiskIfDeClean && (
                      <span className="text-xs text-blue-700 dark:text-blue-400">
                        Wenn DE sauber: {r.residualRiskIfDeClean}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
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
  const [activeTab, setActiveTab] = useState<"de_eu" | "ch" | "ch_simulation">("de_eu");

  const { data: items = [], isLoading } = trpc.productComplianceCheck.getItems.useQuery(
    { checkId },
    { enabled: open }
  );

  const { data: penaltyData } = trpc.productComplianceCheck.getRegulationPenalties.useQuery(
    undefined,
    { enabled: open }
  );

  const deEuItems = items.filter(i => i.jurisdiction === "eu" || i.jurisdiction === "de");
  const chItems = items.filter(i => i.jurisdiction === "ch");

  const getPenalty = (regulationCode: string) => {
    if (!penaltyData?.penalties) return null;
    return penaltyData.penalties.find((p: any) =>
      p.code === regulationCode ||
      regulationCode?.startsWith(p.code.split("-")[0])
    ) ?? null;
  };

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

  const renderItems = (itemList: typeof items) => {
    if (itemList.length === 0) return (
      <p className="text-muted-foreground text-center py-8">No items found.</p>
    );
    return (
      <Accordion type="multiple" className="space-y-2">
        {itemList.map((item) => {
          const penalty = getPenalty(item.regulationCode ?? "");
          return (
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
                      {penalty && (
                        <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">
                          <Euro className="h-3 w-3 mr-1" />{penalty.maxFine}
                        </Badge>
                      )}
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
                {/* Penalty card */}
                <PenaltyCard penalty={penalty} />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="de_eu" className="flex-1">
                <span className="flex items-center gap-1.5">
                  🇩🇪🇪🇺 DE / EU
                  {deEuItems.filter(i => i.status === "not_fulfilled").length > 0 && (
                    <Badge className="bg-red-600 text-white text-xs h-4 px-1">
                      {deEuItems.filter(i => i.status === "not_fulfilled").length}
                    </Badge>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="ch" className="flex-1">
                <span className="flex items-center gap-1.5">
                  🇨🇭 CH (spielzeug3 AG)
                  {chItems.filter(i => i.status === "not_fulfilled").length > 0 && (
                    <Badge className="bg-red-600 text-white text-xs h-4 px-1">
                      {chItems.filter(i => i.status === "not_fulfilled").length}
                    </Badge>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="ch_simulation" className="flex-1">
                <span className="flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5" />
                  CH-Restrisiko-Simulation
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="de_eu" className="mt-4">
              <div className="flex items-center gap-2 mb-3 p-2 bg-muted/30 rounded text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                Anforderungen aus EU-Recht und deutschem Recht – primäre Hersteller-Pflichten von RIVA Filter GmbH.
              </div>
              {renderItems(deEuItems)}
            </TabsContent>

            <TabsContent value="ch" className="mt-4">
              <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs text-muted-foreground">
                <ShieldAlert className="h-4 w-4 shrink-0 text-blue-600" />
                CH-Anforderungen für spielzeug3 AG als Importeur. Viele CH-Risiken reduzieren sich wenn RIVA DE/EU-Dokumente liefert.
              </div>
              {renderItems(chItems)}
            </TabsContent>

            <TabsContent value="ch_simulation" className="mt-4">
              <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs text-muted-foreground">
                <Flag className="h-4 w-4 shrink-0 text-blue-600" />
                Simulation: Wenn RIVA alle DE/EU-Anforderungen erfüllt – welche CH-Risiken bleiben für spielzeug3 AG?
              </div>
              <ChResidualRiskPanel checkId={checkId} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  supplierId: number;
  productId?: number;
}

export function ProductComplianceTab({ supplierId, productId }: Props) {
  const { t } = useLang();
  const pc = (t as any).productCompliance;

  const [selectedCheckId, setSelectedCheckId] = useState<number | null>(null);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [pollingEnabled, setPollingEnabled] = useState(false);

  const utils = trpc.useUtils();

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

  const runningCount = checks.filter((c: any) => c.check.status === "running" || c.check.status === "pending").length;
  const completedCount = checks.filter((c: any) => c.check.status === "completed").length;
  const criticalCount = checks.filter((c: any) => c.check.riskLevel === "critical").length;

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
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {runningCount > 0 && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {runningCount} {pc?.status_running ?? "Running…"} ({completedCount}/{checks.length})
              </p>
            )}
            {completedCount > 0 && criticalCount > 0 && (
              <Badge className="bg-red-600 text-white text-xs">
                {criticalCount} Critical Products
              </Badge>
            )}
          </div>
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

      {/* Summary stats when completed */}
      {completedCount > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Critical", count: checks.filter((c: any) => c.check.riskLevel === "critical").length, color: "text-red-600" },
            { label: "High", count: checks.filter((c: any) => c.check.riskLevel === "high").length, color: "text-orange-600" },
            { label: "Medium", count: checks.filter((c: any) => c.check.riskLevel === "medium").length, color: "text-yellow-600" },
            { label: "Low", count: checks.filter((c: any) => c.check.riskLevel === "low").length, color: "text-green-600" },
          ].map(({ label, count, color }) => (
            <div key={label} className="rounded-lg border p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
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
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">🇪🇺 EU: <strong>{check.euScore ?? "–"}</strong></span>
                        <span className="flex items-center gap-1">🇩🇪 DE: <strong>{check.deScore ?? "–"}</strong></span>
                        <span className="flex items-center gap-1">🇨🇭 CH: <strong>{check.chScore ?? "–"}</strong></span>
                        {(check.criticalIssues as string[] | null)?.length ? (
                          <span className="text-red-600 font-medium">
                            {(check.criticalIssues as string[]).length} critical issues
                          </span>
                        ) : null}
                      </div>
                    )}
                    {check.status === "completed" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(check.createdAt).toLocaleDateString()} · Click for DE/EU + CH details + residual risk simulation
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
