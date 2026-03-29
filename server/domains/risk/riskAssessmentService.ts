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
  category: string;           // e.g. "Product Safety", "Documentation", "Chemical Risks"
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
        `  ${i + 1}. Type: ${d.documentType}, Status: ${d.reviewStatus}, File: ${d.fileName ?? "–"}` +
        (d.standard ? `, Standard: ${d.standard}` : "") +
        (d.expiresAt ? `, Expires: ${new Date(d.expiresAt).toISOString().slice(0, 10)}` : "")
      ).join("\n")
    : "  (No documents available)";

  const compList = components.length > 0
    ? components.map((c) => {
        const cDocs = componentDocs.filter((d: any) => d.componentId === c.id);
        const cDocStr = cDocs.length > 0
          ? cDocs.map((d: any) => `    - ${d.documentType} (${d.reviewStatus})`).join("\n")
          : "    (No component documents)";
        return `  - ${c.name} (Material: ${c.materialType ?? "unknown"}):\n${cDocStr}`;
      }).join("\n")
    : "  (No components recorded)";

  const missingList = missingReqs.length > 0
    ? missingReqs.map((r: any) => `  - ${r.requirementType}: ${r.description ?? ""}`).join("\n")
    : "  (No open requirements)";

  const aiSummary = latestAiAnalysis?.summary
    ? `\nLATEST COMPLIANCE ANALYSIS (Score ${latestAiAnalysis.overallScore}/100):\n  ${latestAiAnalysis.summary}`
    : "";

  return `You are a risk management expert specialising in product safety, toy safety regulations, and supply chain compliance (EN 71, CE, REACH, RoHS, GPSR, Toy Safety Directive 2009/48/EC).

CRITICAL LANGUAGE INSTRUCTION: ALL output fields (summary, risk titles, descriptions, mitigations, missingInfo – ALL text strings) MUST be written in English. Do NOT use German, French, or any other language regardless of product name, brand, or any other context.

Task: Assess the following product for all relevant risks and return a structured risk assessment.

PRODUCT INFORMATION:
  Name: ${product.productName}
  Brand: ${product.brand ?? "–"}
  Internal article number: ${product.internalArticleNumber ?? "–"}
  Age group: ${product.ageGroup ?? "–"}
  Target market: ${product.targetMarket ?? "–"}
  Compliance status: ${product.status}
  Completeness score: ${product.completenessScore ?? 0}%
  Supplier ID: ${product.supplierId}${aiSummary}

AVAILABLE DOCUMENTS (${docs.length}):
${docList}

PRODUCT COMPONENTS (${components.length}):
${compList}

OPEN REQUIREMENTS / MISSING DOCUMENTS (${missingReqs.length}):
${missingList}

ASSESSMENT TASK:
Identify all relevant risks in the following categories (where applicable):
1. Product safety (physical hazards, injury risks)
2. Chemical risks (REACH, RoHS, hazardous substances)
3. Documentation gaps (missing/expired certificates, test reports)
4. Regulatory risks (CE, EN 71, GPSR compliance)
5. Age group risks (small parts, choking hazard, age labelling)
6. Supply chain risks (supplier quality, origin, traceability)
7. Market risks (recall risk, reputational risk)
8. Data gaps (missing product information, incomplete specifications)

For each identified risk:
- Assign a score from 1 (very low) to 10 (critical)
- Explain precisely WHY this risk exists (based on the available data)
- Provide 2-4 concrete mitigation measures

Calculate the overall risk score as a weighted average (higher scores weighted more heavily).
Classify: 1-3 = low, 4-6 = medium, 7-8 = high, 9-10 = critical.

Respond ONLY with valid JSON in the following format:
{
  "overallRiskScore": <number 1.0-10.0>,
  "riskLevel": "<low|medium|high|critical>",
  "summary": "<2-3 sentence executive summary in English>",
  "risks": [
    {
      "category": "<category name in English>",
      "score": <1-10>,
      "title": "<short risk title in English>",
      "description": "<detailed explanation in English>",
      "mitigations": ["<mitigation 1 in English>", "<mitigation 2 in English>", ...]
    }
  ],
  "missingInfo": ["<missing info 1 in English>", "<missing info 2 in English>", ...]
}

Sort risks by score descending. Identify at least 3, at most 10 risks.`;
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
            { role: "system", content: "You are a risk management expert. Respond ONLY with valid JSON. ALL text values MUST be in English – never German or any other language." },
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
    assertSupplierOrInternal(user, product.tenantId ?? 1);
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
            content: "You are a risk management expert. Respond ONLY with valid JSON. ALL text values MUST be in English – never German or any other language.",
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
      return assessmentId;
    } catch (err: any) {
      await updateRiskAssessment(db, assessmentId, { status: "failed", errorMessage: err?.message ?? "Unknown" });
      throw err;
    }
  },

  /** Get the latest completed risk assessment for a product. */
  async getLatest(user: UserContext, productId: number) {
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.tenantId ?? 1);
    const [assessment] = await db.select().from(productRiskAssessments)
      .where(and(
        eq(productRiskAssessments.productId, productId),
        eq(productRiskAssessments.status, "completed")
      ))
      .orderBy(desc(productRiskAssessments.createdAt))
      .limit(1);
    return assessment ?? null;
  },

  /** Get all risk assessments for a product (history). */
  async getHistory(user: UserContext, productId: number) {
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.tenantId ?? 1);
    return db.select().from(productRiskAssessments)
      .where(eq(productRiskAssessments.productId, productId))
      .orderBy(desc(productRiskAssessments.createdAt));
  },
};
