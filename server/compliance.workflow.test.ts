import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]> & {
  complianceRole?: string;
  supplierId?: number;
};

function createCtx(
  role: string,
  supplierId?: number
): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: role === "administrator" ? "admin" : "user",
    complianceRole: role as any,
    supplierId,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: any) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createCtx("internal_employee");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
  });
});

describe("auth.me", () => {
  it("returns the current user when authenticated", async () => {
    const { ctx } = createCtx("compliance_manager");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect((result as any)?.complianceRole).toBe("compliance_manager");
  });

  it("returns null when not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("products.list – role-based access", () => {
  it("internal_employee can call products.list", async () => {
    const { ctx } = createCtx("internal_employee");
    const caller = appRouter.createCaller(ctx);
    // Should not throw FORBIDDEN
    await expect(caller.products.list({})).resolves.toBeDefined();
  });

  it("supplier without supplierId gets empty list", async () => {
    const { ctx } = createCtx("supplier", undefined);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.products.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

describe("products.approve – role enforcement", () => {
  it("internal_employee cannot approve products", async () => {
    const { ctx } = createCtx("internal_employee");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.products.approve({ productId: 9999, note: "test" })
    ).rejects.toThrow();
  });
});

describe("products.reject – role enforcement", () => {
  it("supplier cannot reject products", async () => {
    const { ctx } = createCtx("supplier", 1);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.products.reject({ productId: 9999, note: "test reason" })
    ).rejects.toThrow();
  });
});

describe("suppliers.list – role-based access", () => {
  it("internal_employee can list all suppliers", async () => {
    const { ctx } = createCtx("internal_employee");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.suppliers.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("notifications.list", () => {
  it("authenticated user can list notifications", async () => {
    const { ctx } = createCtx("internal_employee");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notifications.list();
    expect(Array.isArray(result)).toBe(true);
  });
});
