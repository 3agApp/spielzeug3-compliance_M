/**
 * server/routers/products.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for the Products domain.
 *
 * Responsibilities of this file:
 * - Input validation (Zod schemas)
 * - Calling the appropriate service method
 * - Converting AppError → TRPCError via toTRPCError()
 *
 * Business logic lives in: server/domains/products/productService.ts
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createMissingRequirement,
  getDb,
  getMissingRequirementsByProduct,
  getProductById,
  updateMissingRequirement,
  createAuditLog,
  getApprovalHistory,
  getAuditLogsByProduct,
  getCommentsByProduct,
  updateProduct,
  getInternalDashboardStats,
  getSupplierDashboardStats,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { productService } from "../domains/products/productService";
import { toTRPCError } from "../shared/errors";

export const productsRouter = router({
  // ─── Queries ───────────────────────────────────────────────────────────────

  list: protectedProcedure
    .input(
      z.object({
        supplierId: z.number().optional(),
        status: z.string().optional(),
        brand: z.string().optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        return await productService.list(ctx.user, input ?? {});
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await productService.getById(ctx.user, input.id);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  getMissingRequirements: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const product = await getProductById(input.productId);
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        const role = ctx.user.complianceRole ?? "internal_employee";
        if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return getMissingRequirementsByProduct(input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  getTimeline: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.user.complianceRole ?? "internal_employee";
      const isInternal = role !== "supplier";
      const [history, comments, auditEntries] = await Promise.all([
        getApprovalHistory(input.productId),
        getCommentsByProduct(input.productId, isInternal),
        getAuditLogsByProduct(input.productId, 200),
      ]);
      return { history, comments, auditEntries };
    }),

  getBatchInfo: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const batch = (product.batchInfo ?? {}) as {
        batchNumber?: string | null;
        productionDate?: string | null;
        expiryDate?: string | null;
      };
      return {
        batchNumber: batch.batchNumber ?? "",
        productionDate: batch.productionDate ?? "",
        expiryDate: batch.expiryDate ?? "",
        importerName: product.importerName ?? "",
      };
    }),

  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.user.complianceRole ?? "internal_employee";
    if (role === "supplier") {
      if (!ctx.user.supplierId) return {};
      return getSupplierDashboardStats(ctx.user.supplierId);
    }
    return getInternalDashboardStats();
  }),

  // ─── Mutations ─────────────────────────────────────────────────────────────

  create: protectedProcedure
    .input(
      z.object({
        productName: z.string().min(1),
        supplierId: z.number(),
        internalArticleNumber: z.string().optional(),
        supplierArticleNumber: z.string().optional(),
        orderNumber: z.string().optional(),
        ean: z.string().optional(),
        brand: z.string().optional(),
        imageUrl: z.string().optional(),
        kontorId: z.string().optional(),
        categoryId: z.number().optional(),
        templateId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Role check delegated to service
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Service handles role check + audit log
        await productService.create(ctx.user, {
          productName: input.productName,
          supplierId: input.supplierId,
          internalArticleNumber: input.internalArticleNumber,
          supplierArticleNumber: input.supplierArticleNumber,
          orderNumber: input.orderNumber,
          ean: input.ean,
          brand: input.brand,
          tenantId: ctx.user.tenantId ?? 1,
        });

        // Template-specific logic: apply required documents
        // (kept here as it requires direct DB access and is create-only)
        if (input.templateId) {
          const { productTemplates, products: productsTable } = await import("../../drizzle/schema");
          const { eq, desc } = await import("drizzle-orm");
          const [template] = await db
            .select()
            .from(productTemplates)
            .where(eq(productTemplates.id, input.templateId))
            .limit(1);
          if (template) {
            const [newProduct] = await db
              .select()
              .from(productsTable)
              .where(eq(productsTable.supplierId, input.supplierId))
              .orderBy(desc(productsTable.createdAt))
              .limit(1);
            if (newProduct) {
              const validTypes = [
                "test_report", "declaration_of_conformity", "manual", "certificate",
                "product_image", "safety_image", "regulatory_document", "safety_text",
                "warning_text", "age_grading", "material_information", "usage_restrictions",
                "safety_instructions", "additional_notes",
              ] as const;
              for (const doc of (template.requiredDocuments as string[]) ?? []) {
                if (validTypes.includes(doc as any)) {
                  await createMissingRequirement({
                    productId: newProduct.id,
                    requirementType: doc as any,
                    required: true,
                    isMissing: true,
                    status: "missing",
                    sourceSystem: `template:${template.id}`,
                  });
                }
              }
              for (const doc of (template.optionalDocuments as string[]) ?? []) {
                if (validTypes.includes(doc as any)) {
                  await createMissingRequirement({
                    productId: newProduct.id,
                    requirementType: doc as any,
                    required: false,
                    isMissing: true,
                    status: "missing",
                    sourceSystem: `template:${template.id}`,
                  });
                }
              }
            }
          }
        }
        return { success: true };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        productName: z.string().optional(),
        internalArticleNumber: z.string().optional(),
        supplierArticleNumber: z.string().optional(),
        orderNumber: z.string().optional(),
        ean: z.string().optional(),
        brand: z.string().optional(),
        imageUrl: z.string().optional(),
        assignedInternalUserId: z.number().optional(),
        assignedSupplierUserId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;
        await productService.update(ctx.user as any, { productId: id, ...data });
        return { success: true };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  addMissingRequirement: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        requirementType: z.enum([
          "test_report", "declaration_of_conformity", "manual", "certificate",
          "product_image", "safety_image", "regulatory_document", "safety_text",
          "warning_text", "age_grading", "material_information", "usage_restrictions",
          "safety_instructions", "additional_notes",
        ]),
        note: z.string().optional(),
        sourceSystem: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (!["administrator", "compliance_manager", "internal_employee"].includes(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await createMissingRequirement({ ...input, required: true, isMissing: true, status: "missing" });
      return { success: true };
    }),

  updateRequirementStatus: protectedProcedure
    .input(
      z.object({
        requirementId: z.number(),
        status: z.enum(["missing", "provided", "under_review", "approved", "rejected"]),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateMissingRequirement(input.requirementId, {
        status: input.status,
        isMissing: input.status === "missing",
        note: input.note,
      });
      return { success: true };
    }),

  updateBatchInfo: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        batchNumber: z.string().max(128).optional(),
        productionDate: z.string().optional(),
        expiryDate: z.string().optional(),
        importerName: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (!["compliance_manager", "administrator", "super_admin", "internal_employee"].includes(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });

      const existingBatch = (product.batchInfo ?? {}) as Record<string, unknown>;
      const batchInfo = {
        ...existingBatch,
        batchNumber: input.batchNumber !== undefined ? input.batchNumber : (existingBatch.batchNumber ?? null),
        productionDate: input.productionDate !== undefined ? input.productionDate : (existingBatch.productionDate ?? null),
        expiryDate: input.expiryDate !== undefined ? input.expiryDate : (existingBatch.expiryDate ?? null),
      };
      await updateProduct(input.productId, {
        batchInfo,
        ...(input.importerName !== undefined ? { importerName: input.importerName } : {}),
      });
      await createAuditLog({
        entityType: "product",
        entityId: input.productId,
        action: "updated",
        performedByUserId: ctx.user.id,
        payloadSnapshot: { batchInfo } as any,
      });
      return { success: true };
    }),

  // ─── Workflow Actions (delegated to productService) ────────────────────────

  submit: protectedProcedure
    .input(z.object({ productId: z.number(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await productService.submit(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  approve: protectedProcedure
    .input(z.object({ productId: z.number(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await productService.approve(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  reject: protectedProcedure
    .input(z.object({ productId: z.number(), note: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await productService.reject(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  requestClarification: protectedProcedure
    .input(z.object({ productId: z.number(), note: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await productService.requestClarification(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  markComplete: protectedProcedure
    .input(z.object({ productId: z.number(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (!["compliance_manager", "administrator"].includes(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      await updateProduct(input.productId, { status: "completed", completedAt: new Date() });
      const { createApprovalHistoryEntry } = await import("../db");
      await createApprovalHistoryEntry({
        productId: input.productId,
        action: "completed",
        fromStatus: product.status,
        toStatus: "completed",
        performedByUserId: ctx.user.id,
        note: input.note,
      });
      return { success: true };
    }),

  // ─── Supplier Confirmation (delegated to productService) ──────────────────

  supplierConfirm: protectedProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const role = ctx.user.complianceRole ?? "internal_employee";
        if (role !== "supplier") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Nur Lieferanten können die Vollständigkeit bestätigen" });
        }
        const confirmedByName = ctx.user.name ?? ctx.user.email ?? "Lieferant";
        const result = await productService.supplierConfirm(ctx.user as any, {
          productId: input.productId,
          confirmedByName,
        });
        return { ...result, confirmedAt: new Date(), confirmedBy: confirmedByName };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
