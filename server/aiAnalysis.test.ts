import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getSystemSetting: vi.fn(),
    upsertSystemSetting: vi.fn().mockResolvedValue(undefined),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
    getProductById: vi.fn(),
    getDocumentsByProduct: vi.fn().mockResolvedValue([]),
    createAiAnalysis: vi.fn().mockResolvedValue({ insertId: 42 }),
    updateAiAnalysis: vi.fn().mockResolvedValue(undefined),
    getLatestAiAnalysisByProduct: vi.fn().mockResolvedValue(null),
    getAiAnalysisHistory: vi.fn().mockResolvedValue([]),
  };
});

// ─── Context factories ────────────────────────────────────────────────────────
function makeCtx(role: string = "administrator"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "admin@test.com",
      name: "Test Admin",
      loginMethod: "manus",
      role: "admin",
      complianceRole: role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

function makeSupplierCtx(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "supplier-user",
      email: "supplier@test.com",
      name: "Supplier",
      loginMethod: "manus",
      role: "user",
      complianceRole: "supplier",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("aiAnalysis.saveApiKey", () => {
  it("allows administrator to save API key", async () => {
    const caller = appRouter.createCaller(makeCtx("administrator"));
    const result = await caller.aiAnalysis.saveApiKey({ apiKey: "sk-test-1234567890", provider: "openai" });
    expect(result.success).toBe(true);
  });

  it("allows compliance_manager to save API key", async () => {
    const caller = appRouter.createCaller(makeCtx("compliance_manager"));
    const result = await caller.aiAnalysis.saveApiKey({ apiKey: "sk-test-1234567890", provider: "anthropic" });
    expect(result.success).toBe(true);
  });

  it("rejects supplier from saving API key", async () => {
    const caller = appRouter.createCaller(makeSupplierCtx());
    await expect(caller.aiAnalysis.saveApiKey({ apiKey: "sk-test-1234567890", provider: "openai" })).rejects.toThrow();
  });
});

describe("aiAnalysis.getApiKeyStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns configured=false when no key stored", async () => {
    const { getSystemSetting } = await import("./db");
    vi.mocked(getSystemSetting).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx("administrator"));
    const result = await caller.aiAnalysis.getApiKeyStatus();
    expect(result.configured).toBe(false);
    expect(result.maskedKey).toBeNull();
  });

  it("returns masked key when key is stored", async () => {
    const { getSystemSetting } = await import("./db");
    // Mock both ai_provider and ai_api_key settings
    vi.mocked(getSystemSetting).mockImplementation(async (key: string) => {
      if (key === "ai_provider") {
        return { id: 1, settingKey: "ai_provider", settingValue: "openai", isEncrypted: false, updatedByUserId: 1, updatedAt: new Date(), createdAt: new Date() };
      }
      if (key === "ai_api_key") {
        return { id: 2, settingKey: "ai_api_key", settingValue: "sk-proj-abcdefghijklmnop1234", isEncrypted: true, updatedByUserId: 1, updatedAt: new Date(), createdAt: new Date() };
      }
      return undefined;
    });

    const caller = appRouter.createCaller(makeCtx("administrator"));
    const result = await caller.aiAnalysis.getApiKeyStatus();
    expect(result.configured).toBe(true);
    expect(result.maskedKey).toBeTruthy();
    // Should not expose the full key
    expect(result.maskedKey).not.toBe("sk-proj-abcdefghijklmnop1234");
    expect(result.maskedKey).toContain("*");
    expect((result as any).provider).toBe("openai");
  });
});

describe("aiAnalysis.analyzeProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when product does not exist (built-in LLM, no API key required)", async () => {
    const { getSystemSetting, getProductById } = await import("./db");
    vi.mocked(getSystemSetting).mockResolvedValue(undefined); // no API key – but built-in LLM doesn't need one
    vi.mocked(getProductById).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx("compliance_manager"));
    await expect(caller.aiAnalysis.analyzeProduct({ productId: 1 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws NOT_FOUND when product does not exist", async () => {
    const { getSystemSetting, getProductById } = await import("./db");
    vi.mocked(getSystemSetting).mockResolvedValue({
      id: 1,
      settingKey: "openai_api_key",
      settingValue: "sk-test-key",
      isEncrypted: true,
      updatedByUserId: 1,
      updatedAt: new Date(),
      createdAt: new Date(),
    });
    vi.mocked(getProductById).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx("compliance_manager"));
    await expect(caller.aiAnalysis.analyzeProduct({ productId: 9999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects supplier from triggering analysis", async () => {
    const caller = appRouter.createCaller(makeSupplierCtx());
    await expect(caller.aiAnalysis.analyzeProduct({ productId: 1 })).rejects.toThrow();
  });
});

describe("buildRiskAssessmentPrompt – extended finding fields", () => {
  it("prompt contains detail, affectedRegulations, and remediation fields", async () => {
    const { buildRiskAssessmentPrompt } = await import("./domains/ai/aiAnalysisService");
    const product = { productName: "Test Toy", brand: "TestBrand", ageGroup: "3+", targetMarket: "EU", status: "pending" };
    const prompt = buildRiskAssessmentPrompt(product as any, [], null);
    expect(prompt).toContain('"detail"');
    expect(prompt).toContain('"affectedRegulations"');
    expect(prompt).toContain('"remediation"');
  });

  it("prompt still contains all required base fields", async () => {
    const { buildRiskAssessmentPrompt } = await import("./domains/ai/aiAnalysisService");
    const product = { productName: "Test Toy", brand: "TestBrand", ageGroup: "3+", targetMarket: "EU", status: "pending" };
    const prompt = buildRiskAssessmentPrompt(product as any, [], null);
    expect(prompt).toContain('"overallScore"');
    expect(prompt).toContain('"riskLevel"');
    expect(prompt).toContain('"findings"');
    expect(prompt).toContain('"recommendations"');
    expect(prompt).toContain('"message"');
  });

  it("prompt instructs AI to give a short headline in message field", async () => {
    const { buildRiskAssessmentPrompt } = await import("./domains/ai/aiAnalysisService");
    const product = { productName: "Test Toy", brand: "TestBrand", ageGroup: "3+", targetMarket: "EU", status: "pending" };
    const prompt = buildRiskAssessmentPrompt(product as any, [], null);
    expect(prompt).toContain("short 1-sentence headline");
    expect(prompt).toContain("concrete actionable step");
  });

  it("prompt contains score reason fields", async () => {
    const { buildRiskAssessmentPrompt } = await import("./domains/ai/aiAnalysisService");
    const product = { productName: "Test Toy", brand: "TestBrand", ageGroup: "3+", targetMarket: "EU", status: "pending" };
    const prompt = buildRiskAssessmentPrompt(product as any, [], null);
    expect(prompt).toContain('"documentCompletenessReason"');
    expect(prompt).toContain('"contentPlausibilityReason"');
    expect(prompt).toContain('"formalCorrectnessReason"');
    expect(prompt).toContain('"consistencyReason"');
  });

  it("prompt includes document analysis results as context when provided", async () => {
    const { buildRiskAssessmentPrompt } = await import("./domains/ai/aiAnalysisService");
    const product = { productName: "Test Toy", brand: "TestBrand", ageGroup: "3+", targetMarket: "EU", status: "pending" };
    const docAnalysis = [{
      fileName: "EN71.pdf",
      documentType: "test_report",
      score: 90,
      status: "ok",
      positives: ["Issued by accredited lab"],
      issues: [],
      missingElements: ["Expiry date"],
    }];
    const prompt = buildRiskAssessmentPrompt(product as any, [], null, undefined, undefined, docAnalysis);
    expect(prompt).toContain("DOCUMENT ANALYSIS RESULTS");
    expect(prompt).toContain("EN71.pdf");
    expect(prompt).toContain("score: 90/100");
    expect(prompt).toContain("ground truth");
  });

  it("prompt instructs AI not to re-penalise compliant documents", async () => {
    const { buildRiskAssessmentPrompt } = await import("./domains/ai/aiAnalysisService");
    const product = { productName: "Test Toy", brand: "TestBrand", ageGroup: "3+", targetMarket: "EU", status: "pending" };
    const prompt = buildRiskAssessmentPrompt(product as any, [], null);
    expect(prompt).toContain("do NOT re-penalise");
  });
});

describe("aiAnalysis.getLatest", () => {
  it("returns null when no analysis exists", async () => {
    const { getLatestAiAnalysisByProduct } = await import("./db");
    vi.mocked(getLatestAiAnalysisByProduct).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx("internal_employee"));
    const result = await caller.aiAnalysis.getLatest({ productId: 1 });
    expect(result).toBeUndefined();
  });
});
