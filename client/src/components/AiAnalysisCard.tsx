import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Info,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 75) return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (score >= 50) return { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" };
  return { bar: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" };
}

function ScoreRing({ score }: { score: number }) {
  const c = scoreColor(score);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={c.bar.replace("bg-", "stroke-")}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${c.text}`}>{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function CategoryBar({ label, score, icon: Icon }: { label: string; score: number; icon: any }) {
  const c = scoreColor(score);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className={`font-semibold text-xs ${c.text}`}>{score}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function severityIcon(severity: string) {
  switch (severity) {
    case "high": return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case "medium": return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "low": return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
    default: return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  }
}

function severityLabel(severity: string) {
  const map: Record<string, string> = { high: "Kritisch", medium: "Mittel", low: "Gering", info: "Info" };
  return map[severity] ?? severity;
}

function severityBadgeClass(severity: string) {
  switch (severity) {
    case "high": return "text-red-700 bg-red-50 border-red-200";
    case "medium": return "text-amber-700 bg-amber-50 border-amber-200";
    case "low": return "text-blue-700 bg-blue-50 border-blue-200";
    default: return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
interface AiAnalysisCardProps {
  productId: number;
  canTrigger?: boolean;
}

export function AiAnalysisCard({ productId, canTrigger = false }: AiAnalysisCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  async function downloadPdf(analysisId?: number) {
    setIsDownloading(true);
    try {
      const url = analysisId
        ? `/api/reports/ai-analysis/${productId}?analysisId=${analysisId}`
        : `/api/reports/ai-analysis/${productId}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unbekannter Fehler" }));
        throw new Error(err.error ?? "PDF-Download fehlgeschlagen");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `KI-Analyse-${productId}.pdf`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast.success("PDF erfolgreich heruntergeladen");
    } catch (e: any) {
      toast.error(e.message ?? "PDF-Download fehlgeschlagen");
    } finally {
      setIsDownloading(false);
    }
  }

  const latestQuery = trpc.aiAnalysis.getLatest.useQuery({ productId });
  const historyQuery = trpc.aiAnalysis.getHistory.useQuery(
    { productId },
    { enabled: showHistory }
  );
  const utils = trpc.useUtils();

  const analyzeMutation = trpc.aiAnalysis.analyzeProduct.useMutation({
    onSuccess: () => {
      toast.success("KI-Analyse abgeschlossen");
      utils.aiAnalysis.getLatest.invalidate({ productId });
      utils.aiAnalysis.getHistory.invalidate({ productId });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const analysis = latestQuery.data;
  const isRunning = analyzeMutation.isPending;

  // ── Empty / loading state ──────────────────────────────────────────────────
  if (latestQuery.isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center text-muted-foreground text-sm gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Lade KI-Analyse…
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-medium">Noch keine KI-Analyse vorhanden</p>
            <p className="text-sm text-muted-foreground mt-1">
              GPT-4o prüft alle hochgeladenen Dokumente auf Plausibilität und Vollständigkeit.
            </p>
          </div>
          {canTrigger && (
            <Button
              onClick={() => analyzeMutation.mutate({ productId })}
              disabled={isRunning}
              className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
            >
              {isRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isRunning ? "Analysiere…" : "KI-Analyse starten"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const overall = Number(analysis.overallScore ?? 0);
  const docScore = Number(analysis.documentCompletenessScore ?? 0);
  const contentScore = Number(analysis.contentPlausibilityScore ?? 0);
  const formalScore = Number(analysis.formalCorrectnessScore ?? 0);
  const consistencyScore = Number(analysis.consistencyScore ?? 0);
  const findings = (analysis.findings as any[] | null) ?? [];
  const recommendations = (analysis.recommendations as string[] | null) ?? [];
  const overallColor = scoreColor(overall);

  return (
    <div className="space-y-4">
      {/* Main score card */}
      <Card className={`border ${overallColor.border}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              KI-Plausibilitätsprüfung
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(analysis.createdAt).toLocaleString("de-DE")}
              </span>
              <Badge variant="outline" className="text-xs">
                {analysis.modelUsed ?? "GPT-4o"}
              </Badge>
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadPdf()}
                  disabled={isDownloading}
                  className="h-7 text-xs gap-1"
                >
                  {isDownloading ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  PDF exportieren
                </Button>
              {canTrigger && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => analyzeMutation.mutate({ productId })}
                  disabled={isRunning}
                  className="h-7 text-xs gap-1"
                >
                  {isRunning ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Neu analysieren
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Score ring + summary */}
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <ScoreRing score={overall} />
              <Badge
                variant="outline"
                className={`text-sm font-semibold px-3 py-1 ${overallColor.text} ${overallColor.bg} ${overallColor.border}`}
              >
                {overall >= 75 ? "Plausibel" : overall >= 50 ? "Teilweise plausibel" : "Kritisch"}
              </Badge>
            </div>

            <div className="flex-1 space-y-4">
              {/* Summary */}
              {analysis.summary && (
                <div className={`rounded-lg p-3 text-sm ${overallColor.bg} ${overallColor.border} border`}>
                  <p className={overallColor.text}>{analysis.summary}</p>
                </div>
              )}

              {/* Category bars */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CategoryBar label="Dokumentenvollständigkeit" score={docScore} icon={FileText} />
                <CategoryBar label="Inhaltliche Plausibilität" score={contentScore} icon={CheckCircle2} />
                <CategoryBar label="Formale Korrektheit" score={formalScore} icon={Info} />
                <CategoryBar label="Konsistenz" score={consistencyScore} icon={Sparkles} />
              </div>
            </div>
          </div>

          {/* Findings */}
          {findings.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-semibold">Befunde ({findings.length})</p>
                <div className="space-y-2">
                  {findings.map((f: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg border p-3 text-sm"
                    >
                      {severityIcon(f.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{f.category}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 ${severityBadgeClass(f.severity)}`}
                          >
                            {severityLabel(f.severity)}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-0.5">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-semibold">Empfehlungen</p>
                <ul className="space-y-1.5">
                  {recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Tokens used */}
          {analysis.tokensUsed && (
            <p className="text-xs text-muted-foreground text-right">
              {analysis.tokensUsed.toLocaleString("de-DE")} Tokens verwendet
            </p>
          )}
        </CardContent>
      </Card>

      {/* History toggle */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1 text-muted-foreground"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Analyse-Verlauf ({showHistory ? "ausblenden" : "anzeigen"})
        </Button>

        {showHistory && (
          <div className="mt-2 space-y-2">
            {historyQuery.isLoading ? (
              <p className="text-xs text-muted-foreground px-2">Lade Verlauf…</p>
            ) : (historyQuery.data?.length ?? 0) <= 1 ? (
              <p className="text-xs text-muted-foreground px-2">Keine früheren Analysen vorhanden.</p>
            ) : (
              historyQuery.data?.slice(1).map((h: any) => {
                const s = Number(h.overallScore ?? 0);
                const c = scoreColor(s);
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(h.createdAt).toLocaleString("de-DE")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-xs ${c.text}`}>{s}%</span>
                      <Badge variant="outline" className="text-xs">{h.modelUsed ?? "GPT-4o"}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
