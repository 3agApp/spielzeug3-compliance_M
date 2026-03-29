/**
 * server/domains/ai/aiAnalysisService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for AI-powered compliance analysis.
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

// ─── OpenAI helper (isolated for testability) ─────────────────────────────────

async function callOpenAI(apiKey: string, payload: object): Promise<any> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw Errors.external("OpenAI", `HTTP ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Prompt builder (isolated for testability) ────────────────────────────────

export function buildAnalysisPrompt(
  product: any,
  docs: any[],
  safety: any | null,
  components?: any[],
  componentDocs?: any[]
): string {
  const docList = docs.length > 0
    ? docs.map((d, i) =>
        `${i + 1}. Typ: ${d.documentType}, Dateiname: ${d.fileName ?? "–"}, Status: ${d.reviewStatus}` +
        (d.standard ? `, Norm: ${d.standard}` : "") +
        (d.expiresAt ? `, Ablauf: ${new Date(d.expiresAt).toISOString().slice(0, 10)}` : "")
      ).join("\n")
    : "(Keine Dokumente vorhanden)";

  const safetySection = safety
    ? `\nSICHERHEITSDATEN:\n  Sicherheitstext: ${safety.safetyText ?? "–"}\n  Warnhinweis: ${safety.warningText ?? "–"}\n  Altersfreigabe: ${safety.ageGrading ?? "–"}\n  Materialinformation: ${safety.materialInformation ?? "–"}\n  Verwendungsbeschränkungen: ${safety.usageRestrictions ?? "–"}\n  Sicherheitshinweise: ${safety.safetyNotes ?? "–"}`
    : "\nSICHERHEITSDATEN: (Keine Sicherheitsdaten hinterlegt)";

  let componentSection = "";
  if (components && components.length > 0) {
    const compLines = components
      .map((c) => {
        const cDocs = (componentDocs ?? []).filter((d: any) => d.componentId === c.id);
        const cDocList = cDocs.length > 0
          ? cDocs.map((d: any, i: number) =>
              `     ${i + 1}. Typ: ${d.documentType}, Norm: ${d.standard ?? "–"}, Datei: ${d.fileName}, Status: ${d.reviewStatus}`
            ).join("\n")
          : "     (Keine Dokumente)";
        return `  - ${c.name} (Material: ${c.materialType ?? "unbekannt"}, Teilenr.: ${c.partNumber ?? "–"}):\n${cDocList}`;
      }).join("\n");
    componentSection = `\n\nPRODUKTKOMPONENTEN (${components.length} Stück):\n${compLines}`;
  }

  return `Du bist ein Compliance-Experte für Produktsicherheit und Spielzeugrichtlinien (EN 71, CE, REACH, GPSR etc.).
Analysiere die folgende Produktdokumentation auf Plausibilität und Vollständigkeit.

PRODUKT: ${product.productName}
MARKE: ${product.brand ?? "–"}
ALTERSGRUPPE: ${product.ageGroup ?? "–"}
ZIELMARKT: ${product.targetMarket ?? "–"}
STATUS: ${product.status}${safetySection}${componentSection}

DOKUMENTE (${docs.length} Stück):
${docList}

BEWERTE:
1. Vollständigkeit der Dokumentation (Testberichte, Konformitätserklärungen, Zertifikate haben höchste Priorität)
2. Plausibilität der Sicherheitsdaten (Altersfreigabe, Warnhinweise, Materialangaben)
3. Formale Korrektheit (Normenreferenzen, Ablaufdaten, Statusangaben)
4. Konsistenz zwischen Sicherheitsdaten und Dokumenten

Gib deine Analyse als JSON zurück:
{
  "overallScore": <0-100>,
  "riskLevel": "low" | "medium" | "high",
  "summary": "<2-3 Sätze Zusammenfassung auf Deutsch>",
  "findings": [{"type": "positive"|"warning"|"critical", "message": "<string>"}],
  "recommendations": ["<string>"],
  "missingDocuments": ["<string>"]
}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const aiAnalysisService = {
  /** Get API key status (masked) – admin/compliance_manager only. */
  async getApiKeyStatus(user: UserContext) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager"]);
    const setting = await getSystemSetting("openai_api_key");
    if (!setting?.settingValue) return { configured: false, maskedKey: null };
    const key = setting.settingValue;
    const masked =
      key.length > 8 ? `${key.slice(0, 7)}${"*".repeat(key.length - 11)}${key.slice(-4)}` : "****";
    return { configured: true, maskedKey: masked };
  },

  /** Test the stored API key with a minimal request. */
  async testApiKey(user: UserContext) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager"]);
    const setting = await getSystemSetting("openai_api_key");
    if (!setting?.settingValue) throw Errors.precondition("Kein API-Schlüssel hinterlegt");
    const result = await callOpenAI(setting.settingValue, {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Antworte mit: OK" }],
      max_tokens: 5,
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
  async analyzeProducts(user: UserContext & { id: number }, productIds: number[]) {
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

   /** Run a new AI analysis for a product using the built-in LLM (no external API key needed). */
  async analyze(user: UserContext & { id: number }, productId: number) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const enabledSetting = await getSystemSetting("AI_ANALYSIS_ENABLED");
    if (enabledSetting?.settingValue === "false") {
      throw Errors.precondition("AI-Analyse ist deaktiviert.");
    }
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);

    const docs = await getDocumentsByProduct(productId);
    const safety = await getProductSafety(productId);
    const components = await getComponentsByProduct(productId);
    const componentDocs = await getAllComponentDocumentsByProduct(productId);
    const prompt = buildAnalysisPrompt(product, docs, safety, components, componentDocs);

    const analysisRecord = await createAiAnalysis({
      productId,
      status: "pending",
      overallScore: "0",
      triggeredByUserId: user.id,
    } as any);
    const analysisId = analysisRecord; // createAiAnalysis now returns insertId directly as number

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Du bist ein Compliance-Experte für Produktsicherheit. Antworte ausschließlich mit validem JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "compliance_analysis",
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

      const rawContent = response.choices?.[0]?.message?.content ?? "{}";
      const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      const parsed = JSON.parse(content);

      // Derive sub-scores from findings if not explicitly provided
      const findings = parsed.findings ?? [];
      const positiveCount = findings.filter((f: any) => f.type === "positive").length;
      const warningCount = findings.filter((f: any) => f.type === "warning").length;
      const criticalCount = findings.filter((f: any) => f.type === "critical").length;
      const totalFindings = findings.length || 1;

      // Document completeness: based on missing documents
      const missingDocs = parsed.missingDocuments ?? [];
      const docScore = Math.max(0, 100 - missingDocs.length * 15);

      // Content plausibility: based on positive vs warning/critical ratio
      const contentScore = Math.round(((positiveCount + 1) / (totalFindings + 1)) * 100);

      // Formal correctness: deduct for critical findings
      const formalScore = Math.max(0, 100 - criticalCount * 25);

      // Consistency: deduct for warnings
      const consistencyScore = Math.max(0, 100 - warningCount * 15);

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
        modelUsed: "built-in",
        completedAt: new Date(),
      });

      await createAuditLog({
        entityType: "product",
        entityId: productId,
        action: "ai_analysis_completed",
        performedByUserId: user.id,
      });

      return { success: true, analysisId, result: parsed };
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
    // If product not found, return null/undefined gracefully (no analysis exists)
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
  async updateSettings(user: UserContext, settings: { apiKey?: string; enabled?: boolean }) {
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
