import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createAuditLog,
  createMissingRequirement,
  createProduct,
  createSupplier,
  getAllProducts,
  getDb,
  getSupplierById,
  updateProduct,
  updateSupplier,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { apiSyncLogs } from "../../drizzle/schema";
import { desc } from "drizzle-orm";

function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

async function logSync(data: {
  direction: "import" | "export";
  endpoint?: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  status: "success" | "error" | "pending";
  requestPayload?: any;
  responsePayload?: any;
  errorMessage?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(apiSyncLogs).values(data);
}

export const syncRouter = router({
  // ─── Import from Kontor ────────────────────────────────────────────────────
  importProducts: protectedProcedure
    .input(
      z.object({
        products: z.array(
          z.object({
            kontorId: z.string(),
            productName: z.string(),
            internalArticleNumber: z.string().optional(),
            supplierArticleNumber: z.string().optional(),
            orderNumber: z.string().optional(),
            ean: z.string().optional(),
            brand: z.string().optional(),
            supplierKontorId: z.string().optional(),
            missingRequirements: z.array(z.string()).optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user.complianceRole ?? "", ["administrator", "compliance_manager"]);
      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const p of input.products) {
        try {
          // Find supplier by kontorId if provided
          let supplierId = 1; // default
          if (p.supplierKontorId) {
            const allSuppliers = await import("../db").then((m) => m.getAllSuppliers());
            const supplier = allSuppliers.find((s) => s.kontorId === p.supplierKontorId);
            if (supplier) supplierId = supplier.id;
          }

          // Check if product already exists
          const allProducts = await getAllProducts({ supplierId });
          const existing = allProducts.find((prod) => prod.kontorId === p.kontorId);

          if (existing) {
            await updateProduct(existing.id, {
              productName: p.productName,
              internalArticleNumber: p.internalArticleNumber,
              supplierArticleNumber: p.supplierArticleNumber,
              orderNumber: p.orderNumber,
              ean: p.ean,
              brand: p.brand,
              sourceLastSyncAt: new Date(),
            });
            updated++;
          } else {
            await createProduct({
              kontorId: p.kontorId,
              productName: p.productName,
              internalArticleNumber: p.internalArticleNumber,
              supplierArticleNumber: p.supplierArticleNumber,
              orderNumber: p.orderNumber,
              ean: p.ean,
              brand: p.brand,
              supplierId,
              status: "open",
              sourceLastSyncAt: new Date(),
            });
            created++;
          }
        } catch (e) {
          errors++;
        }
      }

      await logSync({
        direction: "import",
        endpoint: "/api/sync/kontor/import",
        relatedEntityType: "product",
        status: errors === 0 ? "success" : "error",
        requestPayload: { count: input.products.length },
        responsePayload: { created, updated, errors },
        errorMessage: errors > 0 ? `${errors} products failed to import` : undefined,
      });

      await createAuditLog({
        entityType: "sync",
        action: "kontor_import",
        performedByUserId: ctx.user.id,
        payloadSnapshot: { created, updated, errors } as any,
      });

      return { success: true, created, updated, errors };
    }),

  // ─── Export to Kontor ──────────────────────────────────────────────────────
  exportApproved: protectedProcedure
    .input(z.object({ productIds: z.array(z.number()).optional() }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user.complianceRole ?? "", ["administrator", "compliance_manager"]);
      const allProducts = await getAllProducts({ status: "approved" });
      const toExport = input.productIds
        ? allProducts.filter((p) => input.productIds!.includes(p.id))
        : allProducts;

      const exportData = toExport.map((p) => ({
        kontorId: p.kontorId,
        internalArticleNumber: p.internalArticleNumber,
        status: p.status,
        completenessScore: p.completenessScore,
        approvedAt: p.approvedAt,
        lastUpdatedAt: p.lastUpdatedAt,
      }));

      await logSync({
        direction: "export",
        endpoint: "/api/sync/kontor/export",
        relatedEntityType: "product",
        status: "success",
        requestPayload: { productIds: input.productIds },
        responsePayload: { exported: exportData.length },
      });

      await createAuditLog({
        entityType: "sync",
        action: "kontor_export",
        performedByUserId: ctx.user.id,
        payloadSnapshot: { exported: exportData.length } as any,
      });

      return { success: true, data: exportData };
    }),

  // ─── Sync Logs ────────────────────────────────────────────────────────────
  getLogs: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      requireRole(ctx.user.complianceRole ?? "", ["administrator", "compliance_manager"]);
      const db = await getDb();
      if (!db) return [];
      return db.select().from(apiSyncLogs).orderBy(desc(apiSyncLogs.createdAt)).limit(input.limit);
    }),
});
