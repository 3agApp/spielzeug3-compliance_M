/**
 * server/domains/declarations/declarationPdfService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a Declaration of Conformity PDF using PDFKit.
 * Covers all 7 sections from the Laravel MODULE_DECLARATION.md spec:
 *   1. Manufacturer / Hersteller
 *   2. Product identification + photos
 *   3. EU Directives / EU-Richtlinien
 *   4. CH Regulations / CH-Vorschriften
 *   5. Standards / Normen
 *   6. Declaration text / Erklärungstext
 *   7. Signature / Unterschrift
 */
import PDFDocument from "pdfkit";

// ─── i18n strings ────────────────────────────────────────────────────────────
const I18N = {
  de: {
    title: "EU-Konformitätserklärung",
    subtitle: "Declaration of Conformity",
    docNumber: "Dokumentnummer",
    version: "Version",
    issuedDate: "Ausstellungsdatum",
    issuedPlace: "Ausstellungsort",
    section1: "1. Hersteller / Manufacturer",
    manufacturerName: "Firmenname",
    manufacturerAddress: "Adresse",
    manufacturerCountry: "Land",
    manufacturerContact: "Kontakt",
    section2: "2. Produktidentifikation / Product Identification",
    productName: "Produktbezeichnung",
    productModel: "Modell / Typ",
    articleNumber: "Artikelnummer",
    ean: "EAN",
    brand: "Marke",
    versionNumber: "Version",
    section3: "3. EU-Richtlinien / EU Directives",
    section3text: "Das oben beschriebene Produkt entspricht den Anforderungen der folgenden EU-Richtlinien:",
    section4: "4. Schweizer Vorschriften / Swiss Regulations",
    section4text: "Das Produkt entspricht zusätzlich den folgenden Schweizer Vorschriften:",
    section5: "5. Harmonisierte Normen / Harmonised Standards",
    section5text: "Die Konformität wurde auf Basis folgender Normen nachgewiesen:",
    section6: "6. Erklärung / Declaration",
    section6text: (name: string, place: string, date: string) =>
      `Ich, ${name}, erkläre in alleiniger Verantwortung, dass das oben beschriebene Produkt mit den oben genannten Richtlinien und Normen übereinstimmt.\n\nAusgestellt in ${place} am ${date}.`,
    section7: "7. Unterschrift / Signature",
    signatoryName: "Name",
    signatoryPosition: "Funktion",
    signedAt: "Unterzeichnet am",
    signaturePlaceholder: "________________________",
    footer: (docNum: string) => `spielzeug3 AG – Compliance Management System | Dok.-Nr.: ${docNum}`,
    noDirectives: "Keine EU-Richtlinien angegeben.",
    noRegulations: "Keine CH-Vorschriften angegeben.",
    noStandards: "Keine Normen angegeben.",
    status: "Status",
    draft: "Entwurf",
    sent: "Versendet",
    manufacturer_review: "Beim Hersteller",
    signed: "Unterzeichnet",
    ai_validated: "KI-validiert",
    archived: "Archiviert",
    annexA: "Anhang A – Produktvarianten / Annex A – Product Variants",
    variantTable: ["Variante", "Artikelnummer", "EAN", "Beschreibung"],
  },
  en: {
    title: "EU Declaration of Conformity",
    subtitle: "EU-Konformitätserklärung",
    docNumber: "Document Number",
    version: "Version",
    issuedDate: "Issue Date",
    issuedPlace: "Place of Issue",
    section1: "1. Manufacturer / Hersteller",
    manufacturerName: "Company Name",
    manufacturerAddress: "Address",
    manufacturerCountry: "Country",
    manufacturerContact: "Contact",
    section2: "2. Product Identification / Produktidentifikation",
    productName: "Product Name",
    productModel: "Model / Type",
    articleNumber: "Article Number",
    ean: "EAN",
    brand: "Brand",
    versionNumber: "Version",
    section3: "3. EU Directives / EU-Richtlinien",
    section3text: "The product described above is in conformity with the requirements of the following EU Directives:",
    section4: "4. Swiss Regulations / Schweizer Vorschriften",
    section4text: "The product additionally complies with the following Swiss regulations:",
    section5: "5. Harmonised Standards / Harmonisierte Normen",
    section5text: "Conformity has been demonstrated on the basis of the following standards:",
    section6: "6. Declaration / Erklärung",
    section6text: (name: string, place: string, date: string) =>
      `I, ${name}, declare under my sole responsibility that the product described above is in conformity with the directives and standards listed above.\n\nIssued in ${place} on ${date}.`,
    section7: "7. Signature / Unterschrift",
    signatoryName: "Name",
    signatoryPosition: "Position",
    signedAt: "Signed on",
    signaturePlaceholder: "________________________",
    footer: (docNum: string) => `spielzeug3 AG – Compliance Management System | Doc. No.: ${docNum}`,
    noDirectives: "No EU directives specified.",
    noRegulations: "No Swiss regulations specified.",
    noStandards: "No standards specified.",
    status: "Status",
    draft: "Draft",
    sent: "Sent",
    manufacturer_review: "Under Manufacturer Review",
    signed: "Signed",
    ai_validated: "AI Validated",
    archived: "Archived",
    annexA: "Annex A – Product Variants / Anhang A – Produktvarianten",
    variantTable: ["Variant", "Article No.", "EAN", "Description"],
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(val: Date | number | string | null | undefined, locale: string): string {
  if (!val) return "–";
  try {
    return new Date(val).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return String(val);
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function generateDeclarationPdf(
  declaration: any,
  lang: "de" | "en" = "de"
): Promise<Buffer> {
  const t = I18N[lang];
  const locale = lang === "en" ? "en-GB" : "de-CH";

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 60, left: 55, right: 55 },
      info: {
        Title: `${t.title} – ${declaration.docNumber ?? ""}`,
        Author: "spielzeug3 AG – Compliance Management System",
        Subject: declaration.effectiveProductName ?? declaration.productName ?? "",
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const accentColor = "#1a3a6b";
    const lightGray = "#f5f5f5";
    const textColor = "#1a1a1a";
    const mutedColor = "#666666";

    // ── Header bar ────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill(accentColor);
    doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold")
      .text(t.title, 55, 22, { width: pageWidth - 120 });
    doc.fontSize(9).font("Helvetica")
      .text(t.subtitle, 55, 46, { width: pageWidth - 120 });

    // Doc number top-right
    if (declaration.docNumber) {
      doc.fontSize(8).font("Helvetica")
        .text(declaration.docNumber, doc.page.width - 180, 28, { width: 130, align: "right" });
    }

    doc.fillColor(textColor).moveDown(0.5);
    let y = 100;

    // ── Meta row ──────────────────────────────────────────────────────────────
    doc.rect(55, y, pageWidth, 28).fill(lightGray);
    const metaItems: Array<[string, string]> = [];
    if (declaration.docNumber) metaItems.push([t.docNumber, declaration.docNumber]);
    if (declaration.version) metaItems.push([t.version, declaration.version]);
    if (declaration.issuedDate) metaItems.push([t.issuedDate, formatDate(declaration.issuedDate, locale)]);
    if (declaration.issuedPlace) metaItems.push([t.issuedPlace, declaration.issuedPlace]);

    const metaColW = pageWidth / Math.max(metaItems.length, 1);
    metaItems.forEach(([label, value], i) => {
      const mx = 55 + i * metaColW;
      doc.fillColor(mutedColor).fontSize(7).font("Helvetica").text(label, mx + 6, y + 4, { width: metaColW - 10 });
      doc.fillColor(textColor).fontSize(9).font("Helvetica-Bold").text(value, mx + 6, y + 14, { width: metaColW - 10 });
    });
    y += 38;

    // ── Section helper ────────────────────────────────────────────────────────
    function sectionHeader(title: string) {
      doc.rect(55, y, pageWidth, 20).fill(accentColor);
      doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold")
        .text(title, 61, y + 5, { width: pageWidth - 10 });
      doc.fillColor(textColor);
      y += 26;
    }

    function labelValue(label: string, value: string | null | undefined, colW = pageWidth) {
      if (!value) return;
      doc.fontSize(8).font("Helvetica").fillColor(mutedColor)
        .text(label + ":", 55, y, { width: colW / 2 - 10, continued: false });
      doc.fontSize(9).font("Helvetica").fillColor(textColor)
        .text(value, 55 + colW / 2, y - doc.currentLineHeight(), { width: colW / 2, align: "left" });
      y += 14;
    }

    function checkSpace(needed = 60) {
      if (y + needed > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        y = 50;
      }
    }

    // ── Section 1: Manufacturer ───────────────────────────────────────────────
    checkSpace(80);
    sectionHeader(t.section1);
    labelValue(t.manufacturerName, declaration.supplierName ?? declaration.manufacturerName);
    labelValue(t.manufacturerAddress, declaration.manufacturerAddress);
    labelValue(t.manufacturerCountry, declaration.manufacturerCountry);
    labelValue(t.manufacturerContact, declaration.manufacturerContact);
    y += 6;

    // ── Section 2: Product identification ────────────────────────────────────
    checkSpace(80);
    sectionHeader(t.section2);
    labelValue(t.productName, declaration.effectiveProductName ?? declaration.productName);
    labelValue(t.productModel, declaration.productModel);
    labelValue(t.articleNumber, declaration.articleNumber ?? declaration.internalArticleNumber);
    labelValue(t.ean, declaration.ean);
    labelValue(t.brand, declaration.brand);
    if (declaration.versionNumber) labelValue(t.versionNumber, declaration.versionNumber);
    y += 6;

    // ── Section 3: EU Directives ──────────────────────────────────────────────
    checkSpace(60);
    sectionHeader(t.section3);
    doc.fontSize(8).font("Helvetica").fillColor(mutedColor)
      .text(t.section3text, 55, y, { width: pageWidth });
    y += 16;

    const directives: string[] = Array.isArray(declaration.euDirectives)
      ? declaration.euDirectives
      : (declaration.euDirectives ? JSON.parse(declaration.euDirectives) : []);

    if (directives.length === 0) {
      doc.fontSize(9).fillColor(mutedColor).text(t.noDirectives, 55, y, { width: pageWidth });
      y += 14;
    } else {
      directives.forEach((d) => {
        checkSpace(16);
        doc.fontSize(9).fillColor(textColor).font("Helvetica")
          .text(`• ${d}`, 61, y, { width: pageWidth - 10 });
        y += 14;
      });
    }
    y += 6;

    // ── Section 4: CH Regulations ─────────────────────────────────────────────
    checkSpace(60);
    sectionHeader(t.section4);
    doc.fontSize(8).font("Helvetica").fillColor(mutedColor)
      .text(t.section4text, 55, y, { width: pageWidth });
    y += 16;

    const chRegs: string[] = Array.isArray(declaration.chRegulations)
      ? declaration.chRegulations
      : (declaration.chRegulations ? JSON.parse(declaration.chRegulations) : []);

    if (chRegs.length === 0) {
      doc.fontSize(9).fillColor(mutedColor).text(t.noRegulations, 55, y, { width: pageWidth });
      y += 14;
    } else {
      chRegs.forEach((r) => {
        checkSpace(16);
        doc.fontSize(9).fillColor(textColor).font("Helvetica")
          .text(`• ${r}`, 61, y, { width: pageWidth - 10 });
        y += 14;
      });
    }
    y += 6;

    // ── Section 5: Standards ──────────────────────────────────────────────────
    checkSpace(60);
    sectionHeader(t.section5);
    doc.fontSize(8).font("Helvetica").fillColor(mutedColor)
      .text(t.section5text, 55, y, { width: pageWidth });
    y += 16;

    const standards: string[] = Array.isArray(declaration.standards)
      ? declaration.standards
      : (declaration.standards ? JSON.parse(declaration.standards) : []);

    if (standards.length === 0) {
      doc.fontSize(9).fillColor(mutedColor).text(t.noStandards, 55, y, { width: pageWidth });
      y += 14;
    } else {
      standards.forEach((s) => {
        checkSpace(16);
        doc.fontSize(9).fillColor(textColor).font("Helvetica")
          .text(`• ${s}`, 61, y, { width: pageWidth - 10 });
        y += 14;
      });
    }
    y += 6;

    // ── Section 6: Declaration text ───────────────────────────────────────────
    checkSpace(80);
    sectionHeader(t.section6);
    const sigName = declaration.signatoryName ?? declaration.supplierName ?? "–";
    const place = declaration.issuedPlace ?? "–";
    const date = formatDate(declaration.issuedDate ?? new Date(), locale);
    const declText = t.section6text(sigName, place, date);

    doc.fontSize(9).font("Helvetica").fillColor(textColor)
      .text(declText, 55, y, { width: pageWidth, lineGap: 3 });
    y += doc.heightOfString(declText, { width: pageWidth }) + 16;

    // ── Section 7: Signature ──────────────────────────────────────────────────
    checkSpace(90);
    sectionHeader(t.section7);

    // Signature box
    doc.rect(55, y, pageWidth / 2 - 10, 60).stroke("#cccccc");
    doc.fontSize(8).fillColor(mutedColor)
      .text(t.signatoryName + ":", 61, y + 6)
      .text(sigName, 61, y + 18)
      .text(t.signatoryPosition + ":", 61, y + 32)
      .text(declaration.signatoryPosition ?? "–", 61, y + 44);

    // Signed-at box
    doc.rect(55 + pageWidth / 2 + 10, y, pageWidth / 2 - 10, 60).stroke("#cccccc");
    doc.fontSize(8).fillColor(mutedColor)
      .text(t.signedAt + ":", 61 + pageWidth / 2 + 10, y + 6);
    if (declaration.signedAt) {
      doc.fontSize(9).fillColor(textColor).font("Helvetica-Bold")
        .text(formatDate(declaration.signedAt, locale), 61 + pageWidth / 2 + 10, y + 18);
    } else {
      doc.fontSize(9).fillColor(mutedColor).font("Helvetica")
        .text(t.signaturePlaceholder, 61 + pageWidth / 2 + 10, y + 30);
    }
    y += 70;

    // ── Annex A: Product variants ─────────────────────────────────────────────
    const articles: any[] = Array.isArray(declaration.articles) ? declaration.articles : [];
    const variants = articles.filter((a: any) => a.isVariant);
    if (variants.length > 0) {
      doc.addPage();
      y = 50;
      sectionHeader(t.annexA);

      // Table header
      const colWidths = [pageWidth * 0.15, pageWidth * 0.2, pageWidth * 0.2, pageWidth * 0.45];
      const headers = t.variantTable;
      doc.rect(55, y, pageWidth, 18).fill(accentColor);
      let cx = 55;
      headers.forEach((h, i) => {
        doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold")
          .text(h, cx + 4, y + 4, { width: colWidths[i] - 8 });
        cx += colWidths[i];
      });
      y += 20;

      variants.forEach((v: any, idx: number) => {
        checkSpace(20);
        if (idx % 2 === 0) doc.rect(55, y, pageWidth, 18).fill(lightGray);
        let vx = 55;
        const cells = [
          v.variantLabel ?? `V${idx + 1}`,
          v.articleNumber ?? v.internalArticleNumber ?? "–",
          v.ean ?? "–",
          v.description ?? v.productName ?? "–",
        ];
        cells.forEach((cell, i) => {
          doc.fillColor(textColor).fontSize(8).font("Helvetica")
            .text(String(cell), vx + 4, y + 4, { width: colWidths[i] - 8 });
          vx += colWidths[i];
        });
        y += 20;
      });
    }

    // ── Footer on current page ─────────────────────────────────────────────────
    // PDFKit v0.18 requires bufferedPageRange to be enabled at construction;
    // we add a simple footer only to the last page to avoid switchToPage issues.
    const footerY = doc.page.height - 35;
    doc.rect(0, footerY - 5, doc.page.width, 40).fill(accentColor);
    doc.fillColor("#ffffff").fontSize(7).font("Helvetica")
      .text(
        t.footer(declaration.docNumber ?? ""),
        55,
        footerY + 2,
        { width: pageWidth - 60, align: "left" }
      );

    doc.end();
  });
}
