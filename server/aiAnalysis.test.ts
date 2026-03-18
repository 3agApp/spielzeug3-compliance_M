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
    const result = await caller.aiAnalysis.saveApiKey({ apiKey: "sk-test-1234567890" });
    expect(result.success).toBe(true);
  });

  it("allows compliance_manager to save API key", async () => {
    const caller = appRouter.createCaller(makeCtx("compliance_manager"));
    const result = await caller.aiAnalysis.saveApiKey({ apiKey: "sk-test-1234567890" });
    expect(result.success).toBe(true);
  });

  it("rejects supplier from saving API key", async () => {
    const caller = appRouter.createCaller(makeSupplierCtx());
    await expect(caller.aiAnalysis.saveApiKey({ apiKey: "sk-test-1234567890" })).rejects.toThrow();
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
    vi.mocked(getSystemSetting).mockResolvedValue({
      id: 1,
      settingKey: "openai_api_key",
      settingValue: "sk-proj-abcdefghijklmnop1234",
      isEncrypted: true,
      updatedByUserId: 1,
      updatedAt: new Date(),
      createdAt: new Date(),
    });

    const caller = appRouter.createCaller(makeCtx("administrator"));
    const result = await caller.aiAnalysis.getApiKeyStatus();
    expect(result.configured).toBe(true);
    expect(result.maskedKey).toBeTruthy();
    // Should not expose the full key
    expect(result.maskedKey).not.toBe("sk-proj-abcdefghijklmnop1234");
    expect(result.maskedKey).toContain("*");
  });
});

describe("aiAnalysis.analyzeProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws BAD_REQUEST when no API key configured", async () => {
    const { getSystemSetting } = await import("./db");
    vi.mocked(getSystemSetting).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx("compliance_manager"));
    await expect(caller.aiAnalysis.analyzeProduct({ productId: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
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

describe("aiAnalysis.getLatest", () => {
  it("returns null when no analysis exists", async () => {
    const { getLatestAiAnalysisByProduct } = await import("./db");
    vi.mocked(getLatestAiAnalysisByProduct).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx("internal_employee"));
    const result = await caller.aiAnalysis.getLatest({ productId: 1 });
    expect(result).toBeUndefined();
  });
});
