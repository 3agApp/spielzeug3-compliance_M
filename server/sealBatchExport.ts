/**
 * Seal Label Batch Export
 * POST /api/reports/seal-labels-batch
 * Body: { productIds: number[] }
 * Returns a ZIP archive containing one PDF per product.
 */
import type { Express } from "express";
import archiver from "archiver";
import { sdk } from "./_core/sdk";
import { getProductById } from "./db";
import { getTenantById } from "./tenantDb";
import { generateSealLabelPdf, type SealLabelStatus } from "./sealLabelPdf";

const ALLOWED_STATUSES: SealLabelStatus[] = ["verified", "in_progress", "not_verified"];

function deriveSealStatus(product: any): SealLabelStatus {
  // Use admin override if set, otherwise derive from product status
  if (product.sealStatusOverride && ALLOWED_STATUSES.includes(product.sealStatusOverride)) {
    return product.sealStatusOverride as SealLabelStatus;
  }
  const s = product.status ?? "";
  if (s === "approved" || s === "completed") return "verified";
  if (["submitted", "under_review", "in_progress", "clarification_needed"].includes(s)) return "in_progress";
  return "not_verified";
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_]/g, "_").slice(0, 50);
}

export function registerSealBatchExportRoute(app: Express) {
  /**
   * POST /api/reports/seal-labels-batch
   * Body JSON: { productIds: number[], tenantId?: number }
   * Streams a ZIP containing one A6 PDF per product.
   */
  app.post("/api/reports/seal-labels-batch", async (req, res) => {
    try {
      // Authenticate
      try {
        await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Nicht authentifiziert" });
        return;
      }

      const body = req.body ?? {};
      const productIds: number[] = Array.isArray(body.productIds)
        ? body.productIds.map(Number).filter((n: number) => !isNaN(n) && n > 0)
        : [];

      if (productIds.length === 0) {
        res.status(400).json({ error: "Keine Produkt-IDs angegeben" });
        return;
      }

      if (productIds.length > 100) {
        res.status(400).json({ error: "Maximal 100 Produkte pro Export erlaubt" });
        return;
      }

      const tenantId = body.tenantId ? parseInt(String(body.tenantId)) : 1;
      const tenant = await getTenantById(isNaN(tenantId) ? 1 : tenantId);
      const tenantName = tenant?.name ?? "Swiss Product Seal";
      const tenantUrl = (tenant as any)?.contactEmail
        ? (tenant as any).contactEmail.replace(/^.*@/, "")
        : "swiss-product-seal.ch";

      const dateStr = new Date().toISOString().slice(0, 10);
      const zipFilename = `Swiss-Product-Seal_Etiketten_${dateStr}.zip`;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.on("error", (err) => {
        console.error("[BatchExport] Archiver error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "ZIP-Generierung fehlgeschlagen" });
        }
      });

      archive.pipe(res);

      // Track used filenames to avoid collisions
      const usedNames = new Map<string, number>();

      for (const productId of productIds) {
        try {
          const product = await getProductById(productId);
          if (!product) {
            console.warn(`[BatchExport] Product ${productId} not found, skipping`);
            continue;
          }

          const status = deriveSealStatus(product);

          // Try to fetch QR code from S3
          let qrCodeBuffer: Buffer | undefined;
          const qrUrl: string | null = (product as any).qrCodeUrl ?? null;
          if (qrUrl) {
            try {
              const response = await fetch(qrUrl);
              if (response.ok) {
                qrCodeBuffer = Buffer.from(await response.arrayBuffer());
              }
            } catch {
              // Silently fall back to placeholder
            }
          }

          const pdfBuffer = await generateSealLabelPdf({
            status,
            tenantName,
            tenantUrl,
            qrCodeBuffer,
          });

          // Build unique filename
          const base = `Swiss-Product-Seal_${safeName((product as any).productName ?? `Produkt-${productId}`)}_${status.replace(/_/g, "-")}`;
          const count = usedNames.get(base) ?? 0;
          usedNames.set(base, count + 1);
          const filename = count === 0 ? `${base}_${dateStr}.pdf` : `${base}_${dateStr}_${count + 1}.pdf`;

          archive.append(pdfBuffer, { name: filename });
        } catch (err) {
          console.error(`[BatchExport] Failed for product ${productId}:`, err);
          // Continue with remaining products
        }
      }

      await archive.finalize();
    } catch (err: any) {
      console.error("[BatchExport] Unexpected error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Batch-Export fehlgeschlagen", details: err.message });
      }
    }
  });
}
