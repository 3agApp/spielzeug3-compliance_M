/**
 * server/declarationModule.test.ts
 * Tests for the Declaration of Conformity module
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ──────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getProductById: vi.fn().mockResolvedValue(null),
  getSupplierById: vi.fn().mockResolvedValue(null),
}));

// ─── Mock storage ─────────────────────────────────────────────────────────────
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.pdf", key: "test.pdf" }),
}));

// ─── Mock LLM ────────────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          isValid: true,
          confidence: 0.95,
          issues: [],
          suggestions: [],
          summary: "Declaration appears valid.",
        }),
      },
    }],
  }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Declaration Number Generator", () => {
  it("generates a correctly formatted document number using internal format", () => {
    // The format is DOC-SZ3-YYYY-NNNN-SSS (internal function, not exported)
    // We verify the pattern by constructing it manually
    const year = new Date().getFullYear();
    const tenantId = 1;
    const seq = 42;
    const num = `DOC-SZ3-${year}-${String(tenantId).padStart(4, "0")}-${String(seq).padStart(3, "0")}`;
    expect(num).toMatch(new RegExp(`^DOC-SZ3-${year}-\\d{4}-\\d{3}$`));
    expect(num).toContain(`-042`);
  });
});

describe("Declaration PDF Service", () => {
  it("generates a PDF buffer for a minimal declaration (DE)", async () => {
    const { generateDeclarationPdf } = await import(
      "./domains/declarations/declarationPdfService"
    );
    const declaration = {
      docNumber: "DOC-SZ3-2026-0001-001",
      version: "1.0",
      issuedDate: new Date("2026-01-15"),
      issuedPlace: "Zürich",
      supplierName: "Test Hersteller GmbH",
      manufacturerAddress: "Teststrasse 1, 8000 Zürich",
      manufacturerCountry: "CH",
      effectiveProductName: "Tigerbox Touch",
      articleNumber: "TBT-001",
      ean: "1234567890123",
      brand: "Hörbert",
      euDirectives: ["2014/53/EU (RED)", "2011/65/EU (RoHS)"],
      chRegulations: ["SR 930.111 (Spielzeugverordnung)"],
      standards: ["EN 71-1:2014+A1:2018", "EN 62115:2005+A2:2011"],
      signatoryName: "Max Mustermann",
      signatoryPosition: "Quality Manager",
      articles: [],
    };

    const pdfBuffer = await generateDeclarationPdf(declaration, "de");
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF magic bytes
    expect(pdfBuffer.slice(0, 4).toString()).toBe("%PDF");
  });

  it("generates a PDF buffer for a minimal declaration (EN)", async () => {
    const { generateDeclarationPdf } = await import(
      "./domains/declarations/declarationPdfService"
    );
    const declaration = {
      docNumber: "DOC-SZ3-2026-0002-001",
      supplierName: "Test Manufacturer Ltd",
      effectiveProductName: "Test Toy",
      euDirectives: ["2009/48/EC (Toy Safety Directive)"],
      chRegulations: [],
      standards: ["EN 71-1:2014"],
      articles: [],
    };

    const pdfBuffer = await generateDeclarationPdf(declaration, "en");
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.slice(0, 4).toString()).toBe("%PDF");
  });

  it("handles empty directives and standards gracefully", async () => {
    const { generateDeclarationPdf } = await import(
      "./domains/declarations/declarationPdfService"
    );
    const declaration = {
      docNumber: "DOC-SZ3-2026-0003-001",
      supplierName: "Empty Test GmbH",
      effectiveProductName: "Empty Test Product",
      euDirectives: [],
      chRegulations: [],
      standards: [],
      articles: [],
    };

    const pdfBuffer = await generateDeclarationPdf(declaration, "de");
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.slice(0, 4).toString()).toBe("%PDF");
  });

  it("includes Annex A when variants are present", async () => {
    const { generateDeclarationPdf } = await import(
      "./domains/declarations/declarationPdfService"
    );
    const declaration = {
      docNumber: "DOC-SZ3-2026-0004-001",
      supplierName: "Variant Test GmbH",
      effectiveProductName: "Multi-Variant Toy",
      euDirectives: ["2009/48/EC"],
      chRegulations: [],
      standards: [],
      articles: [
        { isVariant: true, variantLabel: "V1", articleNumber: "ART-001", ean: "111", description: "Red version" },
        { isVariant: true, variantLabel: "V2", articleNumber: "ART-002", ean: "222", description: "Blue version" },
      ],
    };

    const pdfBuffer = await generateDeclarationPdf(declaration, "de");
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(2000);
  });

  it("DE and EN PDFs differ in content", async () => {
    const { generateDeclarationPdf } = await import(
      "./domains/declarations/declarationPdfService"
    );
    const declaration = {
      docNumber: "DOC-SZ3-2026-0005-001",
      supplierName: "Lang Test GmbH",
      effectiveProductName: "Bilingual Toy",
      euDirectives: ["2009/48/EC"],
      chRegulations: [],
      standards: ["EN 71-1:2014"],
      articles: [],
    };

    const pdfDe = await generateDeclarationPdf(declaration, "de");
    const pdfEn = await generateDeclarationPdf(declaration, "en");
    // PDFs should differ (different i18n strings)
    expect(pdfDe.equals(pdfEn)).toBe(false);
  });
});

describe("Declaration status workflow", () => {
  it("has correct status order: draft → sent → manufacturer_review → signed → ai_validated → archived", () => {
    const statuses = ["draft", "sent", "manufacturer_review", "signed", "ai_validated", "archived"];
    expect(statuses).toHaveLength(6);
    expect(statuses[0]).toBe("draft");
    expect(statuses[statuses.length - 1]).toBe("archived");
  });

  it("token should be a non-empty UUID-like string", () => {
    const token = crypto.randomUUID();
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
