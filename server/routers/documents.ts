/**
 * server/routers/documents.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for the Documents domain.
 * All business logic lives in documentService.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { documentService } from "../domains/documents/documentService";
import { toTRPCError } from "../shared";

const DOCUMENT_TYPES = [
  "test_report",
  "declaration_of_conformity",
  "manual",
  "certificate",
  "product_image",
  "safety_image",
  "regulatory_document",
  "other",
] as const;

const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;

export const documentsRouter = router({
  listArchivedVersions: protectedProcedure
    .input(z.object({ productId: z.number(), documentType: z.enum(DOCUMENT_TYPES) }))
    .query(async ({ ctx, input }) => {
      try {
        return await documentService.listArchivedVersions(ctx.user as any, input.productId, input.documentType);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  listByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await documentService.listByProduct(ctx.user as any, input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  upload: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        documentType: z.enum(DOCUMENT_TYPES),
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string(),
        fileSizeBytes: z.number().optional(),
        expiryDate: z.string().optional(),
        requirementId: z.number().optional(),
        operatorComment: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await documentService.upload(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  updateReviewStatus: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        reviewStatus: z.enum(REVIEW_STATUSES),
        reviewNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await documentService.updateReviewStatus(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      productId: z.number().optional(),
      operatorComment: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await documentService.delete(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /**
   * Toggle the publicDownload flag for a document.
   * Only operators (administrator / compliance_manager / internal_employee) may do this.
   */
  togglePublicDownload: protectedProcedure
    .input(z.object({ documentId: z.number(), publicDownload: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await documentService.togglePublicDownload(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
