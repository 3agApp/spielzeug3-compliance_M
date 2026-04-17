/**
 * Tests for PDF localization (DE/EN) in pdfGenerator.ts and riskReportPdf.ts
 */
import { describe, it, expect } from "vitest";
import { generateAiAnalysisPdf } from "./pdfGenerator";
import { generateRiskReportPdf } from "./riskReportPdf";

const SAMPLE_PRODUCT = {
  productName: "Holzeisenbahn Set Deluxe",
  internalArticleNumber: "ART-10001",
  supplierArticleNumber: "SUP-001",
  ean: "1234567890123",
  brand: "Müller Kids",
  status: "submitted",
  supplierName: "Müller GmbH",
};

const SAMPLE_ANALYSIS = {
  id: 42,
  overallScore: 78,
  documentCompletenessScore: 85,
  contentPlausibilityScore: 72,
  formalCorrectnessScore: 80,
  consistencyScore: 75,
  summary: "The documents are largely complete and plausible.",
  findings: [
    { category: "Documentation", severity: "medium", description: "Missing EN 71 test report." },
  ],
  recommendations: ["Provide EN 71 test report for all components."],
  modelUsed: "GPT-4o",
  tokensUsed: 1234,
  createdAt: new Date("2026-01-15T10:00:00Z"),
};

const SAMPLE_RISKS = [
  {
    id: 1,
    category: "Chemical Safety",
    title: "Missing REACH compliance",
    description: "No REACH compliance documentation provided.",
    score: 7,
    level: "high" as const,
    mitigations: ["Provide REACH compliance certificate."],
  },
];

const SAMPLE_ASSESSMENT = {
  id: 7,
  overallRiskScore: 6.5,
  riskLevel: "medium",
  summary: "Moderate risk due to missing compliance documentation.",
  risks: SAMPLE_RISKS,
  missingInfo: ["REACH compliance certificate", "EN 71 test report"],
  modelUsed: "GPT-4o",
  tokensUsed: 800,
  createdAt: new Date("2026-01-15T10:00:00Z"),
};

// New LLM format findings (type/message/detail/remediation/affectedRegulations)
const NEW_FORMAT_FINDINGS = [
  {
    type: "critical",
    message: "Missing CE marking documentation",
    detail: "The product lacks proper CE marking documentation required by EU Toy Safety Directive.",
    remediation: "Obtain CE marking certificate from accredited body.",
    affectedRegulations: ["Toy Safety Directive 2009/48/EC Art. 4", "EN 71-1:2014"],
  },
  {
    type: "warning",
    message: "Incomplete REACH compliance",
    detail: "REACH declaration does not cover all substances.",
    remediation: "Update REACH declaration to include all relevant substances.",
    affectedRegulations: ["REACH Regulation EC 1907/2006"],
  },
  {
    type: "positive",
    message: "Valid test report present",
    detail: "EN 71-1 test report is present and valid.",
    remediation: null,
    affectedRegulations: ["EN 71-1:2014"],
  },
];

describe("pdfGenerator – AI Analysis PDF localization", () => {
  it("generates a non-empty PDF buffer in German (default)", async () => {
    const buf = await generateAiAnalysisPdf({
      product: SAMPLE_PRODUCT,
      analysis: SAMPLE_ANALYSIS,
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    // PDF magic bytes
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("generates a non-empty PDF buffer in English", async () => {
    const buf = await generateAiAnalysisPdf({
      product: SAMPLE_PRODUCT,
      analysis: SAMPLE_ANALYSIS,
      lang: "en",
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("generates PDF with new LLM format findings (type/message/detail) without crash", async () => {
    // Regression test: LLM returns type/message/detail, old code expected severity/category/description
    const buf = await generateAiAnalysisPdf({
      product: SAMPLE_PRODUCT,
      analysis: { ...SAMPLE_ANALYSIS, findings: NEW_FORMAT_FINDINGS },
      lang: "de",
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("generates PDF with new LLM format findings in English", async () => {
    const buf = await generateAiAnalysisPdf({
      product: SAMPLE_PRODUCT,
      analysis: { ...SAMPLE_ANALYSIS, findings: NEW_FORMAT_FINDINGS },
      lang: "en",
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("handles mixed/unknown finding fields gracefully (no crash)", async () => {
    const mixedFindings = [
      { type: "critical", message: "Test" }, // minimal new format
      { severity: "high", category: "Cat", description: "Desc" }, // old format
      {}, // empty object
    ];
    const buf = await generateAiAnalysisPdf({
      product: SAMPLE_PRODUCT,
      analysis: { ...SAMPLE_ANALYSIS, findings: mixedFindings },
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("DE and EN PDFs differ in content (different strings)", async () => {
    const bufDe = await generateAiAnalysisPdf({
      product: SAMPLE_PRODUCT,
      analysis: SAMPLE_ANALYSIS,
      lang: "de",
    });
    const bufEn = await generateAiAnalysisPdf({
      product: SAMPLE_PRODUCT,
      analysis: SAMPLE_ANALYSIS,
      lang: "en",
    });
    // The buffers should differ because they contain different language strings
    expect(bufDe.equals(bufEn)).toBe(false);
  });
});

describe("riskReportPdf – Risk Report PDF localization", () => {
  it("generates a non-empty PDF buffer in German (default)", async () => {
    const buf = await generateRiskReportPdf({
      product: SAMPLE_PRODUCT,
      assessment: SAMPLE_ASSESSMENT,
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("generates a non-empty PDF buffer in English", async () => {
    const buf = await generateRiskReportPdf({
      product: SAMPLE_PRODUCT,
      assessment: SAMPLE_ASSESSMENT,
      lang: "en",
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("DE and EN risk report PDFs differ in content", async () => {
    const bufDe = await generateRiskReportPdf({
      product: SAMPLE_PRODUCT,
      assessment: SAMPLE_ASSESSMENT,
      lang: "de",
    });
    const bufEn = await generateRiskReportPdf({
      product: SAMPLE_PRODUCT,
      assessment: SAMPLE_ASSESSMENT,
      lang: "en",
    });
    expect(bufDe.equals(bufEn)).toBe(false);
  });

  it("handles empty risks and missingInfo gracefully", async () => {
    const buf = await generateRiskReportPdf({
      product: SAMPLE_PRODUCT,
      assessment: { ...SAMPLE_ASSESSMENT, risks: [], missingInfo: [] },
      lang: "en",
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(500);
  });
});
