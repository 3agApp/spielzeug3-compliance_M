/**
 * RiskAssessmentTab.tsx
 * AI-powered risk assessment display for a product.
 * Shows overall risk score, individual risk cards (1–10), and mitigation steps.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Zap,
  Info,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useLang } from "@/lib/i18n";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score <= 3) return "text-emerald-600";
  if (score <= 6) return "text-amber-500";
  if (score <= 8) return "text-orange-500";
  return "text-red-600";
}

function scoreBg(score: number): string {
  if (score <= 3) return "bg-emerald-50 border-emerald-200";
  if (score <= 6) return "bg-amber-50 border-amber-200";
  if (score <= 8) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function scoreBarColor(score: number): string {
  if (score <= 3) return "bg-emerald-500";
  if (score <= 6) return "bg-amber-400";
  if (score <= 8) return "bg-orange-500";
  return "bg-red-600";
}

function levelLabel(level: string, lang: "de" | "en"): string {
  const map: Record<string, { de: string; en: string }> = {
    low:      { de: "Niedrig",   en: "Low"      },
    medium:   { de: "Mittel",    en: "Medium"   },
    high:     { de: "Hoch",      en: "High"     },
    critical: { de: "Kritisch",  en: "Critical" },
  };
  return map[level]?.[lang] ?? level;
}

function levelBadgeVariant(level: string): "default" | "secondary" | "destructive" | "outline" {
  if (level === "low") return "secondary";
  if (level === "medium") return "outline";
  if (level === "high") return "default";
  return "destructive";
}

function LevelIcon({ level, className }: { level: string; className?: string }) {
  if (level === "low")      return <ShieldCheck className={className} />;
  if (level === "medium")   return <AlertTriangle className={className} />;
  if (level === "high")     return <ShieldAlert className={className} />;
  return <ShieldX className={className} />;
}

// ─── Score gauge ─────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const pct = ((score - 1) / 9) * 100;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-5xl font-bold tabular-nums ${scoreColor(score)}`}>
        {score.toFixed(1)}
      </div>
      <div className="text-xs text-muted-foreground">/10</div>
      <div className="w-32 h-2 rounded-full bg-muted overflow-hidden mt-1">
        <div
          className={`h-full rounded-full transition-all ${scoreBarColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Risk card ────────────────────────────────────────────────────────────────

interface RiskItem {
  category: string;
  score: number;
  title: string;
  description: string;
  mitigations: string[];
}

function RiskCard({ risk, lang }: { risk: RiskItem; lang: "de" | "en" }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`rounded-lg border p-3 ${scoreBg(risk.score)}`}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <div className="flex items-center gap-3">
              {/* Score pill */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                risk.score <= 3 ? "border-emerald-400 text-emerald-700 bg-white" :
                risk.score <= 6 ? "border-amber-400 text-amber-700 bg-white" :
                risk.score <= 8 ? "border-orange-400 text-orange-700 bg-white" :
                                  "border-red-500 text-red-700 bg-white"
              }`}>
                {risk.score}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{risk.title}</span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {risk.category}
                  </Badge>
                </div>
              </div>
              <div className="flex-shrink-0 text-muted-foreground">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 pt-3 border-t border-current/10 space-y-3">
            <p className="text-sm text-foreground/80">{risk.description}</p>
            {risk.mitigations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  {lang === "de" ? "Maßnahmen zur Risikoreduktion" : "Risk mitigation measures"}
                </p>
                <ul className="space-y-1">
                  {risk.mitigations.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-emerald-600" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  productId: number;
  isInternalRole: boolean;
}

export default function RiskAssessmentTab({ productId, isInternalRole }: Props) {
  const { lang } = useLang();
  const [showHistory, setShowHistory] = useState(false);

  const latestQuery = trpc.riskAssessment.getLatest.useQuery({ productId });
  const historyQuery = trpc.riskAssessment.getHistory.useQuery(
    { productId },
    { enabled: showHistory }
  );

  const utils = trpc.useUtils();
  const runMutation = trpc.riskAssessment.run.useMutation({
    onSuccess: () => {
      utils.riskAssessment.getLatest.invalidate({ productId });
      utils.riskAssessment.getHistory.invalidate({ productId });
    },
  });

  const latest = latestQuery.data;
  const risks: RiskItem[] = Array.isArray(latest?.risks) ? (latest.risks as RiskItem[]) : [];
  const missingInfo: string[] = Array.isArray(latest?.missingInfo) ? (latest.missingInfo as string[]) : [];

  const t = {
    title:          lang === "de" ? "KI-Risikobewertung" : "AI Risk Assessment",
    subtitle:       lang === "de" ? "Automatische Analyse aller vorliegenden Produktinformationen" : "Automated analysis of all available product information",
    runBtn:         lang === "de" ? "Neue Bewertung starten" : "Run new assessment",
    running:        lang === "de" ? "Bewertung läuft…" : "Assessment running…",
    noData:         lang === "de" ? "Noch keine Risikobewertung vorhanden." : "No risk assessment available yet.",
    noDataHint:     lang === "de" ? "Starten Sie eine neue Bewertung, um alle Risiken zu analysieren." : "Run a new assessment to analyse all risks.",
    overallRisk:    lang === "de" ? "Gesamt-Risiko" : "Overall Risk",
    riskLevel:      lang === "de" ? "Risikostufe" : "Risk Level",
    summary:        lang === "de" ? "Zusammenfassung" : "Summary",
    risks:          lang === "de" ? "Identifizierte Risiken" : "Identified Risks",
    missingInfo:    lang === "de" ? "Fehlende Informationen zur Risikoreduktion" : "Missing information to reduce risk",
    history:        lang === "de" ? "Bewertungsverlauf" : "Assessment history",
    hideHistory:    lang === "de" ? "Verlauf ausblenden" : "Hide history",
    createdAt:      lang === "de" ? "Erstellt" : "Created",
    score:          lang === "de" ? "Score" : "Score",
    noHistory:      lang === "de" ? "Kein Verlauf vorhanden." : "No history available.",
    errorRun:       lang === "de" ? "Fehler beim Starten der Bewertung" : "Error starting assessment",
  };

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                {t.title}
              </CardTitle>
              <CardDescription className="mt-0.5">{t.subtitle}</CardDescription>
            </div>
            {isInternalRole && (
              <Button
                size="sm"
                onClick={() => runMutation.mutate({ productId })}
                disabled={runMutation.isPending || latestQuery.isLoading}
                className="gap-2 flex-shrink-0"
              >
                {runMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {runMutation.isPending ? t.running : t.runBtn}
              </Button>
            )}
          </div>
          {runMutation.isError && (
            <p className="text-sm text-destructive mt-2">
              {t.errorRun}: {runMutation.error.message}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Loading state */}
      {latestQuery.isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{lang === "de" ? "Lade Bewertung…" : "Loading assessment…"}</span>
        </div>
      )}

      {/* Empty state */}
      {!latestQuery.isLoading && !latest && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">{t.noData}</p>
            {isInternalRole && (
              <p className="text-sm text-muted-foreground">{t.noDataHint}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {latest && (
        <>
          {/* Overall score + summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Score gauge */}
            <Card className="flex flex-col items-center justify-center py-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {t.overallRisk}
              </p>
              <ScoreGauge score={Number(latest.overallRiskScore)} />
              <div className="mt-3 flex items-center gap-1.5">
                <LevelIcon level={latest.riskLevel} className={`h-4 w-4 ${scoreColor(Number(latest.overallRiskScore))}`} />
                <Badge variant={levelBadgeVariant(latest.riskLevel)}>
                  {levelLabel(latest.riskLevel, lang)}
                </Badge>
              </div>
            </Card>

            {/* Summary */}
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  {t.summary}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{latest.summary}</p>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t.createdAt}: {new Date(latest.createdAt).toLocaleString()}
                  {latest.modelUsed && (
                    <span className="ml-2 font-mono">· {latest.modelUsed}</span>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Risk cards */}
          {risks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  {t.risks} ({risks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {risks.map((risk, i) => (
                  <RiskCard key={i} risk={risk} lang={lang} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Missing info */}
          {missingInfo.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {t.missingInfo}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {missingInfo.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* History toggle */}
      {(latest || historyQuery.data) && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="h-4 w-4" />
            {showHistory ? t.hideHistory : t.history}
          </Button>

          {showHistory && (
            <Card className="mt-2">
              <CardContent className="pt-4">
                {historyQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> {lang === "de" ? "Lade…" : "Loading…"}
                  </div>
                ) : !historyQuery.data?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t.noHistory}</p>
                ) : (
                  <div className="space-y-2">
                    {historyQuery.data.map((h) => (
                      <div key={h.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${scoreBg(Number(h.overallRiskScore))}`}>
                        <div className={`font-bold tabular-nums w-8 text-center ${scoreColor(Number(h.overallRiskScore))}`}>
                          {Number(h.overallRiskScore).toFixed(1)}
                        </div>
                        <Badge variant={levelBadgeVariant(h.riskLevel)} className="text-xs">
                          {levelLabel(h.riskLevel, lang)}
                        </Badge>
                        <span className="text-muted-foreground text-xs ml-auto">
                          {new Date(h.createdAt).toLocaleString()}
                        </span>
                        <Badge variant={h.status === "completed" ? "secondary" : h.status === "failed" ? "destructive" : "outline"} className="text-xs">
                          {h.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
