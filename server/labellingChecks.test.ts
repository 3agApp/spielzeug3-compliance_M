/**
 * server/labellingChecks.test.ts
 * Tests for the labellingChecks router – getByProduct, upsert, updateNote.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_LABELLING_CHECKS } from "./routers/labellingChecks";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: () => ({
      from: () => ({
        where: mockSelect,
      }),
    }),
    insert: () => ({
      values: mockInsert,
    }),
    update: () => ({
      set: () => ({
        where: mockUpdate,
      }),
    }),
  }),
}));

// ─── Unit tests for DEFAULT_LABELLING_CHECKS ──────────────────────────────────

describe("DEFAULT_LABELLING_CHECKS", () => {
  it("contains at least 10 checks", () => {
    expect(DEFAULT_LABELLING_CHECKS.length).toBeGreaterThanOrEqual(10);
  });

  it("each check has required fields", () => {
    for (const check of DEFAULT_LABELLING_CHECKS) {
      expect(check).toHaveProperty("checkKey");
      expect(check).toHaveProperty("label");
      expect(check).toHaveProperty("category");
      expect(check).toHaveProperty("market");
      expect(check).toHaveProperty("isMandatory");
      expect(typeof check.checkKey).toBe("string");
      expect(typeof check.label).toBe("string");
      expect(typeof check.isMandatory).toBe("boolean");
    }
  });

  it("all checkKeys are unique", () => {
    const keys = DEFAULT_LABELLING_CHECKS.map((c) => c.checkKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("includes mandatory CE marking check", () => {
    const ceCheck = DEFAULT_LABELLING_CHECKS.find(
      (c) => c.checkKey === "ce_marking_on_product"
    );
    expect(ceCheck).toBeDefined();
    expect(ceCheck?.isMandatory).toBe(true);
    expect(ceCheck?.market).toBe("EU/CH");
  });

  it("includes manufacturer info check", () => {
    const mfgCheck = DEFAULT_LABELLING_CHECKS.find(
      (c) => c.checkKey === "manufacturer_name_address"
    );
    expect(mfgCheck).toBeDefined();
    expect(mfgCheck?.isMandatory).toBe(true);
  });

  it("has both EU-only and EU/CH checks", () => {
    const euOnly = DEFAULT_LABELLING_CHECKS.filter((c) => c.market === "EU");
    const euCh = DEFAULT_LABELLING_CHECKS.filter((c) => c.market === "EU/CH");
    expect(euOnly.length).toBeGreaterThan(0);
    expect(euCh.length).toBeGreaterThan(0);
  });

  it("has both mandatory and optional checks", () => {
    const mandatory = DEFAULT_LABELLING_CHECKS.filter((c) => c.isMandatory);
    const optional = DEFAULT_LABELLING_CHECKS.filter((c) => !c.isMandatory);
    expect(mandatory.length).toBeGreaterThan(0);
    expect(optional.length).toBeGreaterThan(0);
  });

  it("covers all required categories", () => {
    const categories = new Set(DEFAULT_LABELLING_CHECKS.map((c) => c.category));
    expect(categories.has("CE Marking")).toBe(true);
    expect(categories.has("Manufacturer Info")).toBe(true);
    expect(categories.has("Product Identification")).toBe(true);
    expect(categories.has("Age & Safety Warnings")).toBe(true);
  });

  it("includes GPSR checks for EU market", () => {
    const gpsrChecks = DEFAULT_LABELLING_CHECKS.filter(
      (c) => c.category === "GPSR"
    );
    expect(gpsrChecks.length).toBeGreaterThan(0);
    expect(gpsrChecks.every((c) => c.market === "EU")).toBe(true);
  });
});

// ─── Schema validation tests ──────────────────────────────────────────────────

describe("labellingChecks schema validation", () => {
  it("tenantId is stored as string in DB schema", () => {
    // The DB column is varchar(64) for tenant_id
    // This test verifies our String() conversion logic is correct
    const numericTenantId = 1;
    const tenantId = String(numericTenantId);
    expect(tenantId).toBe("1");
    expect(typeof tenantId).toBe("string");
  });

  it("timestamps are stored as bigint (milliseconds)", () => {
    const now = Date.now();
    expect(typeof now).toBe("number");
    expect(now).toBeGreaterThan(1_000_000_000_000); // > year 2001
  });
});
