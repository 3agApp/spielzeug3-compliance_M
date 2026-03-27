/**
 * server/domains/ai/aiRepository.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Data-access layer for the AI Analysis domain.
 */

export {
  createAiAnalysis,
  updateAiAnalysis,
  getLatestAiAnalysisByProduct,
  getAiAnalysisHistory,
} from "../../db";
