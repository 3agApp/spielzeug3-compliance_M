import { useAuth } from "@/_core/hooks/useAuth";
import CreateProductDialog from "@/components/CreateProductDialog";
import { StatusBadge, CompletenessBar } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Download,
  FileArchive,
  Loader2,
  Package,
  Plus,
  Search,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── AI Score mini-badge ──────────────────────────────────────────────────────
function AiScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="text-muted-foreground text-xs">–</span>;
  const color =
    score >= 75 ? "text-emerald-700 bg-emerald-50 border-emerald-300"
    : score >= 50 ? "text-amber-700 bg-amber-50 border-amber-300"
    : "text-red-700 bg-red-50 border-red-300";
  return (
    <Badge variant="outline" className={`gap-1 text-xs font-semibold ${color}`}>
      <Bot className="h-3 w-3" />
      {score}%
    </Badge>
  );
}

// ─── Batch analysis progress dialog ──────────────────────────────────────────
interface AnalysisProgress {
  total: number;
  done: number;
  current: string;
  results: Array<{ productId: number; name: string; success: boolean; score?: number; error?: string }>;
}

function AnalysisProgressDialog({
  open,
  progress,
  onClose,
}: {
  open: boolean;
  progress: AnalysisProgress | null;
  onClose: () => void;
}) {
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  const done = progress?.done ?? 0;
  const total = progress?.total ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && done === total && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            KI-Plausibilitätsprüfung
          </DialogTitle>
          <DialogDescription>
            GPT-4o analysiert die Produktdokumente auf Plausibilität und Vollständigkeit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Overall progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fortschritt</span>
              <span className="font-medium">{done} / {total}</span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>

          {/* Current item */}
          {done < total && progress?.current && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <Bot className="h-4 w-4 animate-pulse text-primary shrink-0" />
              <span className="truncate">Analysiere: {progress.current}</span>
            </div>
          )}

          {/* Results list */}
          {(progress?.results?.length ?? 0) > 0 && (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {progress!.results.map((r) => (
                <div
                  key={r.productId}
                  className="flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2 bg-muted/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {r.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <span className="truncate">{r.name}</span>
                  </div>
                  {r.success && r.score !== undefined ? (
                    <AiScoreBadge score={r.score} />
                  ) : (
                    <span className="text-xs text-red-500 shrink-0">Fehler</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Done */}
          {done === total && total > 0 && (
            <div className="flex justify-end pt-2">
              <Button onClick={onClose}>Schließen</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── STATUS OPTIONS ───────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  "all",
  "open",
  "in_progress",
  "submitted",
  "under_review",
  "clarification_needed",
  "approved",
  "rejected",
  "completed",
] as const;

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Products() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Checkbox selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // New product dialog state
  const [newProductOpen, setNewProductOpen] = useState(false);

  // AI analysis state
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);

  // Batch export state
  const [batchExporting, setBatchExporting] = useState(false);

  // AI scores cache: productId → score
  const [aiScores, setAiScores] = useState<Record<number, number>>({});

  const role = (user as any)?.complianceRole ?? "internal_employee";
  const canRunAi = ["administrator", "compliance_manager", "internal_employee"].includes(role);

  const productsQuery = trpc.products.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
  });

  const utils = trpc.useUtils();
  const analyzeProductMutation = trpc.aiAnalysis.analyzeProduct.useMutation();

  const products = productsQuery.data ?? [];

  // ── Selection helpers ──────────────────────────────────────────────────────
  const allSelected = products.length > 0 && products.every((p: any) => selected.has(p.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p: any) => p.id)));
    }
  };

  const toggleOne = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── AI batch analysis ──────────────────────────────────────────────────────
  const runAiAnalysis = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    const selectedProducts = products.filter((p: any) => ids.includes(p.id));

    setProgress({
      total: ids.length,
      done: 0,
      current: selectedProducts[0]?.productName ?? "",
      results: [],
    });
    setAnalysisOpen(true);

    const results: AnalysisProgress["results"] = [];

    for (let i = 0; i < ids.length; i++) {
      const productId = ids[i];
      const productName = selectedProducts.find((p: any) => p.id === productId)?.productName ?? `Produkt ${productId}`;

      setProgress((prev) => ({
        ...prev!,
        current: productName,
        done: i,
      }));

      try {
        const result = await analyzeProductMutation.mutateAsync({ productId });
        results.push({ productId, name: productName, success: true, score: result.result?.overallScore });
        setAiScores((prev) => ({ ...prev, [productId]: result.result?.overallScore }));
      } catch (err: any) {
        results.push({ productId, name: productName, success: false, error: err.message });
        if (err.message?.includes("API-Schlüssel")) {
          toast.error("Kein OpenAI API-Schlüssel konfiguriert. Bitte in den Einstellungen hinterlegen.");
          break;
        }
      }

      setProgress((prev) => ({
        ...prev!,
        done: i + 1,
        results: [...results],
      }));
    }

    // Refresh product list
    utils.products.list.invalidate();
    setSelected(new Set());
  };

  // ── Batch seal label export ────────────────────────────────────────────────
  const runBatchExport = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    setBatchExporting(true);
    try {
      const response = await fetch("/api/reports/seal-labels-batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: ids }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).error ?? `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `Swiss-Product-Seal_Etiketten_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      toast.success(`${ids.length} Etikett${ids.length !== 1 ? "en" : ""} exportiert`, {
        description: "Die Siegel-Etiketten wurden als ZIP-Archiv heruntergeladen.",
      });
      setSelected(new Set());
    } catch (err: any) {
      toast.error("Export fehlgeschlagen", { description: err.message ?? "Unbekannter Fehler" });
    } finally {
      setBatchExporting(false);
    }
  };

  const handleCloseDialog = () => {
    setAnalysisOpen(false);
    setProgress(null);
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{t.nav.products}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {products.length} {t.common.items}
            {someSelected && (
              <span className="ml-2 text-primary font-medium">
                · {selected.size} ausgewählt
              </span>
            )}
          </p>
        </div>

        {/* New product button */}
        {canRunAi && !someSelected && (
          <Button
            onClick={() => setNewProductOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {lang === "de" ? "Neues Produkt" : "New Product"}
          </Button>
        )}

        {/* Action buttons – visible when items are selected */}
        {canRunAi && someSelected && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* AI analysis */}
            <Button
              onClick={runAiAnalysis}
              disabled={analyzeProductMutation.isPending || batchExporting}
              variant="outline"
              className="gap-2 border-violet-300 text-violet-700 hover:bg-violet-50"
            >
              <Sparkles className="h-4 w-4" />
              KI-Analyse ({selected.size})
            </Button>

            {/* Batch label export */}
            <Button
              onClick={runBatchExport}
              disabled={batchExporting || analyzeProductMutation.isPending}
              className="gap-2 bg-[#C8102E] hover:bg-[#a00d24] text-white shadow-sm"
            >
              {batchExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileArchive className="h-4 w-4" />
              )}
              {batchExporting
                ? "Exportiere…"
                : `Etiketten exportieren (${selected.size})`}
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.action.search + "..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? t.common.all : (t.status as any)[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Hint when nothing selected */}
            {canRunAi && !someSelected && products.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                <Download className="h-3.5 w-3.5" />
                Produkte auswählen für KI-Analyse oder Etikett-Export
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {productsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              {t.msg.loading}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Package className="h-10 w-10 opacity-30" />
              <p className="text-sm">{t.msg.noProducts}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    {canRunAi && (
                      <th className="w-10 px-4">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                          aria-label="Alle auswählen"
                        />
                      </th>
                    )}
                    <th>{t.product.productName}</th>
                    <th>{t.product.internalArticleNumber}</th>
                    <th>{t.product.supplierArticleNumber}</th>
                    {role !== "supplier" && <th>{t.product.supplier}</th>}
                    <th>{t.product.brand}</th>
                    <th>{t.product.status}</th>
                    <th>{t.product.completenessScore}</th>
                    <th className="whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Bot className="h-3.5 w-3.5" />
                        KI-Score
                      </span>
                    </th>
                    <th>{t.product.missingRequirements}</th>
                    <th className="whitespace-nowrap">Siegel</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p: any) => {
                    const isSelected = selected.has(p.id);
                    const aiScore = aiScores[p.id] ?? (p.latestAiScore != null ? Number(p.latestAiScore) : null);
                    return (
                      <tr
                        key={p.id}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                        }`}
                        onClick={() => setLocation(`/products/${p.id}`)}
                      >
                        {canRunAi && (
                          <td className="px-4" onClick={(e) => toggleOne(p.id, e)}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => {}}
                              aria-label={`${p.productName} auswählen`}
                            />
                          </td>
                        )}
                        <td>
                          <div className="font-medium">{p.productName}</div>
                          {p.ean && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              EAN: {p.ean}
                            </div>
                          )}
                        </td>
                        <td className="text-muted-foreground text-xs">
                          {p.internalArticleNumber ?? "–"}
                        </td>
                        <td className="text-muted-foreground text-xs">
                          {p.supplierArticleNumber ?? "–"}
                        </td>
                        {role !== "supplier" && (
                          <td className="text-sm">{p.supplierName ?? "–"}</td>
                        )}
                        <td className="text-sm">{p.brand ?? "–"}</td>
                        <td>
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="min-w-32">
                          <CompletenessBar
                            score={parseFloat(p.completenessScore ?? "0")}
                          />
                        </td>
                        <td>
                          <AiScoreBadge score={aiScore} />
                        </td>
                        <td>
                          {(p.missingCount ?? 0) > 0 ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {p.missingCount}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                              OK
                            </Badge>
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {p.publicUuid ? (
                            p.sealStatus === 'verified' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                Verified
                              </span>
                            ) : p.sealStatus === 'in_progress' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                In Progress
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">–</span>
                            )
                          ) : (
                            <span className="text-xs text-gray-300">–</span>
                          )}
                        </td>
                        <td>
                          <Button variant="ghost" size="sm">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Product Dialog */}
      <CreateProductDialog
        open={newProductOpen}
        onOpenChange={setNewProductOpen}
        onSuccess={() => productsQuery.refetch()}
      />

      {/* AI Analysis Progress Dialog */}
      <AnalysisProgressDialog
        open={analysisOpen}
        progress={progress}
        onClose={handleCloseDialog}
      />
    </div>
  );
}
