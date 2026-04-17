/**
 * client/src/components/AiValidationPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays the structured GPT-4o validation result for a Declaration of
 * Conformity. Shows a summary, a detailed checklist of all 11 checks, and
 * a list of issues found.
 */
import { CheckCircle2, XCircle, AlertCircle, Bot, Clock } from "lucide-react";

interface AiValidationResult {
  is_signed?: boolean;
  signatory_name_present?: boolean;
  signatory_position_present?: boolean;
  issue_date_present?: boolean;
  product_name_matches?: boolean;
  article_number_present?: boolean;
  directives_complete?: boolean;
  ch_regulations_present?: boolean;
  standards_complete?: boolean;
  age_grading_mentioned?: boolean;
  notified_body_referenced?: boolean;
  passed?: boolean;
  summary?: string;
  issues?: string[];
}

interface Props {
  result: AiValidationResult;
  summary?: string | null;
  passed?: boolean | null;
  validatedAt?: string | number | null;
  lang: "de" | "en";
}

const CHECKS: {
  key: keyof AiValidationResult;
  de: string;
  en: string;
  critical?: boolean;
}[] = [
  { key: "is_signed",                de: "Dokument unterzeichnet",             en: "Document signed",                    critical: true },
  { key: "signatory_name_present",   de: "Unterzeichner-Name vorhanden",        en: "Signatory name present",              critical: true },
  { key: "signatory_position_present",de: "Unterzeichner-Position vorhanden",   en: "Signatory position present" },
  { key: "issue_date_present",       de: "Ausstellungsdatum vorhanden",         en: "Issue date present" },
  { key: "product_name_matches",     de: "Produktname stimmt überein",          en: "Product name matches",                critical: true },
  { key: "article_number_present",   de: "Artikelnummer vorhanden",             en: "Article number present" },
  { key: "directives_complete",      de: "EU-Richtlinien vollständig",          en: "EU directives complete",              critical: true },
  { key: "ch_regulations_present",   de: "CH-Vorschriften vorhanden",           en: "CH regulations present" },
  { key: "standards_complete",       de: "Normen vollständig",                  en: "Standards complete",                  critical: true },
  { key: "age_grading_mentioned",    de: "Altersempfehlung angegeben",          en: "Age grading mentioned" },
  { key: "notified_body_referenced", de: "Notifizierte Stelle referenziert",    en: "Notified body referenced" },
];

export default function AiValidationPanel({ result, summary, passed, validatedAt, lang }: Props) {
  const overallPassed = passed ?? result.passed ?? false;

  return (
    <div className={`rounded-lg border text-sm overflow-hidden ${
      overallPassed
        ? "border-green-200 dark:border-green-800"
        : "border-amber-200 dark:border-amber-800"
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${
        overallPassed
          ? "bg-green-50 dark:bg-green-900/30"
          : "bg-amber-50 dark:bg-amber-900/30"
      }`}>
        <div className="flex items-center gap-2 font-medium">
          <Bot className="h-4 w-4" />
          {lang === "de" ? "KI-Validierungsergebnis" : "AI Validation Result"}
        </div>
        <div className="flex items-center gap-2">
          {overallPassed ? (
            <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              {lang === "de" ? "Bestanden" : "Passed"}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
              <AlertCircle className="h-4 w-4" />
              {lang === "de" ? "Probleme gefunden" : "Issues found"}
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      {(summary || result.summary) && (
        <div className="px-4 py-3 border-b border-border/50 text-muted-foreground leading-relaxed">
          {summary || result.summary}
        </div>
      )}

      {/* Checklist */}
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {CHECKS.map(({ key, de, en, critical }) => {
          const value = result[key];
          const isTrue = value === true;
          const isFalse = value === false;
          const isUnknown = value === undefined || value === null;

          return (
            <div
              key={key}
              className={`flex items-center gap-2 px-2 py-1.5 rounded ${
                isTrue
                  ? "text-green-700 dark:text-green-400"
                  : isFalse
                  ? critical
                    ? "text-red-700 dark:text-red-400 font-medium"
                    : "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground"
              }`}
            >
              {isTrue ? (
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
              ) : isFalse ? (
                <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full border border-current opacity-40" />
              )}
              <span className="text-xs">
                {lang === "de" ? de : en}
                {critical && !isTrue && isFalse && (
                  <span className="ml-1 text-xs opacity-70">
                    {lang === "de" ? "(kritisch)" : "(critical)"}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Issues list */}
      {result.issues && result.issues.length > 0 && (
        <div className="px-4 pb-3 pt-1 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {lang === "de" ? "Gefundene Probleme" : "Issues found"}
          </p>
          <ul className="space-y-1.5">
            {result.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timestamp */}
      {validatedAt && (
        <div className="px-4 py-2 border-t border-border/50 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {lang === "de" ? "Validiert am" : "Validated at"}:{" "}
          {new Date(validatedAt).toLocaleString(lang === "de" ? "de-CH" : "en-GB")}
        </div>
      )}
    </div>
  );
}
