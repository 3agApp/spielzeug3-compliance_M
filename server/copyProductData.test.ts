/**
 * server/copyProductData.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for the copyProductDataService.
 *
 * Mock strategy: use `getTableName` from drizzle-orm to identify tables by
 * their actual string name, and use per-table call counters to distinguish
 * source vs. per-target queries.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";

vi.mock("../server/db", () => ({ getDb: vi.fn() }));
vi.mock("../server/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/shared")>();
  return { ...actual, requireRole: vi.fn() };
});

import { getDb } from "../server/db";
import { copyProductDataService } from "../server/domains/products/copyProductDataService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TENANT_ID = 1;

function makeUser(role = "compliance_manager") {
  return { complianceRole: role, tenantId: TENANT_ID, id: 1, openId: "u1", name: "Test" } as any;
}

function makeProduct(id: number, name: string, batchInfo: any = null) {
  return { id, productName: name, internalArticleNumber: `ART-${id}`, tenantId: TENANT_ID, batchInfo };
}

function makeSafetyEntry(productId: number) {
  return {
    id: productId * 10, productId,
    safetyText: "Achtung", warningText: "Gefahr", ageGrading: "3+",
    materialInformation: "ABS", usageRestrictions: null, safetyNotes: null, safetyImages: null,
  };
}

function makeDocument(productId: number, type = "test_report", fileName?: string) {
  return {
    id: productId * 100, productId, documentType: type,
    fileName: fileName ?? `report-${productId}.pdf`,
    fileUrl: `https://s3.example.com/${productId}.pdf`,
    fileKey: `docs/${productId}.pdf`,
    mimeType: "application/pdf", fileSizeBytes: 1234,
    version: 1, isArchived: false, publicDownload: false,
    includeInAiAnalysis: true, expiryDate: null, reviewStatus: "approved",
  };
}

function makeComponent(productId: number) {
  return {
    id: productId * 1000, productId, name: "Holzrad", description: "Massivholzrad",
    materialType: "wood", supplierName: "Holz GmbH", partNumber: "HW-001",
    sortOrder: 0, active: true,
  };
}

function makeLabellingCheck(productId: number, checkKey = "ce_mark") {
  return {
    id: productId * 10000, productId, tenantId: String(TENANT_ID),
    checkKey, label: "CE-Kennzeichnung", category: "general",
    market: "EU/CH", isMandatory: true, checked: true, notes: "Vorhanden",
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}

function makeRequirement(productId: number, type = "test_report") {
  return {
    id: productId * 100000, productId, requirementType: type,
    required: true, isMissing: false, status: "provided",
    note: "Prüfbericht liegt vor", sourceSystem: "manual",
  };
}

/**
 * Build a mock DB where each table has a queue of responses.
 * Each call to .where() on a given table pops the next response from that table's queue.
 */
function buildQueueDb(queues: Record<string, any[][]>) {
  const inserts: any[] = [];
  const updates: any[] = [];
  const counters: Record<string, number> = {};

  const db: any = {
    select: (_fields?: any) => ({
      from: (table: any) => {
        const name = getTableName(table);
        return {
          where: (_cond?: any) => {
            const idx = counters[name] ?? 0;
            counters[name] = idx + 1;
            const queue = queues[name] ?? [];
            return Promise.resolve(queue[idx] ?? []);
          },
        };
      },
    }),
    update: (_table: any) => ({
      set: (data: any) => {
        updates.push(data);
        return { where: () => Promise.resolve() };
      },
    }),
    insert: (_table: any) => ({
      values: (vals: any) => {
        inserts.push(vals);
        return { $returningId: vi.fn().mockResolvedValue([{ id: 9999 }]) };
      },
    }),
  };

  return { db, inserts, updates };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("copyProductDataService.preview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns available categories with correct counts", async () => {
    const source = makeProduct(1, "Tigerbox Touch Plus Gelb");

    // preview: 1 products query, then Promise.all with 5 queries
    const { db } = buildQueueDb({
      products: [[source]],
      product_safety_entries: [[makeSafetyEntry(1)]],
      documents: [[makeDocument(1, "test_report"), makeDocument(1, "certificate")]],
      product_components: [[makeComponent(1)]],
      product_labelling_checks: [[makeLabellingCheck(1, "ce_mark"), makeLabellingCheck(1, "age_grading")]],
      missing_requirements: [[makeRequirement(1, "test_report")]],
    });
    vi.mocked(getDb).mockResolvedValue(db);

    const result = await copyProductDataService.preview(makeUser(), 1);

    expect(result.sourceProduct.id).toBe(1);
    expect(result.sourceProduct.name).toBe("Tigerbox Touch Plus Gelb");

    const cat = (key: string) => result.availableCategories.find((c) => c.key === key);
    expect(cat("safety")?.count).toBe(1);
    expect(cat("documents")?.count).toBe(2);
    expect(cat("components")?.count).toBe(1);
    expect(cat("labelling")?.count).toBe(2);
    expect(cat("requirements")?.count).toBe(1);
  });

  it("throws NOT_FOUND if source product does not exist", async () => {
    const { db } = buildQueueDb({ products: [[]] });
    vi.mocked(getDb).mockResolvedValue(db);

    await expect(copyProductDataService.preview(makeUser(), 999)).rejects.toThrow(/not found/i);
  });

  it("reports batchInfo count as 1 when product has batchInfo", async () => {
    const source = makeProduct(1, "Tigerbox", { batchNumber: "B-001" });
    const { db } = buildQueueDb({
      products: [[source]],
      product_safety_entries: [[]], documents: [[]], product_components: [[]], product_labelling_checks: [[]], missing_requirements: [[]],
    });
    vi.mocked(getDb).mockResolvedValue(db);

    const result = await copyProductDataService.preview(makeUser(), 1);
    expect(result.availableCategories.find((c) => c.key === "batchInfo")?.count).toBe(1);
  });
});

describe("copyProductDataService.execute – safety data", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts new safety entry when target has none", async () => {
    const source = makeProduct(1, "Tigerbox Touch Plus Gelb");
    const target = makeProduct(2, "Tigerbox Touch Plus Blau");

    // execute sequence:
    // products[0] = validate source → [source]
    // products[1] = validate targets (inArray) → [target]
    // Promise.all: product_safety_entries[0]=source safety, docs[0]=[], comps[0]=[], labels[0]=[], reqs[0]=[]
    // per-target: product_safety_entries[1] = existing on target → []
    const { db, inserts } = buildQueueDb({
      products: [[source], [target]],
      product_safety_entries: [[makeSafetyEntry(1)], []],  // source, then per-target check
      documents: [[]], product_components: [[]], product_labelling_checks: [[]], missing_requirements: [[]],
    });
    vi.mocked(getDb).mockResolvedValue(db);

    const results = await copyProductDataService.execute(makeUser(), {
      sourceProductId: 1, targetProductIds: [2], categories: ["safety"], overwrite: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0].copied.safety).toBe(1);
    expect(inserts.some((i) => i.productId === 2)).toBe(true);
  });

  it("skips safety when target already has entry and overwrite=false", async () => {
    const source = makeProduct(1, "Tigerbox Touch Plus Gelb");
    const target = makeProduct(2, "Tigerbox Touch Plus Blau");

    const { db, inserts, updates } = buildQueueDb({
      products: [[source], [target]],
      product_safety_entries: [[makeSafetyEntry(1)], [{ id: 20 }]],
      documents: [[]], product_components: [[]], product_labelling_checks: [[]], missing_requirements: [[]],
    });
    vi.mocked(getDb).mockResolvedValue(db);

    const results = await copyProductDataService.execute(makeUser(), {
      sourceProductId: 1, targetProductIds: [2], categories: ["safety"], overwrite: false,
    });

    expect(results[0].skipped.safety).toBe(1);
    expect(results[0].copied.safety).toBeUndefined();
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("overwrites safety when target already has entry and overwrite=true", async () => {
    const source = makeProduct(1, "Tigerbox Touch Plus Gelb");
    const target = makeProduct(2, "Tigerbox Touch Plus Blau");

    const { db, updates } = buildQueueDb({
      products: [[source], [target]],
      product_safety_entries: [[makeSafetyEntry(1)], [{ id: 20 }]],
      documents: [[]], product_components: [[]], product_labelling_checks: [[]], missing_requirements: [[]],
    });
    vi.mocked(getDb).mockResolvedValue(db);

    const results = await copyProductDataService.execute(makeUser(), {
      sourceProductId: 1, targetProductIds: [2], categories: ["safety"], overwrite: true,
    });

    expect(results[0].copied.safety).toBe(1);
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0]).toMatchObject({ safetyText: "Achtung" });
  });
});

describe("copyProductDataService.execute – documents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("copies documents that do not yet exist on target", async () => {
    const source = makeProduct(1, "Tigerbox Touch Plus Gelb");
    const target = makeProduct(2, "Tigerbox Touch Plus Blau");
    const sourceDocs = [
      makeDocument(1, "test_report", "report.pdf"),
      makeDocument(1, "certificate", "cert.pdf"),
    ];

    const { db, inserts } = buildQueueDb({
      products: [[source], [target]],
      product_safety_entries: [[]], product_components: [[]], product_labelling_checks: [[]], missing_requirements: [[]],
      documents: [sourceDocs, []],  // source docs, then existing on target
    });
    vi.mocked(getDb).mockResolvedValue(db);

    const results = await copyProductDataService.execute(makeUser(), {
      sourceProductId: 1, targetProductIds: [2], categories: ["documents"], overwrite: false,
    });

    expect(results[0].copied.documents).toBe(2);
    expect(inserts).toHaveLength(2);
    expect(inserts.every((i) => i.productId === 2)).toBe(true);
  });

  it("skips document if same type+filename already exists and overwrite=false", async () => {
    const source = makeProduct(1, "Tigerbox Touch Plus Gelb");
    const target = makeProduct(2, "Tigerbox Touch Plus Blau");
    const sourceDoc = makeDocument(1, "test_report", "report.pdf");
    const existingDoc = { documentType: "test_report", fileName: "report.pdf" };

    const { db, inserts } = buildQueueDb({
      products: [[source], [target]],
      product_safety_entries: [[]], product_components: [[]], product_labelling_checks: [[]], missing_requirements: [[]],
      documents: [[sourceDoc], [existingDoc]],
    });
    vi.mocked(getDb).mockResolvedValue(db);

    const results = await copyProductDataService.execute(makeUser(), {
      sourceProductId: 1, targetProductIds: [2], categories: ["documents"], overwrite: false,
    });

    expect(results[0].skipped.documents).toBe(1);
    expect(results[0].copied.documents).toBe(0);
    expect(inserts).toHaveLength(0);
  });
});

describe("copyProductDataService.execute – batchInfo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("copies batchInfo when target has none", async () => {
    const batchData = { batchNumber: "B-2026-001", productionDate: "2026-01-01" };
    const source = makeProduct(1, "Tigerbox Touch Plus Gelb", batchData);
    const target = makeProduct(2, "Tigerbox Touch Plus Blau", null);

    let capturedBatchInfo: any = null;

    // products: validate source, validate targets, per-target batchInfo check
    const { db } = buildQueueDb({
      products: [[source], [target], [{ batchInfo: null }]],
      product_safety_entries: [[]], documents: [[]], product_components: [[]], product_labelling_checks: [[]], missing_requirements: [[]],
    });

    // Override update to capture batchInfo
    db.update = () => ({
      set: (data: any) => {
        capturedBatchInfo = data.batchInfo;
        return { where: () => Promise.resolve() };
      },
    });

    vi.mocked(getDb).mockResolvedValue(db);

    const results = await copyProductDataService.execute(makeUser(), {
      sourceProductId: 1, targetProductIds: [2], categories: ["batchInfo"], overwrite: false,
    });

    expect(results[0].copied.batchInfo).toBe(1);
    expect(capturedBatchInfo).toEqual(batchData);
  });

  it("skips batchInfo when target already has it and overwrite=false", async () => {
    const batchData = { batchNumber: "B-2026-001" };
    const source = makeProduct(1, "Tigerbox Touch Plus Gelb", batchData);
    const target = makeProduct(2, "Tigerbox Touch Plus Blau", { batchNumber: "B-2025-999" });

    const { db } = buildQueueDb({
      products: [[source], [target], [{ batchInfo: { batchNumber: "B-2025-999" } }]],
      product_safety_entries: [[]], documents: [[]], product_components: [[]], product_labelling_checks: [[]], missing_requirements: [[]],
    });
    vi.mocked(getDb).mockResolvedValue(db);

    const results = await copyProductDataService.execute(makeUser(), {
      sourceProductId: 1, targetProductIds: [2], categories: ["batchInfo"], overwrite: false,
    });

    expect(results[0].skipped.batchInfo).toBe(1);
    expect(results[0].copied.batchInfo).toBeUndefined();
  });
});

describe("copyProductDataService.execute – multiple targets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns one result per target product", async () => {
    const source = makeProduct(1, "Tigerbox Touch Plus Gelb");
    const targets = [makeProduct(2, "Blau"), makeProduct(3, "Rot"), makeProduct(4, "Grün")];

    const { db } = buildQueueDb({
      products: [[source], targets],
      product_safety_entries: [[], [], [], []],  // source + 3 per-target checks
      documents: [[]], product_components: [[]], product_labelling_checks: [[]], missing_requirements: [[]],
    });
    vi.mocked(getDb).mockResolvedValue(db);

    const results = await copyProductDataService.execute(makeUser(), {
      sourceProductId: 1, targetProductIds: [2, 3, 4], categories: ["safety"], overwrite: false,
    });

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.targetProductId)).toEqual([2, 3, 4]);
  });

  it("rejects if source product not found", async () => {
    const { db } = buildQueueDb({ products: [[]] });
    vi.mocked(getDb).mockResolvedValue(db);

    await expect(
      copyProductDataService.execute(makeUser(), {
        sourceProductId: 999, targetProductIds: [1], categories: ["safety"], overwrite: false,
      })
    ).rejects.toThrow(/not found/i);
  });
});
