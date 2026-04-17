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

    // ── PRODUCT INFO ───────────────────────────────────────────────────────────
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

    // ── FOOTER on all pages ────────────────────────────────────────────────────
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

    doc.end();
  });
}
