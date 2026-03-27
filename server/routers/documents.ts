import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createAuditLog,
  createDocument,
  deleteDocument,
  getDocumentsByProduct,
  getProductById,
  updateDocument,
  updateMissingRequirement,
  getMissingRequirementsByProduct,
  updateProduct,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";

function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

export const documentsRouter = router({
  listByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getDocumentsByProduct(input.productId);
    }),

  upload: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        documentType: z.enum([
          "test_report",
          "declaration_of_conformity",
          "manual",
          "certificate",
          "product_image",
          "safety_image",
          "regulatory_document",
          "other",
        ]),
        fileName: z.string(),
        fileBase64: z.string(), // base64 encoded file
        mimeType: z.string(),
        fileSizeBytes: z.number().optional(),
        expiryDate: z.string().optional(),
        requirementId: z.number().optional(), // link to missing requirement
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Upload to S3
      const buffer = Buffer.from(input.fileBase64, "base64");
      const fileKey = `compliance/${input.productId}/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Get current version
      const existing = await getDocumentsByProduct(input.productId);
      const sameType = existing.filter((d) => d.documentType === input.documentType);
      const version = sameType.length + 1;

      await createDocument({
        productId: input.productId,
        documentType: input.documentType,
        fileName: input.fileName,
        fileUrl: url,
        fileKey,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        version,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
        uploadedByUserId: ctx.user.id,
        uploadedByRole: role,
        reviewStatus: "pending",
      });

      // Update linked missing requirement
      if (input.requirementId) {
        await updateMissingRequirement(input.requirementId, {
          status: "provided",
          isMissing: false,
        });
      }

      // Reset supplier confirmation if supplier had already confirmed
      let confirmedAtReset = false;
      if (role === "supplier" && (product as any).supplierConfirmedAt) {
        await updateProduct(input.productId, {
          supplierConfirmedAt: null as any,
          supplierConfirmedBy: null as any,
        });
        confirmedAtReset = true;
        await createAuditLog({
          entityType: "product",
          entityId: input.productId,
          action: "supplier_confirmation_reset",
          performedByUserId: ctx.user.id,
          payloadSnapshot: { reason: "document_uploaded", fileName: input.fileName } as any,
        });
      }

      await createAuditLog({
        entityType: "document",
        entityId: input.productId,
        action: "uploaded",
        performedByUserId: ctx.user.id,
        payloadSnapshot: { fileName: input.fileName, documentType: input.documentType } as any,
      });

      return { success: true, url, confirmedAtReset };
    }),

  updateReviewStatus: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        reviewStatus: z.enum(["pending", "approved", "rejected"]),
        reviewNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user.complianceRole ?? "", ["compliance_manager", "administrator"]);
      await updateDocument(input.documentId, {
        reviewStatus: input.reviewStatus,
        reviewNote: input.reviewNote,
        reviewedByUserId: ctx.user.id,
        reviewedAt: new Date(),
      });
      await createAuditLog({
        entityType: "document",
        entityId: input.documentId,
        action: `review_${input.reviewStatus}`,
        performedByUserId: ctx.user.id,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ documentId: z.number(), productId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user.complianceRole ?? "internal_employee";
      // Suppliers can delete their own product's documents; internal roles always allowed
      if (role === "supplier") {
        if (!input.productId) throw new TRPCError({ code: "BAD_REQUEST", message: "productId required for supplier" });
        const product = await getProductById(input.productId);
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });
        if (product.supplierId !== ctx.user.supplierId) throw new TRPCError({ code: "FORBIDDEN" });
      } else {
        requireRole(role, ["administrator", "compliance_manager", "internal_employee"]);
      }

      await deleteDocument(input.documentId);

      // Reset supplier confirmation if supplier had already confirmed
      let confirmedAtReset = false;
      if (role === "supplier" && input.productId) {
        const product = await getProductById(input.productId);
        if (product && (product as any).supplierConfirmedAt) {
          await updateProduct(input.productId, {
            supplierConfirmedAt: null as any,
            supplierConfirmedBy: null as any,
          });
          confirmedAtReset = true;
          await createAuditLog({
            entityType: "product",
            entityId: input.productId,
            action: "supplier_confirmation_reset",
            performedByUserId: ctx.user.id,
            payloadSnapshot: { reason: "document_deleted", documentId: input.documentId } as any,
          });
        }
      }

      await createAuditLog({
        entityType: "document",
        entityId: input.documentId,
        action: "deleted",
        performedByUserId: ctx.user.id,
      });
      return { success: true, confirmedAtReset };
    }),
});
