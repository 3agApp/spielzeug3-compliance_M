/**
 * server/autoAiValidation.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for the automatic AI validation triggered after a manufacturer uploads
 * the signed Declaration of Conformity PDF via the portal.
 *
 * Strategy: mock the DB, storagePut, storageGet, and invokeLLM so we can test
 * the service logic without real infrastructure.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock heavy infrastructure ────────────────────────────────────────────────

vi.mock("../server/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../server/storage", () => ({
  storagePut: vi.fn(),
  storageGet: vi.fn(),
}));

vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { getDb } from "../server/db";
import { storagePut, storageGet } from "../server/storage";
import { invokeLLM } from "../server/_core/llm";
import { declarationService } from "../server/domains/declarations/declarationService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDecl(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    tenantId: 1,
    productId: 10,
    supplierId: 5,
    docNumber: "DOC-SZ1-2026-0001",
    status: "sent",
    version: 1,
    effectiveProductName: "Test Toy",
    euDirectives: ["2009/48/EC"],
    chRegulations: [],
    standards: ["EN 71-1:2014"],
    signedPdfUrl: null,
    signedPdfKey: null,
    signedByName: null,
    signedByPosition: null,
    portalToken: "test-token-abc",
    portalTokenExpiresAt: new Date(Date.now() + 86400_000), // +1 day
    aiValidationPassed: null,
    aiValidationResult: null,
    aiValidationSummary: null,
    aiValidatedAt: null,
    issuedDate: new Date("2026-01-15"),
    issuedPlace: "Zürich",
    testReportRef: "TR-2026-001",
    notifiedBody: null,
    chConformityBody: null,
    manufacturerContactEmail: "mfr@example.com",
    ...overrides,
  };
}

function makeProduct() {
  return {
    id: 10,
    productName: "Test Toy",
    internalArticleNumber: "ART-001",
    ean: "1234567890123",
  };
}

function makeDb(decl: any, product: any) {
  const mockSelect = vi.fn().mockReturnThis();
  const mockFrom = vi.fn().mockReturnThis();
  const mockWhere = vi.fn();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockSet = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockValues = vi.fn().mockReturnThis();
  const mockReturningId = vi.fn().mockResolvedValue([{ id: 99 }]);

  // Track which table is being queried
  let queryTable = "";

  const db: any = {
    select: () => ({
      from: (table: any) => {
        queryTable = table?.["_"] ?? String(table);
        return {
          where: (cond: any) => {
            // Return decl for declarations table, product for products table
            if (queryTable.includes("product")) return Promise.resolve([product]);
            return Promise.resolve([decl]);
          },
        };
      },
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    insert: () => ({
      values: () => ({
        $returningId: mockReturningId,
      }),
    }),
  };

  return db;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("submitSignedPdf – auto AI validation trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns autoValidationTriggered: true on successful upload", async () => {
    const decl = makeDecl();
    const product = makeProduct();
    const db = makeDb(decl, product);

    vi.mocked(getDb).mockResolvedValue(db as any);
    vi.mocked(storagePut).mockResolvedValue({ key: "declarations/1/DOC-SZ1-2026-0001-signed-123.pdf", url: "https://s3.example.com/signed.pdf" });

    const result = await declarationService.submitSignedPdf("test-token-abc", {
      signedPdfBase64: Buffer.from("fake-pdf-content").toString("base64"),
      signatoryName: "Max Mustermann",
      signatoryPosition: "Quality Manager",
    });

    expect(result.success).toBe(true);
    expect(result.autoValidationTriggered).toBe(true);
  });

  it("rejects if token is invalid (no declaration found)", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([]), // empty → not found
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as any);

    await expect(
      declarationService.submitSignedPdf("invalid-token", {
        signedPdfBase64: "dGVzdA==",
        signatoryName: "Test",
        signatoryPosition: "Tester",
      })
    ).rejects.toThrow(/invalid or expired/i);
  });

  it("rejects if declaration is already signed", async () => {
    const decl = makeDecl({ status: "signed" });
    const db = makeDb(decl, makeProduct());
    vi.mocked(getDb).mockResolvedValue(db as any);

    await expect(
      declarationService.submitSignedPdf("test-token-abc", {
        signedPdfBase64: "dGVzdA==",
        signatoryName: "Test",
        signatoryPosition: "Tester",
      })
    ).rejects.toThrow(/already been signed/i);
  });

  it("rejects if portal token is expired", async () => {
    const decl = makeDecl({ portalTokenExpiresAt: new Date(Date.now() - 1000) });
    const db = makeDb(decl, makeProduct());
    vi.mocked(getDb).mockResolvedValue(db as any);

    await expect(
      declarationService.submitSignedPdf("test-token-abc", {
        signedPdfBase64: "dGVzdA==",
        signatoryName: "Test",
        signatoryPosition: "Tester",
      })
    ).rejects.toThrow(/expired/i);
  });
});

describe("validateWithAiInternal – internal AI validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null if declaration is not in 'signed' status (already validated)", async () => {
    const decl = makeDecl({ status: "ai_validated", signedPdfUrl: "https://s3.example.com/signed.pdf" });
    const db = makeDb(decl, makeProduct());
    vi.mocked(getDb).mockResolvedValue(db as any);

    const result = await declarationService.validateWithAiInternal(1);
    expect(result).toBeNull();
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("calls invokeLLM with the signed PDF URL when status is 'signed'", async () => {
    const decl = makeDecl({
      status: "signed",
      signedPdfUrl: "https://s3.example.com/signed.pdf",
      signedPdfKey: "declarations/1/signed.pdf",
      signedByName: "Max Mustermann",
      signedByPosition: "Quality Manager",
    });
    const db = makeDb(decl, makeProduct());
    vi.mocked(getDb).mockResolvedValue(db as any);
    vi.mocked(storageGet).mockResolvedValue({ key: "declarations/1/signed.pdf", url: "https://s3.example.com/signed-presigned.pdf" });
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            is_signed: true,
            signatory_name_present: true,
            signatory_position_present: true,
            date_present: true,
            product_name_matches: true,
            article_number_present: true,
            directives_complete: true,
            ch_regulations_present: true,
            standards_complete: true,
            age_grading_present: false,
            notified_body_present: false,
            issues: [],
            summary: "Document is complete and properly signed.",
            passed: true,
          }),
        },
      }],
    } as any);

    const result = await declarationService.validateWithAiInternal(1);

    expect(invokeLLM).toHaveBeenCalledOnce();
    // Verify the PDF URL was passed to the LLM
    const callArgs = vi.mocked(invokeLLM).mock.calls[0][0];
    const userMsg = callArgs.messages.find((m: any) => m.role === "user");
    expect(userMsg).toBeDefined();
    const fileContent = (userMsg.content as any[]).find((c: any) => c.type === "file_url");
    expect(fileContent?.file_url?.url).toBe("https://s3.example.com/signed-presigned.pdf");

    expect(result?.passed).toBe(true);
    expect(result?.summary).toContain("properly signed");
  });

  it("sets status to 'signed' (not ai_validated) when AI finds issues", async () => {
    const decl = makeDecl({
      status: "signed",
      signedPdfUrl: "https://s3.example.com/signed.pdf",
      signedPdfKey: null,
    });

    // Track what status was written to DB
    let writtenStatus: string | null = null;
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([decl]),
        }),
      }),
      update: () => ({
        set: (data: any) => {
          if (data.status) writtenStatus = data.status;
          return { where: () => Promise.resolve() };
        },
      }),
      insert: () => ({
        values: () => ({
          $returningId: vi.fn().mockResolvedValue([{ id: 99 }]),
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as any);
    vi.mocked(storageGet).mockRejectedValue(new Error("S3 error")); // fallback to stored URL
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            is_signed: false,
            signatory_name_present: false,
            signatory_position_present: false,
            date_present: false,
            product_name_matches: false,
            article_number_present: false,
            directives_complete: false,
            ch_regulations_present: false,
            standards_complete: false,
            age_grading_present: false,
            notified_body_present: false,
            issues: ["Document does not appear to be signed"],
            summary: "The document is missing a signature.",
            passed: false,
          }),
        },
      }],
    } as any);

    const result = await declarationService.validateWithAiInternal(1);

    expect(result?.passed).toBe(false);
    expect(writtenStatus).toBe("signed"); // stays signed, NOT ai_validated
  });

  it("handles LLM JSON parse error gracefully", async () => {
    const decl = makeDecl({
      status: "signed",
      signedPdfUrl: "https://s3.example.com/signed.pdf",
      signedPdfKey: null,
    });
    const db = makeDb(decl, makeProduct());
    vi.mocked(getDb).mockResolvedValue(db as any);
    vi.mocked(storageGet).mockRejectedValue(new Error("S3 error"));
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: "not-valid-json{{" } }],
    } as any);

    const result = await declarationService.validateWithAiInternal(1);

    expect(result?.passed).toBe(false);
    expect(result?.summary).toMatch(/failed to parse/i);
  });
});
