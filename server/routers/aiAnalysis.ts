import { TRPCError } from "@trpc/server";
import { z } from "zod";
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
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

// ─── OpenAI helper ────────────────────────────────────────────────────────────
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
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Analyse prompt ───────────────────────────────────────────────────────────
function buildAnalysisPrompt(product: any, docs: any[], components?: any[], componentDocs?: any[]): string {
  const docList = docs
    .map(
      (d, i) =>
        `${i + 1}. Typ: ${d.documentType}, Dateiname: ${d.fileName}, URL: ${d.fileUrl}, Status: ${d.reviewStatus}`
    )
    .join("\n");

  // Build component section
  let componentSection = "";
  if (components && components.length > 0) {
    const compLines = components.map((c) => {
      const cDocs = (componentDocs ?? []).filter((d: any) => d.componentId === c.id);
      const cDocList = cDocs.length > 0
        ? cDocs.map((d: any, i: number) => `     ${i + 1}. Typ: ${d.documentType}, Norm: ${d.standard ?? "–"}, Datei: ${d.fileName}, Status: ${d.reviewStatus}`).join("\n")
        : "     (Keine Dokumente)";
      return `  - ${c.name} (Material: ${c.materialType ?? "unbekannt"}, Teilenr.: ${c.partNumber ?? "–"}):\n${cDocList}`;
    }).join("\n");
    componentSection = `\n\nPRODUKTKOMPONENTEN (${components.length} Stück):\n${compLines}`;
  }

  return `Du bist ein Compliance-Experte für Produktsicherheit und Spielzeugrichtlinien (EN 71, CE, REACH, etc.).

Analysiere die folgende Produktdokumentation auf Plausibilität und Vollständigkeit.

PRODUKT:
- Name: ${product.productName}
- Interne Artikelnummer: ${product.internalArticleNumber ?? "nicht angegeben"}
- EAN: ${product.ean ?? "nicht angegeben"}
- Marke: ${product.brand ?? "nicht angegeben"}
- Aktueller Status: ${product.status}

PRODUKTDOKUMENTE (${docs.length} Stück):
${docList || "Keine Dokumente vorhanden"}${componentSection}

AUFGABE:
Bewerte die Dokumentation anhand von 4 Kategorien und vergib jeweils einen Score von 0-100:

1. **Dokumentenvollständigkeit** (documentCompletenessScore): Sind alle typischerweise erforderlichen Dokumente vorhanden? (Testbericht, Konformitätserklärung, Handbuch, Zertifikate)

2. **Inhaltliche Plausibilität** (contentPlausibilityScore): Sind die Dokumententypen für dieses Produkt sinnvoll und vollständig? Stimmen Produktname und Dokumentenbezeichnungen überein?

3. **Formale Korrektheit** (formalCorrectnessScore): Sind die Dokumente formal korrekt benannt? Gibt es Hinweise auf korrekte Versionierung und Aktualität?

4. **Konsistenz** (consistencyScore): Sind alle Dokumente konsistent und widerspruchsfrei? Passen alle Dokumente zum selben Produkt?

Antworte AUSSCHLIESSLICH mit folgendem JSON-Format (kein Text davor oder danach):
{
  "overallScore": <Gesamtscore 0-100, gewichteter Durchschnitt>,
  "documentCompletenessScore": <0-100>,
  "contentPlausibilityScore": <0-100>,
  "formalCorrectnessScore": <0-100>,
  "consistencyScore": <0-100>,
  "summary": "<Kurze Zusammenfassung in 2-3 Sätzen auf Deutsch>",
  "findings": [
    { "category": "<Kategorie>", "severity": "high|medium|low|info", "description": "<Befund auf Deutsch>" }
  ],
  "recommendations": [
    "<Empfehlung 1 auf Deutsch>",
    "<Empfehlung 2 auf Deutsch>"
  ]
}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const aiAnalysisRouter = router({
  // Save / update the OpenAI API key (admin only)
  saveApiKey: protectedProcedure
    .input(z.object({ apiKey: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      if (!["administrator", "compliance_manager"].includes(ctx.user.complianceRole ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Store with masking – never return the full key to the frontend
      await upsertSystemSetting("openai_api_key", input.apiKey, true, ctx.user.id);
      await createAuditLog({
        entityType: "system_settings",
        action: "openai_key_updated",
        performedByUserId: ctx.user.id,
      });
      return { success: true };
    }),

  // Check if an API key is configured (returns masked version)
  getApiKeyStatus: protectedProcedure.query(async ({ ctx }) => {
    if (!["administrator", "compliance_manager"].includes(ctx.user.complianceRole ?? "")) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const setting = await getSystemSetting("openai_api_key");
    if (!setting?.settingValue) return { configured: false, maskedKey: null };
    const key = setting.settingValue;
    const masked = key.length > 8 ? `${key.slice(0, 7)}${"*".repeat(key.length - 11)}${key.slice(-4)}` : "****";
    return { configured: true, maskedKey: masked };
  }),

  // Test the stored API key with a minimal request
  testApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    if (!["administrator", "compliance_manager"].includes(ctx.user.complianceRole ?? "")) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const setting = await getSystemSetting("openai_api_key");
    if (!setting?.settingValue) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Kein API-Schlüssel hinterlegt" });
    }
    try {
      const result = await callOpenAI(setting.settingValue, {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Antworte mit: OK" }],
        max_tokens: 5,
      });
      const reply = result.choices?.[0]?.message?.content ?? "";
      return { success: true, model: result.model, reply };
    } catch (err: any) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
    }
  }),

  // Analyse a single product
  analyzeProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!["administrator", "compliance_manager", "internal_employee"].includes(ctx.user.complianceRole ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const setting = await getSystemSetting("openai_api_key");
      if (!setting?.settingValue) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kein OpenAI API-Schlüssel konfiguriert. Bitte in den Einstellungen hinterlegen." });
      }

      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });

      const docs = await getDocumentsByProduct(input.productId);
      // Also load component data for a more thorough analysis
      const components = await getComponentsByProduct(input.productId);
      const componentDocs = await getAllComponentDocumentsByProduct(input.productId);

      // Create a pending record first
      const insertResult = await createAiAnalysis({
        productId: input.productId,
        overallScore: "0",
        status: "running",
        triggeredByUserId: ctx.user.id,
        modelUsed: "gpt-4o",
      });
      const analysisId = (insertResult as any).insertId as number;

      try {
        const prompt = buildAnalysisPrompt(product, docs, components, componentDocs);
        const response = await callOpenAI(setting.settingValue, {
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "Du bist ein Compliance-Experte. Antworte immer ausschließlich mit validem JSON.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 1500,
          temperature: 0.2,
          response_format: { type: "json_object" },
        });

        const content = response.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(content);

        const overallScore = Math.min(100, Math.max(0, Number(parsed.overallScore ?? 0)));
        const docScore = Math.min(100, Math.max(0, Number(parsed.documentCompletenessScore ?? 0)));
        const contentScore = Math.min(100, Math.max(0, Number(parsed.contentPlausibilityScore ?? 0)));
        const formalScore = Math.min(100, Math.max(0, Number(parsed.formalCorrectnessScore ?? 0)));
        const consistencyScore = Math.min(100, Math.max(0, Number(parsed.consistencyScore ?? 0)));

        await updateAiAnalysis(analysisId, {
          overallScore: overallScore.toFixed(2),
          documentCompletenessScore: docScore.toFixed(2),
          contentPlausibilityScore: contentScore.toFixed(2),
          formalCorrectnessScore: formalScore.toFixed(2),
          consistencyScore: consistencyScore.toFixed(2),
          summary: parsed.summary ?? "",
          findings: parsed.findings ?? [],
          recommendations: parsed.recommendations ?? [],
          analyzedDocumentIds: docs.map((d) => d.id),
          modelUsed: response.model ?? "gpt-4o",
          tokensUsed: response.usage?.total_tokens ?? 0,
          status: "completed",
          completedAt: new Date(),
        });

        await createAuditLog({
          entityType: "product",
          entityId: input.productId,
          action: "ai_analysis_completed",
          performedByUserId: ctx.user.id,
          payloadSnapshot: { overallScore, docsAnalyzed: docs.length } as any,
        });

        return {
          analysisId,
          overallScore,
          documentCompletenessScore: docScore,
          contentPlausibilityScore: contentScore,
          formalCorrectnessScore: formalScore,
          consistencyScore,
          summary: parsed.summary ?? "",
          findings: (parsed.findings ?? []) as Array<{ category: string; severity: string; description: string }>,
          recommendations: (parsed.recommendations ?? []) as string[],
          modelUsed: response.model ?? "gpt-4o",
          tokensUsed: response.usage?.total_tokens ?? 0,
        };
      } catch (err: any) {
        await updateAiAnalysis(analysisId, {
          status: "failed",
          errorMessage: err.message,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `KI-Analyse fehlgeschlagen: ${err.message}`,
        });
      }
    }),

  // Batch analyse multiple products
  analyzeProducts: protectedProcedure
    .input(z.object({ productIds: z.array(z.number()).min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      if (!["administrator", "compliance_manager", "internal_employee"].includes(ctx.user.complianceRole ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const setting = await getSystemSetting("openai_api_key");
      if (!setting?.settingValue) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kein OpenAI API-Schlüssel konfiguriert." });
      }

      const results: Array<{ productId: number; success: boolean; overallScore?: number; error?: string }> = [];

      for (const productId of input.productIds) {
        try {
          const product = await getProductById(productId);
          if (!product) {
            results.push({ productId, success: false, error: "Produkt nicht gefunden" });
            continue;
          }

          const docs = await getDocumentsByProduct(productId);
          const components = await getComponentsByProduct(productId);
          const componentDocs = await getAllComponentDocumentsByProduct(productId);
          const insertResult = await createAiAnalysis({
            productId,
            overallScore: "0",
            status: "running",
            triggeredByUserId: ctx.user.id,
            modelUsed: "gpt-4o",
          });
          const analysisId = (insertResult as any).insertId as number;

          const prompt = buildAnalysisPrompt(product, docs, components, componentDocs);
          const response = await callOpenAI(setting.settingValue, {
            model: "gpt-4o",
            messages: [
              { role: "system", content: "Du bist ein Compliance-Experte. Antworte immer ausschließlich mit validem JSON." },
              { role: "user", content: prompt },
            ],
            max_tokens: 1500,
            temperature: 0.2,
            response_format: { type: "json_object" },
          });

          const content = response.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(content);
          const overallScore = Math.min(100, Math.max(0, Number(parsed.overallScore ?? 0)));

          await updateAiAnalysis(analysisId, {
            overallScore: overallScore.toFixed(2),
            documentCompletenessScore: Math.min(100, Math.max(0, Number(parsed.documentCompletenessScore ?? 0))).toFixed(2),
            contentPlausibilityScore: Math.min(100, Math.max(0, Number(parsed.contentPlausibilityScore ?? 0))).toFixed(2),
            formalCorrectnessScore: Math.min(100, Math.max(0, Number(parsed.formalCorrectnessScore ?? 0))).toFixed(2),
            consistencyScore: Math.min(100, Math.max(0, Number(parsed.consistencyScore ?? 0))).toFixed(2),
            summary: parsed.summary ?? "",
            findings: parsed.findings ?? [],
            recommendations: parsed.recommendations ?? [],
            analyzedDocumentIds: docs.map((d) => d.id),
            modelUsed: response.model ?? "gpt-4o",
            tokensUsed: response.usage?.total_tokens ?? 0,
            status: "completed",
            completedAt: new Date(),
          });

          results.push({ productId, success: true, overallScore });
        } catch (err: any) {
          results.push({ productId, success: false, error: err.message });
        }
      }

      return { results };
    }),

  // Get latest analysis for a product
  getLatest: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      return getLatestAiAnalysisByProduct(input.productId);
    }),

  // Get analysis history for a product
  getHistory: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      return getAiAnalysisHistory(input.productId);
    }),
});
