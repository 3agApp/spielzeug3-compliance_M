/**
 * server/riskAssessment.test.ts
 * Unit tests for the risk assessment service and prompt builder.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildRiskPrompt, scoreToLevel } from "./domains/risk/riskAssessmentService";

// ─── scoreToLevel ─────────────────────────────────────────────────────────────

describe("scoreToLevel", () => {
  it("returns low for scores 1-3", () => {
    expect(scoreToLevel(1)).toBe("low");
    expect(scoreToLevel(2)).toBe("low");
    expect(scoreToLevel(3)).toBe("low");
  });

  it("returns medium for scores 4-6", () => {
    expect(scoreToLevel(4)).toBe("medium");
    expect(scoreToLevel(5)).toBe("medium");
    expect(scoreToLevel(6)).toBe("medium");
  });

  it("returns high for scores 7-8", () => {
    expect(scoreToLevel(7)).toBe("high");
    expect(scoreToLevel(8)).toBe("high");
  });

  it("returns critical for scores 9-10", () => {
    expect(scoreToLevel(9)).toBe("critical");
    expect(scoreToLevel(10)).toBe("critical");
  });
});

// ─── buildRiskPrompt ──────────────────────────────────────────────────────────

describe("buildRiskPrompt", () => {
  const product = {
    productName: "Holzeisenbahn Starter-Set",
    brand: "Spielfix",
    internalArticleNumber: "ART-001",
    ageGroup: "3+",
    targetMarket: "DE",
    status: "under_review",
    completenessScore: "72.00",
    supplierId: 42,
    tenantId: 1,
  };

  it("includes product name in prompt", () => {
    const prompt = buildRiskPrompt(product, [], [], [], [], null);
    expect(prompt).toContain("Holzeisenbahn Starter-Set");
  });

  it("includes brand in prompt", () => {
    const prompt = buildRiskPrompt(product, [], [], [], [], null);
    expect(prompt).toContain("Spielfix");
  });

  it("mentions no documents when list is empty", () => {
    const prompt = buildRiskPrompt(product, [], [], [], [], null);
    expect(prompt).toContain("No documents available");
  });

  it("lists documents when provided", () => {
    const docs = [
      { documentType: "test_report", reviewStatus: "approved", fileName: "test.pdf", standard: "EN 71", expiresAt: null },
    ];
    const prompt = buildRiskPrompt(product, docs, [], [], [], null);
    expect(prompt).toContain("test_report");
    expect(prompt).toContain("EN 71");
  });

  it("includes missing requirements", () => {
    const missing = [
      { requirementType: "declaration_of_conformity", description: "CE-Konformitätserklärung fehlt" },
    ];
    const prompt = buildRiskPrompt(product, [], [], [], missing, null);
    expect(prompt).toContain("declaration_of_conformity");
  });

  it("includes latest AI analysis summary when provided", () => {
    const aiAnalysis = { summary: "Gute Dokumentation, aber REACH fehlt.", overallScore: "65" };
    const prompt = buildRiskPrompt(product, [], [], [], [], aiAnalysis);
    expect(prompt).toContain("REACH fehlt");
    expect(prompt).toContain("65");
  });

  it("includes components when provided", () => {
    const comps = [
      { id: 1, name: "Lokomotive", materialType: "Holz", partNumber: "P-001" },
    ];
    const prompt = buildRiskPrompt(product, [], comps, [], [], null);
    expect(prompt).toContain("Lokomotive");
    expect(prompt).toContain("Holz");
  });

  it("requests JSON output format", () => {
    const prompt = buildRiskPrompt(product, [], [], [], [], null);
    expect(prompt).toContain("overallRiskScore");
    expect(prompt).toContain("riskLevel");
    expect(prompt).toContain("mitigations");
  });

  it("specifies 1-10 scale in prompt", () => {
    const prompt = buildRiskPrompt(product, [], [], [], [], null);
    expect(prompt).toContain("1 (very low) to 10 (critical)");
  });
});
