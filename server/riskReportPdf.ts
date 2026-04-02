import PDFDocument from "pdfkit";
import type { RiskItem, RiskAssessmentResult } from "./domains/risk/riskAssessmentService";

// ─── i18n strings ─────────────────────────────────────────────────────────────
const RISK_I18N = {
  de: {
    headerTitle: "Swiss Product Seal – Risikobericht",
    page: (n: number) => `Seite ${n}`,
    footer: (date: string) => `Erstellt am ${date} · Swiss Product Seal Compliance Portal · Vertraulich`,
    reportTitle: "Risikobericht",
    summaryLabel: "ZUSAMMENFASSUNG",
    riskOverview: "Risiko-Übersicht nach Kategorie",
    assessmentMeta: (id: number, date: string, model: string, tokens: string | number) =>
      `Bewertungs-ID: #${id}  ·  Erstellt: ${date}  ·  Modell: ${model}  ·  Token: ${tokens}`,
    detailedRisks: "Identifizierte Risiken im Detail",
    mitigations: "MASSNAHMEN ZUR RISIKOREDUKTION",
    missingInfoTitle: "Fehlende Informationen & Empfehlungen",
    missingInfoSubtitle: "Folgende Informationen würden die Risikobewertung verbessern und den Risikoscore senken:",
    meta: {
      internalArticleNumber: "Interne Artikelnummer",
      supplierArticleNumber: "Lieferanten-Artikelnummer",
      ean: "EAN / GTIN",
      brand: "Marke",
      supplier: "Lieferant",
      status: "Produktstatus",
    },
    riskLevels: {
      low: "Niedrig",
      medium: "Mittel",
      high: "Hoch",
      critical: "Kritisch",
    },
    locale: "de-CH",
    timezone: "Europe/Zurich",
  },
  en: {
    headerTitle: "Swiss Product Seal – Risk Report",
    page: (n: number) => `Page ${n}`,
    footer: (date: string) => `Generated on ${date} · Swiss Product Seal Compliance Portal · Confidential`,
    reportTitle: "Risk Report",
    summaryLabel: "SUMMARY",
    riskOverview: "Risk Overview by Category",
    assessmentMeta: (id: number, date: string, model: string, tokens: string | number) =>
      `Assessment ID: #${id}  ·  Created: ${date}  ·  Model: ${model}  ·  Tokens: ${tokens}`,
    detailedRisks: "Identified Risks in Detail",
    mitigations: "RISK MITIGATION MEASURES",
    missingInfoTitle: "Missing Information & Recommendations",
    missingInfoSubtitle: "The following information would improve the risk assessment and lower the risk score:",
    meta: {
      internalArticleNumber: "Internal Article Number",
      supplierArticleNumber: "Supplier Article Number",
      ean: "EAN / GTIN",
      brand: "Brand",
      supplier: "Supplier",
      status: "Product Status",
    },
    riskLevels: {
      low: "Low",
      medium: "Medium",
      high: "High",
      critical: "Critical",
    },
    locale: "en-GB",
    timezone: "Europe/London",
  },
} as const;

type RiskPdfLang = "de" | "en";

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  primary:    "#1e3a5f",
  accent:     "#2563eb",
  low:        "#16a34a",
  medium:     "#d97706",
  high:       "#ea580c",
  critical:   "#dc2626",
  muted:      "#6b7280",
  border:     "#e5e7eb",
  bgLight:    "#f8fafc",
  bgMuted:    "#f1f5f9",
  white:      "#ffffff",
  text:       "#111827",
  textSub:    "#374151",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function riskColor(score: number): string {
  if (score <= 3) return C.low;
  if (score <= 6) return C.medium;
  if (score <= 8) return C.high;
  return C.critical;
}

function riskLevelLabel(level: string, lang: RiskPdfLang = "de"): string {
  const labels = RISK_I18N[lang].riskLevels;
  return (labels as Record<string, string>)[level] ?? level;
}

function riskLevelColor(level: string): string {
  return { low: C.low, medium: C.medium, high: C.high, critical: C.critical }[level] ?? C.muted;
}

function drawHLine(doc: PDFKit.PDFDocument, y: number, color = C.border, lw = 0.5) {
  doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(color).lineWidth(lw).stroke();
}

function filledRect(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number, h: number,
  fill: string, radius = 3
) {
  doc.roundedRect(x, y, w, h, radius).fillColor(fill).fill();
}

/** Draw a horizontal score bar (1–10). Returns the Y after the bar. */
function drawScoreBar(
  doc: PDFKit.PDFDocument,
  x: number, y: number, width: number,
  score: number, label: string
): number {
  const barH = 7;
  const color = riskColor(score);
  const filled = (score / 10) * width;

  doc.fontSize(8).fillColor(C.textSub).text(label, x, y, { width: width - 30 });
  doc.fontSize(8).fillColor(color).text(`${score}/10`, x + width - 28, y, { width: 28, align: "right" });

  const barY = y + 13;
  filledRect(doc, x, barY, width, barH, C.border, 3);
  if (filled > 0) filledRect(doc, x, barY, Math.max(filled, 6), barH, color, 3);
  return barY + barH + 5;
}

/** Draw a large circular score gauge. Returns the Y below the circle. */
function drawGauge(
  doc: PDFKit.PDFDocument,
  cx: number, cy: number, r: number,
  score: number, level: string
) {
  const color = riskLevelColor(level);
  // Outer ring (background)
  doc.circle(cx, cy, r).strokeColor(C.border).lineWidth(8).stroke();
  // Score arc – approximate with a filled circle segment (PDFKit doesn't have arc fill easily)
  // Draw filled colored circle slightly smaller as accent
  doc.circle(cx, cy, r).strokeColor(color).lineWidth(8).stroke();
  // White inner fill
  doc.circle(cx, cy, r - 10).fillColor(C.white).fill();
  // Score number
  doc.fontSize(28).fillColor(color).text(
    score.toFixed(1),
    cx - 30, cy - 20,
    { width: 60, align: "center" }
  );
  doc.fontSize(9).fillColor(C.muted).text(
    "/10",
    cx - 15, cy + 10,
    { width: 30, align: "center" }
  );
}

// ─── Page header/footer ───────────────────────────────────────────────────────
function addHeader(
  doc: PDFKit.PDFDocument,
  productName: string,
  pageNum: number,
  i18n: typeof RISK_I18N[RiskPdfLang]
) {
  const w = doc.page.width;
  filledRect(doc, 0, 0, w, 36, C.primary, 0);
  doc.fontSize(10).fillColor(C.white)
    .text(i18n.headerTitle, 50, 11, { width: w - 200 });
  doc.fontSize(8).fillColor("#93c5fd")
    .text(productName, 50, 23, { width: w - 200 });
  doc.fontSize(8).fillColor("#93c5fd")
    .text(i18n.page(pageNum), w - 90, 14, { width: 60, align: "right" });
}

function addFooter(
  doc: PDFKit.PDFDocument,
  generatedAt: string,
  i18n: typeof RISK_I18N[RiskPdfLang]
) {
  const w = doc.page.width;
  const y = doc.page.height - 28;
  drawHLine(doc, y, C.border);
  doc.fontSize(7).fillColor(C.muted)
    .text(i18n.footer(generatedAt), 50, y + 6, {
      width: w - 100, align: "center",
    });
}

// ─── Main export ──────────────────────────────────────────────────────────────
export interface RiskReportData {
  product: {
    productName: string;
    internalArticleNumber?: string | null;
    supplierArticleNumber?: string | null;
    ean?: string | null;
    brand?: string | null;
    status?: string | null;
    supplierName?: string | null;
  };
  assessment: {
    id: number;
    overallRiskScore: string | number;
    riskLevel: string;
    summary: string;
    risks: RiskItem[];
    missingInfo: string[];
    modelUsed?: string | null;
    tokensUsed?: number | null;
    createdAt: Date | number | string;
    triggeredByUserName?: string | null;
  };
  lang?: RiskPdfLang;
}

export async function generateRiskReportPdf(data: RiskReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { product, assessment } = data;
    const lang: RiskPdfLang = data.lang ?? "de";
    const i18n = RISK_I18N[lang];

    const score = Number(assessment.overallRiskScore);
    const level = assessment.riskLevel;
    const levelColor = riskLevelColor(level);
    const generatedAt = new Date().toLocaleString(i18n.locale, { timeZone: i18n.timezone });
    const assessmentDate = new Date(assessment.createdAt).toLocaleString(i18n.locale, { timeZone: i18n.timezone });
    const pageW = 595.28;
    const contentW = pageW - 100;
    let pageNum = 0;

    // ── Page 1: Cover ──────────────────────────────────────────────────────────
    pageNum++;
    doc.addPage();
    addHeader(doc, product.productName, pageNum, i18n);
    addFooter(doc, generatedAt, i18n);

    // Title block
    let y = 60;
    filledRect(doc, 50, y, contentW, 90, C.bgLight, 6);
    doc.fontSize(20).fillColor(C.primary)
      .text(i18n.reportTitle, 70, y + 14, { width: contentW - 40 });
    doc.fontSize(13).fillColor(C.textSub)
      .text(product.productName, 70, y + 38, { width: contentW - 40 });
    // Risk level badge
    const badgeW = 110;
    filledRect(doc, pageW - 50 - badgeW - 10, y + 20, badgeW, 28, levelColor, 14);
    doc.fontSize(11).fillColor(C.white)
      .text(riskLevelLabel(level, lang).toUpperCase(), pageW - 50 - badgeW - 10, y + 27, { width: badgeW, align: "center" });

    y += 105;

    // Product meta table
    const meta: [string, string | null | undefined][] = [
      [i18n.meta.internalArticleNumber, product.internalArticleNumber],
      [i18n.meta.supplierArticleNumber, product.supplierArticleNumber],
      [i18n.meta.ean, product.ean],
      [i18n.meta.brand, product.brand],
      [i18n.meta.supplier, product.supplierName],
      [i18n.meta.status, product.status],
    ];
    const colW = (contentW - 10) / 2;
    let col = 0;
    let rowY = y;
    for (const [label, value] of meta) {
      if (!value) continue;
      const xOff = col === 0 ? 50 : 50 + colW + 10;
      doc.fontSize(7).fillColor(C.muted).text(label.toUpperCase(), xOff, rowY, { width: colW });
      doc.fontSize(9).fillColor(C.text).text(value, xOff, rowY + 9, { width: colW });
      col++;
      if (col === 2) { col = 0; rowY += 28; }
    }
    if (col === 1) rowY += 28;
    y = rowY + 8;

    drawHLine(doc, y);
    y += 14;

    // Score gauge section
    const gaugeR = 42;
    const gaugeCX = 50 + gaugeR + 10;
    const gaugeCY = y + gaugeR + 10;
    drawGauge(doc, gaugeCX, gaugeCY, gaugeR, score, level);

    // Summary text beside gauge
    const summaryX = gaugeCX + gaugeR + 24;
    const summaryW = contentW - (gaugeCX - 50 + gaugeR + 24);
    doc.fontSize(9).fillColor(C.muted).text(i18n.summaryLabel, summaryX, y + 8, { width: summaryW });
    doc.fontSize(9).fillColor(C.text).text(assessment.summary, summaryX, y + 20, {
      width: summaryW, lineGap: 3,
    });

    y = gaugeCY + gaugeR + 20;
    drawHLine(doc, y);
    y += 14;

    // Risk score bars overview
    doc.fontSize(10).fillColor(C.primary).text(i18n.riskOverview, 50, y);
    y += 16;
    const topRisks = [...(assessment.risks ?? [])].sort((a, b) => b.score - a.score).slice(0, 8);
    for (const risk of topRisks) {
      if (y > 700) break;
      y = drawScoreBar(doc, 50, y, contentW, risk.score, risk.title);
    }

    y += 10;
    drawHLine(doc, y);
    y += 12;

    // Assessment metadata
    doc.fontSize(7).fillColor(C.muted)
      .text(
        i18n.assessmentMeta(
          assessment.id,
          assessmentDate,
          assessment.modelUsed ?? "–",
          assessment.tokensUsed ?? "–"
        ),
        50, y, { width: contentW }
      );

    // ── Page 2+: Detailed risk cards ──────────────────────────────────────────
    const risks = assessment.risks ?? [];
    if (risks.length > 0) {
      pageNum++;
      doc.addPage();
      addHeader(doc, product.productName, pageNum, i18n);
      addFooter(doc, generatedAt, i18n);
      y = 55;

      doc.fontSize(14).fillColor(C.primary).text(i18n.detailedRisks, 50, y);
      y += 20;

      for (let i = 0; i < risks.length; i++) {
        const risk = risks[i];
        const color = riskColor(risk.score);

        // Estimate card height
        const mitigationLines = risk.mitigations?.length ?? 0;
        const descLines = Math.ceil((risk.description?.length ?? 0) / 90);
        const cardH = 20 + 14 + (descLines * 12) + (mitigationLines * 13) + 28;

        if (y + cardH > doc.page.height - 60) {
          pageNum++;
          doc.addPage();
          addHeader(doc, product.productName, pageNum, i18n);
          addFooter(doc, generatedAt, i18n);
          y = 55;
        }

        // Card background
        filledRect(doc, 50, y, contentW, cardH, C.bgLight, 5);
        // Left color bar
        filledRect(doc, 50, y, 4, cardH, color, 2);

        // Header row: category badge + title + score
        const catBadgeW = Math.min(risk.category.length * 6 + 16, 140);
        filledRect(doc, 62, y + 8, catBadgeW, 14, color + "22", 3);
        doc.fontSize(7).fillColor(color).text(risk.category.toUpperCase(), 68, y + 11, { width: catBadgeW - 12 });

        doc.fontSize(10).fillColor(C.text).text(risk.title, 62 + catBadgeW + 8, y + 8, {
          width: contentW - catBadgeW - 70,
        });

        // Score badge (right)
        const scoreBadgeX = 50 + contentW - 38;
        filledRect(doc, scoreBadgeX, y + 6, 32, 18, color, 9);
        doc.fontSize(10).fillColor(C.white).text(`${risk.score}`, scoreBadgeX, y + 10, { width: 32, align: "center" });

        y += 26;

        // Description
        doc.fontSize(8.5).fillColor(C.textSub).text(risk.description, 62, y, {
          width: contentW - 24, lineGap: 2,
        });
        y += doc.heightOfString(risk.description, { width: contentW - 24, lineGap: 2 }) + 8;

        // Mitigations
        if (risk.mitigations && risk.mitigations.length > 0) {
          doc.fontSize(7.5).fillColor(C.muted).text(i18n.mitigations, 62, y);
          y += 11;
          for (const m of risk.mitigations) {
            doc.fontSize(8).fillColor(C.text)
              .text("→  " + m, 66, y, { width: contentW - 30, lineGap: 1 });
            y += doc.heightOfString("→  " + m, { width: contentW - 30, lineGap: 1 }) + 3;
          }
        }

        y += 12;
      }
    }

    // ── Missing info page ──────────────────────────────────────────────────────
    const missingInfo = assessment.missingInfo ?? [];
    if (missingInfo.length > 0) {
      if (y + 80 > doc.page.height - 60) {
        pageNum++;
        doc.addPage();
        addHeader(doc, product.productName, pageNum, i18n);
        addFooter(doc, generatedAt, i18n);
        y = 55;
      } else {
        y += 10;
        drawHLine(doc, y);
        y += 16;
      }

      doc.fontSize(13).fillColor(C.primary).text(i18n.missingInfoTitle, 50, y);
      y += 8;
      doc.fontSize(8.5).fillColor(C.muted)
        .text(i18n.missingInfoSubtitle, 50, y + 4, { width: contentW });
      y += 22;

      for (let i = 0; i < missingInfo.length; i++) {
        const item = missingInfo[i];
        if (y + 30 > doc.page.height - 60) {
          pageNum++;
          doc.addPage();
          addHeader(doc, product.productName, pageNum, i18n);
          addFooter(doc, generatedAt, i18n);
          y = 55;
        }
        filledRect(doc, 50, y, contentW, 22, C.bgMuted, 4);
        filledRect(doc, 50, y, 3, 22, C.accent, 2);
        doc.fontSize(8).fillColor(C.text).text(`${i + 1}.  ${item}`, 60, y + 7, { width: contentW - 20 });
        y += 26;
      }
    }

    doc.end();
  });
}
