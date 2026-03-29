/**
 * server/routers/documents.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for the Documents domain.
 * All business logic lives in documentService.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { documentService } from "../domains/documents/documentService";
import { riskAssessmentService } from "../domains/risk/riskAssessmentService";
import { getSystemSetting } from "../db";
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
        replacesDocumentId: z.number().optional(),
        addAsNew: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await documentService.upload(ctx.user as any, input);
        // Fire-and-forget: auto risk re-assessment after every document upload
        void (async () => {
          try {
            const setting = await getSystemSetting("RISK_AUTO_REASSESS");
            const enabled =
              setting === null ||
              setting?.settingValue === null ||
              setting?.settingValue === "true" ||
              setting?.settingValue === "1";
            if (enabled) {
              await riskAssessmentService.runAutomatic(
                input.productId,
                (ctx.user as any).id
              );
            }
          } catch {
            // never block the upload response
          }
        })();
        return result;
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

  /**
   * Manually trigger revocation of expired public documents.
   * Only administrator / compliance_manager may call this.
   * Pass force=true to bypass the AUTO_REVOKE_EXPIRED_PUBLIC_DOCS setting.
   */
  revokeExpiredPublic: protectedProcedure
    .input(z.object({ force: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await documentService.revokeExpiredPublicDocuments(
          ctx.user as any,
          { force: input.force }
        );
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
