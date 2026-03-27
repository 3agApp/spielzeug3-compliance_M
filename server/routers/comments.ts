/**
 * server/routers/comments.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for Product Comments.
 * All business logic lives in commentsService.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { commentsService } from "../domains/compliance/commentsService";
import { toTRPCError } from "../shared";

export const commentsRouter = router({
  listByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await commentsService.listByProduct(ctx.user as any, input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        commentText: z.string().min(1),
        visibilityInternalOnly: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await commentsService.create(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
