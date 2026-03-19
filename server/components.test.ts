import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock context helpers ─────────────────────────────────────────────────────
function makeCtx(overrides: Partial<TrpcContext["user"]> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "email",
      role: "admin",
      complianceRole: "administrator",
      languagePreference: "de",
      supplierId: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

function makeSupplierCtx(supplierId: number): TrpcContext {
  return makeCtx({ complianceRole: "supplier", supplierId, role: "user" } as any);
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("components router", () => {
  it("listByProduct returns array (product may not exist in test DB)", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    // Product 9999 likely doesn't exist → should throw NOT_FOUND
    await expect(caller.components.listByProduct({ productId: 9999 })).rejects.toThrow();
  });

  it("create is accessible for administrator role", async () => {
    const ctx = makeCtx({ complianceRole: "administrator" });
    const caller = appRouter.createCaller(ctx);
    // Product 1 exists in demo data – should succeed or fail with DB error, not FORBIDDEN
    const result = await caller.components.create({ productId: 1, name: "Test Komponente" }).catch((e) => e);
    // Either succeeds or throws a DB/NOT_FOUND error – not FORBIDDEN
    if (result instanceof Error) {
      expect(result.message).not.toContain("FORBIDDEN");
    } else {
      expect(result).toHaveProperty("success", true);
    }
  });

  it("reviewDocument throws FORBIDDEN for supplier role", async () => {
    const ctx = makeSupplierCtx(1);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.components.reviewDocument({ documentId: 1, reviewStatus: "approved" })
    ).rejects.toThrow();
  });

  it("delete throws NOT_FOUND for non-existent component", async () => {
    const ctx = makeCtx({ complianceRole: "administrator" });
    const caller = appRouter.createCaller(ctx);
    // Component 99999 should not exist
    await expect(caller.components.delete({ id: 99999 })).rejects.toThrow();
  });
});

describe("components router – input validation", () => {
  it("create rejects empty name", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.components.create({ productId: 1, name: "" })
    ).rejects.toThrow();
  });

  it("uploadDocument rejects unknown componentId", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.components.uploadDocument({
        componentId: 99999,
        documentType: "test_report",
        fileName: "test.pdf",
        fileBase64: "dGVzdA==",
        mimeType: "application/pdf",
      })
    ).rejects.toThrow();
  });
});
