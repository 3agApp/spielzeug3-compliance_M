import PDFDocument from "pdfkit";

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

function scoreLabel(score: number): string {
  if (score >= 75) return "Plausibel";
  if (score >= 50) return "Teilweise plausibel";
  return "Kritisch";
}

function severityColor(severity: string): string {
  switch (severity) {
    case "high": return COLORS.danger;
    case "medium": return COLORS.warning;
    case "low": return COLORS.accent;
    default: return COLORS.success;
  }
}

function severityLabel(severity: string): string {
  const map: Record<string, string> = { high: "Kritisch", medium: "Mittel", low: "Gering", info: "Info" };
  return map[severity] ?? severity;
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
}

export function generateAiAnalysisPdf(data: PdfReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { product, analysis } = data;
    const overall = Math.round(Number(analysis.overallScore ?? 0));
    const docScore = Math.round(Number(analysis.documentCompletenessScore ?? 0));
    const contentScore = Math.round(Number(analysis.contentPlausibilityScore ?? 0));
    const formalScore = Math.round(Number(analysis.formalCorrectnessScore ?? 0));
    const consistencyScore = Math.round(Number(analysis.consistencyScore ?? 0));
    const findings: Array<{ category: string; severity: string; description: string }> =
      Array.isArray(analysis.findings) ? analysis.findings : [];
    const recommendations: string[] =
      Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
    const pageW = doc.page.width - 100; // usable width (50 margin each side)

    // ── HEADER BANNER ──────────────────────────────────────────────────────────
    drawFilledRect(doc, 0, 0, doc.page.width, 90, COLORS.primary, 0);

    doc.fontSize(18).fillColor(COLORS.white)
      .text("KI-Plausibilitätsprüfung", 50, 22, { width: pageW - 120 });
    doc.fontSize(10).fillColor("#93c5fd")
      .text("spielzeug3 AG · Supplier Compliance Portal", 50, 46);
    doc.fontSize(8).fillColor("#bfdbfe")
      .text(`Erstellt am ${new Date(analysis.createdAt).toLocaleString("de-DE")}`, 50, 62);

    // Report ID badge (top right)
    doc.fontSize(8).fillColor("#bfdbfe")
      .text(`Bericht #${analysis.id}`, doc.page.width - 150, 36, { width: 100, align: "right" });

    doc.y = 110;

    // ── PRODUCT INFO ───────────────────────────────────────────────────────────
    doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold")
      .text("Produktinformationen", 50, doc.y);
    doc.moveDown(0.4);
    drawHorizontalLine(doc, doc.y);
    doc.moveDown(0.5);

    const infoRows = [
      ["Produktname", product.productName],
      ["Interne Artikelnummer", product.internalArticleNumber ?? "–"],
      ["Lieferanten-Artikelnummer", product.supplierArticleNumber ?? "–"],
      ["EAN", product.ean ?? "–"],
      ["Marke", product.brand ?? "–"],
      ["Lieferant", product.supplierName ?? "–"],
      ["Status", product.status],
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
      .text(scoreLabel(overall), 170, scoreBoxY + 18);
    doc.fontSize(9).fillColor(COLORS.muted).font("Helvetica")
      .text(`Gesamtbewertung der Dokumentenplausibilität`, 170, scoreBoxY + 38);
    doc.fontSize(8).fillColor(COLORS.muted)
      .text(`Modell: ${analysis.modelUsed ?? "GPT-4o"} · ${analysis.tokensUsed ? analysis.tokensUsed.toLocaleString("de-DE") + " Tokens" : ""}`, 170, scoreBoxY + 54);

    doc.y = scoreBoxY + scoreBoxH + 16;

    // ── SUMMARY ────────────────────────────────────────────────────────────────
    if (analysis.summary) {
      doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold")
        .text("Zusammenfassung", 50, doc.y);
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
      .text("Kategorie-Bewertungen", 50, doc.y);
    doc.moveDown(0.4);
    drawHorizontalLine(doc, doc.y);
    doc.moveDown(0.5);

    const halfW = (pageW - 20) / 2;
    const catStartY = doc.y;

    const categories = [
      { label: "Dokumentenvollständigkeit", score: docScore },
      { label: "Inhaltliche Plausibilität", score: contentScore },
      { label: "Formale Korrektheit", score: formalScore },
      { label: "Konsistenz", score: consistencyScore },
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
        .text(`Befunde (${findings.length})`, 50, doc.y);
      doc.moveDown(0.4);
      drawHorizontalLine(doc, doc.y);
      doc.moveDown(0.5);

      findings.forEach((finding, i) => {
        if (doc.y > doc.page.height - 120) doc.addPage();

        const fY = doc.y;
        const sColor = severityColor(finding.severity);
        doc.fontSize(9);
        const descH = Math.max(40, doc.heightOfString(finding.description ?? "", { width: pageW - 80 }) + 30);

        // Background
        drawFilledRect(doc, 50, fY, pageW, descH, COLORS.bgLight, 6);
        // Left severity bar
        drawFilledRect(doc, 50, fY, 4, descH, sColor, 2);

        // Severity badge
        doc.fontSize(7).fillColor(COLORS.white).font("Helvetica-Bold");
        const badgeW = 48;
        drawFilledRect(doc, doc.page.width - 50 - badgeW - 4, fY + 8, badgeW, 14, sColor, 3);
        doc.text(severityLabel(finding.severity).toUpperCase(), doc.page.width - 50 - badgeW, fY + 11, { width: badgeW, align: "center" });

        // Category
        doc.fontSize(9).fillColor(COLORS.primary).font("Helvetica-Bold")
          .text(finding.category ?? `Befund ${i + 1}`, 62, fY + 8, { width: pageW - 80 });

        // Description
        doc.fontSize(9).fillColor(COLORS.textSecondary).font("Helvetica")
          .text(finding.description ?? "", 62, fY + 22, { width: pageW - 80 });

        doc.y = fY + descH + 6;
      });

      doc.moveDown(0.5);
    }

    // ── RECOMMENDATIONS ────────────────────────────────────────────────────────
    if (recommendations.length > 0) {
      if (doc.y > doc.page.height - 150) doc.addPage();

      doc.fontSize(11).fillColor(COLORS.primary).font("Helvetica-Bold")
        .text("Empfehlungen", 50, doc.y);
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
          `spielzeug3 AG · Supplier Compliance Portal · Bericht #${analysis.id} · Seite ${i + 1} von ${totalPages}`,
          50, footerY, { width: pageW, align: "center" }
        );
    }

    doc.end();
  });
}
