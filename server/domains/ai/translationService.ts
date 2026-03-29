/**
 * server/domains/ai/translationService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Translates AI analysis and risk assessment results to a target language.
 * Results are cached in the DB to avoid repeated LLM calls.
 *
 * Supported target languages: "de" (German), "fr" (French), etc.
 * Source language is always English.
 */

import { invokeLLM } from "../../_core/llm";
import { getDb } from "../../db";
import {
  aiAnalysisTranslations,
  riskAssessmentTranslations,
  aiAnalysisResults,
  productRiskAssessments,
} from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranslatedAiAnalysis {
  summary: string;
  findings: Array<{
    type: string;
    message: string;
    detail?: string;
    remediation?: string;
    affectedRegulations?: string[];
  }>;
  recommendations: string[];
  scoreReasons?: {
    documentCompletenessReason?: string;
    contentPlausibilityReason?: string;
    formalCorrectnessReason?: string;
    consistencyReason?: string;
  };
}

export interface TranslatedRiskAssessment {
  summary: string;
  risks: Array<{
    category: string;
    title: string;
    description: string;
    mitigations: string[];
    score: number;
  }>;
  missingInfo: string[];
}

const LANG_NAMES: Record<string, string> = {
  de: "German",
  fr: "French",
  it: "Italian",
  es: "Spanish",
};

// ─── AI Analysis Translation ──────────────────────────────────────────────────

export async function translateAiAnalysis(
  analysisId: number,
  targetLang: string
): Promise<TranslatedAiAnalysis | null> {
  const db = await getDb();
  if (!db) return null;

  // 1. Check cache
  const [cached] = await db
    .select()
    .from(aiAnalysisTranslations)
    .where(
      and(
        eq(aiAnalysisTranslations.analysisId, analysisId),
        eq(aiAnalysisTranslations.targetLang, targetLang)
      )
    )
    .limit(1);

  if (cached) {
    return cached.translatedData as TranslatedAiAnalysis;
  }

  // 2. Load source analysis
  const [analysis] = await db
    .select()
    .from(aiAnalysisResults)
    .where(eq(aiAnalysisResults.id, analysisId))
    .limit(1);

  if (!analysis) return null;

  const langName = LANG_NAMES[targetLang] ?? targetLang;

  // 3. Build translation payload (only translatable text fields)
  const sourceData = {
    summary: analysis.summary ?? "",
    findings: (analysis.findings as any[]) ?? [],
    recommendations: (analysis.recommendations as string[]) ?? [],
    scoreReasons: (analysis.scoreReasons as any) ?? {},
  };

  // 4. Call LLM for translation
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a professional translator specialising in regulatory and compliance documents. Translate the provided JSON content from English to ${langName}. Preserve all JSON structure, keys, and non-text values (numbers, booleans, arrays of strings that are regulation codes like "EN 71-1:2014"). Only translate human-readable text values. Return ONLY valid JSON with the same structure.`,
      },
      {
        role: "user",
        content: `Translate this compliance analysis data to ${langName}:\n${JSON.stringify(sourceData, null, 2)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "translated_ai_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  message: { type: "string" },
                  detail: { type: "string" },
                  remediation: { type: "string" },
                  affectedRegulations: { type: "array", items: { type: "string" } },
                },
                required: ["type", "message", "detail", "remediation", "affectedRegulations"],
                additionalProperties: false,
              },
            },
            recommendations: { type: "array", items: { type: "string" } },
            scoreReasons: {
              type: "object",
              properties: {
                documentCompletenessReason: { type: "string" },
                contentPlausibilityReason: { type: "string" },
                formalCorrectnessReason: { type: "string" },
                consistencyReason: { type: "string" },
              },
              required: [
                "documentCompletenessReason",
                "contentPlausibilityReason",
                "formalCorrectnessReason",
                "consistencyReason",
              ],
              additionalProperties: false,
            },
          },
          required: ["summary", "findings", "recommendations", "scoreReasons"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content ?? "{}";
  const translated: TranslatedAiAnalysis =
    typeof content === "string" ? JSON.parse(content) : content;

  // 5. Cache result
  await db.insert(aiAnalysisTranslations).values({
    analysisId,
    targetLang,
    translatedData: translated as any,
    createdAt: Date.now(),
  });

  return translated;
}

// ─── Risk Assessment Translation ──────────────────────────────────────────────

export async function translateRiskAssessment(
  assessmentId: number,
  targetLang: string
): Promise<TranslatedRiskAssessment | null> {
  const db = await getDb();
  if (!db) return null;

  // 1. Check cache
  const [cached] = await db
    .select()
    .from(riskAssessmentTranslations)
    .where(
      and(
        eq(riskAssessmentTranslations.assessmentId, assessmentId),
        eq(riskAssessmentTranslations.targetLang, targetLang)
      )
    )
    .limit(1);

  if (cached) {
    return cached.translatedData as TranslatedRiskAssessment;
  }

  // 2. Load source assessment
  const [assessment] = await db
    .select()
    .from(productRiskAssessments)
    .where(eq(productRiskAssessments.id, assessmentId))
    .limit(1);

  if (!assessment) return null;

  const langName = LANG_NAMES[targetLang] ?? targetLang;

  const sourceData = {
    summary: assessment.summary ?? "",
    risks: (assessment.risks as any[]) ?? [],
    missingInfo: (assessment.missingInfo as string[]) ?? [],
  };

  // 3. Call LLM for translation
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a professional translator specialising in regulatory and compliance documents. Translate the provided JSON content from English to ${langName}. Preserve all JSON structure, keys, and non-text values (numbers, booleans). Only translate human-readable text values (titles, descriptions, mitigations, summaries). Return ONLY valid JSON with the same structure.`,
      },
      {
        role: "user",
        content: `Translate this risk assessment data to ${langName}:\n${JSON.stringify(sourceData, null, 2)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "translated_risk_assessment",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            risks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  score: { type: "number" },
                  title: { type: "string" },
                  description: { type: "string" },
                  mitigations: { type: "array", items: { type: "string" } },
                },
                required: ["category", "score", "title", "description", "mitigations"],
                additionalProperties: false,
              },
            },
            missingInfo: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "risks", "missingInfo"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content ?? "{}";
  const translated: TranslatedRiskAssessment =
    typeof content === "string" ? JSON.parse(content) : content;

  // 4. Cache result
  await db.insert(riskAssessmentTranslations).values({
    assessmentId,
    targetLang,
    translatedData: translated as any,
    createdAt: Date.now(),
  });

  return translated;
}
