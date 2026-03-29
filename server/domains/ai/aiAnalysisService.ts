/**
 * server/domains/ai/aiAnalysisService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for AI-powered compliance analysis.
 *
 * Two analysis types:
 *  1. Document Analysis  – per-document review against EU/CH legal requirements
 *  2. Risk Assessment    – overall product risk evaluation (all docs + safety data)
 *
 * All AI output is in English regardless of UI language.
 *
 * IMPORTANT: The "reviewStatus" field (pending/approved/rejected) is our INTERNAL
 * document review workflow status – it does NOT indicate whether the document
 * itself is legally valid. The AI must not penalise a document solely because
 * its review status is "pending".
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

// ─── Legal requirements per document type ─────────────────────────────────────

const LEGAL_REQUIREMENTS: Record<string, string> = {
  declaration_of_conformity: `
EU Declaration of Conformity (DoC) – mandatory requirements under Toy Safety Directive 2009/48/EC and GPSR 2023/988:
- Full product name and model/article number
- Name and address of manufacturer or authorised representative in the EU
- Reference to all applicable EU directives (2009/48/EC, REACH Regulation 1907/2006, RoHS if applicable)
- List of harmonised standards applied (e.g. EN 71-1:2014+A1:2018, EN 71-2:2011+A1:2014, EN 71-3:2019+A1:2021)
- Name, position, and handwritten or electronic signature of authorised signatory
- Date of issue
- For Switzerland: must also reference the Swiss Toy Safety Ordinance (SR 817.023.11) and conform to MRA CH-EU

If any of these elements are missing or unclear, the DoC is legally incomplete.`,

  test_report: `
Test Report – mandatory requirements for CE marking under Toy Safety Directive 2009/48/EC:
- Must be issued by an accredited third-party laboratory (ISO/IEC 17025 accreditation required for EN 71-1, EN 71-2, EN 71-3)
- Must clearly identify the product (name, model, article number, age group)
- Must reference the exact standard(s) tested (e.g. EN 71-1:2014+A1:2018 – Mechanical and Physical Properties)
- Must cover all relevant parts of EN 71 for the product category (EN 71-1, EN 71-2, EN 71-3, EN 71-8 if applicable)
- Must include pass/fail result for each test clause
- Must include test date and report issue date
- Validity: typically 3–5 years; must be re-tested if product changes or standard is revised
- For Switzerland: same requirements apply under the Swiss MRA; accredited labs recognised by ILAC/EA are accepted`,

  certificate: `
Certificate (e.g. CE Certificate, GS Certificate, UKCA) – requirements:
- Issued by a Notified Body (NB) or accredited certification body
- Must include NB number (for EU CE) or equivalent body identification
- Must reference the applicable directive and standard
- Must include product description, manufacturer details, and certificate number
- Must include validity period (issue date and expiry date)
- Must be signed by an authorised person at the certification body
- For Switzerland: STS-accredited bodies or bodies recognised under the MRA CH-EU`,

  safety_data_sheet: `
Safety Data Sheet (SDS/MSDS) – requirements under REACH Regulation 1907/2006 and CLP Regulation 1272/2008:
- Must follow the 16-section format specified in REACH Annex II
- Section 1: Identification of substance/mixture and supplier
- Section 2: Hazard identification (GHS/CLP classification)
- Section 3: Composition/information on ingredients
- Section 8: Exposure controls/personal protection
- Section 11: Toxicological information
- Must be in the language of the country of use
- Must be kept up to date (revision date required)`,

  instruction_manual: `
Instruction Manual / User Instructions – requirements under Toy Safety Directive 2009/48/EC Art. 11 and Annex V:
- Must include age warnings (e.g. "Not suitable for children under 36 months")
- Must include all mandatory safety warnings specified in Annex V of 2009/48/EC
- Must include instructions for safe use, assembly, and maintenance
- Must be in the official language(s) of the country of sale
- For Switzerland: must be available in German, French, and Italian (or at least German)
- Must include manufacturer/importer name and address`,

  reach_compliance: `
REACH Compliance Documentation – requirements under REACH Regulation 1907/2006:
- Must confirm that no Substances of Very High Concern (SVHC) are present above 0.1% w/w
- Must reference the current SVHC Candidate List (updated twice yearly by ECHA)
- Must include date of assessment and the version of the SVHC list used
- If SVHCs are present: must include safe use instructions and notification to ECHA SCIP database
- For toys: must also comply with EN 71-3 (migration of certain elements) and EN 71-9 (chemical toys)`,

  rohs_compliance: `
RoHS Compliance Documentation – requirements under RoHS Directive 2011/65/EU (recast):
- Must confirm that restricted substances (Pb, Hg, Cd, Cr VI, PBB, PBDE, DEHP, BBP, DBP, DIBP) are below maximum concentration values
- Must include test evidence or supplier declarations for each restricted substance
- Must reference the applicable RoHS Directive and amendment (EU 2015/863)
- Must include product description and date of assessment`,

  default: `
General compliance document requirements for toys sold in the EU/Switzerland:
- Must clearly identify the product (name, model, article number)
- Must include manufacturer or importer name and address
- Must reference applicable regulations and standards
- Must include date of issue and, where applicable, expiry date
- Must be signed by an authorised person`,
};

function getLegalRequirements(documentType: string): string {
  return LEGAL_REQUIREMENTS[documentType] ?? LEGAL_REQUIREMENTS.default;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

/**
 * Build a per-document analysis prompt with EU/CH legal requirements.
 *
 * IMPORTANT NOTE FOR AI: The "reviewStatus" field (pending/approved/rejected) is
 * our INTERNAL document workflow status – it does NOT indicate whether the document
 * is legally valid. Do NOT penalise a document for having "pending" review status.
 * Focus only on the document type, file name, standard references, and content.
 */
export function buildDocumentAnalysisPrompt(product: any, docs: any[]): string {
  if (docs.length === 0) {
    return `You are a toy industry compliance expert (EN 71, CE, CPSIA, REACH, GPSR).
No documents have been uploaded for product "${product.productName}".
Return a JSON analysis indicating that no documents are available.`;
  }

  const docSections = docs
    .map((d, i) => {
      const legalReqs = getLegalRequirements(d.documentType);
      const expiryInfo = d.expiresAt
        ? `Expiry date on file: ${new Date(d.expiresAt).toISOString().slice(0, 10)}`
        : "No expiry date recorded";
      return `
--- DOCUMENT ${i + 1} ---
ID: ${d.id}
Type: ${d.documentType}
File name: ${d.fileName ?? "–"}
Standard referenced: ${d.standard ?? "not specified"}
${expiryInfo}
Internal review status: ${d.reviewStatus} [NOTE: This is our internal workflow status, NOT a legal validity indicator. Do NOT penalise for "pending" status.]

LEGAL REQUIREMENTS FOR THIS DOCUMENT TYPE:
${legalReqs}`;
    })
    .join("\n");

  return `You are a senior toy industry compliance expert specialising in EU and Swiss toy safety regulations.

PRODUCT INFORMATION:
- Product name: ${product.productName}
- Brand: ${product.brand ?? "–"}
- Age group: ${product.ageGroup ?? "–"}
- Target market: ${product.targetMarket ?? "EU/Switzerland"}
- Internal article number: ${product.internalArticleNumber ?? "–"}

CRITICAL INSTRUCTION: The "Internal review status" field (pending/approved/rejected) is our company's INTERNAL document workflow status. It does NOT mean the document is legally invalid. Do NOT list "pending status" as a legal compliance issue. Evaluate only the actual legal and technical content requirements.

DOCUMENTS TO ANALYSE (${docs.length} total):
${docSections}

TASK: For each document, evaluate:
1. Does the document type match what is legally required for this product?
2. Does the file name/standard reference suggest the correct content?
3. Based on the document type and available metadata, which mandatory legal elements are likely present or missing?
4. Are there any expiry or validity concerns?
5. What specific issues should be discussed with the manufacturer/supplier?

For each document, also generate a professional email template (in English) that can be sent to the manufacturer/supplier to request corrections or missing information.

Return ONLY valid JSON matching this exact schema – no extra text:
{
  "documentAnalysis": [
    {
      "documentId": <number>,
      "documentType": "<string>",
      "fileName": "<string>",
      "score": <0-100>,
      "status": "ok" | "warning" | "critical",
      "legalBasis": "<string – which EU/CH regulation applies>",
      "issues": ["<string – specific legal/technical issue>"],
      "positives": ["<string – what appears to be correctly present>"],
      "missingElements": ["<string – mandatory elements that appear to be missing>"],
      "emailTemplate": "<string – professional email to manufacturer requesting corrections, use \\n for line breaks>"
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
              `${i + 1}. Type: ${d.documentType}, File: ${d.fileName ?? "–"}, Standard: ${d.standard ?? "–"}` +
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
                    `     ${i + 1}. Type: ${d.documentType}, Standard: ${d.standard ?? "–"}, File: ${d.fileName}`
                )
                .join("\n")
            : "     (No documents)";
        return `  - ${c.name} (Material: ${c.materialType ?? "unknown"}, Part no.: ${c.partNumber ?? "–"}):\n${cDocList}`;
      })
      .join("\n");
    componentSection = `\n\nPRODUCT COMPONENTS (${components.length} total):\n${compLines}`;
  }

  return `You are a senior toy industry compliance expert specialising in EU and Swiss toy safety regulations (Toy Safety Directive 2009/48/EC, GPSR 2023/988, REACH, EN 71 series, Swiss Toy Safety Ordinance SR 817.023.11).
Perform an overall compliance risk assessment for the following product.

PRODUCT: ${product.productName}
BRAND: ${product.brand ?? "–"}
AGE GROUP: ${product.ageGroup ?? "–"}
TARGET MARKET: ${product.targetMarket ?? "EU/Switzerland"}
STATUS: ${product.status}${safetySection}${componentSection}

DOCUMENTS (${docs.length} total):
${docList}

EVALUATE:
1. Documentation completeness (test reports, declarations of conformity, and certificates have highest priority under 2009/48/EC)
2. Safety data plausibility (age grading, warnings, material information vs. EN 71 requirements)
3. Formal correctness (standard references, expiry dates, accreditation requirements)
4. Consistency between safety data and documents
5. Missing mandatory documents for EU/Swiss market entry

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

  /**
   * Run a full analysis for a product:
   *  - Per-document analysis with EU/CH legal requirements (Document Analysis tab)
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
      // ── Step 1: Per-document analysis with EU/CH legal requirements ────────
      let documentAnalysis: any[] = [];
      let emailTemplate: any = null;

      if (docs.length > 0) {
        const docPrompt = buildDocumentAnalysisPrompt(product, docs);
        const docResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a senior toy industry compliance expert. Respond ONLY with valid JSON, no markdown, no extra text. The internal review status (pending/approved/rejected) is a workflow status only – do NOT penalise documents for having 'pending' status.",
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
                        legalBasis: { type: "string" },
                        issues: { type: "array", items: { type: "string" } },
                        positives: { type: "array", items: { type: "string" } },
                        missingElements: { type: "array", items: { type: "string" } },
                        emailTemplate: { type: "string" },
                      },
                      required: [
                        "documentId",
                        "documentType",
                        "fileName",
                        "score",
                        "status",
                        "legalBasis",
                        "issues",
                        "positives",
                        "missingElements",
                        "emailTemplate",
                      ],
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

        // Build combined email template for all documents with issues
        const docsWithIssues = documentAnalysis.filter(
          (d: any) => d.issues?.length > 0 || d.missingElements?.length > 0
        );
        if (docsWithIssues.length > 0) {
          emailTemplate = {
            subject: `Compliance Documentation Request – ${product.productName} (${product.internalArticleNumber ?? product.id})`,
            body: buildCombinedEmailTemplate(product, docsWithIssues),
          };
        }
      }

      // ── Step 2: Overall risk assessment ────────────────────────────────────
      const riskPrompt = buildRiskAssessmentPrompt(product, docs, safety, components, componentDocs);
      const riskResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a senior toy industry compliance expert. Respond ONLY with valid JSON, no markdown, no extra text.",
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
              required: [
                "overallScore",
                "riskLevel",
                "summary",
                "findings",
                "recommendations",
                "missingDocuments",
              ],
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
        emailTemplate: emailTemplate,
        analyzedDocumentIds: docs.map((d) => d.id),
        modelUsed: "built-in",
        completedAt: new Date(),
      } as any);

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
          emailTemplate,
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

// ─── Email template builder ───────────────────────────────────────────────────

function buildCombinedEmailTemplate(product: any, docsWithIssues: any[]): string {
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const issueLines = docsWithIssues
    .map((doc: any) => {
      const lines: string[] = [`Document: ${doc.documentType.replace(/_/g, " ").toUpperCase()} (${doc.fileName})`];
      if (doc.missingElements?.length > 0) {
        lines.push("  Missing mandatory elements:");
        doc.missingElements.forEach((el: string) => lines.push(`    – ${el}`));
      }
      if (doc.issues?.length > 0) {
        lines.push("  Issues identified:");
        doc.issues.forEach((issue: string) => lines.push(`    – ${issue}`));
      }
      return lines.join("\n");
    })
    .join("\n\n");

  return `Subject: Compliance Documentation Request – ${product.productName}

Date: ${today}

Dear Sir or Madam,

We are writing regarding the compliance documentation for the following product:

Product: ${product.productName}
Article Number: ${product.internalArticleNumber ?? "–"}
Brand: ${product.brand ?? "–"}

During our compliance review, we identified the following issues with the submitted documentation that must be resolved before we can proceed with market placement in the EU/Switzerland:

${issueLines}

We kindly request that you provide updated or corrected documentation addressing the above points at your earliest convenience. Please note that all documents must comply with the applicable EU regulations (Toy Safety Directive 2009/48/EC, REACH Regulation 1907/2006, GPSR 2023/988) and Swiss requirements (SR 817.023.11).

If you have any questions regarding the specific requirements, please do not hesitate to contact us.

We look forward to receiving the corrected documentation.

Kind regards,

[Your Name]
[Your Position]
spielzeug3 AG
[Contact Details]`;
}
