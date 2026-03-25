import PDFDocument from "pdfkit";

export type SealLabelStatus = "verified" | "in_progress" | "not_verified";

export interface SealLabelOptions {
  status: SealLabelStatus;
  tenantName: string;
  tenantUrl: string;
  /** Optional: actual QR code PNG buffer to embed. If omitted, a placeholder is drawn. */
  qrCodeBuffer?: Buffer;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<
  SealLabelStatus,
  { shieldStroke: string; shieldFill: string; checkColor: string; bannerBg: string; urlColor: string; border: string }
> = {
  verified: {
    shieldStroke: "#c8102e",
    shieldFill: "#fef2f2",
    checkColor: "#c8102e",
    bannerBg: "#2d7a3a",
    urlColor: "#c8102e",
    border: "#c8102e",
  },
  in_progress: {
    shieldStroke: "#d97706",
    shieldFill: "#fffbeb",
    checkColor: "#d97706",
    bannerBg: "#d97706",
    urlColor: "#d97706",
    border: "#d97706",
  },
  not_verified: {
    shieldStroke: "#9ca3af",
    shieldFill: "#f9fafb",
    checkColor: "#9ca3af",
    bannerBg: "#6b7280",
    urlColor: "#9ca3af",
    border: "#9ca3af",
  },
};

const STATUS_LABELS: Record<SealLabelStatus, string> = {
  verified: "VERIFIED",
  in_progress: "IN PROGRESS",
  not_verified: "NOT VERIFIED",
};

// ─── PDFKit draw helpers ──────────────────────────────────────────────────────

/** Convert hex color to [r, g, b] 0-255 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function setFill(doc: PDFKit.PDFDocument, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.fillColor([r, g, b]);
}

function setStroke(doc: PDFKit.PDFDocument, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.strokeColor([r, g, b]);
}

/**
 * Draw the hexagonal shield shape.
 * Centre at (cx, cy), radius r.
 */
function drawShield(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  r: number,
  fillHex: string,
  strokeHex: string,
  strokeWidth = 2.5
) {
  // Hexagonal shield: flat-top hexagon with slight bottom taper
  // Points: top-left, top-right, right, bottom-right, bottom, bottom-left, left
  const pts = [
    [cx - r * 0.55, cy - r * 0.85], // top-left
    [cx + r * 0.55, cy - r * 0.85], // top-right
    [cx + r * 0.9,  cy - r * 0.2],  // right
    [cx + r * 0.65, cy + r * 0.75], // bottom-right
    [cx,            cy + r],         // bottom tip
    [cx - r * 0.65, cy + r * 0.75], // bottom-left
    [cx - r * 0.9,  cy - r * 0.2],  // left
  ];

  doc.save();
  doc.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    doc.lineTo(pts[i][0], pts[i][1]);
  }
  doc.closePath();
  setFill(doc, fillHex);
  setStroke(doc, strokeHex);
  doc.lineWidth(strokeWidth);
  doc.fillAndStroke();
  doc.restore();
}

/** Draw inner shield outline (thinner, lighter) */
function drawShieldInner(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  r: number,
  strokeHex: string
) {
  const scale = 0.82;
  const pts = [
    [cx - r * 0.55 * scale, cy - r * 0.85 * scale + 2],
    [cx + r * 0.55 * scale, cy - r * 0.85 * scale + 2],
    [cx + r * 0.9  * scale, cy - r * 0.2  * scale + 2],
    [cx + r * 0.65 * scale, cy + r * 0.75 * scale + 2],
    [cx,                    cy + r         * scale + 2],
    [cx - r * 0.65 * scale, cy + r * 0.75 * scale + 2],
    [cx - r * 0.9  * scale, cy - r * 0.2  * scale + 2],
  ];

  doc.save();
  doc.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    doc.lineTo(pts[i][0], pts[i][1]);
  }
  doc.closePath();
  setStroke(doc, strokeHex);
  doc.lineWidth(0.8);
  doc.opacity(0.3);
  doc.stroke();
  doc.restore();
}

/** Draw a large checkmark at (cx, cy) with arm length ~size */
function drawCheckmark(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  size: number,
  colorHex: string
) {
  // Checkmark: left arm goes down-right, right arm goes up-right
  const x1 = cx - size * 0.45;
  const y1 = cy + size * 0.05;
  const x2 = cx - size * 0.05;
  const y2 = cy + size * 0.45;
  const x3 = cx + size * 0.5;
  const y3 = cy - size * 0.45;

  doc.save();
  doc.moveTo(x1, y1).lineTo(x2, y2).lineTo(x3, y3);
  setStroke(doc, colorHex);
  doc.lineWidth(size * 0.18);
  doc.lineCap("round");
  doc.lineJoin("round");
  doc.stroke();
  doc.restore();
}

/** Draw a small shield icon (for QR overlay) */
function drawSmallShield(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  r: number,
  fillHex: string
) {
  const pts = [
    [cx - r * 0.55, cy - r * 0.85],
    [cx + r * 0.55, cy - r * 0.85],
    [cx + r * 0.9,  cy - r * 0.2 ],
    [cx + r * 0.65, cy + r * 0.75],
    [cx,            cy + r        ],
    [cx - r * 0.65, cy + r * 0.75],
    [cx - r * 0.9,  cy - r * 0.2 ],
  ];
  doc.save();
  doc.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i][0], pts[i][1]);
  doc.closePath();
  setFill(doc, fillHex);
  doc.fill();
  doc.restore();
}

/** Draw a simple QR-code placeholder pattern */
function drawQrPlaceholder(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  size: number,
  logoColor: string
) {
  const cell = size / 21; // 21×21 QR grid

  // Background
  doc.save();
  doc.roundedRect(x, y, size, size, 4);
  setFill(doc, "#f3f4f6");
  doc.fill();
  doc.restore();

  // Draw finder patterns (three corner squares)
  const finderPositions = [
    [0, 0],
    [14, 0],
    [0, 14],
  ] as [number, number][];

  finderPositions.forEach(([col, row]) => {
    const fx = x + col * cell;
    const fy = y + row * cell;
    // Outer square
    doc.save();
    doc.roundedRect(fx, fy, 7 * cell, 7 * cell, 2);
    setStroke(doc, "#111111");
    doc.lineWidth(cell * 0.8);
    doc.stroke();
    doc.restore();
    // Inner filled square
    doc.save();
    doc.roundedRect(fx + 2 * cell, fy + 2 * cell, 3 * cell, 3 * cell, 1);
    setFill(doc, "#111111");
    doc.fill();
    doc.restore();
  });

  // Simulate data modules (simple pattern)
  const dataModules = [
    [8, 0], [10, 0], [12, 0],
    [8, 2], [11, 2],
    [9, 4], [12, 4],
    [8, 6], [10, 6],
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
  ] as [number, number][];

  doc.save();
  setFill(doc, "#111111");
  dataModules.forEach(([col, row]) => {
    doc.rect(x + col * cell, y + row * cell, cell * 0.85, cell * 0.85).fill();
  });
  doc.restore();

  // White circle overlay for logo
  const cx = x + size / 2;
  const cy = y + size / 2;
  const circleR = size * 0.14;
  doc.save();
  doc.circle(cx, cy, circleR);
  setFill(doc, "#ffffff");
  doc.fill();
  doc.restore();

  // Small shield icon in centre
  drawSmallShield(doc, cx, cy - circleR * 0.05, circleR * 0.75, logoColor);

  // Tiny checkmark on shield
  doc.save();
  const ck = circleR * 0.35;
  doc.moveTo(cx - ck * 0.45, cy + ck * 0.05)
    .lineTo(cx - ck * 0.05, cy + ck * 0.45)
    .lineTo(cx + ck * 0.5, cy - ck * 0.45);
  setStroke(doc, "#ffffff");
  doc.lineWidth(ck * 0.25);
  doc.lineCap("round");
  doc.lineJoin("round");
  doc.stroke();
  doc.restore();
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generate a print-ready PDF of the Swiss Product Seal label.
 * Output size: A6 (105 × 148 mm) – ideal for product labels.
 */
export function generateSealLabelPdf(opts: SealLabelOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { status, tenantName, tenantUrl, qrCodeBuffer } = opts;
    const cfg = STATUS_COLORS[status];
    const statusLabel = STATUS_LABELS[status];

    // A6 in points: 297.64 × 419.53 pt
    const doc = new PDFDocument({
      size: "A6",
      margin: 0,
      bufferPages: false,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;   // ~297.6 pt
    const H = doc.page.height;  // ~419.5 pt

    // ── OUTER BORDER ──────────────────────────────────────────────────────────
    const margin = 14;
    const innerW = W - margin * 2;
    const innerH = H - margin * 2;

    doc.save();
    doc.roundedRect(margin, margin, innerW, innerH, 10);
    setStroke(doc, cfg.border);
    doc.lineWidth(2);
    doc.stroke();
    doc.restore();

    // ── SHIELD SECTION ────────────────────────────────────────────────────────
    const shieldCX = W / 2;
    const shieldCY = margin + 78;
    const shieldR = 52;

    drawShield(doc, shieldCX, shieldCY, shieldR, cfg.shieldFill, cfg.shieldStroke, 2.5);
    drawShieldInner(doc, shieldCX, shieldCY, shieldR, cfg.shieldStroke);

    // Large checkmark
    drawCheckmark(doc, shieldCX, shieldCY - 4, shieldR * 0.55, cfg.checkColor);

    // "SWISS PRODUCT SEAL" text below checkmark, inside shield
    doc.save();
    setFill(doc, "#444444");
    doc.fontSize(6.5).font("Helvetica-Bold");
    doc.text("SWISS PRODUCT SEAL", shieldCX - 50, shieldCY + shieldR * 0.55, {
      width: 100,
      align: "center",
      characterSpacing: 0.8,
    });
    doc.restore();

    // ── STATUS BANNER (overlaps shield bottom) ────────────────────────────────
    const bannerW = 90;
    const bannerH = 16;
    const bannerX = shieldCX - bannerW / 2;
    const bannerY = shieldCY + shieldR * 0.72;

    doc.save();
    doc.roundedRect(bannerX, bannerY, bannerW, bannerH, 8);
    setFill(doc, cfg.bannerBg);
    doc.fill();
    doc.restore();

    doc.save();
    setFill(doc, "#ffffff");
    doc.fontSize(7.5).font("Helvetica-Bold");
    doc.text(statusLabel, bannerX, bannerY + 4, {
      width: bannerW,
      align: "center",
      characterSpacing: 1.5,
    });
    doc.restore();

    // ── QR CODE SECTION ───────────────────────────────────────────────────────
    const qrSize = 110;
    const qrX = (W - qrSize) / 2;
    const qrY = bannerY + bannerH + 18;

    if (qrCodeBuffer) {
      // Embed actual QR code image
      doc.save();
      doc.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 6);
      setFill(doc, "#f3f4f6");
      doc.fill();
      doc.restore();

      doc.image(qrCodeBuffer, qrX, qrY, { width: qrSize, height: qrSize });

      // White circle + small shield overlay
      const cx = qrX + qrSize / 2;
      const cy = qrY + qrSize / 2;
      const circleR = qrSize * 0.14;
      doc.save();
      doc.circle(cx, cy, circleR);
      setFill(doc, "#ffffff");
      doc.fill();
      doc.restore();
      drawSmallShield(doc, cx, cy - circleR * 0.05, circleR * 0.75, cfg.checkColor);
      doc.save();
      const ck = circleR * 0.35;
      doc.moveTo(cx - ck * 0.45, cy + ck * 0.05)
        .lineTo(cx - ck * 0.05, cy + ck * 0.45)
        .lineTo(cx + ck * 0.5, cy - ck * 0.45);
      setStroke(doc, "#ffffff");
      doc.lineWidth(ck * 0.25);
      doc.lineCap("round");
      doc.lineJoin("round");
      doc.stroke();
      doc.restore();
    } else {
      // Draw placeholder
      drawQrPlaceholder(doc, qrX, qrY, qrSize, cfg.checkColor);
    }

    // "Scan for compliance info"
    doc.save();
    setFill(doc, "#9ca3af");
    doc.fontSize(7.5).font("Helvetica");
    doc.text("Scan for compliance info", 0, qrY + qrSize + 8, {
      width: W,
      align: "center",
    });
    doc.restore();

    // ── DIVIDER ───────────────────────────────────────────────────────────────
    const divY = qrY + qrSize + 24;
    doc.save();
    doc.moveTo(margin + 16, divY).lineTo(W - margin - 16, divY);
    setStroke(doc, "#e5e7eb");
    doc.lineWidth(0.6);
    doc.stroke();
    doc.restore();

    // ── IMPORTED BY SECTION ───────────────────────────────────────────────────
    const impY = divY + 10;

    // "Imported by" italic label
    doc.save();
    setFill(doc, "#9ca3af");
    doc.fontSize(7).font("Helvetica-Oblique");
    doc.text("Imported by", 0, impY, { width: W, align: "center" });
    doc.restore();

    // Company name
    doc.save();
    setFill(doc, "#111111");
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text(tenantName, 0, impY + 12, { width: W, align: "center" });
    doc.restore();

    // URL
    doc.save();
    setFill(doc, cfg.urlColor);
    doc.fontSize(8).font("Helvetica-Bold");
    doc.text(tenantUrl, 0, impY + 26, { width: W, align: "center" });
    doc.restore();

    doc.end();
  });
}
