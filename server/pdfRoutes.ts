import type { Express } from "express";
import { sdk } from "./_core/sdk";
import {
  getAiAnalysisHistory,
  getLatestAiAnalysisByProduct,
  getProductById,
  getSupplierById,
} from "./db";
import { generateAiAnalysisPdf } from "./pdfGenerator";
import { generateSealLabelPdf, type SealLabelStatus } from "./sealLabelPdf";
import { getTenantById } from "./tenantDb";

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
        qrCodeBuffer,
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
}
