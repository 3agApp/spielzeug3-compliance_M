import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  computeCompletenessScore,
  createApprovalHistoryEntry,
  createAuditLog,
  createMissingRequirement,
  createNotification,
  createProduct,
  getAllProducts,
  getDb,
  getMissingRequirementsByProduct,
  getProductById,
  getProductsBySupplier,
  updateMissingRequirement,
  updateProduct,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

export const productsRouter = router({
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
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (role === "supplier") {
        if (!ctx.user.supplierId) return [];
        return getProductsBySupplier(ctx.user.supplierId);
      }
      return getAllProducts(input ?? {});
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const product = await getProductById(input.id);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return product;
    }),

  getMissingRequirements: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getMissingRequirementsByProduct(input.productId);
    }),

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
      requireRole(ctx.user.complianceRole ?? "", [
        "administrator",
        "compliance_manager",
        "internal_employee",
      ]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Create the product
      await createProduct({ ...input, status: "open" });

      // If a template was selected, auto-apply its required documents as missing requirements
      if (input.templateId) {
        const { productTemplates } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [template] = await db
          .select()
          .from(productTemplates)
          .where(eq(productTemplates.id, input.templateId))
          .limit(1);
        if (template) {
          // Get the newly created product to get its ID
          const { products: productsTable } = await import("../../drizzle/schema");
          const { desc } = await import("drizzle-orm");
          const [newProduct] = await db
            .select()
            .from(productsTable)
            .where(eq(productsTable.supplierId, input.supplierId))
            .orderBy(desc(productsTable.createdAt))
            .limit(1);
          if (newProduct) {
            const requiredDocs = (template.requiredDocuments as string[]) ?? [];
            const optionalDocs = (template.optionalDocuments as string[]) ?? [];
            const validTypes = [
              "test_report", "declaration_of_conformity", "manual", "certificate",
              "product_image", "safety_image", "regulatory_document", "safety_text",
              "warning_text", "age_grading", "material_information", "usage_restrictions",
              "safety_instructions", "additional_notes",
            ] as const;
            for (const doc of requiredDocs) {
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
            for (const doc of optionalDocs) {
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

      await createAuditLog({
        entityType: "product",
        action: "created",
        performedByUserId: ctx.user.id,
        payloadSnapshot: input as any,
      });
      return { success: true };
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
      requireRole(ctx.user.complianceRole ?? "", [
        "administrator",
        "compliance_manager",
        "internal_employee",
      ]);
      const { id, ...data } = input;
      await updateProduct(id, data);
      await createAuditLog({
        entityType: "product",
        entityId: id,
        action: "updated",
        performedByUserId: ctx.user.id,
        payloadSnapshot: data as any,
      });
      return { success: true };
    }),

  addMissingRequirement: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        requirementType: z.enum([
          "test_report",
          "declaration_of_conformity",
          "manual",
          "certificate",
          "product_image",
          "safety_image",
          "regulatory_document",
          "safety_text",
          "warning_text",
          "age_grading",
          "material_information",
          "usage_restrictions",
          "safety_instructions",
          "additional_notes",
        ]),
        note: z.string().optional(),
        sourceSystem: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user.complianceRole ?? "", [
        "administrator",
        "compliance_manager",
        "internal_employee",
      ]);
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

  // ─── Workflow Actions ──────────────────────────────────────────────────────
  submit: protectedProcedure
    .input(z.object({ productId: z.number(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const fromStatus = product.status;
      await updateProduct(input.productId, { status: "submitted", submittedAt: new Date() });
      await createApprovalHistoryEntry({
        productId: input.productId,
        action: "submitted",
        fromStatus,
        toStatus: "submitted",
        performedByUserId: ctx.user.id,
        note: input.note,
      });
      await createAuditLog({
        entityType: "product",
        entityId: input.productId,
        action: "submitted",
        performedByUserId: ctx.user.id,
      });
      return { success: true };
    }),

  approve: protectedProcedure
    .input(z.object({ productId: z.number(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user.complianceRole ?? "", ["compliance_manager", "administrator"]);
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const score = await computeCompletenessScore(input.productId);
      await updateProduct(input.productId, {
        status: "approved",
        approvedAt: new Date(),
        completenessScore: String(score) as any,
      });
      await createApprovalHistoryEntry({
        productId: input.productId,
        action: "approved",
        fromStatus: product.status,
        toStatus: "approved",
        performedByUserId: ctx.user.id,
        note: input.note,
      });
      await createAuditLog({
        entityType: "product",
        entityId: input.productId,
        action: "approved",
        performedByUserId: ctx.user.id,
      });
      // Notify supplier users
      if (product.assignedSupplierUserId) {
        await createNotification({
          userId: product.assignedSupplierUserId,
          type: "approved",
          title: `Produkt genehmigt: ${product.productName}`,
          message: input.note ?? "Ihr Produkt wurde genehmigt.",
          relatedProductId: input.productId,
        });
      }
      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({ productId: z.number(), note: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user.complianceRole ?? "", ["compliance_manager", "administrator"]);
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      await updateProduct(input.productId, { status: "rejected", rejectedAt: new Date() });
      await createApprovalHistoryEntry({
        productId: input.productId,
        action: "rejected",
        fromStatus: product.status,
        toStatus: "rejected",
        performedByUserId: ctx.user.id,
        note: input.note,
      });
      await createAuditLog({
        entityType: "product",
        entityId: input.productId,
        action: "rejected",
        performedByUserId: ctx.user.id,
      });
      if (product.assignedSupplierUserId) {
        await createNotification({
          userId: product.assignedSupplierUserId,
          type: "rejected",
          title: `Produkt abgelehnt: ${product.productName}`,
          message: input.note,
          relatedProductId: input.productId,
        });
      }
      return { success: true };
    }),

  requestClarification: protectedProcedure
    .input(z.object({ productId: z.number(), note: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user.complianceRole ?? "", [
        "compliance_manager",
        "administrator",
        "internal_employee",
      ]);
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      await updateProduct(input.productId, { status: "clarification_needed" });
      await createApprovalHistoryEntry({
        productId: input.productId,
        action: "clarification_requested",
        fromStatus: product.status,
        toStatus: "clarification_needed",
        performedByUserId: ctx.user.id,
        note: input.note,
      });
      await createAuditLog({
        entityType: "product",
        entityId: input.productId,
        action: "clarification_requested",
        performedByUserId: ctx.user.id,
      });
      if (product.assignedSupplierUserId) {
        await createNotification({
          userId: product.assignedSupplierUserId,
          type: "clarification_requested",
          title: `Rückfrage zu: ${product.productName}`,
          message: input.note,
          relatedProductId: input.productId,
        });
      }
      return { success: true };
    }),

  markComplete: protectedProcedure
    .input(z.object({ productId: z.number(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user.complianceRole ?? "", ["compliance_manager", "administrator"]);
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      await updateProduct(input.productId, { status: "completed", completedAt: new Date() });
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

  getTimeline: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { getApprovalHistory, getCommentsByProduct } = await import("../db");
      const role = ctx.user.complianceRole ?? "internal_employee";
      const isInternal = role !== "supplier";
      const [history, comments] = await Promise.all([
        getApprovalHistory(input.productId),
        getCommentsByProduct(input.productId, isInternal),
      ]);
      return { history, comments };
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
      requireRole(ctx.user.complianceRole ?? "", [
        "compliance_manager",
        "administrator",
        "super_admin",
        "internal_employee",
      ]);
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
      const { getSupplierDashboardStats } = await import("../db");
      return getSupplierDashboardStats(ctx.user.supplierId);
    }
    const { getInternalDashboardStats } = await import("../db");
    return getInternalDashboardStats();
  }),
});
