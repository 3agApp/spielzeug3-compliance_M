/**
 * server/routers/riskAssessment.ts
 * tRPC procedures for AI-powered product risk assessment.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { riskAssessmentService } from "../domains/risk/riskAssessmentService";

export const riskAssessmentRouter = router({
  /** Run a new AI risk assessment for a product. Internal roles only. */
  run: protectedProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return riskAssessmentService.run(
        ctx.user as any,
        input.productId
      );
    }),

  /** Get the latest completed risk assessment for a product. */
  getLatest: protectedProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return riskAssessmentService.getLatest(ctx.user, input.productId);
    }),

  /** Get the full risk assessment history for a product. */
  getHistory: protectedProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return riskAssessmentService.getHistory(ctx.user, input.productId);
    }),
});
