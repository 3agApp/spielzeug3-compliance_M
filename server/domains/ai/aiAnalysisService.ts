/**
 * server/domains/ai/aiAnalysisService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for AI-powered compliance analysis.
 *
 * Design decisions:
 * - OpenAI API call is isolated in a private helper so it can be mocked in tests.
 * - The service validates that the product exists and the caller has access
 *   before making any external API call (fail fast, avoid unnecessary costs).
 * - System settings (OPENAI_API_KEY, AI_ANALYSIS_ENABLED) are read from DB
 *   so admins can toggle the feature without a deployment.
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
  /**
   * Run a new AI analysis for a product.
   * Only internal roles may trigger analyses.
   */
  async analyze(user: UserContext & { id: number }, productId: number) {
    requireRole(user.complianceRole, ADMIN_ROLES);

    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);

    // Check if AI analysis is enabled
    const enabledSetting = await getSystemSetting("AI_ANALYSIS_ENABLED");
    if (enabledSetting?.settingValue === "false") {
      throw Errors.precondition("AI-Analyse ist deaktiviert.");
    }

    // Get API key from system settings
    const apiKeySetting = await getSystemSetting("OPENAI_API_KEY");
    const apiKey = apiKeySetting?.settingValue;
    if (!apiKey) {
      throw Errors.precondition(
        "OpenAI API-Schlüssel ist nicht konfiguriert. Bitte in den Systemeinstellungen hinterlegen."
      );
    }

    // Gather all documents and components
    const docs = await getDocumentsByProduct(productId);
    const components = await getComponentsByProduct(productId);
    const componentDocs = await getAllComponentDocumentsByProduct(productId);

    const prompt = buildAnalysisPrompt(product, docs, components, componentDocs);

    // Create a pending analysis record
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
          { role: "system", content: "You are a compliance expert. Always respond with valid JSON." },
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

  /**
   * Get the latest analysis result for a product.
   */
  async getLatest(user: UserContext, productId: number) {
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);
    return getLatestAiAnalysisByProduct(productId);
  },

  /**
   * Get the full analysis history for a product.
   */
  async getHistory(user: UserContext, productId: number) {
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);
    return getAiAnalysisHistory(productId);
  },

  /**
   * Update AI analysis settings (admin only).
   */
  async updateSettings(
    user: UserContext,
    settings: { apiKey?: string; enabled?: boolean }
  ) {
    requireRole(user.complianceRole, ["administrator", "super_admin"]);
    if (settings.apiKey !== undefined) {
      await upsertSystemSetting("OPENAI_API_KEY", settings.apiKey);
    }
    if (settings.enabled !== undefined) {
      await upsertSystemSetting("AI_ANALYSIS_ENABLED", String(settings.enabled));
    }
    return { success: true };
  },
};
