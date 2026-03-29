/**
 * server/domains/ai/aiAnalysisService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for AI-powered compliance analysis.
 *
 * Two analysis types:
 *  1. Document Analysis  – per-document review (completeness, formal correctness, content)
 *  2. Risk Assessment    – overall product risk evaluation (all docs + safety data)
 *
 * All AI output is in English regardless of UI language.
 */

import {
  createAiAnalysis,
  createAuditLog,
  getAiAnalysisHistory,
  getAllComponentDocumentsByProduct,
  getComponentsByProduct,
  getDocumentsByProduct,
  getLatestAiAnalysisByProduct,
  getProductById,
  getProductSafety,
  getSystemSetting,
  updateAiAnalysis,
  upsertSystemSetting,
} from "../../db";
import { invokeLLM } from "../../_core/llm";
import { Errors, requireRole, assertSupplierOrInternal, ADMIN_ROLES } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

// ─── Prompt builders ──────────────────────────────────────────────────────────

/**
 * Build a per-document analysis prompt.
 */
export function buildDocumentAnalysisPrompt(
  product: any,
  docs: any[]
): string {
  if (docs.length === 0) {
    return `You are a toy industry compliance expert (EN 71, CE, CPSIA, REACH, GPSR).
No documents have been uploaded for product "${product.productName}".
Return a JSON analysis indicating that no documents are available.`;
  }

  const docList = docs
    .map(
      (d, i) =>
        `${i + 1}. ID:${d.id} | Type: ${d.documentType} | File: ${d.fileName ?? "–"} | Status: ${d.reviewStatus}` +
        (d.standard ? ` | Standard: ${d.standard}` : "") +
        (d.expiresAt ? ` | Expires: ${new Date(d.expiresAt).toISOString().slice(0, 10)}` : "")
    )
    .join("\n");

  return `You are a toy industry compliance expert specializing in EN 71, CE marking, CPSIA, REACH, and GPSR regulations.

PRODUCT: ${product.productName}
BRAND: ${product.brand ?? "–"}
AGE GROUP: ${product.ageGroup ?? "–"}
TARGET MARKET: ${product.targetMarket ?? "–"}

UPLOADED DOCUMENTS (${docs.length} total):
${docList}

TASK: Analyze each document individually. For each document, evaluate:
1. Formal correctness (correct document type for the product, valid standards referenced, expiry dates present)
2. Content completeness (does the document cover what is expected for this product type?)
3. Any issues or concerns

Return ONLY valid JSON matching this exact schema – no extra text:
{
  "documentAnalysis": [
    {
      "documentId": <number – the ID from the list above>,
      "documentType": "<string>",
      "fileName": "<string>",
      "score": <0-100>,
      "status": "ok" | "warning" | "critical",
      "issues": ["<string>"],
      "positives": ["<string>"]
    }
  ]
}`;
}

/**
 * Build the overall risk assessment prompt.
 */
export function buildRiskAssessmentPrompt(
  product: any,
  docs: any[],
  safety: any | null,
  components?: any[],
  componentDocs?: any[]
): string {
  const docList =
    docs.length > 0
      ? docs
          .map(
            (d, i) =>
              `${i + 1}. Type: ${d.documentType}, File: ${d.fileName ?? "–"}, Status: ${d.reviewStatus}` +
              (d.standard ? `, Standard: ${d.standard}` : "") +
              (d.expiresAt ? `, Expires: ${new Date(d.expiresAt).toISOString().slice(0, 10)}` : "")
          )
          .join("\n")
      : "(No documents uploaded)";

  const safetySection = safety
    ? `\nSAFETY DATA:\n  Safety text: ${safety.safetyText ?? "–"}\n  Warning text: ${safety.warningText ?? "–"}\n  Age grading: ${safety.ageGrading ?? "–"}\n  Material information: ${safety.materialInformation ?? "–"}\n  Usage restrictions: ${safety.usageRestrictions ?? "–"}\n  Safety notes: ${safety.safetyNotes ?? "–"}`
    : "\nSAFETY DATA: (No safety data provided)";

  let componentSection = "";
  if (components && components.length > 0) {
    const compLines = components
      .map((c) => {
        const cDocs = (componentDocs ?? []).filter((d: any) => d.componentId === c.id);
        const cDocList =
          cDocs.length > 0
            ? cDocs
                .map(
                  (d: any, i: number) =>
                    `     ${i + 1}. Type: ${d.documentType}, Standard: ${d.standard ?? "–"}, File: ${d.fileName}, Status: ${d.reviewStatus}`
                )
                .join("\n")
            : "     (No documents)";
        return `  - ${c.name} (Material: ${c.materialType ?? "unknown"}, Part no.: ${c.partNumber ?? "–"}):\n${cDocList}`;
      })
      .join("\n");
    componentSection = `\n\nPRODUCT COMPONENTS (${components.length} total):\n${compLines}`;
  }

  return `You are a toy industry compliance expert specializing in EN 71, CE marking, CPSIA, REACH, and GPSR regulations.
Perform an overall risk assessment for the following product.

PRODUCT: ${product.productName}
BRAND: ${product.brand ?? "–"}
AGE GROUP: ${product.ageGroup ?? "–"}
TARGET MARKET: ${product.targetMarket ?? "–"}
STATUS: ${product.status}${safetySection}${componentSection}

DOCUMENTS (${docs.length} total):
${docList}

EVALUATE:
1. Documentation completeness (test reports, declarations of conformity, and certificates have highest priority)
2. Safety data plausibility (age grading, warnings, material information)
3. Formal correctness (standard references, expiry dates, review status)
4. Consistency between safety data and documents

Return ONLY valid JSON matching this exact schema – no extra text:
{
  "overallScore": <0-100>,
  "riskLevel": "low" | "medium" | "high",
  "summary": "<2-3 sentence summary in English>",
  "findings": [
    { "type": "positive" | "warning" | "critical", "message": "<string>" }
  ],
  "recommendations": ["<string>"],
  "missingDocuments": ["<string>"]
}`;
}

// Legacy alias for backward compatibility with tests
export const buildAnalysisPrompt = buildRiskAssessmentPrompt;

// ─── Service ──────────────────────────────────────────────────────────────────

export const aiAnalysisService = {
  /** Get API key status (masked) – admin/compliance_manager only. */
  async getApiKeyStatus(user: UserContext) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager"]);
    const setting = await getSystemSetting("openai_api_key");
    if (!setting?.settingValue) return { configured: false, maskedKey: null };
    const key = setting.settingValue;
    const masked =
      key.length > 8
        ? `${key.slice(0, 7)}${"*".repeat(key.length - 11)}${key.slice(-4)}`
        : "****";
    return { configured: true, maskedKey: masked };
  },

  /** Test the stored API key with a minimal request. */
  async testApiKey(user: UserContext) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager"]);
    const result = await invokeLLM({
      messages: [{ role: "user", content: "Reply with: OK" }],
    });
    return {
      success: true,
      model: result.model,
      reply: result.choices?.[0]?.message?.content ?? "",
    };
  },

  /** Analyse a single product (alias for analyze). */
  async analyzeProduct(user: UserContext & { id: number }, productId: number) {
    return this.analyze(user, productId);
  },

  /** Batch analyse multiple products. */
  async analyzeProducts(
    user: UserContext & { id: number },
    productIds: number[]
  ) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const results: Array<{
      productId: number;
      success: boolean;
      overallScore?: number;
      error?: string;
    }> = [];
    for (const productId of productIds) {
      try {
        const r = await this.analyze(user, productId);
        results.push({ productId, success: true, overallScore: r.result?.overallScore });
      } catch (err: any) {
        results.push({ productId, success: false, error: err.message });
      }
    }
    return { results };
  },

  /**
   * Run a full analysis for a product:
   *  - Per-document analysis (Document Analysis tab)
   *  - Overall risk assessment (Risk Assessment tab)
   * Uses the built-in LLM – no external API key needed.
   */
  async analyze(user: UserContext & { id: number }, productId: number) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const enabledSetting = await getSystemSetting("AI_ANALYSIS_ENABLED");
    if (enabledSetting?.settingValue === "false") {
      throw Errors.precondition("AI analysis is disabled.");
    }
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);

    const docs = await getDocumentsByProduct(productId);
    const safety = await getProductSafety(productId);
    const components = await getComponentsByProduct(productId);
    const componentDocs = await getAllComponentDocumentsByProduct(productId);

    // Create pending record
    const analysisId = await createAiAnalysis({
      productId,
      status: "pending",
      overallScore: "0",
      triggeredByUserId: user.id,
    } as any);

    try {
      // ── Step 1: Per-document analysis ──────────────────────────────────────
      let documentAnalysis: any[] = [];

      if (docs.length > 0) {
        const docPrompt = buildDocumentAnalysisPrompt(product, docs);
        const docResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a toy industry compliance expert. Respond ONLY with valid JSON, no markdown, no extra text.",
            },
            { role: "user", content: docPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "document_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  documentAnalysis: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        documentId: { type: "number" },
                        documentType: { type: "string" },
                        fileName: { type: "string" },
                        score: { type: "number" },
                        status: { type: "string" },
                        issues: { type: "array", items: { type: "string" } },
                        positives: { type: "array", items: { type: "string" } },
                      },
                      required: ["documentId", "documentType", "fileName", "score", "status", "issues", "positives"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["documentAnalysis"],
                additionalProperties: false,
              },
            },
          },
        });

        const docRaw = docResponse.choices?.[0]?.message?.content ?? "{}";
        const docContent = typeof docRaw === "string" ? docRaw : JSON.stringify(docRaw);
        const docParsed = JSON.parse(docContent);
        documentAnalysis = docParsed.documentAnalysis ?? [];
      }

      // ── Step 2: Overall risk assessment ────────────────────────────────────
      const riskPrompt = buildRiskAssessmentPrompt(product, docs, safety, components, componentDocs);
      const riskResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a toy industry compliance expert. Respond ONLY with valid JSON, no markdown, no extra text.",
          },
          { role: "user", content: riskPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "risk_assessment",
            strict: true,
            schema: {
              type: "object",
              properties: {
                overallScore: { type: "number" },
                riskLevel: { type: "string" },
                summary: { type: "string" },
                findings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      message: { type: "string" },
                    },
                    required: ["type", "message"],
                    additionalProperties: false,
                  },
                },
                recommendations: { type: "array", items: { type: "string" } },
                missingDocuments: { type: "array", items: { type: "string" } },
              },
              required: ["overallScore", "riskLevel", "summary", "findings", "recommendations", "missingDocuments"],
              additionalProperties: false,
            },
          },
        },
      });

      const riskRaw = riskResponse.choices?.[0]?.message?.content ?? "{}";
      const riskContent = typeof riskRaw === "string" ? riskRaw : JSON.stringify(riskRaw);
      const parsed = JSON.parse(riskContent);

      // ── Derive sub-scores ──────────────────────────────────────────────────
      const findings = parsed.findings ?? [];
      const positiveCount = findings.filter((f: any) => f.type === "positive").length;
      const warningCount = findings.filter((f: any) => f.type === "warning").length;
      const criticalCount = findings.filter((f: any) => f.type === "critical").length;
      const totalFindings = findings.length || 1;

      const missingDocs = parsed.missingDocuments ?? [];
      const docScore = Math.max(0, 100 - missingDocs.length * 15);
      const contentScore = Math.round(((positiveCount + 1) / (totalFindings + 1)) * 100);
      const formalScore = Math.max(0, 100 - criticalCount * 25);
      const consistencyScore = Math.max(0, 100 - warningCount * 15);

      // ── Save to DB ─────────────────────────────────────────────────────────
      await updateAiAnalysis(analysisId, {
        status: "completed",
        overallScore: String(parsed.overallScore ?? 0),
        documentCompletenessScore: String(docScore),
        contentPlausibilityScore: String(contentScore),
        formalCorrectnessScore: String(formalScore),
        consistencyScore: String(consistencyScore),
        summary: parsed.summary ?? null,
        findings: parsed.findings ?? [],
        recommendations: parsed.recommendations ?? [],
        documentAnalysis: documentAnalysis,
        analyzedDocumentIds: docs.map((d) => d.id),
        modelUsed: "built-in",
        completedAt: new Date(),
      });

      await createAuditLog({
        entityType: "product",
        entityId: productId,
        action: "ai_analysis_completed",
        performedByUserId: user.id,
      });

      return {
        success: true,
        analysisId,
        result: {
          ...parsed,
          documentAnalysis,
        },
      };
    } catch (err) {
      await updateAiAnalysis(analysisId, {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  },

  /** Get the latest analysis result for a product. */
  async getLatest(user: UserContext, productId: number) {
    const product = await getProductById(productId);
    if (!product) return undefined;
    assertSupplierOrInternal(user, product.supplierId);
    return getLatestAiAnalysisByProduct(productId);
  },

  /** Get the full analysis history for a product. */
  async getHistory(user: UserContext, productId: number) {
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);
    return getAiAnalysisHistory(productId);
  },

  /** Update AI analysis settings (admin only). */
  async updateSettings(
    user: UserContext,
    settings: { apiKey?: string; enabled?: boolean }
  ) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager"]);
    if (settings.apiKey !== undefined) {
      await upsertSystemSetting("openai_api_key", settings.apiKey);
    }
    if (settings.enabled !== undefined) {
      await upsertSystemSetting("AI_ANALYSIS_ENABLED", String(settings.enabled));
    }
    return { success: true };
  },
};
