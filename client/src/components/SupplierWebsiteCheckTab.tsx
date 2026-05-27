/**
 * SupplierWebsiteCheckTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tab component for the Supplier Detail page.
 * Allows triggering an AI-powered compliance check of the supplier's website
 * against EU / DE / CH regulations.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { SupplierCheckItem, SupplierWebsiteCheck, SupplierComplianceAnalysis } from "../../../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckWithItems = SupplierWebsiteCheck & { items: SupplierCheckItem[] };

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, label, size = 80 }: { score: number | null; label: string; size?: number }) {
  const s = score ?? 0;
  const color = s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (s / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/30" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
          className="rotate-90 fill-foreground text-sm font-bold" style={{ transform: `rotate(90deg) translate(0, -${size / 2}px) translate(${size / 2}px, 0)`, fontSize: 16, fontWeight: 700 }}>
          {s}
        </text>
      </svg>
      <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: string; t: any }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    fulfilled:          { label: t.erfuellt,          className: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: <CheckCircle2 className="h-3 w-3" /> },
    partially_fulfilled:{ label: t.teilweise_erfuellt, className: "bg-amber-100 text-amber-800 border-amber-300",   icon: <AlertTriangle className="h-3 w-3" /> },
    not_fulfilled:      { label: t.nicht_erfuellt,     className: "bg-red-100 text-red-800 border-red-300",         icon: <XCircle className="h-3 w-3" /> },
    not_applicable:     { label: t.nicht_anwendbar,    className: "bg-slate-100 text-slate-600 border-slate-300",   icon: <Info className="h-3 w-3" /> },
    unclear:            { label: t.unklar,             className: "bg-purple-100 text-purple-700 border-purple-300",icon: <AlertCircle className="h-3 w-3" /> },
  };
  const cfg = map[status] ?? { label: status, className: "bg-slate-100 text-slate-700 border-slate-300", icon: null };
  return (
    <Badge variant="outline" className={`flex items-center gap-1 text-xs font-medium ${cfg.className}`}>
      {cfg.icon}{cfg.label}
    </Badge>
  );
}

// ─── Criticality badge ────────────────────────────────────────────────────────

function CriticalityBadge({ criticality, t }: { criticality: string; t: any }) {
  const map: Record<string, { label: string; className: string }> = {
    critical: { label: t.kritisch, className: "bg-red-600 text-white" },
    high:     { label: t.hoch,     className: "bg-orange-500 text-white" },
    medium:   { label: t.mittel,   className: "bg-amber-400 text-amber-900" },
    low:      { label: t.niedrig,  className: "bg-blue-100 text-blue-800" },
    info:     { label: t.info,     className: "bg-slate-100 text-slate-600" },
  };
  const cfg = map[criticality] ?? { label: criticality, className: "bg-slate-100 text-slate-600" };
  return <Badge className={`text-xs font-semibold ${cfg.className}`}>{cfg.label}</Badge>;
}

// ─── Jurisdiction badge ───────────────────────────────────────────────────────

function JurisdictionBadge({ jurisdiction, t }: { jurisdiction: string; t: any }) {
  const map: Record<string, string> = {
    eu: "bg-blue-100 text-blue-800",
    de: "bg-yellow-100 text-yellow-800",
    ch: "bg-red-100 text-red-800",
    international: "bg-slate-100 text-slate-700",
  };
  const labels: Record<string, string> = { eu: t.eu, de: t.de, ch: t.ch, international: t.international };
  return (
    <Badge variant="outline" className={`text-xs ${map[jurisdiction] ?? "bg-slate-100 text-slate-700"}`}>
      {labels[jurisdiction] ?? jurisdiction}
    </Badge>
  );
}

// ─── Check item card ──────────────────────────────────────────────────────────

function CheckItemCard({ item, t }: { item: SupplierCheckItem; t: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <CriticalityBadge criticality={item.criticality} t={t} />
            <JurisdictionBadge jurisdiction={item.jurisdiction} t={t} />
            <StatusBadge status={item.status} t={t} />
            <span className="text-xs font-mono text-muted-foreground">{item.regulationCode}</span>
          </div>
          <p className="text-sm font-medium text-foreground truncate">{item.regulationName}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.finding}</p>
        </div>
        <div className="shrink-0 text-muted-foreground mt-1">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t bg-muted/10 p-4 space-y-3 text-sm">
          {item.finding && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t.befund}</p>
              <p className="text-foreground">{item.finding}</p>
            </div>
          )}
          {item.evidence && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t.belege}</p>
              <p className="text-foreground italic">{item.evidence}</p>
            </div>
          )}
          {item.recommendation && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t.handlungsempfehlung}</p>
              <p className="text-foreground">{item.recommendation}</p>
            </div>
          )}
          {item.legalRisk && (
            <div className="rounded-md bg-orange-50 border border-orange-200 p-3">
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />{t.rechtliches_risiko_hersteller}
              </p>
              <p className="text-orange-800 text-xs">{item.legalRisk}</p>
            </div>
          )}
          {item.chRisk && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />{t.rechtliches_risiko_ch}
              </p>
              <p className="text-red-800 text-xs">{item.chRisk}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Check detail view ────────────────────────────────────────────────────────

function CheckDetailView({ checkId, supplierId, t, onBack }: { checkId: number; supplierId: number; t: any; onBack: () => void }) {
  const { data: check, isLoading } = trpc.supplierWebsiteCheck.getCheck.useQuery({ checkId });
  const [filterJurisdiction, setFilterJurisdiction] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCriticality, setFilterCriticality] = useState<string>("all");

  if (isLoading) return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t.pruefung_laeuft}</div>;
  if (!check) return null;

  const analysis = check.analysisResult as SupplierComplianceAnalysis | null;
  const items = check.items ?? [];

  const filtered = items.filter((item) => {
    if (filterJurisdiction !== "all" && item.jurisdiction !== filterJurisdiction) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterCriticality !== "all" && item.criticality !== filterCriticality) return false;
    return true;
  });

  const criticalCount = items.filter((i) => i.criticality === "critical").length;
  const highCount = items.filter((i) => i.criticality === "high").length;
  const notFulfilledCount = items.filter((i) => i.status === "not_fulfilled").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← {t.zurueck}
        </button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {t.analyse_vom} {new Date(check.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col items-center">
          <ScoreRing score={check.overallScore} label={t.gesamtbewertung} />
        </Card>
        <Card className="p-4 flex flex-col items-center">
          <ScoreRing score={check.euScore} label={t.eu_regulierungen} />
        </Card>
        <Card className="p-4 flex flex-col items-center">
          <ScoreRing score={check.deScore} label={t.de_regulierungen} />
        </Card>
        <Card className="p-4 flex flex-col items-center">
          <ScoreRing score={check.chScore} label={t.ch_risiko} />
        </Card>
      </div>

      {/* Alert summary */}
      {(criticalCount > 0 || highCount > 0 || notFulfilledCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              <strong>{criticalCount}</strong> {t.kritisch}
            </div>
          )}
          {highCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-sm text-orange-700">
              <AlertTriangle className="h-4 w-4" />
              <strong>{highCount}</strong> {t.hoch}
            </div>
          )}
          {notFulfilledCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <XCircle className="h-4 w-4" />
              <strong>{notFulfilledCount}</strong> {t.nicht_erfuellt}
            </div>
          )}
        </div>
      )}

      {/* Analysis summary */}
      {analysis && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t.analyse_zusammenfassung}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.productCategories && analysis.productCategories.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t.produktkategorien}</p>
                <div className="flex flex-wrap gap-1">
                  {analysis.productCategories.map((cat, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{cat}</Badge>
                  ))}
                </div>
              </div>
            )}
            {analysis.overallAssessment && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t.gesamtbewertung}</p>
                <p className="text-sm text-foreground">{analysis.overallAssessment}</p>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              {analysis.summaryDE && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">{t.hersteller_de_eu}</p>
                  <p className="text-xs text-blue-900">{analysis.summaryDE}</p>
                </div>
              )}
              {analysis.summaryEN && (
                <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs font-semibold text-slate-700 mb-1">{t.haendler_ch}</p>
                  <p className="text-xs text-slate-900">{analysis.summaryEN}</p>
                </div>
              )}
            </div>
            {analysis.criticalFindings && analysis.criticalFindings.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{t.kritische_befunde}
                </p>
                <ul className="space-y-1">
                  {analysis.criticalFindings.map((f, i) => (
                    <li key={i} className="text-xs text-red-700 flex items-start gap-1">
                      <span className="mt-0.5 shrink-0">•</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.positiveFindings && analysis.positiveFindings.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />{t.positive_befunde}
                </p>
                <ul className="space-y-1">
                  {analysis.positiveFindings.map((f, i) => (
                    <li key={i} className="text-xs text-emerald-700 flex items-start gap-1">
                      <span className="mt-0.5 shrink-0">✓</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground">{t.filter_jurisdiction}:</span>
        {["all", "eu", "de", "ch", "international"].map((j) => (
          <button
            key={j}
            onClick={() => setFilterJurisdiction(j)}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
              filterJurisdiction === j
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            {j === "all" ? t.alle_regulierungen : (t[j] ?? j)}
          </button>
        ))}
        <Separator orientation="vertical" className="h-4" />
        <span className="text-xs text-muted-foreground">{t.filter_status}:</span>
        {["all", "not_fulfilled", "partially_fulfilled", "unclear"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
              filterStatus === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            {s === "all" ? t.alle_regulierungen : (t[s.replace(/_/g, "_")] ?? s)}
          </button>
        ))}
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t.keine_pruefungen_vorhanden}</p>
        ) : (
          filtered.map((item) => <CheckItemCard key={item.id} item={item} t={t} />)
        )}
      </div>
    </div>
  );
}

// ─── Main tab component ───────────────────────────────────────────────────────

export function SupplierWebsiteCheckTab({ supplierId, supplierWebsite }: { supplierId: number; supplierWebsite?: string | null }) {
  const { t } = useLang();
  const utils = trpc.useUtils();

  const [websiteUrl, setWebsiteUrl] = useState(supplierWebsite ?? "");
  const [selectedCheckId, setSelectedCheckId] = useState<number | null>(null);

  const { data: checks, isLoading: checksLoading } = trpc.supplierWebsiteCheck.listChecks.useQuery({ supplierId });

  const triggerMutation = trpc.supplierWebsiteCheck.triggerCheck.useMutation({
    onSuccess: (result) => {
      toast.success(t.inline.website_pruefung_gestartet ?? "Compliance check started");
      utils.supplierWebsiteCheck.listChecks.invalidate({ supplierId });
      setSelectedCheckId(result.checkId);
    },
    onError: (err) => {
      toast.error(`${t.inline.pruefung_fehlgeschlagen}: ${err.message}`);
    },
  });

  const deleteMutation = trpc.supplierWebsiteCheck.deleteCheck.useMutation({
    onSuccess: () => {
      utils.supplierWebsiteCheck.listChecks.invalidate({ supplierId });
      if (selectedCheckId) setSelectedCheckId(null);
    },
  });

  const ti = t.inline;

  if (selectedCheckId) {
    return (
      <CheckDetailView
        checkId={selectedCheckId}
        supplierId={supplierId}
        t={ti}
        onBack={() => setSelectedCheckId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Trigger new check */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            {ti.neue_pruefung_starten}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="https://www.example.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => {
                if (!websiteUrl) return;
                triggerMutation.mutate({ supplierId, websiteUrl });
              }}
              disabled={triggerMutation.isPending || !websiteUrl}
              className="shrink-0"
            >
              {triggerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {ti.pruefung_laeuft}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {ti.website_pruefung_starten}
                </>
              )}
            </Button>
          </div>
          {triggerMutation.isPending && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {ti.analyse_laeuft_bitte_warten}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Previous checks list */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{ti.website_compliance_check}</h3>
        {checksLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            {ti.pruefung_laeuft}
          </div>
        ) : !checks || checks.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
            <Globe className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-muted-foreground">{ti.keine_pruefungen_vorhanden}</p>
            <p className="text-xs text-muted-foreground">{ti.pruefung_starten_hinweis}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {checks.map((check) => (
              <div
                key={check.id}
                className="rounded-lg border p-4 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckStatusIcon status={check.status} />
                      <a
                        href={check.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline flex items-center gap-1 truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {check.websiteUrl}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{new Date(check.createdAt).toLocaleDateString()}</span>
                      {check.overallScore != null && (
                        <span className="flex items-center gap-1">
                          {ti.score_label}: <strong className={check.overallScore >= 75 ? "text-emerald-600" : check.overallScore >= 50 ? "text-amber-600" : "text-red-600"}>{check.overallScore}</strong>/100
                        </span>
                      )}
                      {check.euScore != null && <span>EU: {check.euScore}</span>}
                      {check.deScore != null && <span>DE: {check.deScore}</span>}
                      {check.chScore != null && <span>CH: {check.chScore}</span>}
                    </div>
                    {check.status === "failed" && check.errorMessage && (
                      <p className="text-xs text-red-600 mt-1">{check.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {check.status === "completed" && (
                      <Button variant="outline" size="sm" onClick={() => setSelectedCheckId(check.id)}>
                        {ti.uebersicht}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm(ti.pruefung_loeschen_bestaetigen)) {
                          deleteMutation.mutate({ checkId: check.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckStatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
}
