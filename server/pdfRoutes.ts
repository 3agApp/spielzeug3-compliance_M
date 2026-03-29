import type { Express } from "express";
import { sdk } from "./_core/sdk";
import QRCode from "qrcode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import sharp from "sharp";

/**
 * Convert a PDF buffer to a high-resolution PNG using pdftoppm (poppler).
 * Returns a PNG Buffer of the first page at 150 dpi.
 */
async function pdfToPng(pdfBuffer: Buffer, dpi = 150): Promise<Buffer> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seal-png-"));
  const pdfPath = path.join(tmpDir, "seal.pdf");
  const outBase = path.join(tmpDir, "page");
  try {
    fs.writeFileSync(pdfPath, pdfBuffer);
    const result = spawnSync(
      "pdftoppm",
      ["-r", String(dpi), "-png", "-singlefile", pdfPath, outBase],
      { timeout: 15_000 }
    );
    if (result.status !== 0) {
      throw new Error(`pdftoppm failed: ${result.stderr?.toString()}`);
    }
    const pngPath = `${outBase}.png`;
    if (!fs.existsSync(pngPath)) {
      throw new Error("pdftoppm produced no output file");
    }
    // Use sharp to ensure clean RGBA PNG with transparent background
    const pngBuffer = await sharp(pngPath)
      .png({ compressionLevel: 6 })
      .toBuffer();
    return pngBuffer;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
import {
  getAiAnalysisHistory,
  getLatestAiAnalysisByProduct,
  getProductById,
  getSupplierById,
  getDb,
} from "./db";
import { generateAiAnalysisPdf } from "./pdfGenerator";
import { generateSealLabelPdf, type SealLabelStatus } from "./sealLabelPdf";
import { generateRiskReportPdf } from "./riskReportPdf";
import { getTenantById } from "./tenantDb";
import { productRiskAssessments } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export function registerPdfRoutes(app: Express) {
  /**
   * GET /api/reports/ai-analysis/:productId
   * Returns the latest AI analysis as a PDF download.
   * Query param ?analysisId=N to download a specific historical analysis.
   */
  app.get("/api/reports/ai-analysis/:productId", async (req, res) => {
    try {
      // Authenticate
      let user: any;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Nicht authentifiziert" });
        return;
      }

      const productId = parseInt(req.params.productId ?? "0");
      if (!productId || isNaN(productId)) {
        res.status(400).json({ error: "Ungültige Produkt-ID" });
        return;
      }

      // Load product
      const product = await getProductById(productId);
      if (!product) {
        res.status(404).json({ error: "Produkt nicht gefunden" });
        return;
      }

      // Load analysis – specific one or latest
      let analysis: any;
      const analysisIdParam = req.query.analysisId;
      if (analysisIdParam) {
        const history = await getAiAnalysisHistory(productId);
        analysis = history.find((h) => h.id === parseInt(String(analysisIdParam)));
      } else {
        analysis = await getLatestAiAnalysisByProduct(productId);
      }

      if (!analysis) {
        res.status(404).json({ error: "Keine KI-Analyse vorhanden" });
        return;
      }

      // Optionally enrich with supplier name
      let supplierName: string | null = null;
      if ((product as any).supplierId) {
        const supplier = await getSupplierById((product as any).supplierId);
        supplierName = supplier?.name ?? null;
      }

      const pdfBuffer = await generateAiAnalysisPdf({
        product: {
          productName: (product as any).productName,
          internalArticleNumber: (product as any).internalArticleNumber,
          supplierArticleNumber: (product as any).supplierArticleNumber,
          ean: (product as any).ean,
          brand: (product as any).brand,
          status: (product as any).status,
          supplierName,
        },
        analysis: {
          id: analysis.id,
          overallScore: analysis.overallScore,
          documentCompletenessScore: analysis.documentCompletenessScore,
          contentPlausibilityScore: analysis.contentPlausibilityScore,
          formalCorrectnessScore: analysis.formalCorrectnessScore,
          consistencyScore: analysis.consistencyScore,
          summary: analysis.summary,
          findings: analysis.findings,
          recommendations: analysis.recommendations,
          modelUsed: analysis.modelUsed,
          tokensUsed: analysis.tokensUsed,
          createdAt: analysis.createdAt,
          triggeredByUserName: null,
        },
      });

      const safeName = ((product as any).productName ?? "produkt")
        .replace(/[^a-zA-Z0-9äöüÄÖÜß\-_]/g, "_")
        .slice(0, 50);
      const filename = `KI-Analyse_${safeName}_${new Date(analysis.createdAt).toISOString().slice(0, 10)}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[PDF] Generation failed:", err);
      res.status(500).json({ error: "PDF-Generierung fehlgeschlagen", details: err.message });
    }
  });

  /**
   * GET /api/reports/seal-label
   * Generates a print-ready A6 PDF of the Swiss Product Seal label.
   * Query params:
   *   status=verified|in_progress|not_verified  (default: verified)
   *   tenantId=1                                 (default: 1)
   *   productId=N                                (optional – embeds the real QR code from S3)
   * Authentication: required (session cookie).
   */
  app.get("/api/reports/seal-label", async (req, res) => {
    try {
      // Authenticate
      try {
        await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Nicht authentifiziert" });
        return;
      }

      // Parse params
      const rawStatus = String(req.query.status ?? "verified");
      const allowedStatuses: SealLabelStatus[] = ["verified", "in_progress", "not_verified"];
      const status: SealLabelStatus = allowedStatuses.includes(rawStatus as SealLabelStatus)
        ? (rawStatus as SealLabelStatus)
        : "verified";

      const tenantId = parseInt(String(req.query.tenantId ?? "1"));
      const productIdParam = req.query.productId ? parseInt(String(req.query.productId)) : null;

      // Load tenant info
      const tenant = await getTenantById(isNaN(tenantId) ? 1 : tenantId);
      const tenantName = tenant?.name ?? "Swiss Product Seal";
      const tenantUrl = (tenant as any)?.websiteUrl ?? "swiss-product-seal.ch";
      const tenantLogoUrl: string | null = (tenant as any)?.logoUrl ?? null;
      const tenantPrimaryColor: string | null = (tenant as any)?.primaryColor ?? null;

      // Optionally load real QR code from S3
      let qrCodeBuffer: Buffer | undefined;
      let productName: string | undefined;
      if (productIdParam && !isNaN(productIdParam)) {
        const product = await getProductById(productIdParam);
        if (product) {
          productName = (product as any).productName ?? undefined;
          const qrUrl: string | null = (product as any).qrCodeUrl ?? null;
          if (qrUrl) {
            try {
              const response = await fetch(qrUrl);
              if (response.ok) {
                const arrayBuf = await response.arrayBuffer();
                qrCodeBuffer = Buffer.from(arrayBuf);
              }
            } catch (fetchErr) {
              console.warn("[PDF] Could not fetch QR code from S3, using placeholder:", fetchErr);
            }
          }
        }
      }

      // Generate PDF
      const pdfBuffer = await generateSealLabelPdf({
        status,
        tenantName,
        tenantUrl,
        tenantLogoUrl,
        tenantPrimaryColor,
        qrCodeBuffer,
        tenantId: isNaN(tenantId) ? 1 : tenantId,
      });

      const statusSlug = status.replace(/_/g, "-");
      const safeName = productName
        ? `_${productName.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_]/g, "_").slice(0, 40)}`
        : "";
      const filename = `Swiss-Product-Seal${safeName}_${statusSlug}_${new Date().toISOString().slice(0, 10)}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[PDF] Seal label generation failed:", err);
      res.status(500).json({ error: "PDF-Generierung fehlgeschlagen", details: err.message });
    }
  });

  /**
   * GET /api/reports/seal-label-example
   * Generates a sample Swiss Product Seal PDF (status=verified).
   * The embedded QR code points to /seal-info – NOT to a real product page.
   * No authentication required so the file can be shared freely.
   * Query params:
   *   tenantId=1  (optional, for tenant branding)
   *   format=pdf|png  (default: pdf)
   */
  app.get("/api/reports/seal-label-example", async (req, res) => {
    try {
      const tenantId = parseInt(String(req.query.tenantId ?? "1"));
      const format = String(req.query.format ?? "pdf") === "png" ? "png" : "pdf";

      // Load tenant branding (best-effort)
      const tenant = await getTenantById(isNaN(tenantId) ? 1 : tenantId).catch(() => null);
      const tenantName = (tenant as any)?.name ?? "Swiss Product Seal";
      const tenantUrl = (tenant as any)?.websiteUrl ?? "swiss-product-seal.ch";
      const tenantLogoUrl: string | null = (tenant as any)?.logoUrl ?? null;
      const tenantPrimaryColor: string | null = (tenant as any)?.primaryColor ?? null;

      // Build QR code pointing to /seal-info (absolute URL based on request host)
      const proto = req.headers["x-forwarded-proto"] ?? "https";
      const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "swiss-product-seal.ch";
      const sealInfoUrl = `${proto}://${host}/seal-info`;
      const qrCodeBuffer = Buffer.from(
        await QRCode.toBuffer(sealInfoUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 300,
          color: { dark: "#1f2937", light: "#ffffff" },
        })
      );

      const pdfBuffer = await generateSealLabelPdf({
        status: "verified",
        tenantName,
        tenantUrl,
        tenantLogoUrl,
        tenantPrimaryColor,
        qrCodeBuffer,
        tenantId: isNaN(tenantId) ? 1 : tenantId,
      });

      const date = new Date().toISOString().slice(0, 10);

      if (format === "png") {
        // Render first page of PDF to PNG at 300 dpi (print-ready)
        const pngBuffer = await pdfToPng(pdfBuffer, 300);
        const pngFilename = `Swiss-Product-Seal_BEISPIEL_verified_${date}.png`;
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Disposition", `attachment; filename="${pngFilename}"`);
        res.setHeader("Content-Length", pngBuffer.length);
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.send(pngBuffer);
        return;
      }

      const filename = `Swiss-Product-Seal_BEISPIEL_verified_${date}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      // Allow caching for 1 hour (static example)
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[PDF] Example seal label generation failed:", err);
      res.status(500).json({ error: "PDF-Generierung fehlgeschlagen", details: err.message });
    }
  });

  /**
   * GET /api/reports/risk-assessment/:productId
   * Returns the latest (or a specific) risk assessment as a PDF download.
   * Query param ?assessmentId=N to download a specific historical assessment.
   * Authentication: required (session cookie).
   */
  app.get("/api/reports/risk-assessment/:productId", async (req, res) => {
    try {
      // Authenticate
      let user: any;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Nicht authentifiziert" });
        return;
      }

      const productId = parseInt(req.params.productId ?? "0");
      if (!productId || isNaN(productId)) {
        res.status(400).json({ error: "Ungültige Produkt-ID" });
        return;
      }

      // Load product
      const product = await getProductById(productId);
      if (!product) {
        res.status(404).json({ error: "Produkt nicht gefunden" });
        return;
      }

      // Load assessment – specific or latest completed
      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Datenbank nicht verfügbar" });
        return;
      }

      let assessment: any;
      const assessmentIdParam = req.query.assessmentId;
      if (assessmentIdParam) {
        const [found] = await db.select().from(productRiskAssessments)
          .where(and(
            eq(productRiskAssessments.productId, productId),
            eq(productRiskAssessments.id, parseInt(String(assessmentIdParam)))
          ))
          .limit(1);
        assessment = found ?? null;
      } else {
        const [latest] = await db.select().from(productRiskAssessments)
          .where(and(
            eq(productRiskAssessments.productId, productId),
            eq(productRiskAssessments.status, "completed")
          ))
          .orderBy(desc(productRiskAssessments.createdAt))
          .limit(1);
        assessment = latest ?? null;
      }

      if (!assessment) {
        res.status(404).json({ error: "Keine Risikobewertung vorhanden" });
        return;
      }

      // Enrich with supplier name
      let supplierName: string | null = null;
      if ((product as any).supplierId) {
        const supplier = await getSupplierById((product as any).supplierId);
        supplierName = supplier?.name ?? null;
      }

      // Parse risks and missingInfo from JSON strings if needed
      const risks = typeof assessment.risks === "string"
        ? JSON.parse(assessment.risks)
        : (assessment.risks ?? []);
      const missingInfo = typeof assessment.missingInfo === "string"
        ? JSON.parse(assessment.missingInfo)
        : (assessment.missingInfo ?? []);

      const pdfBuffer = await generateRiskReportPdf({
        product: {
          productName: (product as any).productName,
          internalArticleNumber: (product as any).internalArticleNumber,
          supplierArticleNumber: (product as any).supplierArticleNumber,
          ean: (product as any).ean,
          brand: (product as any).brand,
          status: (product as any).status,
          supplierName,
        },
        assessment: {
          id: assessment.id,
          overallRiskScore: assessment.overallRiskScore,
          riskLevel: assessment.riskLevel,
          summary: assessment.summary ?? "",
          risks,
          missingInfo,
          modelUsed: assessment.modelUsed,
          tokensUsed: assessment.tokensUsed,
          createdAt: assessment.createdAt,
        },
      });

      const safeName = ((product as any).productName ?? "produkt")
        .replace(/[^a-zA-Z0-9äöüÄÖÜß\-_]/g, "_")
        .slice(0, 50);
      const filename = `Risikobericht_${safeName}_${new Date(assessment.createdAt).toISOString().slice(0, 10)}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[PDF] Risk report generation failed:", err);
      res.status(500).json({ error: "PDF-Generierung fehlgeschlagen", details: err.message });
    }
  });
}
