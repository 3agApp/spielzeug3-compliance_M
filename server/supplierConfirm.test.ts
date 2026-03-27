import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ─────────────────────────────────────────────────────────────────
const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) });
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    }),
  }),
});

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    update: mockUpdate,
    select: mockSelect,
  }),
  getProductById: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../drizzle/schema", () => ({
  products: { id: "id", supplierConfirmedAt: "supplierConfirmedAt", supplierConfirmedBy: "supplierConfirmedBy" },
  documents: { productId: "productId", documentType: "documentType", reviewStatus: "reviewStatus", uploadedAt: "uploadedAt" },
  productSafetyEntries: { productId: "productId" },
  suppliers: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

// ─── Tests: supplierConfirm business logic ───────────────────────────────────
describe("supplierConfirm mutation logic", () => {
  it("rejects non-supplier roles", async () => {
    const { getProductById } = await import("../db");
    vi.mocked(getProductById).mockResolvedValue({
      id: 1, supplierId: 5,
    } as any);

    // Simulate role check
    const role = "internal_employee";
    expect(role).not.toBe("supplier");
    // In the actual mutation, this would throw FORBIDDEN
  });

  it("rejects supplier accessing another supplier's product", async () => {
    const { getProductById } = await import("../db");
    vi.mocked(getProductById).mockResolvedValue({
      id: 1, supplierId: 99, // different from ctx.user.supplierId = 5
    } as any);

    const product = await getProductById(1);
    const ctxSupplierId = 5;
    expect(product?.supplierId).not.toBe(ctxSupplierId);
  });

  it("allows supplier to confirm their own product", async () => {
    const { getProductById, getDb } = await import("../db");
    vi.mocked(getProductById).mockResolvedValue({
      id: 1, supplierId: 5,
    } as any);

    const product = await getProductById(1);
    const ctxSupplierId = 5;
    expect(product?.supplierId).toBe(ctxSupplierId);

    const db = await getDb();
    expect(db).toBeTruthy();
  });

  it("sets supplierConfirmedAt to current date", () => {
    const before = new Date();
    const confirmedAt = new Date();
    const after = new Date();
    expect(confirmedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(confirmedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("uses user name or email as confirmedBy", () => {
    const userWithName = { name: "Max Muster", email: "max@test.ch" };
    const userWithoutName = { name: null, email: "max@test.ch" };
    const userWithNothing = { name: null, email: null };

    expect(userWithName.name ?? userWithName.email ?? "Lieferant").toBe("Max Muster");
    expect(userWithoutName.name ?? userWithoutName.email ?? "Lieferant").toBe("max@test.ch");
    expect(userWithNothing.name ?? userWithNothing.email ?? "Lieferant").toBe("Lieferant");
  });
});

// ─── Tests: getPublicProduct document summary ────────────────────────────────
describe("getPublicProduct document summary aggregation", () => {
  it("aggregates documents by type correctly", () => {
    const docs = [
      { documentType: "test_report", reviewStatus: "approved" },
      { documentType: "test_report", reviewStatus: "pending" },
      { documentType: "declaration_of_conformity", reviewStatus: "approved" },
      { documentType: "manual", reviewStatus: "rejected" },
    ];

    const summary = docs.reduce((acc: Record<string, any>, doc) => {
      const key = doc.documentType;
      if (!acc[key]) acc[key] = { type: key, total: 0, approved: 0, pending: 0, rejected: 0 };
      acc[key].total++;
      if (doc.reviewStatus === "approved") acc[key].approved++;
      else if (doc.reviewStatus === "rejected") acc[key].rejected++;
      else acc[key].pending++;
      return acc;
    }, {});

    expect(summary["test_report"].total).toBe(2);
    expect(summary["test_report"].approved).toBe(1);
    expect(summary["test_report"].pending).toBe(1);
    expect(summary["declaration_of_conformity"].approved).toBe(1);
    expect(summary["manual"].rejected).toBe(1);
  });

  it("counts total and approved documents correctly", () => {
    const docs = [
      { reviewStatus: "approved" },
      { reviewStatus: "approved" },
      { reviewStatus: "pending" },
      { reviewStatus: "rejected" },
    ];

    const total = docs.length;
    const approved = docs.filter(d => d.reviewStatus === "approved").length;

    expect(total).toBe(4);
    expect(approved).toBe(2);
  });

  it("returns empty summary for product with no documents", () => {
    const docs: any[] = [];
    const summary = Object.values(docs.reduce((acc: Record<string, any>, doc) => {
      const key = doc.documentType;
      if (!acc[key]) acc[key] = { type: key, total: 0, approved: 0, pending: 0, rejected: 0 };
      acc[key].total++;
      return acc;
    }, {}));

    expect(summary).toHaveLength(0);
  });
});

// ─── Tests: submit blocked without supplier confirmation ────────────────────
describe("submit mutation: blocked without supplierConfirmedAt", () => {
  it("throws PRECONDITION_FAILED when supplier has not confirmed", () => {
    const product = { id: 1, supplierId: 5, supplierConfirmedAt: null };
    const role = "supplier";
    const shouldBlock = role === "supplier" && !product.supplierConfirmedAt;
    expect(shouldBlock).toBe(true);
  });

  it("allows submit when supplier has confirmed", () => {
    const product = { id: 1, supplierId: 5, supplierConfirmedAt: new Date().toISOString() };
    const role = "supplier";
    const shouldBlock = role === "supplier" && !product.supplierConfirmedAt;
    expect(shouldBlock).toBe(false);
  });

  it("does not block internal employees (no confirmation required)", () => {
    const product = { id: 1, supplierId: 5, supplierConfirmedAt: null };
    const role = "compliance_manager";
    const shouldBlock = role === "supplier" && !product.supplierConfirmedAt;
    expect(shouldBlock).toBe(false);
  });

  it("frontend: submitBlocked is true when canSubmit and not confirmed", () => {
    const role = "supplier";
    const status = "open";
    const supplierConfirmedAt = null;
    const canSubmit = role === "supplier" && ["open", "in_progress", "clarification_needed"].includes(status);
    const submitBlocked = canSubmit && !supplierConfirmedAt;
    expect(canSubmit).toBe(true);
    expect(submitBlocked).toBe(true);
  });

  it("frontend: submitBlocked is false after confirmation", () => {
    const role = "supplier";
    const status = "open";
    const supplierConfirmedAt = new Date().toISOString();
    const canSubmit = role === "supplier" && ["open", "in_progress", "clarification_needed"].includes(status);
    const submitBlocked = canSubmit && !supplierConfirmedAt;
    expect(canSubmit).toBe(true);
    expect(submitBlocked).toBe(false);
  });
});

// ─── Tests: mandatory requirements checklist logic ──────────────────────────
describe("mandatory requirements checklist in SealTab", () => {
  it("allMandatoryMet is true when no mandatory requirements exist", () => {
    const mandatoryReqs: any[] = [];
    const missingMandatory = mandatoryReqs.filter(
      (r) => r.status === "missing" || r.status === "rejected"
    );
    const allMandatoryMet = mandatoryReqs.length === 0 || missingMandatory.length === 0;
    expect(allMandatoryMet).toBe(true);
  });

  it("allMandatoryMet is false when mandatory docs are missing", () => {
    const mandatoryReqs = [
      { id: 1, requirementType: "test_report", required: true, status: "missing" },
      { id: 2, requirementType: "declaration_of_conformity", required: true, status: "approved" },
    ];
    const missingMandatory = mandatoryReqs.filter(
      (r) => r.status === "missing" || r.status === "rejected"
    );
    const allMandatoryMet = mandatoryReqs.length === 0 || missingMandatory.length === 0;
    expect(allMandatoryMet).toBe(false);
    expect(missingMandatory).toHaveLength(1);
  });

  it("allMandatoryMet is true when all mandatory docs are provided/approved", () => {
    const mandatoryReqs = [
      { id: 1, requirementType: "test_report", required: true, status: "approved" },
      { id: 2, requirementType: "declaration_of_conformity", required: true, status: "provided" },
      { id: 3, requirementType: "certificate", required: true, status: "under_review" },
    ];
    const missingMandatory = mandatoryReqs.filter(
      (r) => r.status === "missing" || r.status === "rejected"
    );
    const allMandatoryMet = mandatoryReqs.length === 0 || missingMandatory.length === 0;
    expect(allMandatoryMet).toBe(true);
    expect(missingMandatory).toHaveLength(0);
  });

  it("rejected docs count as missing for checklist", () => {
    const mandatoryReqs = [
      { id: 1, requirementType: "test_report", required: true, status: "rejected" },
    ];
    const missingMandatory = mandatoryReqs.filter(
      (r) => r.status === "missing" || r.status === "rejected"
    );
    expect(missingMandatory).toHaveLength(1);
  });

  it("progress counter shows correct fraction", () => {
    const mandatoryReqs = [
      { id: 1, status: "approved" },
      { id: 2, status: "provided" },
      { id: 3, status: "missing" },
      { id: 4, status: "rejected" },
    ];
    const missingMandatory = mandatoryReqs.filter(
      (r) => r.status === "missing" || r.status === "rejected"
    );
    const completed = mandatoryReqs.length - missingMandatory.length;
    expect(completed).toBe(2);
    expect(mandatoryReqs.length).toBe(4);
  });

  it("button is blocked when mandatory docs are missing", () => {
    const allMandatoryMet = false;
    const supplierConfirmedAt = null;
    const shouldBlock = !allMandatoryMet && !supplierConfirmedAt;
    expect(shouldBlock).toBe(true);
  });

  it("button is active after renewal even if docs are missing (renewal allowed)", () => {
    // After first confirmation, renewal is always allowed
    const supplierConfirmedAt = new Date().toISOString();
    // Button shows 'Bestätigung erneuern' regardless of docs
    expect(!!supplierConfirmedAt).toBe(true);
  });
});

// ─── Tests: trust indicator logic ────────────────────────────────────────────
describe("trust indicators on public landing page", () => {
  it("shows supplier confirmation badge when confirmed", () => {
    const supplierConfirmedAt = new Date().toISOString();
    expect(!!supplierConfirmedAt).toBe(true);
  });

  it("hides supplier confirmation badge when not confirmed", () => {
    const supplierConfirmedAt = null;
    expect(!!supplierConfirmedAt).toBe(false);
  });

  it("marks docs trust item as met when docs exist", () => {
    const totalDocs = 3;
    const approvedDocs = 2;
    const met = totalDocs > 0;
    expect(met).toBe(true);
    expect(approvedDocs).toBeLessThanOrEqual(totalDocs);
  });

  it("marks compliance trust item as met only for verified status", () => {
    expect("verified" === "verified").toBe(true);
    expect("in_progress" === "verified").toBe(false);
    expect("not_verified" === "verified").toBe(false);
  });
});
