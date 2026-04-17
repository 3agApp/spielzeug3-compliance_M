/**
 * Product Import Router
 * Handles CSV / XLSX bulk-import of products for a given supplier.
 *
 * File upload is handled via a dedicated Express route (multipart/form-data),
 * which stores the buffer in a request-scoped map and calls the tRPC procedure
 * indirectly. The tRPC procedures here handle preview and commit.
 *
 * Upload endpoint: POST /api/import/products/upload
 * tRPC procedures: products.import.preview, products.import.commit
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { previewImport, productImportService } from "../domains/products/productImportService";
import { TRPCError } from "@trpc/server";

// In-memory staging store: uploadId → { buffer, mimeType, userId }
// Entries expire after 10 minutes
const stagingStore = new Map<
  string,
  { buffer: Buffer; mimeType: string; userId: string; expiresAt: number }
>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of Array.from(stagingStore.entries())) {
    if (val.expiresAt < now) stagingStore.delete(key);
  }
}, 5 * 60 * 1000);

export function stageUpload(uploadId: string, buffer: Buffer, mimeType: string, userId: string) {
  stagingStore.set(uploadId, {
    buffer,
    mimeType,
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
}

export const productImportRouter = router({
  /**
   * Preview the staged upload without writing to DB.
   * Returns detected column mapping + first 200 rows.
   */
  preview: protectedProcedure
    .input(z.object({ uploadId: z.string() }))
    .query(async ({ input, ctx }) => {
      const staged = stagingStore.get(input.uploadId);
      if (!staged) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Upload not found or expired. Please re-upload the file.",
        });
      }
      if (staged.userId !== String(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Upload belongs to a different user." });
      }
      try {
        return previewImport(staged.buffer, staged.mimeType);
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err?.message ?? "Parse error" });
      }
    }),

  /**
   * Commit the staged upload to the database.
   */
  commit: protectedProcedure
    .input(
      z.object({
        uploadId: z.string(),
        supplierId: z.number().int().positive(),
        updateExisting: z.boolean().default(false),
        defaultBrand: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const staged = stagingStore.get(input.uploadId);
      if (!staged) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Upload not found or expired. Please re-upload the file.",
        });
      }
      if (staged.userId !== String(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Upload belongs to a different user." });
      }

      const result = await productImportService.importFromBuffer(
        ctx.user,
        input.supplierId,
        staged.buffer,
        staged.mimeType,
        {
          updateExisting: input.updateExisting,
          defaultBrand: input.defaultBrand,
        }
      );

      // Remove from staging after successful commit
      stagingStore.delete(input.uploadId);

      return result;
    }),
});
