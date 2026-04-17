/**
 * server/routers/productCopy.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * tRPC procedures for copying compliance data between products.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { copyProductDataService } from "../domains/products/copyProductDataService";

const categoryEnum = z.enum([
  "safety",
  "documents",
  "components",
  "batchInfo",
  "labelling",
  "requirements",
]);

export const productCopyRouter = router({
  // ── Preview: what data is available on source product ────────────────────
  preview: protectedProcedure
    .input(z.object({ sourceProductId: z.number() }))
    .query(async ({ ctx, input }) => {
      return copyProductDataService.preview(ctx.user, input.sourceProductId);
    }),

  // ── Execute copy ─────────────────────────────────────────────────────────
  execute: protectedProcedure
    .input(z.object({
      sourceProductId: z.number(),
      targetProductIds: z.array(z.number()).min(1).max(50),
      categories: z.array(categoryEnum).min(1),
      overwrite: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      return copyProductDataService.execute(ctx.user, input);
    }),
});
