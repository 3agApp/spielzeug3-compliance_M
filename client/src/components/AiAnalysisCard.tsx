/**
 * AiAnalysisCard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Two-section AI analysis view:
 *  1. Document Analysis  – per-document scores and issues
 *  2. Risk Assessment    – overall product risk with findings and recommendations
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileSearch,
  FileText,
  Info,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { translateError } from "@/lib/translateError";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 75)
    return {
      bar: "bg-emerald-500",
      text: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      stroke: "stroke-emerald-500",
    };
  if (score >= 50)
    return {
      bar: "bg-amber-500",
      text: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      stroke: "stroke-amber-500",
    };
  return {
    bar: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    stroke: "stroke-red-500",
  };
}

function ScoreRing({ score }: { score: number }) {
  const c = scoreColor(score);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="currentColor" strokeWidth="8"
          className="text-muted/30"
        />
        <circle
          cx="50" cy="50" r={radius}
          fill="none" strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={c.stroke}
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

function CategoryBar({
  label,
  score,
  icon: Icon,
}: {
  label: string;
  score: number;
  icon: any;
}) {
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

function findingIcon(type: string) {
  switch (type) {
    case "critical":
      return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "positive":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
  }
}

function findingBadgeClass(type: string) {
  switch (type) {
    case "critical":
      return "text-red-700 bg-red-50 border-red-200";
    case "warning":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "positive":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    default:
      return "text-blue-700 bg-blue-50 border-blue-200";
  }
}

function docStatusBadge(status: string) {
  switch (status) {
    case "ok":
      return (
        <Badge variant="outline" className="text-xs text-emerald-700 bg-emerald-50 border-emerald-200">
          <CheckCircle2 className="h-3 w-3 mr-1" /> OK
        </Badge>
      );
    case "warning":
      return (
        <Badge variant="outline" className="text-xs text-amber-700 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-3 w-3 mr-1" /> Warning
        </Badge>
      );
    case "critical":
      return (
        <Badge variant="outline" className="text-xs text-red-700 bg-red-50 border-red-200">
          <XCircle className="h-3 w-3 mr-1" /> Critical
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

// ─── Document Analysis Section ────────────────────────────────────────────────

function DocumentAnalysisSection({ documentAnalysis }: { documentAnalysis: any[] }) {
  if (!documentAnalysis || documentAnalysis.length === 0) {
    return (
      <div className="py-8 flex flex-col items-center gap-3 text-center text-muted-foreground">
        <FileSearch className="h-10 w-10 opacity-40" />
        <p className="text-sm">
          No documents were analyzed. Upload documents first, then run a new analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documentAnalysis.map((doc: any, i: number) => {
        const c = scoreColor(doc.score ?? 0);
        return (
          <Card key={i} className={`border ${c.border}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{doc.fileName || "–"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{doc.documentType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {docStatusBadge(doc.status)}
                  <span className={`text-sm font-bold ${c.text}`}>{doc.score ?? 0}/100</span>
                </div>
              </div>

              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                  style={{ width: `${doc.score ?? 0}%` }}
                />
              </div>

              {doc.positives && doc.positives.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {doc.positives.map((p: string, j: number) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              )}

              {doc.issues && doc.issues.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {doc.issues.map((issue: string, j: number) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-red-700">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Risk Assessment Section ──────────────────────────────────────────────────

function RiskAssessmentSection({ analysis }: { analysis: any }) {
  const overall = Number(analysis.overallScore ?? 0);
  const docScore = Number(analysis.documentCompletenessScore ?? 0);
  const contentScore = Number(analysis.contentPlausibilityScore ?? 0);
  const formalScore = Number(analysis.formalCorrectnessScore ?? 0);
  const consistencyScore = Number(analysis.consistencyScore ?? 0);
  const findings = (analysis.findings as any[] | null) ?? [];
  const recommendations = (analysis.recommendations as string[] | null) ?? [];
  const overallColor = scoreColor(overall);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <ScoreRing score={overall} />
          <Badge
            variant="outline"
            className={`text-sm font-semibold px-3 py-1 ${overallColor.text} ${overallColor.bg} ${overallColor.border}`}
          >
            {overall >= 75 ? "Low Risk" : overall >= 50 ? "Medium Risk" : "High Risk"}
          </Badge>
        </div>

        <div className="flex-1 space-y-4">
          {analysis.summary && (
            <div className={`rounded-lg p-3 text-sm ${overallColor.bg} ${overallColor.border} border`}>
              <p className={overallColor.text}>{analysis.summary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CategoryBar label="Document Completeness" score={docScore} icon={FileText} />
            <CategoryBar label="Content Plausibility" score={contentScore} icon={CheckCircle2} />
            <CategoryBar label="Formal Correctness" score={formalScore} icon={Info} />
            <CategoryBar label="Consistency" score={consistencyScore} icon={Sparkles} />
          </div>
        </div>
      </div>

      {findings.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-semibold">Findings ({findings.length})</p>
            <div className="space-y-2">
              {findings.map((f: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border p-3 text-sm"
                >
                  {findingIcon(f.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <Badge
                        variant="outline"
                        className={`text-xs px-1.5 py-0 ${findingBadgeClass(f.type)}`}
                      >
                        {f.type === "critical"
                          ? "Critical"
                          : f.type === "warning"
                          ? "Warning"
                          : f.type === "positive"
                          ? "Positive"
                          : f.type}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{f.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {recommendations.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-semibold">Recommendations</p>
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

      {analysis.tokensUsed && (
        <p className="text-xs text-muted-foreground text-right">
          {analysis.tokensUsed.toLocaleString("en-US")} tokens used
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AiAnalysisCardProps {
  productId: number;
  canTrigger?: boolean;
}

export function AiAnalysisCard({ productId, canTrigger = false }: AiAnalysisCardProps) {
  const { lang } = useLang();
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
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "PDF download failed");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `AI-Analysis-${productId}.pdf`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast.success("PDF downloaded successfully");
    } catch (e: any) {
      toast.error(e.message ?? "PDF download failed");
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
      toast.success("AI analysis completed");
      utils.aiAnalysis.getLatest.invalidate({ productId });
      utils.aiAnalysis.getHistory.invalidate({ productId });
    },
    onError: (e: any) => toast.error(translateError(e.message, lang)),
  });

  const analysis = latestQuery.data;
  const isRunning = analyzeMutation.isPending;

  if (latestQuery.isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center text-muted-foreground text-sm gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading analysis...
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
            <p className="font-medium">No analysis available yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Analyzes each uploaded document individually and performs an overall risk assessment.
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
              {isRunning ? "Analysing..." : "Start AI Analysis"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const documentAnalysis = (analysis.documentAnalysis as any[] | null) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              AI Analysis
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(analysis.createdAt).toLocaleString("en-GB")}
              </span>
              <Badge variant="outline" className="text-xs">
                {analysis.modelUsed ?? "built-in"}
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
                Export PDF
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
                  {isRunning ? "Analysing..." : "Re-analyse"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="documents">
            <TabsList className="mb-4">
              <TabsTrigger value="documents" className="gap-2">
                <FileSearch className="h-4 w-4" />
                Document Analysis
                {documentAnalysis.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {documentAnalysis.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="risk" className="gap-2">
                <ShieldAlert className="h-4 w-4" />
                Risk Assessment
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="mt-0">
              <DocumentAnalysisSection documentAnalysis={documentAnalysis} />
            </TabsContent>

            <TabsContent value="risk" className="mt-0">
              <RiskAssessmentSection analysis={analysis} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* History */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1 text-muted-foreground"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          Analysis history ({showHistory ? "hide" : "show"})
        </Button>

        {showHistory && (
          <div className="mt-2 space-y-2">
            {historyQuery.isLoading ? (
              <p className="text-xs text-muted-foreground px-2">Loading history...</p>
            ) : (historyQuery.data?.length ?? 0) <= 1 ? (
              <p className="text-xs text-muted-foreground px-2">
                No previous analyses available.
              </p>
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
                      {new Date(h.createdAt).toLocaleString("en-GB")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-xs ${c.text}`}>{s}%</span>
                      <Badge variant="outline" className="text-xs">
                        {h.modelUsed ?? "built-in"}
                      </Badge>
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
