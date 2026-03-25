import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ────────────────────────────────────────────────────────────────
vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("../server/tenantDb", () => ({
  getTenantById: vi.fn().mockResolvedValue({
    id: 1,
    slug: "spielzeug3",
    name: "Spielzeug 3 AG",
    plan: "professional",
    modulesEnabled: ["compliance", "seal"],
    isActive: true,
    primaryColor: "#C8102E",
    logoUrl: null,
    contactEmail: "info@spielzeug3.ch",
    createdAt: new Date("2024-01-01"),
  }),
  getTenantBySlug: vi.fn().mockResolvedValue({
    id: 1,
    slug: "spielzeug3",
    name: "Spielzeug 3 AG",
  }),
  listTenants: vi.fn().mockResolvedValue([]),
  createTenant: vi.fn().mockResolvedValue({ id: 2, slug: "new-tenant" }),
  updateTenant: vi.fn().mockResolvedValue(undefined),
  getTenantStats: vi.fn().mockResolvedValue({ productCount: 5, supplierCount: 2, userCount: 3 }),
  ensureProductPublicUuid: vi.fn().mockResolvedValue({
    publicUuid: "550e8400-e29b-41d4-a716-446655440000",
    qrCodeUrl: "https://cdn.example.com/qr/test.png",
    qrCodeSvgUrl: "https://cdn.example.com/qr/test.svg",
  }),
}));

// Note: sealUtils is NOT mocked here so we test the real implementation

// ─── Tests: sealUtils ────────────────────────────────────────────────────────
describe("sealUtils", () => {
  it("getPublicProductUrl builds correct URL", async () => {
    const { getPublicProductUrl } = await import("../server/sealUtils");
    const url = getPublicProductUrl("test-uuid-123");
    expect(url).toContain("test-uuid-123");
    expect(url).toMatch(/^https?:\/\//);
  });

  it("getSealStatus returns verified for approved product", async () => {
    const { getSealStatus } = await import("../server/sealUtils");
    const status = getSealStatus({ status: "approved", completenessScore: "95" });
    expect(status).toBe("verified");
  });

  it("getSealStatus returns in_progress for submitted product with score > 0", async () => {
    const { getSealStatus } = await import("../server/sealUtils");
    // submitted status is not 'open'/'draft' → in_progress
    const status = getSealStatus({ status: "submitted", completenessScore: "60" });
    expect(status).toBe("in_progress");
  });

  it("getSealStatus returns not_verified for open product with score 0", async () => {
    const { getSealStatus } = await import("../server/sealUtils");
    // open + score 0 → not_verified
    const status = getSealStatus({ status: "open", completenessScore: "0" });
    expect(status).toBe("not_verified");
  });

  it("getSealStatus returns in_progress for in_progress status with score > 0", async () => {
    const { getSealStatus } = await import("../server/sealUtils");
    // in_progress status → in_progress (not open/draft)
    const status = getSealStatus({ status: "in_progress", completenessScore: "75" });
    expect(status).toBe("in_progress");
  });
});

// ─── Tests: tenantDb helpers (mocked) ────────────────────────────────────────
describe("tenantDb", () => {
  it("getTenantById returns tenant with correct fields", async () => {
    const { getTenantById } = await import("../server/tenantDb");
    const tenant = await getTenantById(1);
    expect(tenant).toBeDefined();
    expect(tenant?.slug).toBe("spielzeug3");
    expect(tenant?.name).toBe("Spielzeug 3 AG");
    expect(tenant?.primaryColor).toBe("#C8102E");
  });

  it("getTenantBySlug returns tenant for known slug", async () => {
    const { getTenantBySlug } = await import("../server/tenantDb");
    const tenant = await getTenantBySlug("spielzeug3");
    expect(tenant).toBeDefined();
    expect(tenant?.id).toBe(1);
  });

  it("ensureProductPublicUuid returns uuid and qr urls", async () => {
    const { ensureProductPublicUuid } = await import("../server/tenantDb");
    const result = await ensureProductPublicUuid(1, "spielzeug3");
    expect(result.publicUuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.qrCodeUrl).toBeTruthy();
    expect(result.qrCodeSvgUrl).toBeTruthy();
  });

  it("getTenantStats returns product/supplier/user counts", async () => {
    const { getTenantStats } = await import("../server/tenantDb");
    const stats = await getTenantStats(1);
    expect(typeof stats.productCount).toBe("number");
    expect(typeof stats.supplierCount).toBe("number");
    expect(typeof stats.userCount).toBe("number");
  });
});

// ─── Tests: Tenant module guard logic ────────────────────────────────────────
describe("Tenant module guard", () => {
  it("seal module is included in professional plan modules", async () => {
    const { getTenantById } = await import("../server/tenantDb");
    const tenant = await getTenantById(1);
    const modules = (tenant?.modulesEnabled as string[]) ?? [];
    expect(modules).toContain("seal");
    expect(modules).toContain("compliance");
  });

  it("public product URL uses correct domain format", async () => {
    const { getPublicProductUrl } = await import("../server/sealUtils");
    const url = getPublicProductUrl("abc-123");
    // Should be a valid URL with the uuid
    expect(() => new URL(url)).not.toThrow();
    expect(url).toContain("abc-123");
  });
});
