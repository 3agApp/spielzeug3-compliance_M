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
  getSystemSetting,
  updateAiAnalysis,
  upsertSystemSetting,
} from "../../db";
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
  components?: any[],
  componentDocs?: any[]
): string {
  const docList = docs
    .map(
      (d, i) =>
        `${i + 1}. Typ: ${d.documentType}, Dateiname: ${d.fileName}, URL: ${d.fileUrl}, Status: ${d.reviewStatus}`
    )
    .join("\n");

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
                    `     ${i + 1}. Typ: ${d.documentType}, Norm: ${d.standard ?? "–"}, Datei: ${d.fileName}, Status: ${d.reviewStatus}`
                )
                .join("\n")
            : "     (Keine Dokumente)";
        return `  - ${c.name} (Material: ${c.materialType ?? "unbekannt"}, Teilenr.: ${c.partNumber ?? "–"}):\n${cDocList}`;
      })
      .join("\n");
    componentSection = `\n\nPRODUKTKOMPONENTEN (${components.length} Stück):\n${compLines}`;
  }

  return `Du bist ein Compliance-Experte für Produktsicherheit und Spielzeugrichtlinien (EN 71, CE, REACH, etc.).
Analysiere die folgende Produktdokumentation auf Plausibilität und Vollständigkeit.

PRODUKT: ${product.productName}
MARKE: ${product.brand ?? "–"}
ALTERSGRUPPE: ${product.ageGroup ?? "–"}
ZIELMARKT: ${product.targetMarket ?? "–"}
STATUS: ${product.status}${componentSection}

DOKUMENTE (${docs.length} Stück):
${docList || "(Keine Dokumente vorhanden)"}

Gib deine Analyse als JSON zurück mit folgenden Feldern:
- overallScore: Zahl 0-100
- riskLevel: "low" | "medium" | "high"
- summary: Kurze Zusammenfassung (2-3 Sätze)
- findings: Array von { type: "positive"|"warning"|"critical", message: string }
- recommendations: Array von strings
- missingDocuments: Array von strings (fehlende Dokumenttypen)`;
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

   /** Run a new AI analysis for a product. */
  async analyze(user: UserContext & { id: number }, productId: number) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    // Check API key first (BAD_REQUEST if missing)
    const apiKeySetting = await getSystemSetting("openai_api_key");
    const apiKey = apiKeySetting?.settingValue;
    if (!apiKey) {
      throw Errors.validation(
        "OpenAI API-Schlüssel ist nicht konfiguriert. Bitte in den Systemeinstellungen hinterlegen."
      );
    }
    const enabledSetting = await getSystemSetting("AI_ANALYSIS_ENABLED");
    if (enabledSetting?.settingValue === "false") {
      throw Errors.precondition("AI-Analyse ist deaktiviert.");
    }
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);

    const docs = await getDocumentsByProduct(productId);
    const components = await getComponentsByProduct(productId);
    const componentDocs = await getAllComponentDocumentsByProduct(productId);
    const prompt = buildAnalysisPrompt(product, docs, components, componentDocs);

    const analysisRecord = await createAiAnalysis({
      productId,
      status: "pending",
      overallScore: "0",
      triggeredByUserId: user.id,
    } as any);
    const analysisId =
      typeof analysisRecord === "number" ? analysisRecord : (analysisRecord as any)?.id ?? 0;

    try {
      const response = await callOpenAI(apiKey, {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a compliance expert. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const content = response.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content);

      await updateAiAnalysis(analysisId, {
        status: "completed",
        analysisResult: JSON.stringify(parsed),
        completedAt: new Date(),
        overallScore: String(parsed.overallScore ?? 0),
      } as any);

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
