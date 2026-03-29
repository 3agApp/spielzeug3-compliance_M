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
import { Errors, requireRole, assertSupplierOrInternal, ADMIN_ROLES } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";
import { extractDocumentText } from "./documentExtractor";
import { invokeTenantLLM, getTenantAIConfig, testTenantAIKey } from "./tenantLLM";

// ─── Legal requirements per document type ─────────────────────────────────────

const LEGAL_REQUIREMENTS: Record<string, string> = {
  declaration_of_conformity: `
EU Declaration of Conformity (DoC) – mandatory elements that must appear IN THE DOCUMENT ITSELF under Toy Safety Directive 2009/48/EC and GPSR 2023/988:
- Full product name and model/article number
- Name and address of manufacturer or authorised representative in the EU
- Reference to all applicable EU directives (at minimum: 2009/48/EC; also REACH 1907/2006 and RoHS 2011/65/EU if applicable)
- List of harmonised standards applied (e.g. EN 71-1:2014+A1:2018, EN 71-2:2011+A1:2014, EN 71-3:2019+A1:2021)
- Name, position, and handwritten or electronic signature of authorised signatory
- Date of issue

SWITZERLAND NOTE: Switzerland has a Mutual Recognition Agreement (MRA) with the EU (RS 0.946.526.81). A valid EU DoC (2009/48/EC) is fully accepted for the Swiss market. A separate reference to the Swiss Toy Safety Ordinance SR 817.023.11 is NOT required and must NOT be flagged as missing.

DO NOT flag as missing: CE marking on the product/packaging, manufacturer address on the product/packaging, product identification code on the toy itself. These are product labelling requirements, not DoC document requirements.

If any of the above document elements are missing or unclear in the DoC itself, it is legally incomplete.`,


  test_report: `
Test Report – mandatory elements that must appear IN THE DOCUMENT ITSELF under Toy Safety Directive 2009/48/EC:
- Must be issued by an accredited third-party laboratory (ISO/IEC 17025 accreditation required for EN 71-1, EN 71-2, EN 71-3)
- Must clearly identify the product (name, model, article number, age group)
- Must reference the exact standard(s) tested with year (e.g. EN 71-1:2014+A1:2018 – Mechanical and Physical Properties)
- Must include pass/fail result for each test clause
- Must include test date and report issue date
- Validity: typically 3–5 years; must be re-tested if product changes or standard is revised

SWITZERLAND NOTE: Switzerland accepts test reports from ILAC/EA-accredited laboratories (same as EU). No separate Swiss accreditation is required. A test report valid for EU CE marking is fully valid for the Swiss market under the MRA.

DO NOT flag as missing: CE marking on the product, manufacturer address on the product or packaging, product identification code on the toy itself, EU importer address on the packaging. These are product labelling requirements, NOT test report requirements.

Evaluate ONLY what is present or missing in the test report document itself.`,


  certificate: `
Certificate (e.g. CE Certificate, GS Certificate, UKCA) – mandatory elements IN THE DOCUMENT ITSELF:
- Issued by a Notified Body (NB) or accredited certification body
- Must include NB number (for EU CE) or equivalent body identification
- Must reference the applicable directive and standard
- Must include product description, manufacturer details, and certificate number
- Must include validity period (issue date and expiry date)
- Must be signed by an authorised person at the certification body

SWITZERLAND NOTE: Certificates from EU Notified Bodies or ILAC/EA-accredited bodies are fully recognised in Switzerland under the MRA. No separate Swiss certification is required.

DO NOT flag product labelling requirements (CE marking on product, packaging markings) as missing from this certificate document.`,


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
General compliance document – mandatory elements IN THE DOCUMENT ITSELF for toys sold in the EU/Switzerland:
- Must clearly identify the product (name, model, article number)
- Must include manufacturer or importer name and address
- Must reference applicable regulations and standards
- Must include date of issue and, where applicable, expiry date
- Must be signed by an authorised person

SWITZERLAND NOTE: Switzerland has a Mutual Recognition Agreement (MRA) with the EU. EU-compliant documents are accepted for the Swiss market. Do NOT flag missing Swiss-specific references as a compliance issue if valid EU documentation is present.

DO NOT flag product labelling requirements (CE marking on product, packaging markings, address on packaging) as missing from compliance documents.`,

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
export function buildDocumentAnalysisPrompt(product: any, docs: any[], extractedTexts?: Map<number, string>): string {
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
      const extractedText = extractedTexts?.get(d.id);
      const contentSection = extractedText
        ? `\nEXTRACTED DOCUMENT CONTENT (use this to evaluate the actual document):\n${extractedText}`
        : `\nDOCUMENT CONTENT: (not available – evaluate based on file name and metadata only; be conservative and avoid assuming missing elements)`;
      return `
--- DOCUMENT ${i + 1} ---
ID: ${d.id}
Type: ${d.documentType}
File name: ${d.fileName ?? "–"}
Standard referenced: ${d.standard ?? "not specified"}
${expiryInfo}
Internal review status: ${d.reviewStatus} [NOTE: This is our internal workflow status, NOT a legal validity indicator. Do NOT penalise for "pending" status.]
${contentSection}

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

CRITICAL RULES – READ BEFORE ANALYSING:
1. Evaluate ONLY the DOCUMENT CONTENT itself. Do NOT flag product/packaging labelling requirements (e.g. CE marking on the toy, manufacturer address on packaging, product ID code on the toy) as missing from a document.
2. Switzerland FULLY accepts EU-compliant documentation under the MRA (RS 0.946.526.81). Do NOT flag missing Swiss Toy Safety Ordinance (SR 817.023.11) references as a compliance issue if valid EU documentation is present.
3. The "Internal review status" (pending/approved/rejected) is our company's internal workflow status. NEVER flag "pending" status as a legal compliance issue.
4. If the document content has been extracted (see EXTRACTED DOCUMENT CONTENT above), base your evaluation primarily on the actual content, not assumptions.

TASK: For each document, evaluate:
1. Does the document type match what is legally required for this product?
2. Based on the EXTRACTED CONTENT (if available), which mandatory legal elements are present or missing IN THE DOCUMENT ITSELF?
3. Are there any expiry or validity concerns visible in the document?
4. What specific document-level issues (not product/packaging issues) should be discussed with the manufacturer/supplier?

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
  componentDocs?: any[],
  documentAnalysisResults?: any[]
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

   // Build document analysis context section if available
  let docAnalysisSection = "";
  if (documentAnalysisResults && documentAnalysisResults.length > 0) {
    const lines = documentAnalysisResults.map((d: any) => {
      const positives = (d.positives ?? []).join("; ") || "none";
      const issues = (d.issues ?? []).join("; ") || "none";
      const missing = (d.missingElements ?? []).join("; ") || "none";
      return `  - ${d.fileName ?? d.documentType} (${d.documentType}, score: ${d.score}/100, status: ${d.status}):\n    Positives: ${positives}\n    Issues: ${issues}\n    Missing elements: ${missing}`;
    });
    docAnalysisSection = `\n\nDOCUMENT ANALYSIS RESULTS (already evaluated per-document – use these as ground truth for your assessment):\n${lines.join("\n")}`;
  }

  return `You are a senior toy industry compliance expert specialising in EU and Swiss toy safety regulations (Toy Safety Directive 2009/48/EC, GPSR 2023/988, REACH, EN 71 series, Swiss Toy Safety Ordinance SR 817.023.11).
Perform an overall compliance risk assessment for the following product.
PRODUCT: ${product.productName}
BRAND: ${product.brand ?? "–"}
AGE GROUP: ${product.ageGroup ?? "–"}
TARGET MARKET: ${product.targetMarket ?? "EU/Switzerland"}
STATUS: ${product.status}${safetySection}${componentSection}
DOCUMENTS (${docs.length} total):
${docList}${docAnalysisSection}
EVALUATE:
1. Documentation completeness (test reports, declarations of conformity, and certificates have highest priority under 2009/48/EC). Use the document analysis results above as ground truth – do NOT re-penalise documents that were already scored as compliant.
2. Safety data plausibility (age grading, warnings, material information vs. EN 71 requirements)
3. Formal correctness (standard references, expiry dates, accreditation requirements)
4. Consistency between safety data and documents
5. Missing mandatory documents for EU/Swiss market entry

For each of the four score dimensions, provide a 1-2 sentence explanation of the key reason(s) behind your score:
- documentCompletenessReason: What documents are present/missing and why this affects the score?
- contentPlausibilityReason: What specific content is implausible, contradictory, or raises concerns? Be specific.
- formalCorrectnessReason: What formal elements (standard references, dates, accreditation) are correct or incorrect?
- consistencyReason: Are safety data and documents consistent with each other? What inconsistencies exist?

Return ONLY valid JSON matching this exact schema – no extra text:
{
  "overallScore": <0-100>,
  "riskLevel": "low" | "medium" | "high",
  "summary": "<2-3 sentence summary in English>",
  "documentCompletenessScore": <0-100>,
  "documentCompletenessReason": "<1-2 sentences>",
  "contentPlausibilityScore": <0-100>,
  "contentPlausibilityReason": "<1-2 sentences explaining what is or is not plausible>",
  "formalCorrectnessScore": <0-100>,
  "formalCorrectnessReason": "<1-2 sentences>",
  "consistencyScore": <0-100>,
  "consistencyReason": "<1-2 sentences>",
  "findings": [
    {
      "type": "positive" | "warning" | "critical",
      "message": "<short 1-sentence headline of the finding>",
      "detail": "<2-4 sentences explaining WHY this is a finding, what the specific gap or issue is, and what the legal/regulatory consequence could be>",
      "affectedRegulations": ["<e.g. EN 71-1:2014, Toy Safety Directive 2009/48/EC Art. 11>"],
      "remediation": "<concrete actionable step(s) to resolve this finding, e.g. which document to obtain, which information to add, which standard to reference>"
    }
  ],
  "recommendations": ["<string>"],
  "missingDocuments": ["<string>"]
}`;
}

// Legacy alias for backward compatibility with tests
export const buildAnalysisPrompt = buildRiskAssessmentPrompt;

// ─── Service ──────────────────────────────────────────────────────────────────

export const aiAnalysisService = {
  /** Get AI config status (provider + masked key) – admin/compliance_manager only. */
  async getApiKeyStatus(user: UserContext) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager"]);
    const config = await getTenantAIConfig();
    if (!config.configured) return { configured: false, maskedKey: null, provider: null };
    const key = config.apiKey;
    const masked =
      key.length > 8
        ? `${key.slice(0, 7)}${"*".repeat(Math.max(0, key.length - 11))}${key.slice(-4)}`
        : "****";
    return { configured: true, maskedKey: masked, provider: config.provider };
  },

  /** Test the tenant's configured AI key with a minimal request. */
  async testApiKey(user: UserContext) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager"]);
    return testTenantAIKey();
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

    const allDocs = await getDocumentsByProduct(productId);
    // Only analyse documents explicitly marked for AI analysis
    const docs = allDocs.filter((d: any) => d.includeInAiAnalysis !== false);
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
        // Extract text from each document (PDF) in parallel
        const extractedTexts = new Map<number, string>();
        await Promise.all(
          docs.map(async (doc) => {
            const extracted = await extractDocumentText(doc.fileUrl, doc.fileName ?? "");
            if (extracted.extractionStatus === "success" && extracted.text.trim().length > 50) {
              extractedTexts.set(doc.id, extracted.text);
            }
          })
        );

        const docPrompt = buildDocumentAnalysisPrompt(product, docs, extractedTexts);
        const docResponse = await invokeTenantLLM({
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

        const docContent = docResponse.content;
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
      const riskPrompt = buildRiskAssessmentPrompt(product, docs, safety, components, componentDocs, documentAnalysis);
      const riskResponse = await invokeTenantLLM({
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
                documentCompletenessScore: { type: "number" },
                documentCompletenessReason: { type: "string" },
                contentPlausibilityScore: { type: "number" },
                contentPlausibilityReason: { type: "string" },
                formalCorrectnessScore: { type: "number" },
                formalCorrectnessReason: { type: "string" },
                consistencyScore: { type: "number" },
                consistencyReason: { type: "string" },
                findings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      message: { type: "string" },
                      detail: { type: "string" },
                      affectedRegulations: { type: "array", items: { type: "string" } },
                      remediation: { type: "string" },
                    },
                    required: ["type", "message", "detail", "affectedRegulations", "remediation"],
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
                "documentCompletenessScore",
                "documentCompletenessReason",
                "contentPlausibilityScore",
                "contentPlausibilityReason",
                "formalCorrectnessScore",
                "formalCorrectnessReason",
                "consistencyScore",
                "consistencyReason",
                "findings",
                "recommendations",
                "missingDocuments",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const parsed = JSON.parse(riskResponse.content);

      // ── Use AI-provided sub-scores (with fallback to algorithmic calculation) ───────
      const findings = parsed.findings ?? [];
      const positiveCount = findings.filter((f: any) => f.type === "positive").length;
      const warningCount = findings.filter((f: any) => f.type === "warning").length;
      const criticalCount = findings.filter((f: any) => f.type === "critical").length;
      const totalFindings = findings.length || 1;
      const missingDocs = parsed.missingDocuments ?? [];

      // Prefer AI-provided scores; fall back to algorithmic if not present
      const docScore = parsed.documentCompletenessScore ?? Math.max(0, 100 - missingDocs.length * 15);
      const contentScore = parsed.contentPlausibilityScore ?? Math.round(((positiveCount + 1) / (totalFindings + 1)) * 100);
      const formalScore = parsed.formalCorrectnessScore ?? Math.max(0, 100 - criticalCount * 25);
      const consistencyScore = parsed.consistencyScore ?? Math.max(0, 100 - warningCount * 15);

      // ── Save to DB ──────────────────────────────────────────────────────
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
        modelUsed: riskResponse.model,
        completedAt: new Date(),
        // Store score reasons as part of findings metadata
        scoreReasons: {
          documentCompleteness: parsed.documentCompletenessReason ?? null,
          contentPlausibility: parsed.contentPlausibilityReason ?? null,
          formalCorrectness: parsed.formalCorrectnessReason ?? null,
          consistency: parsed.consistencyReason ?? null,
        },
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
  async updateSettings(user: UserContext, settings: { apiKey?: string; provider?: string; model?: string; enabled?: boolean }) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager"]);
    if (settings.apiKey !== undefined) {
      await upsertSystemSetting("ai_api_key", settings.apiKey);
    }
    if (settings.provider !== undefined) {
      const validProviders = ["openai", "anthropic", "gemini"];
      if (!validProviders.includes(settings.provider)) {
        throw Errors.validation(`Invalid provider. Must be one of: ${validProviders.join(", ")}`);
      }
      await upsertSystemSetting("ai_provider", settings.provider);
    }
    if (settings.model !== undefined) {
      await upsertSystemSetting("ai_model", settings.model);
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
