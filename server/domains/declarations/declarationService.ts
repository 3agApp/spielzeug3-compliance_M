/**
 * server/domains/declarations/declarationService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for Declarations of Conformity (DoC).
 *
 * State machine:
 *   draft → sent → manufacturer_review → signed → ai_validated → archived
 *
 * Token-based manufacturer portal: no login required, token = credential.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getDb } from "../../db";
import {
  declarations,
  declarationArticles,
  declarationStatusHistory,
  documents,
  products,
  suppliers,
  type Declaration,
  type InsertDeclaration,
  type InsertDeclarationArticle,
  type InsertDeclarationStatusHistory,
} from "../../../drizzle/schema";
import { Errors, requireRole } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";
import { invokeLLM } from "../../_core/llm";
import { storagePut, storageGet } from "../../storage";
import { emailService } from "../email/emailService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateDocNumber(tenantId: number, sequence: number): string {
  const year = new Date().getFullYear();
  const seq = String(sequence).padStart(4, "0");
  return `DOC-SZ${tenantId}-${year}-${seq}`;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function tokenExpiresAt(days = 30): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function getUserName(user: UserContext): string {
  return (user as any).name ?? (user as any).email ?? `User #${user.id ?? "?"}`;
}

function getUserId(user: UserContext): number {
  return Number(user.id ?? 0);
}

async function addHistory(
  declarationId: number,
  action: string,
  fromStatus: string | null,
  toStatus: string,
  performedByUserId: number | null,
  performedByName: string | null,
  note?: string
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(declarationStatusHistory).values({
    declarationId,
    action,
    fromStatus: fromStatus as any,
    toStatus: toStatus as any,
    performedByUserId,
    performedByName,
    note: note ?? null,
  } as InsertDeclarationStatusHistory);
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const declarationService = {
  // ── List all declarations for a product ──────────────────────────────────
  async listByProduct(user: UserContext, productId: number) {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(declarations)
      .where(
        and(
          eq(declarations.productId, productId),
          eq(declarations.tenantId, user.tenantId ?? 1)
        )
      )
      .orderBy(desc(declarations.createdAt));

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const articles = await db
      .select()
      .from(declarationArticles)
      .where(inArray(declarationArticles.declarationId, ids));

    return rows.map((d) => ({
      ...d,
      articles: articles.filter((a) => a.declarationId === d.id),
    }));
  },

  // ── List all declarations for tenant (for index page) ────────────────────
  async listAll(user: UserContext) {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(declarations)
      .where(eq(declarations.tenantId, user.tenantId ?? 1))
      .orderBy(desc(declarations.createdAt));
  },

  // ── Get single declaration by ID ─────────────────────────────────────────
  async getById(user: UserContext, id: number) {
    const db = await getDb();
    if (!db) throw Errors.notFound("Database unavailable");
    const [decl] = await db
      .select()
      .from(declarations)
      .where(
        and(
          eq(declarations.id, id),
          eq(declarations.tenantId, user.tenantId ?? 1)
        )
      );
    if (!decl) throw Errors.notFound("Declaration not found");

    const articles = await db
      .select()
      .from(declarationArticles)
      .where(eq(declarationArticles.declarationId, id));

    const history = await db
      .select()
      .from(declarationStatusHistory)
      .where(eq(declarationStatusHistory.declarationId, id))
      .orderBy(desc(declarationStatusHistory.createdAt));

    return { ...decl, articles, statusHistory: history };
  },

  // ── Create a new declaration ─────────────────────────────────────────────
  async create(
    user: UserContext,
    input: {
      productId: number;
      supplierId: number;
      effectiveProductName?: string;
      effectiveAgeGrading?: string;
      euDirectives?: string[];
      chRegulations?: string[];
      standards?: string[];
      testReportRef?: string;
      notifiedBody?: string;
      chConformityBody?: string;
      issuedDate?: string;
      issuedPlace?: string;
      manufacturerContactName?: string;
      manufacturerContactEmail?: string;
      annexArticleIds?: number[];
    }
  ) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin"]);
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    // Generate doc number
    const existing = await db
      .select({ id: declarations.id })
      .from(declarations)
      .where(eq(declarations.tenantId, user.tenantId ?? 1));
    const seq = existing.length + 1;
    const docNumber = generateDocNumber(user.tenantId ?? 1, seq);

    // Snapshot primary product
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, input.productId));
    if (!product) throw Errors.notFound("Product not found");

    const [declResult] = await db
      .insert(declarations)
      .values({
        tenantId: user.tenantId ?? 1,
        productId: input.productId,
        supplierId: input.supplierId,
        docNumber,
        version: 1,
        status: "draft",
        effectiveProductName: input.effectiveProductName ?? product.productName,
        effectiveAgeGrading: input.effectiveAgeGrading ?? null,
        euDirectives: input.euDirectives ?? [],
        chRegulations: input.chRegulations ?? [],
        standards: input.standards ?? [],
        testReportRef: input.testReportRef ?? null,
        notifiedBody: input.notifiedBody ?? null,
        chConformityBody: input.chConformityBody ?? null,
        issuedDate: input.issuedDate ? new Date(input.issuedDate) : null,
        issuedPlace: input.issuedPlace ?? null,
        manufacturerContactName: input.manufacturerContactName ?? null,
        manufacturerContactEmail: input.manufacturerContactEmail ?? null,
        createdByUserId: getUserId(user),
        updatedByUserId: getUserId(user),
      } as InsertDeclaration)
      .$returningId();

    const declId = (declResult as any).id as number;

    // Primary article snapshot
    await db.insert(declarationArticles).values({
      declarationId: declId,
      productId: input.productId,
      isPrimary: true,
      snapshotProductName: product.productName,
      snapshotArticleNumber: product.internalArticleNumber ?? null,
      snapshotEan: product.ean ?? null,
      snapshotBrand: product.brand ?? null,
      snapshotAgeGrading: input.effectiveAgeGrading ?? null,
      sortOrder: 0,
    } as InsertDeclarationArticle);

    // Annex A snapshots
    if (input.annexArticleIds && input.annexArticleIds.length > 0) {
      for (let i = 0; i < input.annexArticleIds.length; i++) {
        const annexId = input.annexArticleIds[i];
        const [annexProduct] = await db
          .select()
          .from(products)
          .where(eq(products.id, annexId));
        if (annexProduct) {
          await db.insert(declarationArticles).values({
            declarationId: declId,
            productId: annexId,
            isPrimary: false,
            snapshotProductName: annexProduct.productName,
            snapshotArticleNumber: annexProduct.internalArticleNumber ?? null,
            snapshotEan: annexProduct.ean ?? null,
            snapshotBrand: annexProduct.brand ?? null,
            snapshotAgeGrading: null,
            sortOrder: i + 1,
          } as InsertDeclarationArticle);
        }
      }
    }

    await addHistory(declId, "created", null, "draft", getUserId(user), getUserName(user));

    return this.getById(user, declId);
  },

  // ── Update draft fields ──────────────────────────────────────────────────
  async update(
    user: UserContext,
    id: number,
    input: Partial<{
      effectiveProductName: string;
      effectiveAgeGrading: string;
      euDirectives: string[];
      chRegulations: string[];
      standards: string[];
      testReportRef: string;
      notifiedBody: string;
      chConformityBody: string;
      issuedDate: string;
      issuedPlace: string;
      manufacturerContactName: string;
      manufacturerContactEmail: string;
    }>
  ) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin"]);
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    const [decl] = await db
      .select()
      .from(declarations)
      .where(and(eq(declarations.id, id), eq(declarations.tenantId, user.tenantId ?? 1)));
    if (!decl) throw Errors.notFound("Declaration not found");
    if (!["draft", "sent"].includes(decl.status)) {
      throw Errors.precondition("Only draft or sent declarations can be updated");
    }

    const updateData: Partial<InsertDeclaration> = { updatedByUserId: getUserId(user) };
    if (input.effectiveProductName !== undefined) updateData.effectiveProductName = input.effectiveProductName;
    if (input.effectiveAgeGrading !== undefined) updateData.effectiveAgeGrading = input.effectiveAgeGrading;
    if (input.euDirectives !== undefined) updateData.euDirectives = input.euDirectives;
    if (input.chRegulations !== undefined) updateData.chRegulations = input.chRegulations;
    if (input.standards !== undefined) updateData.standards = input.standards;
    if (input.testReportRef !== undefined) updateData.testReportRef = input.testReportRef;
    if (input.notifiedBody !== undefined) updateData.notifiedBody = input.notifiedBody;
    if (input.chConformityBody !== undefined) updateData.chConformityBody = input.chConformityBody;
    if (input.issuedDate !== undefined) updateData.issuedDate = new Date(input.issuedDate);
    if (input.issuedPlace !== undefined) updateData.issuedPlace = input.issuedPlace;
    if (input.manufacturerContactName !== undefined) updateData.manufacturerContactName = input.manufacturerContactName;
    if (input.manufacturerContactEmail !== undefined) updateData.manufacturerContactEmail = input.manufacturerContactEmail;

    await db.update(declarations).set(updateData).where(eq(declarations.id, id));
    return this.getById(user, id);
  },

  // ── Send to manufacturer ─────────────────────────────────────────────────
  async sendToManufacturer(user: UserContext, id: number, portalBaseUrl: string) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin"]);
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    const [decl] = await db
      .select()
      .from(declarations)
      .where(and(eq(declarations.id, id), eq(declarations.tenantId, user.tenantId ?? 1)));
    if (!decl) throw Errors.notFound("Declaration not found");
    if (!["draft", "sent"].includes(decl.status)) {
      throw Errors.precondition("Only draft declarations can be sent");
    }
    if (!decl.manufacturerContactEmail) {
      throw Errors.precondition("Manufacturer contact email is required before sending");
    }

    const token = generateToken();
    const expiresAt = tokenExpiresAt(30);

    await db.update(declarations).set({
      status: "sent",
      sentAt: new Date(),
      portalToken: token,
      portalTokenExpiresAt: expiresAt,
      updatedByUserId: getUserId(user),
    }).where(eq(declarations.id, id));

    await addHistory(id, "sent", decl.status, "sent", getUserId(user), getUserName(user),
      `Sent to ${decl.manufacturerContactEmail}`);

    const portalUrl = `${portalBaseUrl}/declaration/portal/${token}`;
    const expiryStr = expiresAt.toLocaleDateString("de-CH");

    try {
      await emailService.sendEmail({
        to: decl.manufacturerContactEmail,
        subject: `Konformitätserklärung ${decl.docNumber} – Bitte unterzeichnen / Declaration of Conformity – Please sign`,
        htmlBody: buildManufacturerEmail(decl, portalUrl, expiryStr),
      });
    } catch (e) {
      console.error("Failed to send manufacturer email:", e);
    }

    return this.getById(user, id);
  },

  // ── Regenerate portal token ──────────────────────────────────────────────
  async regenerateToken(user: UserContext, id: number) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin"]);
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    const [decl] = await db
      .select()
      .from(declarations)
      .where(and(eq(declarations.id, id), eq(declarations.tenantId, user.tenantId ?? 1)));
    if (!decl) throw Errors.notFound("Declaration not found");

    const token = generateToken();
    const expiresAt = tokenExpiresAt(30);
    await db.update(declarations).set({ portalToken: token, portalTokenExpiresAt: expiresAt })
      .where(eq(declarations.id, id));

    return { token, expiresAt };
  },

  // ── Get declaration by portal token (public – no auth) ───────────────────
  async getByToken(token: string) {
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    const [decl] = await db
      .select()
      .from(declarations)
      .where(eq(declarations.portalToken, token));
    if (!decl) throw Errors.notFound("Invalid or expired link");
    if (decl.portalTokenExpiresAt && decl.portalTokenExpiresAt < new Date()) {
      throw Errors.precondition("This signing link has expired. Please contact the importer.");
    }

    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, decl.supplierId));
    const [product] = await db.select().from(products).where(eq(products.id, decl.productId));
    const articles = await db.select().from(declarationArticles)
      .where(eq(declarationArticles.declarationId, decl.id));

    return {
      ...decl,
      supplierName: supplier?.name ?? "Unknown",
      productName: product?.productName ?? "Unknown",
      articles,
    };
  },

  // ── Manufacturer submits signed PDF via portal ───────────────────────────
  async submitSignedPdf(
    token: string,
    input: {
      signedPdfBase64: string;
      signatoryName: string;
      signatoryPosition: string;
    }
  ) {
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    const [decl] = await db.select().from(declarations).where(eq(declarations.portalToken, token));
    if (!decl) throw Errors.notFound("Invalid or expired link");
    if (decl.portalTokenExpiresAt && decl.portalTokenExpiresAt < new Date()) {
      throw Errors.precondition("This signing link has expired");
    }
    if (["signed", "ai_validated", "archived"].includes(decl.status)) {
      throw Errors.precondition("This declaration has already been signed");
    }

    const pdfBuffer = Buffer.from(input.signedPdfBase64, "base64");
    const fileKey = `declarations/${decl.tenantId}/${decl.docNumber}-signed-${Date.now()}.pdf`;
    const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

    await db.update(declarations).set({
      status: "signed",
      signedAt: new Date(),
      signedByName: input.signatoryName,
      signedByPosition: input.signatoryPosition,
      signatureMethod: "manual_upload",
      signedPdfUrl: url,
      signedPdfKey: fileKey,
    }).where(eq(declarations.id, decl.id));

    await addHistory(decl.id, "signed", decl.status, "signed", null, input.signatoryName,
      `Signed by ${input.signatoryName} (${input.signatoryPosition})`);

    return { success: true };
  },

  // ── AI validation of signed declaration ──────────────────────────────────
  async validateWithAi(user: UserContext, id: number) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin"]);
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    const [decl] = await db
      .select()
      .from(declarations)
      .where(and(eq(declarations.id, id), eq(declarations.tenantId, user.tenantId ?? 1)));
    if (!decl) throw Errors.notFound("Declaration not found");
    if (decl.status !== "signed") {
      throw Errors.precondition("AI validation is only available after the manufacturer has signed");
    }

    const [product] = await db.select().from(products).where(eq(products.id, decl.productId));

    // Resolve a fresh presigned URL for the signed PDF so GPT-4o can read it
    let pdfUrl: string | null = decl.signedPdfUrl ?? null;
    if (decl.signedPdfKey) {
      try {
        const { url } = await storageGet(decl.signedPdfKey);
        pdfUrl = url;
      } catch {
        // fallback to stored URL
      }
    }

    const systemPrompt = `You are a senior compliance expert specialising in EU and Swiss toy safety regulations.
Your task is to review the attached Declaration of Conformity (DoC) PDF and verify it against the metadata provided.
Be precise and strict – this document has legal significance. Respond only with the requested JSON.`;

    const userContent: any[] = [
      { type: "text", text: buildAiValidationPrompt(decl, product) },
    ];

    // Attach the actual signed PDF so GPT-4o can read the document content
    if (pdfUrl) {
      userContent.push({
        type: "file_url",
        file_url: { url: pdfUrl, mime_type: "application/pdf" },
      });
    }

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "doc_validation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              is_signed: { type: "boolean" },
              signatory_name_present: { type: "boolean" },
              signatory_position_present: { type: "boolean" },
              date_present: { type: "boolean" },
              product_name_matches: { type: "boolean" },
              article_number_present: { type: "boolean" },
              directives_complete: { type: "boolean" },
              ch_regulations_present: { type: "boolean" },
              standards_complete: { type: "boolean" },
              age_grading_present: { type: "boolean" },
              notified_body_present: { type: "boolean" },
              issues: { type: "array", items: { type: "string" } },
              summary: { type: "string" },
              passed: { type: "boolean" },
            },
            required: [
              "is_signed", "signatory_name_present", "signatory_position_present",
              "date_present", "product_name_matches", "article_number_present",
              "directives_complete", "ch_regulations_present", "standards_complete",
              "age_grading_present", "notified_body_present", "issues", "summary", "passed",
            ],
            additionalProperties: false,
          },
        },
      } as any,
    });

    const content = response.choices[0]?.message?.content;
    let result: any = {};
    try {
      result = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      result = { passed: false, summary: "AI validation failed to parse response", issues: [] };
    }

    const newStatus = result.passed ? "ai_validated" : "signed";
    await db.update(declarations).set({
      status: newStatus as any,
      aiValidationPassed: result.passed,
      aiValidationResult: result,
      aiValidationSummary: result.summary,
      aiValidatedAt: new Date(),
      updatedByUserId: getUserId(user),
    }).where(eq(declarations.id, id));

    await addHistory(id, "ai_validated", "signed", newStatus, getUserId(user), getUserName(user),
      result.passed ? "AI validation passed" : "AI validation found issues");

    return result;
  },

  // ── Archive: create Document record ──────────────────────────────────────
  async archive(user: UserContext, id: number) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin"]);
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    const [decl] = await db
      .select()
      .from(declarations)
      .where(and(eq(declarations.id, id), eq(declarations.tenantId, user.tenantId ?? 1)));
    if (!decl) throw Errors.notFound("Declaration not found");
    if (decl.status === "archived") throw Errors.precondition("Declaration is already archived");
    if (!decl.signedPdfUrl) throw Errors.precondition("Cannot archive: no signed PDF available");

    const [docResult] = await db.insert(documents).values({
      productId: decl.productId,
      documentType: "declaration_of_conformity",
      fileName: `${decl.docNumber}-signed.pdf`,
      fileUrl: decl.signedPdfUrl,
      fileKey: decl.signedPdfKey ?? "",
      mimeType: "application/pdf",
      version: 1,
      isArchived: false,
      publicDownload: false,
      includeInAiAnalysis: true,
      reviewStatus: "approved",
      uploadedByUserId: getUserId(user),
      uploadedByRole: "compliance_manager",
      uploadedAt: new Date(),
    } as any).$returningId();

    const docId = (docResult as any).id as number;

    await db.update(declarations).set({
      status: "archived",
      archivedAt: new Date(),
      archivedDocumentId: docId,
      updatedByUserId: getUserId(user),
    }).where(eq(declarations.id, id));

    await addHistory(id, "archived", decl.status, "archived", getUserId(user), getUserName(user),
      `Archived. Document record #${docId} created.`);

    return this.getById(user, id);
  },
};

// ─── Email template ───────────────────────────────────────────────────────────

function buildManufacturerEmail(decl: Declaration, portalUrl: string, expiryStr: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #C8102E; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 18px;">Konformitätserklärung / Declaration of Conformity</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px;">Dokument-Nr. / Doc. No.: ${decl.docNumber}</p>
  </div>
  <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="margin-top: 0;">Sehr geehrte Damen und Herren,<br><em>Dear Sir or Madam,</em></p>
    <p>
      Wir bitten Sie, die Konformitätserklärung für das Produkt
      <strong>${decl.effectiveProductName ?? "—"}</strong> zu prüfen, zu unterzeichnen und das unterzeichnete Dokument über den folgenden Link hochzuladen.
      <br><br>
      <em>Please review the Declaration of Conformity for the product
      <strong>${decl.effectiveProductName ?? "—"}</strong>, sign it, and upload the signed document via the link below.</em>
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${portalUrl}" style="background: #C8102E; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
        📄 Dokument öffnen / Open Document
      </a>
    </div>
    <p style="font-size: 13px; color: #666;">
      Dieser Link ist gültig bis: <strong>${expiryStr}</strong><br>
      <em>This link is valid until: <strong>${expiryStr}</strong></em>
    </p>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
    <p style="font-size: 12px; color: #999; margin-bottom: 0;">
      Bei Fragen wenden Sie sich bitte an Ihren Ansprechpartner bei Spielzeug3 AG.<br>
      <em>For questions, please contact your Spielzeug3 AG representative.</em>
    </p>
  </div>
</body>
</html>`;
}

// ─── AI validation prompt ─────────────────────────────────────────────────────

function buildAiValidationPrompt(decl: Declaration, product: any): string {
  const directives = (decl.euDirectives as string[] ?? []).map((d: string) => `  - ${d}`).join("\n") || "  (none specified)";
  const chRegs = (decl.chRegulations as string[] ?? []).map((r: string) => `  - ${r}`).join("\n") || "  (none specified)";
  const standards = (decl.standards as string[] ?? []).map((s: string) => `  - ${s}`).join("\n") || "  (none specified)";

  return `Please review the attached Declaration of Conformity (DoC) PDF for the following product and verify its completeness and correctness.

=== EXPECTED METADATA (from our compliance system) ===
Product Name: ${decl.effectiveProductName ?? product?.productName ?? "Unknown"}
Internal Article No.: ${product?.internalArticleNumber ?? "Unknown"}
Age Grading: ${decl.effectiveAgeGrading ?? "Not specified"}
Issued Date: ${decl.issuedDate ? new Date(decl.issuedDate).toLocaleDateString("de-CH") : "Not specified"}
Issued Place: ${decl.issuedPlace ?? "Not specified"}
Signed by: ${decl.signedByName ?? "Unknown"} (${decl.signedByPosition ?? "Unknown"})
Signed at: ${decl.signedAt ? new Date(decl.signedAt).toLocaleDateString("de-CH") : "Unknown"}
Test Report Reference: ${decl.testReportRef ?? "Not provided"}
Notified Body: ${decl.notifiedBody ?? "Not provided"}
CH Conformity Body: ${decl.chConformityBody ?? "Not provided"}

Expected EU Directives:
${directives}

Expected CH Regulations:
${chRegs}

Expected Standards:
${standards}

=== YOUR TASK ===
Carefully read the attached PDF and check each of the following:
1. Is the document actually signed (wet or digital signature visible)?
2. Is the signatory name present and does it match "${decl.signedByName ?? "Unknown"}"?
3. Is the signatory position/title present?
4. Is the issue date present and correct?
5. Does the product name in the PDF match the expected product name?
6. Is the article number present in the PDF?
7. Are all expected EU directives listed in the PDF?
8. Are the CH regulations present (if applicable)?
9. Are all expected standards listed?
10. Is the age grading mentioned?
11. Is a notified body referenced (if required by the directives)?

For each issue found, provide a clear, actionable description in English.
Set "passed" to true only if checks 1, 2, 5, 7, and 9 all pass.
Provide a concise "summary" (2-3 sentences) with an overall assessment.`;
}
