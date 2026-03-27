/**
 * Public REST API – WooCommerce / External Integration
 *
 * GET /api/v1/products/:uuid        → Product seal status by public UUID
 * GET /api/v1/products/by-ean/:ean  → Product seal status by EAN
 *
 * No authentication required. Only safe public fields are returned.
 */
import type { Express } from "express";
import { getDb } from "./db";
import { products } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { getSealStatus, getPublicProductUrl } from "./sealUtils";
import { getTenantById } from "./tenantDb";

function buildProductResponse(product: {
  publicUuid: string | null;
  productName: string;
  brand: string | null;
  ean: string | null;
  status: string;
  completenessScore: string | null;
  sealStatusOverride: string | null;
  publicVisible: boolean;
  qrCodeUrl: string | null;
  approvedAt: Date | null;
  sealEnabledAt: Date | null;
  tenantId: number;
  importerName: string | null;
}) {
  const sealStatus = getSealStatus({
    status: product.status as any,
    completenessScore: product.completenessScore,
    sealStatusOverride: product.sealStatusOverride as any,
  });
  return {
    uuid: product.publicUuid,
    productName: product.productName,
    brand: product.brand,
    ean: product.ean,
    sealStatus,
    sealStatusLabel: sealStatus === "verified" ? "VERIFIED" : sealStatus === "in_progress" ? "IN PROGRESS" : "NOT VERIFIED",
    publicVisible: product.publicVisible,
    landingPageUrl: product.publicUuid ? getPublicProductUrl(product.publicUuid) : null,
    qrCodeUrl: product.qrCodeUrl,
    approvedAt: product.approvedAt,
    sealEnabledAt: product.sealEnabledAt,
    tenantId: product.tenantId,
    importerName: product.importerName,
  };
}

/** CORS-Middleware für alle öffentlichen API-Routen – erlaubt Cross-Origin-Zugriff aus Onlineshops */
function withCors(res: import("express").Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
}

export function registerPublicApiRoutes(app: Express) {
  // OPTIONS preflight für alle /api/v1/* Routen
  app.options("/api/v1/*", (_req, res) => {
    withCors(res);
    res.sendStatus(204);
  });

  // GET /api/v1/products/:uuid
  app.get("/api/v1/products/:uuid", async (req, res) => {
    try {
      withCors(res);
      const { uuid } = req.params;
      if (!uuid || !/^[0-9a-f-]{36}$/i.test(uuid)) {
        return res.status(400).json({ error: "Invalid UUID format" });
      }
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Database unavailable" });

      const result = await db
        .select({
          publicUuid: products.publicUuid,
          productName: products.productName,
          brand: products.brand,
          ean: products.ean,
          status: products.status,
          completenessScore: products.completenessScore,
          sealStatusOverride: products.sealStatusOverride,
          publicVisible: products.publicVisible,
          qrCodeUrl: products.qrCodeUrl,
          approvedAt: products.approvedAt,
          sealEnabledAt: products.sealEnabledAt,
          tenantId: products.tenantId,
          importerName: products.importerName,
        })
        .from(products)
        .where(eq(products.publicUuid, uuid))
        .limit(1);

      if (!result[0]) return res.status(404).json({ error: "Product not found" });

      const tenant = await getTenantById(result[0].tenantId);
      const response = {
        ...buildProductResponse(result[0]),
        importer: tenant ? { name: tenant.name, slug: tenant.slug } : null,
      };
      return res.json(response);
    } catch (err) {
      console.error("[PublicAPI] GET /products/:uuid error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/v1/products/by-ean/:ean
  app.get("/api/v1/products/by-ean/:ean", async (req, res) => {
    try {
      withCors(res);
      const { ean } = req.params;
      if (!ean || ean.length < 8 || ean.length > 20) {
        return res.status(400).json({ error: "Invalid EAN format" });
      }
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Database unavailable" });

      const result = await db
        .select({
          publicUuid: products.publicUuid,
          productName: products.productName,
          brand: products.brand,
          ean: products.ean,
          status: products.status,
          completenessScore: products.completenessScore,
          sealStatusOverride: products.sealStatusOverride,
          publicVisible: products.publicVisible,
          qrCodeUrl: products.qrCodeUrl,
          approvedAt: products.approvedAt,
          sealEnabledAt: products.sealEnabledAt,
          tenantId: products.tenantId,
          importerName: products.importerName,
        })
        .from(products)
        .where(eq(products.ean, ean))
        .limit(1);

      if (!result[0]) return res.status(404).json({ error: "Product not found" });
      if (!result[0].publicUuid) return res.status(404).json({ error: "Product has no public page" });

      const tenant = await getTenantById(result[0].tenantId);
      const response = {
        ...buildProductResponse(result[0]),
        importer: tenant ? { name: tenant.name, slug: tenant.slug } : null,
      };
      return res.json(response);
    } catch (err) {
      console.error("[PublicAPI] GET /products/by-ean/:ean error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
