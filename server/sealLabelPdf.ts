import PDFDocument from "pdfkit";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import { getActiveSealUrl } from "./routers/sealAssets";

export type SealLabelStatus = "verified" | "in_progress" | "not_verified";

export interface SealLabelOptions {
  status: SealLabelStatus;
  tenantName: string;
  tenantUrl: string;
  /** Tenant ID for loading custom seal graphics from DB (defaults to 1) */
  tenantId?: number;
  /** Optional: actual QR code PNG buffer to embed. If omitted, a placeholder is drawn. */
  qrCodeBuffer?: Buffer;
  /** Optional: tenant logo URL to display instead of plain tenantName text */
  tenantLogoUrl?: string | null;
  /** Optional: tenant primary color to override the verified-status border/accent color */
  tenantPrimaryColor?: string | null;
  /** Optional: internal Swiss verification number printed on product-specific labels */
  swissVerificationNumber?: string | null;
}

// ─── Color config ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<SealLabelStatus, { border: string; urlColor: string }> = {
  verified:     { border: "#16a34a", urlColor: "#16a34a" },
  in_progress:  { border: "#d97706", urlColor: "#d97706" },
  not_verified: { border: "#9ca3af", urlColor: "#6b7280" },
};

// Paths to the local SVG files (used for PDF generation)
// process.cwd() = /home/ubuntu/spielzeug3-compliance (project root) when running via tsx
function getSvgPath(filename: string): string {
  // Try relative to cwd first (dev server), then absolute fallback
  const cwdPath = path.resolve(process.cwd(), "../webdev-static-assets/seals", filename);
  if (fs.existsSync(cwdPath)) return cwdPath;
  // Absolute fallback for production
  return path.join("/home/ubuntu/webdev-static-assets/seals", filename);
}

const SVG_PATHS: Record<SealLabelStatus, string> = {
  verified:     getSvgPath("seal-verified.svg"),
  in_progress:  getSvgPath("seal-in-progress.svg"),
  not_verified: getSvgPath("seal-not-verified.svg"),
};

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function setFill(doc: PDFKit.PDFDocument, hex: string) {
  doc.fillColor(hexToRgb(hex));
}

function setStroke(doc: PDFKit.PDFDocument, hex: string) {
  doc.strokeColor(hexToRgb(hex));
}

function escapeSvgText(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[char] ?? char));
}

async function loadSealGraphicPng(status: SealLabelStatus, tenantId: number): Promise<Buffer> {
  try {
    const activeUrl = await getActiveSealUrl(tenantId, status);
    const response = await fetch(activeUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return sharp(Buffer.from(await response.arrayBuffer()))
      .resize(800, 880, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    const svgPath = SVG_PATHS[status];
    return sharp(fs.readFileSync(svgPath))
      .resize(800, 880, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
  }
}

// ─── QR placeholder ───────────────────────────────────────────────────────────

/** Draw a clean QR-code placeholder pattern (no logo overlay) */
function drawQrPlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  const cell = size / 21;

  // Background
  doc.save();
  doc.roundedRect(x, y, size, size, 4);
  setFill(doc, "#f3f4f6");
  doc.fill();
  doc.restore();

  // Finder patterns
  const finderPositions: [number, number][] = [[0, 0], [14, 0], [0, 14]];
  finderPositions.forEach(([col, row]) => {
    const fx = x + col * cell;
    const fy = y + row * cell;
    doc.save();
    doc.roundedRect(fx, fy, 7 * cell, 7 * cell, 2);
    setStroke(doc, "#1f2937");
    doc.lineWidth(cell * 0.8);
    doc.stroke();
    doc.restore();
    doc.save();
    doc.roundedRect(fx + 2 * cell, fy + 2 * cell, 3 * cell, 3 * cell, 1);
    setFill(doc, "#1f2937");
    doc.fill();
    doc.restore();
  });

  // Data modules
  const dataModules: [number, number][] = [
    [8, 0], [10, 0], [12, 0], [8, 2], [11, 2], [9, 4], [12, 4], [8, 6], [10, 6],
    [0, 8], [2, 8], [4, 8], [8, 8], [10, 8], [12, 8], [14, 8], [16, 8], [18, 8], [20, 8],
    [1, 9], [3, 9], [9, 9], [11, 9],
    [0, 10], [2, 10], [4, 10], [8, 10], [12, 10], [14, 10], [16, 10], [18, 10],
    [1, 11], [3, 11], [9, 11], [11, 11], [13, 11],
    [0, 12], [2, 12], [8, 12], [10, 12], [12, 12],
    [14, 14], [16, 14], [18, 14], [20, 14],
    [15, 15], [17, 15], [19, 15],
    [14, 16], [16, 16], [20, 16],
    [15, 17], [17, 17], [19, 17],
    [14, 18], [16, 18], [18, 18], [20, 18],
    [15, 19], [19, 19],
    [14, 20], [16, 20], [18, 20], [20, 20],
  ];

  doc.save();
  setFill(doc, "#1f2937");
  dataModules.forEach(([col, row]) => {
    doc.rect(x + col * cell, y + row * cell, cell * 0.85, cell * 0.85).fill();
  });
  doc.restore();
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generate a print-ready PDF of the Swiss Product Seal label.
 * Output size: A6 (105 × 148 mm).
 * The seal graphic is rendered from the same SVG used in the HTML preview,
 * ensuring pixel-identical appearance across HTML, PDF, and embed widgets.
 */
export async function generateSealLabelPdf(opts: SealLabelOptions): Promise<Buffer> {
  const { status, tenantName, tenantUrl, qrCodeBuffer, tenantId = 1, tenantLogoUrl, tenantPrimaryColor, swissVerificationNumber } = opts;
  // Apply tenant primary color to verified status only; keep semantic colors for others
  const baseCfg = STATUS_COLORS[status];
  const cfg = (status === "verified" && tenantPrimaryColor && /^#[0-9A-Fa-f]{6}$/.test(tenantPrimaryColor))
    ? { border: tenantPrimaryColor, urlColor: tenantPrimaryColor }
    : baseCfg;

  // ── Load seal graphic: DB custom upload → local SVG → CDN PNG fallback ────────────
  let sealPng: Buffer;
  try {
    // 1. Try DB-stored custom URL (could be PNG or SVG)
    const activeUrl = await getActiveSealUrl(tenantId, status);
    const res = await fetch(activeUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const imgBuffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("svg")) {
      // SVG needs rasterization
      sealPng = await sharp(imgBuffer).resize(400, 440).png().toBuffer();
    } else {
      // PNG/JPEG: resize to consistent dimensions
      sealPng = await sharp(imgBuffer).resize(400, 440, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    }
  } catch {
    // 2. Local SVG fallback
    try {
      const svgPath = SVG_PATHS[status];
      const svgBuffer = fs.readFileSync(svgPath);
      sealPng = await sharp(svgBuffer).resize(400, 440).png().toBuffer();
    } catch {
      // 3. CDN PNG fallback
      const cdnUrls: Record<SealLabelStatus, string> = {
        verified:
          "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-verified_75b748c3.png",
        in_progress:
          "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-in-progress_65b28caf.png",
        not_verified:
          "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-not-verified_119c8334.png",
      };
      const fallbackRes = await fetch(cdnUrls[status]);
      const fallbackBuf = Buffer.from(await fallbackRes.arrayBuffer());
      sealPng = await sharp(fallbackBuf).resize(400, 440, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    }
  }

  // ── Load tenant logo PNG (before Promise, so we can use await) ────────────
  let logoPng: Buffer | null = null;
  if (tenantLogoUrl) {
    try {
      const logoRes = await fetch(tenantLogoUrl);
      if (logoRes.ok) {
        const logoBuf = Buffer.from(await logoRes.arrayBuffer());
        logoPng = await sharp(logoBuf)
          .resize(200, 64, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
          .png()
          .toBuffer();
      }
    } catch {
      // Logo load failed – fall back to text
    }
  }

  return new Promise((resolve, reject) => {
    // A6 in points: 297.64 × 419.53 pt
    const doc = new PDFDocument({ size: "A6", margin: 0, bufferPages: false });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;   // ~297.6 pt
    const H = doc.page.height;  // ~419.5 pt
    const margin = 14;

    // ── OUTER BORDER ──────────────────────────────────────────────────────────
    doc.save();
    doc.roundedRect(margin, margin, W - margin * 2, H - margin * 2, 10);
    setStroke(doc, cfg.border);
    doc.lineWidth(2);
    doc.stroke();
    doc.restore();

    // ── SEAL GRAPHIC (SVG rendered as PNG) ────────────────────────────────────
    const sealW = 130;   // display width in pt
    const sealH = 143;   // display height in pt (200:220 ratio)
    const sealX = (W - sealW) / 2;
    const sealY = margin + 14;

    doc.image(sealPng, sealX, sealY, { width: sealW, height: sealH });

    // ── QR CODE SECTION ───────────────────────────────────────────────────────
    const qrSize = 110;
    const qrX = (W - qrSize) / 2;
    const qrY = sealY + sealH + 12;

    if (qrCodeBuffer) {
      // Background
      doc.save();
      doc.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 6);
      setFill(doc, "#f3f4f6");
      doc.fill();
      doc.restore();
      // Actual QR code – no overlay
      doc.image(qrCodeBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    } else {
      drawQrPlaceholder(doc, qrX, qrY, qrSize);
    }

    // "Scan for compliance info"
    doc.save();
    setFill(doc, "#9ca3af");
    doc.fontSize(7.5).font("Helvetica");
    doc.text("Scan for compliance info", 0, qrY + qrSize + 7, { width: W, align: "center" });
    doc.restore();

    // ── INTERNAL SWISS VERIFICATION NUMBER ─────────────────────────────────────
    const verificationY = qrY + qrSize + 19;
    if (swissVerificationNumber) {
      doc.save();
      setFill(doc, "#9ca3af");
      doc.fontSize(6.5).font("Helvetica");
      doc.text("CH VERIFICATION NO.", 0, verificationY, { width: W, align: "center" });
      setFill(doc, "#111111");
      doc.fontSize(8).font("Courier-Bold");
      doc.text(swissVerificationNumber, 0, verificationY + 8, { width: W, align: "center" });
      doc.restore();
    }

    // ── DIVIDER ───────────────────────────────────────────────────────────────
    const divY = qrY + qrSize + (swissVerificationNumber ? 38 : 22);
    doc.save();
    doc.moveTo(margin + 16, divY).lineTo(W - margin - 16, divY);
    setStroke(doc, "#e5e7eb");
    doc.lineWidth(0.6);
    doc.stroke();
    doc.restore();

        // ── IMPORTED BY SECTION ─────────────────────────────────────────────
    const impY = divY + 9;

    doc.save();
    setFill(doc, "#9ca3af");
    doc.fontSize(7).font("Helvetica-Oblique");
    doc.text("Imported by", 0, impY, { width: W, align: "center" });
    doc.restore();

    // If tenant has a logo (pre-loaded above), embed it; otherwise fall back to text
    if (logoPng) {
      const logoW = 80;
      const logoH = 26;
      const logoX = (W - logoW) / 2;
      doc.image(logoPng, logoX, impY + 9, { width: logoW, height: logoH });
    } else {
      doc.save();
      setFill(doc, "#111111");
      doc.fontSize(10).font("Helvetica-Bold");
      doc.text(tenantName, 0, impY + 11, { width: W, align: "center" });
      doc.restore();
    }

    doc.save();
    setFill(doc, cfg.urlColor);
    doc.fontSize(8).font("Helvetica-Bold");
    doc.text(tenantUrl, 0, impY + 39, { width: W, align: "center" });
    doc.restore();

    doc.end();
  });
}

/**
 * Create a print-ready PNG label at 300 dpi (1240 × 1748 px, A6 ratio).
 * It deliberately uses only the shipped Sharp dependency, so it works in
 * deployed environments without relying on Poppler or other OS binaries.
 */
export async function generateSealLabelPng(opts: SealLabelOptions): Promise<Buffer> {
  const {
    status, tenantName, tenantUrl, qrCodeBuffer, tenantId = 1,
    tenantLogoUrl, tenantPrimaryColor, swissVerificationNumber,
  } = opts;
  const baseCfg = STATUS_COLORS[status];
  const cfg = (status === "verified" && tenantPrimaryColor && /^#[0-9A-Fa-f]{6}$/.test(tenantPrimaryColor))
    ? { border: tenantPrimaryColor, urlColor: tenantPrimaryColor }
    : baseCfg;
  const width = 1240;
  const height = 1748;
  const sealPng = await loadSealGraphicPng(status, tenantId);

  let tenantLogo: Buffer | null = null;
  if (tenantLogoUrl) {
    try {
      const response = await fetch(tenantLogoUrl);
      if (response.ok) {
        tenantLogo = await sharp(Buffer.from(await response.arrayBuffer()))
          .resize(360, 96, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
          .png()
          .toBuffer();
      }
    } catch {
      tenantLogo = null;
    }
  }

  let qrPng: Buffer | null = null;
  if (qrCodeBuffer) {
    qrPng = await sharp(qrCodeBuffer).resize(470, 470, { fit: "contain" }).png().toBuffer();
  }

  const verificationBlock = swissVerificationNumber
    ? `<text x="620" y="1278" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#9ca3af" letter-spacing="1.5">CH VERIFICATION NO.</text>
       <text x="620" y="1322" text-anchor="middle" font-family="monospace" font-size="32" font-weight="700" fill="#111827">${escapeSvgText(swissVerificationNumber)}</text>`
    : "";
  const dividerY = swissVerificationNumber ? 1360 : 1270;
  const importedY = dividerY + 48;
  const tenantText = tenantLogo ? "" : `<text x="620" y="${importedY + 65}" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="700" fill="#111827">${escapeSvgText(tenantName)}</text>`;
  const urlY = tenantLogo ? importedY + 150 : importedY + 118;
  const textOverlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="60" y="60" width="1120" height="1628" rx="42" fill="#ffffff" stroke="${cfg.border}" stroke-width="10"/>
    <text x="620" y="1218" text-anchor="middle" font-family="Arial, sans-serif" font-size="27" fill="#9ca3af">Scan for compliance info</text>
    ${verificationBlock}
    <line x1="145" x2="1095" y1="${dividerY}" y2="${dividerY}" stroke="#e5e7eb" stroke-width="3"/>
    <text x="620" y="${importedY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-style="italic" fill="#9ca3af">Imported by</text>
    ${tenantText}
    <text x="620" y="${urlY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="27" font-weight="700" fill="${cfg.urlColor}">${escapeSvgText(tenantUrl)}</text>
  </svg>`);

  const composites: sharp.OverlayOptions[] = [
    { input: textOverlay, top: 0, left: 0 },
    { input: sealPng, top: 100, left: 220 },
  ];
  if (qrPng) composites.push({ input: qrPng, top: 680, left: 385 });
  if (tenantLogo) composites.push({ input: tenantLogo, top: importedY + 22, left: 440 });

  return sharp({
    create: { width, height, channels: 4, background: "#ffffff" },
  }).composite(composites).png({ compressionLevel: 8 }).toBuffer();
}
