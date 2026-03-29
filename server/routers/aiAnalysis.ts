/**
 * server/routers/aiAnalysis.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for AI-powered compliance analysis.
 * All business logic lives in aiAnalysisService.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { aiAnalysisService } from "../domains/ai/aiAnalysisService";
import { toTRPCError } from "../shared";

export const aiAnalysisRouter = router({
  /** Save / update the AI provider and API key (admin only). */
  saveApiKey: protectedProcedure
    .input(z.object({
      apiKey: z.string().min(10),
      provider: z.enum(["openai", "anthropic", "gemini"]),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await aiAnalysisService.updateSettings(ctx.user as any, {
          apiKey: input.apiKey,
          provider: input.provider,
        });
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Check if an API key is configured (returns masked version). */
  getApiKeyStatus: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await aiAnalysisService.getApiKeyStatus(ctx.user as any);
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  /** Test the stored API key with a minimal request. */
  testApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await aiAnalysisService.testApiKey(ctx.user as any);
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  /** Analyse a single product. */
  analyzeProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await aiAnalysisService.analyzeProduct(ctx.user as any, input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Batch analyse multiple products. */
  analyzeProducts: protectedProcedure
    .input(z.object({ productIds: z.array(z.number()).min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await aiAnalysisService.analyzeProducts(ctx.user as any, input.productIds);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Get latest analysis for a product. */
  getLatest: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await aiAnalysisService.getLatest(ctx.user as any, input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Get analysis history for a product. */
  getHistory: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await aiAnalysisService.getHistory(ctx.user as any, input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
