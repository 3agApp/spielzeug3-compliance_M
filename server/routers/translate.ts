/**
 * server/routers/translate.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * tRPC procedures for on-the-fly translation of AI analysis and risk assessment
 * results. Translations are cached in the DB to avoid repeated LLM calls.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  translateAiAnalysis,
  translateRiskAssessment,
} from "../domains/ai/translationService";

const SUPPORTED_LANGS = ["de", "fr", "it", "es"] as const;

export const translateRouter = router({
  /**
   * Translate an AI analysis result to the target language.
   * Returns cached translation if available.
   */
  aiAnalysis: protectedProcedure
    .input(
      z.object({
        analysisId: z.number().int().positive(),
        targetLang: z.enum(SUPPORTED_LANGS),
      })
    )
    .query(async ({ input }) => {
      const result = await translateAiAnalysis(input.analysisId, input.targetLang);
      return result;
    }),

  /**
   * Translate a risk assessment result to the target language.
   * Returns cached translation if available.
   */
  riskAssessment: protectedProcedure
    .input(
      z.object({
        assessmentId: z.number().int().positive(),
        targetLang: z.enum(SUPPORTED_LANGS),
      })
    )
    .query(async ({ input }) => {
      const result = await translateRiskAssessment(input.assessmentId, input.targetLang);
      return result;
    }),
});
