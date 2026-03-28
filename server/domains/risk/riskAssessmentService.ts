/**
 * server/domains/risk/riskAssessmentService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * AI-powered risk assessment for products.
 * Uses the Manus built-in LLM (invokeLLM) – no external API key required.
 *
 * Risk score scale: 1 (very low) → 10 (critical)
 * Risk levels:
 *   1-3  → low      (green)
 *   4-6  → medium   (yellow)
 *   7-8  → high     (orange)
 *   9-10 → critical (red)
 */

import { invokeLLM } from "../../_core/llm";
import { getDb } from "../../db";
import {
  productRiskAssessments,
  products,
  documents,
  productComponents,
  componentDocuments,
  missingRequirements,
  aiAnalysisResults,
} from "../../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { Errors, requireRole, assertSupplierOrInternal, ADMIN_ROLES } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiskItem {
  category: string;           // e.g. "Produktsicherheit", "Dokumentation", "Chemikalien"
  score: number;              // 1–10
  title: string;              // Short title of the risk
  description: string;        // Detailed explanation why this is a risk
  mitigations: string[];      // Concrete steps to reduce this risk
}

export interface RiskAssessmentResult {
  overallRiskScore: number;   // 1–10 (weighted average of top risks)
  riskLevel: "low" | "medium" | "high" | "critical";
  summary: string;            // 2-3 sentence executive summary
  risks: RiskItem[];          // All identified risks, sorted by score desc
  missingInfo: string[];      // What additional info would reduce risk
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildRiskPrompt(
  product: any,
  docs: any[],
  components: any[],
  componentDocs: any[],
  missingReqs: any[],
  latestAiAnalysis: any | null
): string {
  const docList = docs.length > 0
    ? docs.map((d, i) =>
        `  ${i + 1}. Typ: ${d.documentType}, Status: ${d.reviewStatus}, Datei: ${d.fileName ?? "–"}` +
        (d.standard ? `, Norm: ${d.standard}` : "") +
        (d.expiresAt ? `, Ablauf: ${new Date(d.expiresAt).toISOString().slice(0, 10)}` : "")
      ).join("\n")
    : "  (Keine Dokumente vorhanden)";

  const compList = components.length > 0
    ? components.map((c) => {
        const cDocs = componentDocs.filter((d: any) => d.componentId === c.id);
        const cDocStr = cDocs.length > 0
          ? cDocs.map((d: any) => `    - ${d.documentType} (${d.reviewStatus})`).join("\n")
          : "    (Keine Komponentendokumente)";
        return `  - ${c.name} (Material: ${c.materialType ?? "unbekannt"}):\n${cDocStr}`;
      }).join("\n")
    : "  (Keine Komponenten erfasst)";

  const missingList = missingReqs.length > 0
    ? missingReqs.map((r: any) => `  - ${r.requirementType}: ${r.description ?? ""}`).join("\n")
    : "  (Keine offenen Anforderungen)";

  const aiSummary = latestAiAnalysis?.summary
    ? `\nLETZTE COMPLIANCE-ANALYSE (Score ${latestAiAnalysis.overallScore}/100):\n  ${latestAiAnalysis.summary}`
    : "";

  return `Du bist ein Risikomanagement-Experte für Produktsicherheit, Spielzeugrichtlinien und Lieferketten-Compliance (EN 71, CE, REACH, RoHS, GPSR etc.).

Deine Aufgabe: Bewerte das folgende Produkt auf alle relevanten Risiken und gib eine strukturierte Risikobewertung zurück.

PRODUKT-INFORMATIONEN:
  Name: ${product.productName}
  Marke: ${product.brand ?? "–"}
  Interne Artikelnummer: ${product.internalArticleNumber ?? "–"}
  Altersgruppe: ${product.ageGroup ?? "–"}
  Zielmarkt: ${product.targetMarket ?? "–"}
  Compliance-Status: ${product.status}
  Vollständigkeitsgrad: ${product.completenessScore ?? 0}%
  Lieferant-ID: ${product.supplierId}${aiSummary}

VORHANDENE DOKUMENTE (${docs.length}):
${docList}

PRODUKTKOMPONENTEN (${components.length}):
${compList}

OFFENE ANFORDERUNGEN / FEHLENDE UNTERLAGEN (${missingReqs.length}):
${missingList}

BEWERTUNGSAUFGABE:
Identifiziere alle relevanten Risiken in folgenden Kategorien (sofern zutreffend):
1. Produktsicherheit (physische Gefahren, Verletzungsrisiken)
2. Chemische Risiken (REACH, RoHS, Schadstoffe)
3. Dokumentationslücken (fehlende/abgelaufene Zertifikate, Prüfberichte)
4. Regulatorische Risiken (CE, EN 71, GPSR-Konformität)
5. Altersgruppen-Risiken (Kleinteile, Erstickungsgefahr, Altersfreigabe)
6. Lieferketten-Risiken (Lieferantenqualität, Herkunft, Rückverfolgbarkeit)
7. Marktrisiken (Rückrufrisiko, Reputationsrisiko)
8. Datenlücken (fehlende Produktinformationen, unvollständige Angaben)

Für jedes identifizierte Risiko:
- Vergib einen Score von 1 (sehr niedrig) bis 10 (kritisch)
- Erkläre präzise WARUM dieses Risiko besteht (basierend auf den vorliegenden Daten)
- Nenne 2-4 konkrete Maßnahmen zur Risikoreduktion

Berechne den Gesamt-Risikoscore als gewichteten Durchschnitt (höhere Scores gewichten stärker).
Klassifiziere: 1-3 = low, 4-6 = medium, 7-8 = high, 9-10 = critical.

Antworte AUSSCHLIESSLICH mit validem JSON in folgendem Format:
{
  "overallRiskScore": <Zahl 1.0-10.0>,
  "riskLevel": "<low|medium|high|critical>",
  "summary": "<2-3 Sätze Executive Summary auf Deutsch>",
  "risks": [
    {
      "category": "<Kategoriename>",
      "score": <1-10>,
      "title": "<Kurztitel des Risikos>",
      "description": "<Detaillierte Begründung warum dieses Risiko besteht>",
      "mitigations": ["<Maßnahme 1>", "<Maßnahme 2>", ...]
    }
  ],
  "missingInfo": ["<Fehlende Info 1>", "<Fehlende Info 2>", ...]
}

Sortiere risks nach score absteigend. Identifiziere mindestens 3, maximal 10 Risiken.`;
}

// ─── Score → Level helper ─────────────────────────────────────────────────────

export function scoreToLevel(score: number): "low" | "medium" | "high" | "critical" {
  if (score <= 3) return "low";
  if (score <= 6) return "medium";
  if (score <= 8) return "high";
  return "critical";
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function createRiskAssessment(db: any, data: {
  productId: number;
  tenantId: number;
  overallRiskScore: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "pending" | "running" | "completed" | "failed";
  triggeredByUserId: number;
}) {
  const [result] = await db.insert(productRiskAssessments).values(data);
  return result.insertId as number;
}

async function updateRiskAssessment(db: any, id: number, data: Partial<{
  status: "pending" | "running" | "completed" | "failed";
  overallRiskScore: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  risks: any;
  summary: string;
  missingInfo: any;
  modelUsed: string;
  tokensUsed: number;
  errorMessage: string;
  completedAt: Date;
}>) {
  await db.update(productRiskAssessments).set(data).where(eq(productRiskAssessments.id, id));
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const riskAssessmentService = {
  /**
   * Run a risk assessment triggered automatically by the system (no role check).
   * Used for fire-and-forget triggers after document uploads.
   * Silently fails so it never blocks the caller.
   */
  async runAutomatic(productId: number, triggeredByUserId: number): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;
      const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      if (!product) return;
      const productDocs = await db.select().from(documents).where(eq(documents.productId, productId));
      const productComponentsList = await db.select().from(productComponents).where(eq(productComponents.productId, productId));
      const compDocsList = productComponentsList.length > 0
        ? await db.select().from(componentDocuments).where(eq(componentDocuments.componentId, productComponentsList[0].id))
        : [];
      const missingReqs = await db.select().from(missingRequirements).where(eq(missingRequirements.productId, productId));
      const [latestAi] = await db.select().from(aiAnalysisResults)
        .where(and(eq(aiAnalysisResults.productId, productId), eq(aiAnalysisResults.status, "completed")))
        .orderBy(desc(aiAnalysisResults.createdAt))
        .limit(1);
      const assessmentId = await createRiskAssessment(db, {
        productId,
        tenantId: product.tenantId ?? 1,
        overallRiskScore: "5.0",
        riskLevel: "medium",
        status: "running",
        triggeredByUserId,
      });
      try {
        const prompt = buildRiskPrompt(product, productDocs, productComponentsList, compDocsList, missingReqs, latestAi ?? null);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Du bist ein Risikomanagement-Experte. Antworte ausschließlich mit validem JSON." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "risk_assessment",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  overallRiskScore: { type: "number" },
                  riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
                  summary: { type: "string" },
                  risks: { type: "array", items: { type: "object", properties: { category: { type: "string" }, score: { type: "number" }, title: { type: "string" }, description: { type: "string" }, mitigations: { type: "array", items: { type: "string" } } }, required: ["category", "score", "title", "description", "mitigations"], additionalProperties: false } },
                  missingInfo: { type: "array", items: { type: "string" } },
                },
                required: ["overallRiskScore", "riskLevel", "summary", "risks", "missingInfo"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices?.[0]?.message?.content ?? "{}";
        const parsed: RiskAssessmentResult = typeof content === "string" ? JSON.parse(content) : content;
        const score = Math.max(1, Math.min(10, Number(parsed.overallRiskScore) || 5));
        const level = scoreToLevel(score);
        await updateRiskAssessment(db, assessmentId, {
          status: "completed",
          overallRiskScore: score.toFixed(1),
          riskLevel: level,
          risks: parsed.risks ?? [],
          summary: parsed.summary ?? "",
          missingInfo: parsed.missingInfo ?? [],
          modelUsed: response.model ?? "unknown",
          tokensUsed: response.usage?.total_tokens ?? 0,
          completedAt: new Date(),
        });
      } catch (innerErr: any) {
        await updateRiskAssessment(db, assessmentId, { status: "failed", errorMessage: innerErr?.message ?? "Unknown" });
      }
    } catch {
      // silent fail – never block the upload
    }
  },

  /** Run a new AI risk assessment for a product. */
  async run(user: UserContext & { id: number }, productId: number) {
    requireRole(user.complianceRole, ADMIN_ROLES);

    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    // Load product
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) throw Errors.notFound("Product", productId);

    // Load all related data
    const productDocs = await db.select().from(documents).where(eq(documents.productId, productId));
    const productComponentsList = await db.select().from(productComponents).where(eq(productComponents.productId, productId));
    const compDocsList = productComponentsList.length > 0
      ? await db.select().from(componentDocuments).where(
          eq(componentDocuments.componentId, productComponentsList[0].id)
        )
      : [];
    const missingReqs = await db.select().from(missingRequirements).where(
      eq(missingRequirements.productId, productId)
    );
    // Latest AI compliance analysis for context
    const [latestAi] = await db.select().from(aiAnalysisResults)
      .where(and(eq(aiAnalysisResults.productId, productId), eq(aiAnalysisResults.status, "completed")))
      .orderBy(desc(aiAnalysisResults.createdAt))
      .limit(1);

    // Create pending record
    const assessmentId = await createRiskAssessment(db, {
      productId,
      tenantId: product.tenantId ?? 1,
      overallRiskScore: "5.0",
      riskLevel: "medium",
      status: "running",
      triggeredByUserId: user.id,
    });

    try {
      const prompt = buildRiskPrompt(
        product,
        productDocs,
        productComponentsList,
        compDocsList,
        missingReqs,
        latestAi ?? null
      );

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Du bist ein Risikomanagement-Experte. Antworte ausschließlich mit validem JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "risk_assessment",
            strict: true,
            schema: {
              type: "object",
              properties: {
                overallRiskScore: { type: "number" },
                riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
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
              required: ["overallRiskScore", "riskLevel", "summary", "risks", "missingInfo"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content ?? "{}";
      const parsed: RiskAssessmentResult = typeof content === "string" ? JSON.parse(content) : content;

      // Clamp score to 1-10
      const score = Math.max(1, Math.min(10, Number(parsed.overallRiskScore) || 5));
      const level = scoreToLevel(score);

      await updateRiskAssessment(db, assessmentId, {
        status: "completed",
        overallRiskScore: score.toFixed(1),
        riskLevel: level,
        risks: parsed.risks ?? [],
        summary: parsed.summary ?? "",
        missingInfo: parsed.missingInfo ?? [],
        modelUsed: response.model ?? "unknown",
        tokensUsed: response.usage?.total_tokens ?? 0,
        completedAt: new Date(),
      });

      return {
        success: true,
        assessmentId,
        overallRiskScore: score,
        riskLevel: level,
        summary: parsed.summary,
        risks: parsed.risks,
        missingInfo: parsed.missingInfo,
      };
    } catch (err: any) {
      await updateRiskAssessment(db, assessmentId, {
        status: "failed",
        errorMessage: err.message ?? "Unknown error",
      });
      throw err;
    }
  },

  /** Get the latest completed risk assessment for a product. */
  async getLatest(user: UserContext, productId: number) {
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) return null;
    assertSupplierOrInternal(user, product.supplierId);

    const [latest] = await db.select().from(productRiskAssessments)
      .where(and(
        eq(productRiskAssessments.productId, productId),
        eq(productRiskAssessments.status, "completed")
      ))
      .orderBy(desc(productRiskAssessments.createdAt))
      .limit(1);

    return latest ?? null;
  },

  /** Get the full assessment history for a product. */
  async getHistory(user: UserContext, productId: number) {
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);

    return db.select().from(productRiskAssessments)
      .where(eq(productRiskAssessments.productId, productId))
      .orderBy(desc(productRiskAssessments.createdAt))
      .limit(20);
  },
};
