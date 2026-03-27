/**
 * server/routers/safety.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for Product Safety data.
 * All business logic lives in safetyService.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { safetyService } from "../domains/compliance/safetyService";
import { toTRPCError } from "../shared";

export const safetyRouter = router({
  getByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await safetyService.getByProduct(ctx.user as any, input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        safetyText: z.string().optional(),
        warningText: z.string().optional(),
        ageGrading: z.string().optional(),
        materialInformation: z.string().optional(),
        usageRestrictions: z.string().optional(),
        safetyNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await safetyService.upsert(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
