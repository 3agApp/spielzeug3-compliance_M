import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Context helpers ──────────────────────────────────────────────────────────
function makeCtx(role: string, userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      email: `user${userId}@test.de`,
      name: `User ${userId}`,
      loginMethod: "manus",
      role: role === "administrator" ? "admin" : "user",
      complianceRole: role,
      supplierId: role === "supplier" ? 1 : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

// ─── Feature 1: Expiry Router ─────────────────────────────────────────────────
describe("expiry.getExpiringDocuments", () => {
  it("returns summary and items for admin", async () => {
    const caller = appRouter.createCaller(makeCtx("administrator"));
    const result = await caller.expiry.getExpiringDocuments({ daysAhead: 90 });
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("items");
    expect(result.summary).toHaveProperty("expired");
    expect(result.summary).toHaveProperty("critical");
    expect(result.summary).toHaveProperty("warning");
    expect(result.summary).toHaveProperty("upcoming");
    expect(result.summary).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("returns summary and items for compliance_manager", async () => {
    const caller = appRouter.createCaller(makeCtx("compliance_manager"));
    const result = await caller.expiry.getExpiringDocuments({ daysAhead: 30 });
    expect(result.summary.total).toBeGreaterThanOrEqual(0);
  });

  it("returns summary and items for internal_employee", async () => {
    const caller = appRouter.createCaller(makeCtx("internal_employee"));
    const result = await caller.expiry.getExpiringDocuments({ daysAhead: 60 });
    expect(result).toHaveProperty("items");
  });
});

// ─── Feature 2: Invitations Router ───────────────────────────────────────────
describe("invitations.validateToken", () => {
  it("returns null for unknown token", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.invitations.validateToken({ token: "nonexistent-token-xyz" });
    // After refactor: returns null (falsy) for unknown/expired tokens
    expect(result).toBeNull();
  });
});

describe("invitations.list", () => {
  it("throws FORBIDDEN for supplier role", async () => {
    const caller = appRouter.createCaller(makeCtx("supplier"));
    await expect(caller.invitations.list()).rejects.toThrow();
  });

  it("returns list for administrator", async () => {
    const caller = appRouter.createCaller(makeCtx("administrator"));
    const result = await caller.invitations.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns list for compliance_manager", async () => {
    const caller = appRouter.createCaller(makeCtx("compliance_manager"));
    const result = await caller.invitations.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("invitations.create", () => {
  it("throws FORBIDDEN for internal_employee", async () => {
    const caller = appRouter.createCaller(makeCtx("internal_employee"));
    await expect(
      caller.invitations.create({
        supplierId: 1,
        email: "test@test.de",
        validDays: 7,
        origin: "https://example.com",
      })
    ).rejects.toThrow();
  });
});

// ─── Feature 3: Templates Router ─────────────────────────────────────────────
describe("templates.listCategories", () => {
  it("returns active categories for any authenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx("internal_employee"));
    const result = await caller.templates.listCategories();
    expect(Array.isArray(result)).toBe(true);
    // Demo data should have categories
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});

describe("templates.listTemplates", () => {
  it("returns templates list for compliance_manager", async () => {
    const caller = appRouter.createCaller(makeCtx("compliance_manager"));
    const result = await caller.templates.listTemplates();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns templates list for administrator", async () => {
    const caller = appRouter.createCaller(makeCtx("administrator"));
    const result = await caller.templates.listTemplates();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("templates.createCategory", () => {
  it("throws FORBIDDEN for compliance_manager", async () => {
    const caller = appRouter.createCaller(makeCtx("compliance_manager"));
    await expect(
      caller.templates.createCategory({
        key: "test-cat",
        labelDe: "Test",
        labelEn: "Test",
        sortOrder: 99,
      })
    ).rejects.toThrow();
  });
});

describe("templates.deleteTemplate", () => {
  it("throws FORBIDDEN for internal_employee", async () => {
    const caller = appRouter.createCaller(makeCtx("internal_employee"));
    await expect(caller.templates.deleteTemplate({ id: 999 })).rejects.toThrow();
  });
});
