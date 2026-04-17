import PDFDocument from "pdfkit";

// ─── i18n strings ─────────────────────────────────────────────────────────────
const PDF_I18N = {
  de: {
    title: "KI-Plausibilitätsprüfung",
    subtitle: "spielzeug3 AG · Supplier Compliance Portal",
    createdAt: (date: string) => `Erstellt am ${date}`,
    reportId: (id: number) => `Bericht #${id}`,
    productInfo: "Produktinformationen",
    labels: {
      productName: "Produktname",
      internalArticleNumber: "Interne Artikelnummer",
      supplierArticleNumber: "Lieferanten-Artikelnummer",
      ean: "EAN",
      brand: "Marke",
      supplier: "Lieferant",
      status: "Status",
    },
    overallDesc: "Gesamtbewertung der Dokumentenplausibilität",
    model: (m: string, tokens: string) => `Modell: ${m}${tokens ? ` · ${tokens} Tokens` : ""}`,
    summary: "Zusammenfassung",
    categoryScores: "Kategorie-Bewertungen",
    categories: {
      docCompleteness: "Dokumentenvollständigkeit",
      contentPlausibility: "Inhaltliche Plausibilität",
      formalCorrectness: "Formale Korrektheit",
      consistency: "Konsistenz",
    },
    findings: (n: number) => `Befunde (${n})`,
    findingFallback: (i: number) => `Befund ${i + 1}`,
    recommendations: "Empfehlungen",
    documentAnalysisTitle: (n: number) => `Dokument-Analysen (${n})`,
    tocTitle: "Inhaltsverzeichnis",
    tocDocuments: "Dokument-Analysen",
    tocColumns: { num: "Nr.", name: "Dokumentname", type: "Typ", score: "Score", status: "Status", page: "Seite" },
    docStatus: {
      compliant: "Konform",
      partial: "Teilweise konform",
      critical: "Nicht konform",
      pending: "Ausstehend",
    },
    docLabels: {
      legalBasis: "Rechtsgrundlage",
      positives: "Positive Punkte",
      missingElements: "Fehlende Pflichtangaben",
      issues: "Hinweise",
    },
    footer: (id: number, page: number, total: number) =>
      `spielzeug3 AG · Supplier Compliance Portal · Bericht #${id} · Seite ${page} von ${total}`,
    scoreLabels: {
      plausible: "Plausibel",
      partial: "Teilweise plausibel",
      critical: "Kritisch",
    },
    severityLabels: {
      high: "Kritisch",
      medium: "Mittel",
      low: "Gering",
      info: "Info",
      critical: "Kritisch",
      warning: "Warnung",
      positive: "OK",
    },
  },
  en: {
    title: "AI Plausibility Check",
    subtitle: "spielzeug3 AG · Supplier Compliance Portal",
    createdAt: (date: string) => `Created on ${date}`,
    reportId: (id: number) => `Report #${id}`,
    productInfo: "Product Information",
    labels: {
      productName: "Product Name",
      internalArticleNumber: "Internal Article Number",
      supplierArticleNumber: "Supplier Article Number",
      ean: "EAN",
      brand: "Brand",
      supplier: "Supplier",
      status: "Status",
    },
    overallDesc: "Overall document plausibility assessment",
    model: (m: string, tokens: string) => `Model: ${m}${tokens ? ` · ${tokens} tokens` : ""}`,
    summary: "Summary",
    categoryScores: "Category Scores",
    categories: {
      docCompleteness: "Document Completeness",
      contentPlausibility: "Content Plausibility",
      formalCorrectness: "Formal Correctness",
      consistency: "Consistency",
    },
    findings: (n: number) => `Findings (${n})`,
    findingFallback: (i: number) => `Finding ${i + 1}`,
    recommendations: "Recommendations",
    documentAnalysisTitle: (n: number) => `Document Analyses (${n})`,
    tocTitle: "Table of Contents",
    tocDocuments: "Document Analyses",
    tocColumns: { num: "No.", name: "Document Name", type: "Type", score: "Score", status: "Status", page: "Page" },
    docStatus: {
      compliant: "Compliant",
      partial: "Partially Compliant",
      critical: "Non-Compliant",
      pending: "Pending",
    },
    docLabels: {
      legalBasis: "Legal Basis",
      positives: "Positive Points",
      missingElements: "Missing Mandatory Elements",
      issues: "Issues",
    },
    footer: (id: number, page: number, total: number) =>
      `spielzeug3 AG · Supplier Compliance Portal · Report #${id} · Page ${page} of ${total}`,
    scoreLabels: {
      plausible: "Plausible",
      partial: "Partially plausible",
      critical: "Critical",
    },
    severityLabels: {
      high: "Critical",
      medium: "Medium",
      low: "Low",
      info: "Info",
      critical: "Critical",
      warning: "Warning",
      positive: "OK",
    },
  },
} as const;

type PdfLang = "de" | "en";

// ─── Color palette ────────────────────────────────────────────────────────────
const COLORS = {
  primary: "#1e3a5f",       // Deep navy
  accent: "#2563eb",        // Blue
  success: "#16a34a",       // Green
  warning: "#d97706",       // Amber
  danger: "#dc2626",        // Red
  muted: "#6b7280",         // Gray
  border: "#e5e7eb",        // Light gray
  bgLight: "#f8fafc",       // Near-white
  white: "#ffffff",
  text: "#111827",
  textSecondary: "#374151",
};

function scoreColor(score: number): string {
  if (score >= 75) return COLORS.success;
  if (score >= 50) return COLORS.warning;
  return COLORS.danger;
}

function scoreLabel(score: number, lang: PdfLang): string {
  const labels = PDF_I18N[lang].scoreLabels;
  if (score >= 75) return labels.plausible;
  if (score >= 50) return labels.partial;
  return labels.critical;
}

/**
 * Normalise a finding to a canonical { severity, category, description, remediation, affectedRegulations }.
 * Supports both the old format (severity/category/description) and the current LLM format
 * (type/message/detail/remediation/affectedRegulations).
 */
function normaliseFinding(f: any): {
  severity: string;
  category: string;
  description: string;
  remediation: string | null;
  affectedRegulations: string[];
} {
  // Map LLM "type" to canonical severity
  const rawSeverity: string = f.severity ?? f.type ?? "info";
  let severity: string;
  switch (rawSeverity) {
    case "critical": severity = "high"; break;
    case "warning":  severity = "medium"; break;
    case "positive": severity = "low"; break;
    default:         severity = rawSeverity; // high / medium / low / info
  }
  return {
    severity,
    category: f.category ?? f.message ?? "",
    description: f.description ?? f.detail ?? "",
    remediation: f.remediation ?? null,
    affectedRegulations: Array.isArray(f.affectedRegulations) ? f.affectedRegulations : [],
  };
}

function severityColor(severity: string): string {
  switch (severity) {
    case "high": return COLORS.danger;
    case "medium": return COLORS.warning;
    case "low": return COLORS.accent;
    default: return COLORS.success;
  }
}

function severityLabel(severity: string, lang: PdfLang): string {
  const labels = PDF_I18N[lang].severityLabels;
  return (labels as Record<string, string>)[severity] ?? severity;
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
function drawHorizontalLine(doc: PDFKit.PDFDocument, y: number, color = COLORS.border) {
  doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(color).lineWidth(0.5).stroke();
}

function drawFilledRect(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number, h: number,
  fillColor: string, radius = 4
) {
  doc.roundedRect(x, y, w, h, radius).fillColor(fillColor).fill();
}

function drawProgressBar(
  doc: PDFKit.PDFDocument,
  x: number, y: number, width: number, score: number, label: string
) {
  const barH = 8;
  const filled = (score / 100) * width;
  const color = scoreColor(score);

  // Label + score
  doc.fontSize(9).fillColor(COLORS.textSecondary).text(label, x, y, { width: width - 40 });
  doc.fontSize(9).fillColor(color).text(`${score}%`, x + width - 35, y, { width: 35, align: "right" });

  const barY = y + 14;
  // Background track
  drawFilledRect(doc, x, barY, width, barH, COLORS.border, 4);
  // Filled portion
  if (filled > 0) {
    drawFilledRect(doc, x, barY, Math.max(filled, 8), barH, color, 4);
  }
  return barY + barH + 6;
}

// ─── Main generator ───────────────────────────────────────────────────────────
export interface PdfReportData {
  product: {
    productName: string;
    internalArticleNumber?: string | null;
    supplierArticleNumber?: string | null;
    ean?: string | null;
    brand?: string | null;
    status: string;
    supplierName?: string | null;
  };
  analysis: {
    id: number;
    overallScore: string | number;
    documentCompletenessScore?: string | number | null;
    contentPlausibilityScore?: string | number | null;
    formalCorrectnessScore?: string | number | null;
    consistencyScore?: string | number | null;
    summary?: string | null;
    findings?: any;
    recommendations?: any;
    documentAnalysis?: any; // per-document analysis array
    modelUsed?: string | null;
    tokensUsed?: number | null;
    createdAt: Date;
    triggeredByUserName?: string | null;
  };
  lang?: PdfLang;
}

export function generateAiAnalysisPdf(data: PdfReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { product, analysis } = data;
    const lang: PdfLang = data.lang ?? "de";
    const i18n = PDF_I18N[lang];
    const locale = lang === "de" ? "de-DE" : "en-GB";

    const overall = Math.round(Number(analysis.overallScore ?? 0));
    const docScore = Math.round(Number(analysis.documentCompletenessScore ?? 0));
    const contentScore = Math.round(Number(analysis.contentPlausibilityScore ?? 0));
    const formalScore = Math.round(Number(analysis.formalCorrectnessScore ?? 0));
    const consistencyScore = Math.round(Number(analysis.consistencyScore ?? 0));
    // Normalise findings: support both old (severity/category/description) and
    // new LLM format (type/message/detail/remediation/affectedRegulations)
    const findings = (Array.isArray(analysis.findings) ? analysis.findings : []).map(normaliseFinding);
    const recommendations: string[] =
      Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
    const pageW = doc.page.width - 100; // usable width (50 margin each side)

    // ── HEADER BANNER ──────────────────────────────────────────────────────────
    drawFilledRect(doc, 0, 0, doc.page.width, 90, COLORS.primary, 0);

    doc.fontSize(18).fillColor(COLORS.white)
      .text(i18n.title, 50, 22, { width: pageW - 120 });
    doc.fontSize(10).fillColor("#93c5fd")
      .text(i18n.subtitle, 50, 46);
    doc.fontSize(8).fillColor("#bfdbfe")
      .text(i18n.createdAt(new Date(analysis.createdAt).toLocaleString(locale)), 50, 62);

    // Report ID badge (top right)
    doc.fontSize(8).fillColor("#bfdbfe")
      .text(i18n.reportId(analysis.id), doc.page.width - 150, 36, { width: 100, align: "right" });

    doc.y = 110;

    // ── PRODUCT INFO ─────────────────────────────────────────────────────
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold")
      .text(i18n.productInfo, 50, doc.y);
    doc.moveDown(0.4);
    drawHorizontalLine(doc, doc.y);
    doc.moveDown(0.5);

    const infoRows = [
      [i18n.labels.productName, product.productName],
      [i18n.labels.internalArticleNumber, product.internalArticleNumber ?? "–"],
      [i18n.labels.supplierArticleNumber, product.supplierArticleNumber ?? "–"],
      [i18n.labels.ean, product.ean ?? "–"],
      [i18n.labels.brand, product.brand ?? "–"],
      [i18n.labels.supplier, product.supplierName ?? "–"],
      [i18n.labels.status, product.status],
    ];

    const colW = pageW / 2 - 10;
    let infoY = doc.y;
    infoRows.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 50 + col * (colW + 20);
      const y = infoY + row * 22;

      doc.fontSize(8).fillColor(COLORS.muted).font("Helvetica").text(label, x, y);
      doc.fontSize(9).fillColor(COLORS.text).font("Helvetica-Bold")
        .text(value, x, y + 10, { width: colW });
    });

    doc.y = infoY + Math.ceil(infoRows.length / 2) * 22 + 10;
    doc.moveDown(0.8);

    // ── OVERALL SCORE ──────────────────────────────────────────────────────────
    const scoreBoxY = doc.y;
    const scoreBoxH = 80;
    drawFilledRect(doc, 50, scoreBoxY, pageW, scoreBoxH, COLORS.bgLight, 8);
    doc.rect(50, scoreBoxY, pageW, scoreBoxH).strokeColor(scoreColor(overall)).lineWidth(1.5).stroke();

    // Big score number
    doc.fontSize(36).fillColor(scoreColor(overall)).font("Helvetica-Bold")
      .text(`${overall}%`, 70, scoreBoxY + 16, { width: 90, align: "center" });

    // Label
    doc.fontSize(14).fillColor(scoreColor(overall)).font("Helvetica-Bold")
      .text(scoreLabel(overall, lang), 170, scoreBoxY + 18);
    doc.fontSize(9).fillColor(COLORS.muted).font("Helvetica")
      .text(i18n.overallDesc, 170, scoreBoxY + 38);
    const tokensStr = analysis.tokensUsed
      ? analysis.tokensUsed.toLocaleString(locale)
      : "";
    doc.fontSize(8).fillColor(COLORS.muted)
      .text(i18n.model(analysis.modelUsed ?? "GPT-4o", tokensStr), 170, scoreBoxY + 54);

    doc.y = scoreBoxY + scoreBoxH + 16;

    // ── SUMMARY ────────────────────────────────────────────────────────────────
    if (analysis.summary) {
      doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold")
        .text(i18n.summary, 50, doc.y);
      doc.moveDown(0.4);
      drawHorizontalLine(doc, doc.y);
      doc.moveDown(0.5);

      const summaryBoxY = doc.y;
      const summaryText = analysis.summary;
      doc.fontSize(10);
      const summaryH = Math.max(50, doc.heightOfString(summaryText, { width: pageW - 20 }) + 20);
      drawFilledRect(doc, 50, summaryBoxY, pageW, summaryH, "#eff6ff", 6);

      doc.fontSize(10).fillColor(COLORS.textSecondary).font("Helvetica")
        .text(summaryText, 62, summaryBoxY + 10, { width: pageW - 24 });

      doc.y = summaryBoxY + summaryH + 16;
    }

    // ── CATEGORY SCORES ────────────────────────────────────────────────────────
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold")
      .text(i18n.categoryScores, 50, doc.y);
    doc.moveDown(0.4);
    drawHorizontalLine(doc, doc.y);
    doc.moveDown(0.5);

    const halfW = (pageW - 20) / 2;
    const catStartY = doc.y;

    const categories = [
      { label: i18n.categories.docCompleteness, score: docScore },
      { label: i18n.categories.contentPlausibility, score: contentScore },
      { label: i18n.categories.formalCorrectness, score: formalScore },
      { label: i18n.categories.consistency, score: consistencyScore },
    ];

    let catY = catStartY;
    categories.forEach((cat, i) => {
      const col = i % 2;
      const x = 50 + col * (halfW + 20);
      if (i % 2 === 0 && i > 0) catY += 40;
      drawProgressBar(doc, x, catY, halfW, cat.score, cat.label);
    });

    doc.y = catY + 50;

    // ── FINDINGS ───────────────────────────────────────────────────────────────
    if (findings.length > 0) {
      // Check if we need a new page
      if (doc.y > doc.page.height - 200) doc.addPage();

      doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold")
        .text(i18n.findings(findings.length), 50, doc.y);
      doc.moveDown(0.4);
      drawHorizontalLine(doc, doc.y);
      doc.moveDown(0.5);

      findings.forEach((finding, i) => {
        if (doc.y > doc.page.height - 120) doc.addPage();

        const fY = doc.y;
        const sColor = severityColor(finding.severity);
        doc.fontSize(9);

        // Calculate block height: description + optional remediation + optional regulations
        const descText = finding.description ?? "";
        const remText = finding.remediation ? (lang === "de" ? `Ma\u00dfnahme: ${finding.remediation}` : `Remediation: ${finding.remediation}`) : "";
        const regsText = finding.affectedRegulations.length
          ? finding.affectedRegulations.join(" \u00b7 ") : "";
        const combinedText = [descText, remText, regsText].filter(Boolean).join("\n");
        const descH = Math.max(50, doc.heightOfString(combinedText || " ", { width: pageW - 80 }) + 36);

        // Background
        drawFilledRect(doc, 50, fY, pageW, descH, COLORS.bgLight, 6);
        // Left severity bar
        drawFilledRect(doc, 50, fY, 4, descH, sColor, 2);

        // Severity badge
        doc.fontSize(7).fillColor(COLORS.white).font("Helvetica-Bold");
        const badgeW = 52;
        const labelText = severityLabel(finding.severity, lang).toUpperCase();
        drawFilledRect(doc, doc.page.width - 50 - badgeW - 4, fY + 8, badgeW, 14, sColor, 3);
        doc.text(labelText, doc.page.width - 50 - badgeW, fY + 11, { width: badgeW, align: "center" });

        // Category / headline
        doc.fontSize(9).fillColor(COLORS.primary).font("Helvetica-Bold")
          .text(finding.category || i18n.findingFallback(i), 62, fY + 8, { width: pageW - 80 });

        // Description
        let textY = fY + 22;
        if (descText) {
          doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica")
            .text(descText, 62, textY, { width: pageW - 80 });
          textY = doc.y + 4;
        }

        // Remediation (if present)
        if (finding.remediation) {
          doc.fontSize(8).fillColor(COLORS.accent).font("Helvetica-Bold")
            .text(lang === "de" ? "Ma\u00dfnahme: " : "Remediation: ", 62, textY, { continued: true, width: pageW - 80 });
          doc.font("Helvetica").fillColor(COLORS.textSecondary)
            .text(finding.remediation, { width: pageW - 80 });
          textY = doc.y + 2;
        }

        // Affected regulations (if present)
        if (finding.affectedRegulations.length) {
          doc.fontSize(7).fillColor(COLORS.muted).font("Helvetica")
            .text(finding.affectedRegulations.join(" \u00b7 "), 62, textY, { width: pageW - 80 });
        }

        doc.y = fY + descH + 6;
      });

      doc.moveDown(0.5);
    }

    // ── RECOMMENDATIONS ────────────────────────────────────────────────────────
    if (recommendations.length > 0) {
      if (doc.y > doc.page.height - 150) doc.addPage();

      doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold")
        .text(i18n.recommendations, 50, doc.y);
      doc.moveDown(0.4);
      drawHorizontalLine(doc, doc.y);
      doc.moveDown(0.5);

      recommendations.forEach((rec, i) => {
        if (doc.y > doc.page.height - 80) doc.addPage();

        const recY = doc.y;
        doc.fontSize(9);
        const recH = Math.max(28, doc.heightOfString(rec, { width: pageW - 50 }) + 16);

        drawFilledRect(doc, 50, recY, pageW, recH, "#f0fdf4", 6);
        doc.rect(50, recY, pageW, recH).strokeColor("#bbf7d0").lineWidth(0.5).stroke();

        // Bullet circle
        doc.circle(66, recY + recH / 2, 6).fillColor(COLORS.success).fill();
        doc.fontSize(8).fillColor(COLORS.white).font("Helvetica-Bold")
          .text(`${i + 1}`, 63, recY + recH / 2 - 4, { width: 6, align: "center" });

        doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica")
          .text(rec, 80, recY + 8, { width: pageW - 40 });

        doc.y = recY + recH + 5;
      });
    }

    // ── DOCUMENT ANALYSES ─────────────────────────────────────────────────────
    // One full page per document for clarity and completeness.
    const docAnalyses: Array<{
      documentId?: number;
      fileName?: string;
      documentType?: string;
      score?: number;
      status?: string;
      legalBasis?: string;
      positives?: string[];
      missingElements?: string[];
      issues?: string[];
    }> = Array.isArray(analysis.documentAnalysis) ? analysis.documentAnalysis : [];

    // Helper: normalise doc status string to a known key
    const normaliseDocStatus = (raw: string): string => {
        const s = (raw ?? "").toLowerCase();
        if (s === "compliant" || s === "ok") return "compliant";
        if (s === "critical" || s === "non-compliant" || s === "noncompliant") return "critical";
        if (s === "partial" || s === "warning" || s === "partially compliant") return "partial";
        return "pending";
    };

    if (docAnalyses.length > 0) {
      docAnalyses.forEach((da, idx) => {
        // Every document starts on a fresh page
        doc.addPage();

        const daScore = Math.round(Number(da.score ?? 0));
        const daColor = scoreColor(daScore);
        const daStatus = normaliseDocStatus(da.status ?? "");
        const positives = Array.isArray(da.positives) ? da.positives : [];
        const missing = Array.isArray(da.missingElements) ? da.missingElements : [];
        const issues = Array.isArray(da.issues) ? da.issues : [];
        const legalBasis = da.legalBasis ?? "";

        // Status badge colours
        const statusBgColor = daStatus === "compliant" ? "#dcfce7"
          : daStatus === "critical" ? "#fee2e2"
          : daStatus === "partial" ? "#fef9c3"
          : COLORS.bgLight;
        const statusTextColor = daStatus === "compliant" ? COLORS.success
          : daStatus === "critical" ? COLORS.danger
          : daStatus === "partial" ? "#92400e"
          : COLORS.muted;
        const borderColor = daStatus === "compliant" ? COLORS.success
          : daStatus === "critical" ? COLORS.danger
          : daStatus === "partial" ? "#d97706"
          : COLORS.border;
        const statusLabel = (i18n.docStatus as Record<string, string>)[daStatus] ?? daStatus;

        // ── Page header: document counter ──
        doc.fontSize(8).fillColor(COLORS.muted).font("Helvetica")
          .text(
            `${i18n.documentAnalysisTitle(docAnalyses.length)} – ${idx + 1} / ${docAnalyses.length}`,
            50, 50, { width: pageW }
          );
        drawHorizontalLine(doc, 62);

        let y = 72;

        // ── File icon + name ──
        drawFilledRect(doc, 50, y, 22, 26, COLORS.border, 3);
        doc.fontSize(7).fillColor(COLORS.muted).font("Helvetica-Bold")
          .text("PDF", 51, y + 9, { width: 20, align: "center" });

        // File name – allow wrapping for long names
        const fileNameStr = (da.fileName ?? "-").replace(/\u00fc/g, "ue").replace(/\u00f6/g, "oe")
          .replace(/\u00e4/g, "ae").replace(/\u00dc/g, "Ue").replace(/\u00d6/g, "Oe")
          .replace(/\u00c4/g, "Ae").replace(/\u00df/g, "ss");
        doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold")
          .text(fileNameStr, 80, y, { width: pageW - 170 });
        doc.fontSize(11);
        const fileNameH = doc.heightOfString(fileNameStr, { width: pageW - 170 });
        doc.fontSize(8).fillColor(COLORS.muted).font("Helvetica")
          .text(da.documentType ?? "", 80, y + fileNameH + 2);

        // Score (right)
        doc.fontSize(13).fillColor(daColor).font("Helvetica-Bold")
          .text(`${daScore}/100`, doc.page.width - 110, y, { width: 55, align: "right" });

        // Status badge
        const badgeW = 90;
        const badgeX = doc.page.width - 50 - badgeW - 60;
        drawFilledRect(doc, badgeX, y, badgeW, 20, statusBgColor, 4);
        doc.rect(badgeX, y, badgeW, 20).strokeColor(borderColor).lineWidth(0.5).stroke();
        doc.fontSize(8).fillColor(statusTextColor).font("Helvetica-Bold")
          .text(statusLabel, badgeX, y + 6, { width: badgeW, align: "center" });

        y += Math.max(30, fileNameH + 14);

        // ── Score bar ──
        const barW = pageW;
        const filledW = Math.max(0, (daScore / 100) * barW);
        drawFilledRect(doc, 50, y, barW, 6, COLORS.border, 3);
        if (filledW > 0) drawFilledRect(doc, 50, y, filledW, 6, daColor, 3);
        y += 14;

        // ── Legal basis ──
        if (legalBasis) {
          doc.fontSize(8).fillColor(COLORS.muted).font("Helvetica")
            .text(legalBasis, 50, y, { width: pageW });
          y = doc.y + 8;
        }

        // ── Positives ──
        if (positives.length > 0) {
          doc.fontSize(9).fillColor(COLORS.success).font("Helvetica-Bold")
            .text(i18n.docLabels.positives, 50, y);
          y = doc.y + 4;
          positives.forEach((p) => {
            // Page break if needed
            if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
            doc.circle(58, y + 5, 5).fillColor(COLORS.success).fill();
            doc.fontSize(8).fillColor(COLORS.white).font("Helvetica-Bold")
              .text("v", 55, y + 2, { width: 6, align: "center" });
            doc.fontSize(8).fillColor(COLORS.textSecondary).font("Helvetica")
              .text(p, 70, y, { width: pageW - 22 });
            y = doc.y + 3;
          });
          y += 4;
        }

        // ── Missing elements ──
        if (missing.length > 0) {
          if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
          doc.fontSize(9).fillColor(COLORS.danger).font("Helvetica-Bold")
            .text(i18n.docLabels.missingElements + ":", 50, y);
          y = doc.y + 4;
          missing.forEach((m) => {
            if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
            const rowH = Math.max(18, doc.heightOfString(m, { width: pageW - 40 }) + 8);
            drawFilledRect(doc, 50, y, pageW, rowH, "#fef2f2", 3);
            doc.fontSize(9).fillColor(COLORS.danger).font("Helvetica-Bold")
              .text("-", 58, y + (rowH - 10) / 2, { continued: true });
            doc.font("Helvetica").fillColor(COLORS.textSecondary)
              .text(" " + m, { width: pageW - 30 });
            y = doc.y + 3;
          });
          y += 4;
        }

        // ── Issues / warnings ──
        if (issues.length > 0) {
          if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
          issues.forEach((iss) => {
            if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
            // Use ASCII "(!)" instead of Unicode warning triangle to avoid encoding issues
            doc.fontSize(9).fillColor(COLORS.warning).font("Helvetica-Bold")
              .text("(!)", 50, y, { continued: true });
            doc.font("Helvetica").fillColor(COLORS.warning)
              .text(" " + iss, { width: pageW - 20 });
            y = doc.y + 3;
          });
        }
      });
    }

    // ── TABLE OF CONTENTS on page 2 (inserted via switchToPage after all content is rendered) ─────
    // We use bufferPages mode, so we can switch back to page 2 and draw the TOC there.
    const tocDocAnalyses: Array<{
      documentId?: number;
      fileName?: string;
      documentType?: string;
      score?: number;
      status?: string;
    }> = Array.isArray(analysis.documentAnalysis) ? analysis.documentAnalysis : [];

    if (tocDocAnalyses.length > 0) {
      // Insert a blank page 2 for the TOC. We add it now (after all content pages) and then
      // switchToPage(1) to render on it. The footer loop will handle numbering.
      doc.addPage();
      const tocPageIndex = doc.bufferedPageRange().count - 1; // last added page index

      // Move the TOC page to position 1 (0-indexed) by switching to it and drawing.
      // PDFKit doesn't support page reordering, so instead we:
      // 1. Add the TOC page at the end
      // 2. Use switchToPage to draw on it
      // 3. The footer loop will number it correctly
      // Note: page numbers in TOC will reference the final page order.
      // Since we can't reorder, we render TOC at the end and note it as "Appendix".
      // BETTER APPROACH: reserve page 2 slot by adding it immediately after page 1,
      // then switch back to continue content on page 3.
      // Since bufferPages=true, we already have all pages buffered.
      // The TOC page was just added as the last page. Switch to it and render.
      doc.switchToPage(tocPageIndex);

      const tocPageNum = tocPageIndex + 1; // 1-based
      // The document analysis pages start at page 3 (page 1 = summary, page 2 = TOC-placeholder,
      // but since we appended TOC at the end, doc-analysis pages start at page 2 in the buffer).
      // We need to figure out which page index the first doc-analysis page has.
      // Doc-analysis pages: they were added starting after recommendations.
      // Total pages before TOC page = tocPageIndex, doc-analysis pages = tocDocAnalyses.length
      // So first doc-analysis page index = tocPageIndex - tocDocAnalyses.length
      const firstDocPageIndex = tocPageIndex - tocDocAnalyses.length;

      const normaliseDocStatusToc = (raw: string): string => {
        const s = (raw ?? "").toLowerCase();
        if (s === "compliant" || s === "ok") return "compliant";
        if (s === "critical" || s === "non-compliant" || s === "noncompliant") return "critical";
        if (s === "partial" || s === "warning" || s === "partially compliant") return "partial";
        return "pending";
      };

      // Column widths
      const colNum = 28;
      const colType = 90;
      const colScore = 48;
      const colStatus = 90;
      const colPage = 36;
      const colName = pageW - colNum - colType - colScore - colStatus - colPage - 10;
      const colX = {
        num: 50,
        name: 50 + colNum + 4,
        type: 50 + colNum + 4 + colName + 4,
        score: 50 + colNum + 4 + colName + 4 + colType + 4,
        status: 50 + colNum + 4 + colName + 4 + colType + 4 + colScore + 4,
        page: 50 + colNum + 4 + colName + 4 + colType + 4 + colScore + 4 + colStatus + 4,
      };

      // TOC header
      doc.fontSize(14).fillColor(COLORS.primary).font("Helvetica-Bold")
        .text(i18n.tocTitle, 50, 50, { width: pageW });
      drawHorizontalLine(doc, 68);
      doc.fontSize(10).fillColor(COLORS.primary).font("Helvetica-Bold")
        .text(i18n.tocDocuments, 50, 76);

      // Table header
      const headerY = 90;
      drawFilledRect(doc, 50, headerY, pageW, 18, COLORS.primary, 3);
      doc.fontSize(7).fillColor(COLORS.white).font("Helvetica-Bold");
      doc.text(i18n.tocColumns.num, colX.num, headerY + 5, { width: colNum, align: "center" });
      doc.text(i18n.tocColumns.name, colX.name, headerY + 5, { width: colName });
      doc.text(i18n.tocColumns.type, colX.type, headerY + 5, { width: colType });
      doc.text(i18n.tocColumns.score, colX.score, headerY + 5, { width: colScore, align: "center" });
      doc.text(i18n.tocColumns.status, colX.status, headerY + 5, { width: colStatus, align: "center" });
      doc.text(i18n.tocColumns.page, colX.page, headerY + 5, { width: colPage, align: "center" });

      let rowY = headerY + 18;
      tocDocAnalyses.forEach((da, idx) => {
        if (rowY > doc.page.height - 80) {
          // If TOC overflows, just continue on same page (truncate for now)
          return;
        }
        const rowH = 18;
        const isEven = idx % 2 === 0;
        drawFilledRect(doc, 50, rowY, pageW, rowH, isEven ? COLORS.bgLight : COLORS.white, 0);

        const daScore = Math.round(Number(da.score ?? 0));
        const daStatus = normaliseDocStatusToc(da.status ?? "");
        const statusLabel = (i18n.docStatus as Record<string, string>)[daStatus] ?? daStatus;
        const statusColor = daStatus === "compliant" ? COLORS.success
          : daStatus === "critical" ? COLORS.danger
          : daStatus === "partial" ? COLORS.warning
          : COLORS.muted;
        const daColor = scoreColor(daScore);
        const rawName = da.fileName ?? "-";
        const displayName = rawName.length > 42 ? rawName.substring(0, 39) + "..." : rawName;
        const docPageNum = firstDocPageIndex + idx + 1; // 1-based page number

        doc.fontSize(7.5).font("Helvetica");
        doc.fillColor(COLORS.muted).text(`${idx + 1}`, colX.num, rowY + 5, { width: colNum, align: "center" });
        doc.fillColor(COLORS.text).text(displayName, colX.name, rowY + 5, { width: colName });
        doc.fillColor(COLORS.muted).text(da.documentType ?? "", colX.type, rowY + 5, { width: colType });
        doc.fillColor(daColor).font("Helvetica-Bold")
          .text(`${daScore}/100`, colX.score, rowY + 5, { width: colScore, align: "center" });
        doc.fillColor(statusColor).font("Helvetica-Bold")
          .text(statusLabel, colX.status, rowY + 5, { width: colStatus, align: "center" });
        doc.fillColor(COLORS.muted).font("Helvetica")
          .text(`${docPageNum}`, colX.page, rowY + 5, { width: colPage, align: "center" });
        doc.moveTo(50, rowY + rowH).lineTo(50 + pageW, rowY + rowH)
          .strokeColor(COLORS.border).lineWidth(0.3).stroke();
        rowY += rowH;
      });
    }

    // ── FOOTER on all pages ─────────────────────────────────────────────────────
    // IMPORTANT: call flushPages() before iterating buffered pages to prevent
    // PDFKit from appending phantom duplicate pages after switchToPage().
    doc.flushPages();
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 40;
      drawHorizontalLine(doc, footerY - 5, COLORS.border);
      doc.fontSize(7).fillColor(COLORS.muted).font("Helvetica")
        .text(
          i18n.footer(analysis.id, i + 1, totalPages),
          50, footerY, { width: pageW, align: "center" }
        );
    }

    doc.end();  });
}
