/**
 * AiAnalysisCard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Two-section AI analysis view:
 *  1. Document Analysis  – per-document EU/CH legal compliance check
 *  2. Risk Assessment    – overall product risk with findings and recommendations
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  FileSearch,
  FileText,
  Info,
  Mail,
  RefreshCw,
  Scale,
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
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle
          cx="50" cy="50" r={radius} fill="none" strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className={c.stroke}
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

function CategoryBar({ label, score, icon: Icon, reason }: { label: string; score: number; icon: any; reason?: string | null }) {
  const c = scoreColor(score);
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`font-semibold text-xs ${c.text}`}>{score}%</span>
          {reason && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Why this score?"
            >
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${score}%` }} />
      </div>
      {reason && open && (
        <p className={`text-xs leading-relaxed rounded-md px-2.5 py-2 mt-1 border ${c.bg} ${c.border} ${c.text}`}>
          {reason}
        </p>
      )}
    </div>
  );
}

function findingIcon(type: string) {
  switch (type) {
    case "critical": return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "positive": return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
    default: return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
  }
}

function findingBadgeClass(type: string) {
  switch (type) {
    case "critical": return "text-red-700 bg-red-50 border-red-200";
    case "warning": return "text-amber-700 bg-amber-50 border-amber-200";
    case "positive": return "text-emerald-700 bg-emerald-50 border-emerald-200";
    default: return "text-blue-700 bg-blue-50 border-blue-200";
  }
}

function docStatusBadge(status: string) {
  switch (status) {
    case "ok":
      return (
        <Badge variant="outline" className="text-xs text-emerald-700 bg-emerald-50 border-emerald-200">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
        </Badge>
      );
    case "warning":
      return (
        <Badge variant="outline" className="text-xs text-amber-700 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-3 w-3 mr-1" /> Incomplete
        </Badge>
      );
    case "critical":
      return (
        <Badge variant="outline" className="text-xs text-red-700 bg-red-50 border-red-200">
          <XCircle className="h-3 w-3 mr-1" /> Non-Compliant
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

// ─── Email Template Dialog ────────────────────────────────────────────────────

function EmailTemplateDialog({
  open,
  onClose,
  subject,
  body,
  title,
}: {
  open: boolean;
  onClose: () => void;
  subject: string;
  body: string;
  title: string;
}) {
  const fullText = `Subject: ${subject}\n\n${body}`;

  function copyToClipboard() {
    navigator.clipboard.writeText(fullText).then(() => {
      toast.success("Email template copied to clipboard");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden flex flex-col gap-3 min-h-0">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="font-medium text-muted-foreground">Subject: </span>
            <span>{subject}</span>
          </div>
          <Textarea
            className="flex-1 min-h-[300px] font-mono text-xs resize-none"
            value={body}
            readOnly
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" onClick={copyToClipboard} className="gap-2">
              <Copy className="h-3.5 w-3.5" />
              Copy to Clipboard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Document Analysis Section ────────────────────────────────────────────────

function DocumentAnalysisSection({ documentAnalysis }: { documentAnalysis: any[] }) {
  const [emailDialog, setEmailDialog] = useState<{
    open: boolean;
    subject: string;
    body: string;
    docName: string;
  }>({ open: false, subject: "", body: "", docName: "" });

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
    <>
      {/* Info banner about review status */}
      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          <strong>Note:</strong> The document status shown here (e.g. "pending") is our{" "}
          <strong>internal review workflow status</strong> – it does not reflect the legal validity
          of the document. The AI analysis below evaluates each document against EU/Swiss legal
          requirements independently of the review status.
        </span>
      </div>

      <div className="space-y-4">
        {documentAnalysis.map((doc: any, i: number) => {
          const c = scoreColor(doc.score ?? 0);
          const hasEmail = !!doc.emailTemplate;
          const hasIssues = (doc.issues?.length ?? 0) > 0;
          const hasMissing = (doc.missingElements?.length ?? 0) > 0;

          return (
            <Card key={i} className={`border ${c.border}`}>
              <CardContent className="pt-4 pb-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{doc.fileName || "–"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {doc.documentType?.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {docStatusBadge(doc.status)}
                    <span className={`text-sm font-bold ${c.text}`}>{doc.score ?? 0}/100</span>
                    {hasEmail && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={() =>
                          setEmailDialog({
                            open: true,
                            subject: `Compliance Documentation Request – ${doc.fileName}`,
                            body: doc.emailTemplate,
                            docName: doc.fileName,
                          })
                        }
                      >
                        <Mail className="h-3 w-3" />
                        Email Template
                      </Button>
                    )}
                  </div>
                </div>

                {/* Score bar */}
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                    style={{ width: `${doc.score ?? 0}%` }}
                  />
                </div>

                {/* Legal basis */}
                {doc.legalBasis && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Scale className="h-3.5 w-3.5 shrink-0" />
                    <span className="italic">{doc.legalBasis}</span>
                  </div>
                )}

                {/* Positives */}
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

                {/* Missing mandatory elements */}
                {hasMissing && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" />
                      Missing mandatory elements:
                    </p>
                    <ul className="space-y-1">
                      {doc.missingElements.map((el: string, j: number) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded px-2 py-1">
                          <span className="shrink-0 font-bold">–</span>
                          {el}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Issues */}
                {hasIssues && (
                  <ul className="mt-2 space-y-1">
                    {doc.issues.map((issue: string, j: number) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-amber-700">
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

      {/* Email template dialog (per-document) */}
      <EmailTemplateDialog
        open={emailDialog.open}
        onClose={() => setEmailDialog((s) => ({ ...s, open: false }))}
        subject={emailDialog.subject}
        body={emailDialog.body}
        title={`Email Template – ${emailDialog.docName}`}
      />
    </>
  );
}

// ─── Risk Assessment Section ──────────────────────────────────────────────────

function FindingCard({ f, index, productName, productArticleNumber }: { f: any; index: number; productName?: string; productArticleNumber?: string }) {
  const [open, setOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const hasDetail = !!(f.detail || (f.affectedRegulations?.length > 0) || f.remediation || f.regulatoryQuotes?.length > 0);

  // Build a per-finding email template
  const buildFindingEmail = () => {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const regList = (f.affectedRegulations as string[] ?? []).map((r: string) => `  – ${r}`).join("\n");
    const quotesSection = (f.regulatoryQuotes as any[] ?? []).length > 0
      ? `\nLegal basis:\n${(f.regulatoryQuotes as any[]).map((q: any) => `  ${q.source} ${q.article}:\n  "${q.quote}"`).join("\n\n")}`
      : "";
    const remediationSection = f.remediation ? `\nRequested action:\n${f.remediation}` : "";
    return `Date: ${today}\n\nDear Sir or Madam,\n\nWe are writing regarding the compliance documentation for the following product:\n\nProduct: ${productName ?? "–"}\nArticle Number: ${productArticleNumber ?? "–"}\n\nDuring our compliance review, we identified the following issue that requires your attention:\n\nFinding: ${f.message}\n\n${f.detail ?? ""}\n\nAffected regulations:\n${regList}${quotesSection}${remediationSection}\n\nWe kindly request that you provide updated or corrected documentation addressing the above point at your earliest convenience.\n\nKind regards,\n\n[Your Name]\n[Your Position]\nspielezeug3 AG\n[Contact Details]`;
  };

  return (
    <div
      className={`rounded-lg border text-sm transition-colors ${
        f.type === "critical"
          ? "border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20"
          : f.type === "warning"
          ? "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20"
          : f.type === "positive"
          ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/10"
          : "border-border bg-muted/30"
      }`}
    >
      {/* Header row – always visible */}
      <button
        type="button"
        className="w-full flex items-start gap-2.5 p-3 text-left"
        onClick={() => hasDetail && setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="mt-0.5 shrink-0">{findingIcon(f.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Badge variant="outline" className={`text-xs px-1.5 py-0 ${findingBadgeClass(f.type)}`}>
              {f.type === "critical" ? "Critical" : f.type === "warning" ? "Warning" : f.type === "positive" ? "Positive" : f.type}
            </Badge>
          </div>
          <p className="text-muted-foreground leading-snug">{f.message}</p>
        </div>
        {hasDetail && (
          <span className="shrink-0 mt-0.5 text-muted-foreground">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </button>

      {/* Expanded detail panel */}
      {open && hasDetail && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {f.detail && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Details</p>
              <p className="text-sm text-foreground leading-relaxed">{f.detail}</p>
            </div>
          )}
          {f.affectedRegulations?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Affected Regulations</p>
              <div className="flex flex-wrap gap-1.5">
                {(f.affectedRegulations as string[]).map((reg: string, ri: number) => (
                  <span
                    key={ri}
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-background text-foreground"
                  >
                    <Scale className="h-3 w-3 mr-1 text-muted-foreground" />
                    {reg}
                  </span>
                ))}
              </div>
            </div>
          )}
          {f.remediation && (
            <div className={`rounded-md border p-3 ${
              f.type === "positive"
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                f.type === "positive" ? "text-emerald-700" : "text-blue-700"
              }`}>
                {f.type === "positive" ? "Why this is good" : "How to resolve"}
              </p>
              <p className={`text-sm leading-relaxed ${
                f.type === "positive" ? "text-emerald-800 dark:text-emerald-300" : "text-blue-800 dark:text-blue-300"
              }`}>{f.remediation}</p>
            </div>
          )}

          {/* Regulatory Quotes */}
          {(f.regulatoryQuotes as any[] ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Legal Basis</p>
              <div className="space-y-2">
                {(f.regulatoryQuotes as any[]).map((q: any, qi: number) => (
                  <blockquote key={qi} className="border-l-2 border-amber-400 pl-3 py-1 bg-amber-50/50 dark:bg-amber-950/20 rounded-r-md">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">
                      {q.source} – {q.article}
                    </p>
                    <p className="text-xs text-muted-foreground italic leading-relaxed">&ldquo;{q.quote}&rdquo;</p>
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {/* Per-finding email request button (only for non-positive findings) */}
          {f.type !== "positive" && (
            <div className="pt-1">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-7"
                onClick={() => setEmailOpen(true)}
              >
                <Mail className="h-3.5 w-3.5" />
                Request from Manufacturer
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Per-finding email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Email Template – {f.message}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Pre-filled email template for requesting corrected documentation from the manufacturer. Edit as needed before sending.</p>
            <Textarea
              className="font-mono text-xs min-h-[340px] resize-y"
              value={buildFindingEmail()}
              readOnly
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  navigator.clipboard.writeText(buildFindingEmail());
                  setEmailCopied(true);
                  setTimeout(() => setEmailCopied(false), 2000);
                  toast.success("Email template copied to clipboard");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                {emailCopied ? "Copied!" : "Copy"}
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  const body = encodeURIComponent(buildFindingEmail());
                  const subject = encodeURIComponent(`Compliance Documentation Request – ${productName ?? "Product"}: ${f.message}`);
                  window.open(`mailto:?subject=${subject}&body=${body}`);
                }}
              >
                <Mail className="h-3.5 w-3.5" />
                Open in Email Client
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RiskAssessmentSection({ analysis, productName, productArticleNumber }: { analysis: any; productName?: string; productArticleNumber?: string }) {
  const { lang } = useLang();
  const needsTranslation = lang !== "en" && !!analysis?.id;

  const translationQuery = trpc.translate.aiAnalysis.useQuery(
    { analysisId: analysis?.id ?? 0, targetLang: lang as any },
    { enabled: needsTranslation }
  );

  // Use translated data if available, otherwise fall back to original
  const translated = needsTranslation ? translationQuery.data : null;
  const isTranslating = needsTranslation && translationQuery.isLoading;

  const overall = Number(analysis.overallScore ?? 0);
  const docScore = Number(analysis.documentCompletenessScore ?? 0);
  const contentScore = Number(analysis.contentPlausibilityScore ?? 0);
  const formalScore = Number(analysis.formalCorrectnessScore ?? 0);
  const consistencyScore = Number(analysis.consistencyScore ?? 0);
  const findings = (translated?.findings ?? analysis.findings as any[] | null) ?? [];
  const recommendations = (translated?.recommendations ?? analysis.recommendations as string[] | null) ?? [];
  const summary = translated?.summary ?? analysis.summary;
  const overallColor = scoreColor(overall);
  const rawScoreReasons = (translated?.scoreReasons ?? (analysis as any).scoreReasons) as {
    documentCompletenessReason?: string | null;
    contentPlausibilityReason?: string | null;
    formalCorrectnessReason?: string | null;
    consistencyReason?: string | null;
    // legacy field names
    documentCompleteness?: string | null;
    contentPlausibility?: string | null;
    formalCorrectness?: string | null;
    consistency?: string | null;
  } | null;
  const scoreReasons = rawScoreReasons ? {
    documentCompleteness: rawScoreReasons.documentCompletenessReason ?? rawScoreReasons.documentCompleteness,
    contentPlausibility: rawScoreReasons.contentPlausibilityReason ?? rawScoreReasons.contentPlausibility,
    formalCorrectness: rawScoreReasons.formalCorrectnessReason ?? rawScoreReasons.formalCorrectness,
    consistency: rawScoreReasons.consistencyReason ?? rawScoreReasons.consistency,
  } : null;

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
          {isTranslating && (
            <div className="rounded-lg p-3 text-sm bg-muted/50 border border-border flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>Translating analysis to German…</span>
            </div>
          )}
          {summary && !isTranslating && (
            <div className={`rounded-lg p-3 text-sm ${overallColor.bg} ${overallColor.border} border`}>
              <p className={overallColor.text}>{summary}</p>
              {translated && (
                <p className="text-xs mt-1.5 opacity-60 flex items-center gap-1">
                  🌐 Translated from English
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CategoryBar label="Document Completeness" score={docScore} icon={FileText} reason={scoreReasons?.documentCompleteness} />
            <CategoryBar label="Content Plausibility" score={contentScore} icon={CheckCircle2} reason={scoreReasons?.contentPlausibility} />
            <CategoryBar label="Formal Correctness" score={formalScore} icon={Info} reason={scoreReasons?.formalCorrectness} />
            <CategoryBar label="Consistency" score={consistencyScore} icon={Sparkles} reason={scoreReasons?.consistency} />
          </div>
        </div>
      </div>

      {findings.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Findings ({findings.length})</p>
              {findings.some((f: any) => f.detail || f.affectedRegulations?.length > 0 || f.remediation) && (
                <p className="text-xs text-muted-foreground">Click a finding to expand details</p>
              )}
            </div>
            <div className="space-y-2">
              {findings.map((f: any, i: number) => (
                <FindingCard key={i} f={f} index={i} productName={productName} productArticleNumber={productArticleNumber} />
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
  supplierEmail?: string;
  supplierName?: string;
  productName?: string;
  productArticleNumber?: string;
}

export function AiAnalysisCard({ productId, canTrigger = false, supplierEmail, supplierName, productName, productArticleNumber }: AiAnalysisCardProps) {
  const { lang } = useLang();
  const [showHistory, setShowHistory] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [combinedEmailOpen, setCombinedEmailOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");

  const sendEmailMutation = trpc.email.sendManufacturerEmail.useMutation({
    onSuccess: () => {
      toast.success("Email sent successfully to manufacturer");
      setSendDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to send email"),
  });

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
  const historyQuery = trpc.aiAnalysis.getHistory.useQuery({ productId }, { enabled: showHistory });
  const apiKeyStatusQuery = trpc.aiAnalysis.getApiKeyStatus.useQuery();
  const aiConfigured = apiKeyStatusQuery.data?.configured ?? false;
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
              Checks each document against EU/Swiss legal requirements and performs an overall risk assessment.
            </p>
          </div>
          {!aiConfigured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2 max-w-md text-left">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>No AI provider configured. Please add your API key under <strong>Settings → AI Analysis</strong> to enable AI features.</span>
            </div>
          )}
          {canTrigger && (
            <Button
              onClick={() => analyzeMutation.mutate({ productId })}
              disabled={isRunning || !aiConfigured}
              className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white disabled:opacity-50"
            >
              {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isRunning ? "Analysing..." : "Start AI Analysis"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const documentAnalysis = (analysis.documentAnalysis as any[] | null) ?? [];
  const emailTemplate = analysis.emailTemplate as { subject: string; body: string } | null;
  const hasEmailTemplate = !!emailTemplate?.body;

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
              {hasEmailTemplate && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCombinedEmailOpen(true)}
                    className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <Mail className="h-3 w-3" />
                    Preview Email
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSendTo(supplierEmail ?? "");
                      setSendSubject(emailTemplate!.subject);
                      setSendBody(emailTemplate!.body);
                      setSendDialogOpen(true);
                    }}
                    className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Mail className="h-3 w-3" />
                    Send to Manufacturer
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadPdf()}
                disabled={isDownloading}
                className="h-7 text-xs gap-1"
              >
                {isDownloading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Export PDF
              </Button>
              {canTrigger && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!aiConfigured) {
                      toast.error("No AI provider configured. Please add your API key under Settings → AI Analysis.");
                      return;
                    }
                    analyzeMutation.mutate({ productId });
                  }}
                  disabled={isRunning}
                  title={!aiConfigured ? "No AI provider configured" : undefined}
                  className={`h-7 text-xs gap-1 ${!aiConfigured ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isRunning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
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
              <RiskAssessmentSection analysis={analysis} productName={productName} productArticleNumber={productArticleNumber} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Combined email template dialog */}
      {hasEmailTemplate && (
        <EmailTemplateDialog
          open={combinedEmailOpen}
          onClose={() => setCombinedEmailOpen(false)}
          subject={emailTemplate!.subject}
          body={emailTemplate!.body}
          title="Email Template – All Issues"
        />
      )}

      {/* Send Email Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              Send Email to Manufacturer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Recipient */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Recipient</label>
              <input
                type="email"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="manufacturer@example.com"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {supplierEmail && sendTo !== supplierEmail && (
                <button
                  type="button"
                  onClick={() => setSendTo(supplierEmail)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Use supplier email: {supplierEmail}
                </button>
              )}
              {!supplierEmail && (
                <p className="text-xs text-amber-600">
                  No supplier email on file. Please enter the recipient address manually.
                </p>
              )}
            </div>
            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Subject</label>
              <input
                type="text"
                value={sendSubject}
                onChange={(e) => setSendSubject(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {/* Body preview */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email Body (HTML)</label>
              <div className="rounded-md border bg-white p-3 text-sm max-h-64 overflow-y-auto" dangerouslySetInnerHTML={{ __html: sendBody }} />
            </div>
            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!sendTo) { toast.error("Please enter a recipient email address."); return; }
                  sendEmailMutation.mutate({ productId, to: sendTo, subject: sendSubject, htmlBody: sendBody });
                }}
                disabled={sendEmailMutation.isPending}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {sendEmailMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1 text-muted-foreground"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Analysis history ({showHistory ? "hide" : "show"})
        </Button>

        {showHistory && (
          <div className="mt-2 space-y-2">
            {historyQuery.isLoading ? (
              <p className="text-xs text-muted-foreground px-2">Loading history...</p>
            ) : (historyQuery.data?.length ?? 0) <= 1 ? (
              <p className="text-xs text-muted-foreground px-2">No previous analyses available.</p>
            ) : (
              historyQuery.data?.slice(1).map((h: any) => {
                const s = Number(h.overallScore ?? 0);
                const c = scoreColor(s);
                return (
                  <div key={h.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(h.createdAt).toLocaleString("en-GB")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-xs ${c.text}`}>{s}%</span>
                      <Badge variant="outline" className="text-xs">{h.modelUsed ?? "built-in"}</Badge>
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
