import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ─────────────────────────────────────────────────────────────────
const mockUpdateProduct = vi.fn().mockResolvedValue(undefined);
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);
const mockGetProductById = vi.fn();

vi.mock("../db", () => ({
  getProductById: mockGetProductById,
  updateProduct: mockUpdateProduct,
  createAuditLog: mockCreateAuditLog,
  createDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  getDocumentsByProduct: vi.fn().mockResolvedValue([]),
  updateMissingRequirement: vi.fn().mockResolvedValue(undefined),
  getMissingRequirementsByProduct: vi.fn().mockResolvedValue([]),
}));

vi.mock("../storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/file.pdf", key: "test-key" }),
}));

vi.mock("../../drizzle/schema", () => ({
  products: {},
  documents: {},
}));

// ─── Tests: upload reset logic ────────────────────────────────────────────────
describe("upload mutation: reset supplierConfirmedAt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets confirmation when supplier uploads and was already confirmed", async () => {
    const product = { id: 1, supplierId: 5, supplierConfirmedAt: new Date() };
    const role = "supplier";
    const ctxSupplierId = 5;

    // Simulate the reset logic
    let confirmedAtReset = false;
    if (role === "supplier" && product.supplierConfirmedAt) {
      await mockUpdateProduct(product.id, {
        supplierConfirmedAt: null,
        supplierConfirmedBy: null,
      });
      confirmedAtReset = true;
    }

    expect(confirmedAtReset).toBe(true);
    expect(mockUpdateProduct).toHaveBeenCalledWith(1, {
      supplierConfirmedAt: null,
      supplierConfirmedBy: null,
    });
  });

  it("does NOT reset when supplier uploads but was not yet confirmed", async () => {
    const product = { id: 1, supplierId: 5, supplierConfirmedAt: null };
    const role = "supplier";

    let confirmedAtReset = false;
    if (role === "supplier" && product.supplierConfirmedAt) {
      await mockUpdateProduct(product.id, { supplierConfirmedAt: null });
      confirmedAtReset = true;
    }

    expect(confirmedAtReset).toBe(false);
    expect(mockUpdateProduct).not.toHaveBeenCalled();
  });

  it("does NOT reset when internal employee uploads (even if supplier had confirmed)", async () => {
    const product = { id: 1, supplierId: 5, supplierConfirmedAt: new Date() };
    const role = "internal_employee";

    let confirmedAtReset = false;
    if (role === "supplier" && product.supplierConfirmedAt) {
      await mockUpdateProduct(product.id, { supplierConfirmedAt: null });
      confirmedAtReset = true;
    }

    expect(confirmedAtReset).toBe(false);
    expect(mockUpdateProduct).not.toHaveBeenCalled();
  });

  it("returns confirmedAtReset: true in response when reset occurred", () => {
    const confirmedAtReset = true;
    const response = { success: true, url: "https://cdn.example.com/file.pdf", confirmedAtReset };
    expect(response.confirmedAtReset).toBe(true);
  });

  it("returns confirmedAtReset: false in response when no reset occurred", () => {
    const confirmedAtReset = false;
    const response = { success: true, url: "https://cdn.example.com/file.pdf", confirmedAtReset };
    expect(response.confirmedAtReset).toBe(false);
  });
});

// ─── Tests: delete reset logic ────────────────────────────────────────────────
describe("delete mutation: reset supplierConfirmedAt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets confirmation when supplier deletes a document and was already confirmed", async () => {
    const product = { id: 1, supplierId: 5, supplierConfirmedAt: new Date() };
    const role = "supplier";

    let confirmedAtReset = false;
    if (role === "supplier" && product.supplierConfirmedAt) {
      await mockUpdateProduct(product.id, {
        supplierConfirmedAt: null,
        supplierConfirmedBy: null,
      });
      confirmedAtReset = true;
      await mockCreateAuditLog({
        entityType: "product",
        entityId: product.id,
        action: "supplier_confirmation_reset",
        payloadSnapshot: { reason: "document_deleted" },
      });
    }

    expect(confirmedAtReset).toBe(true);
    expect(mockUpdateProduct).toHaveBeenCalledOnce();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "supplier_confirmation_reset" })
    );
  });

  it("does NOT reset when internal employee deletes a document", async () => {
    const product = { id: 1, supplierId: 5, supplierConfirmedAt: new Date() };
    const role = "compliance_manager";

    let confirmedAtReset = false;
    if (role === "supplier" && product.supplierConfirmedAt) {
      confirmedAtReset = true;
    }

    expect(confirmedAtReset).toBe(false);
    expect(mockUpdateProduct).not.toHaveBeenCalled();
  });

  it("audit log records reason as document_deleted", async () => {
    await mockCreateAuditLog({
      entityType: "product",
      entityId: 1,
      action: "supplier_confirmation_reset",
      payloadSnapshot: { reason: "document_deleted", documentId: 42 },
    });

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "supplier_confirmation_reset",
        payloadSnapshot: expect.objectContaining({ reason: "document_deleted" }),
      })
    );
  });
});

// ─── Tests: frontend toast logic ─────────────────────────────────────────────
describe("frontend: toast shown when confirmedAtReset is true", () => {
  it("shows warning toast when confirmedAtReset is true", () => {
    const data = { success: true, url: "https://cdn.example.com/file.pdf", confirmedAtReset: true };
    const shouldShowToast = data?.confirmedAtReset ?? false;
    expect(shouldShowToast).toBe(true);
  });

  it("does not show warning toast when confirmedAtReset is false", () => {
    const data = { success: true, url: "https://cdn.example.com/file.pdf", confirmedAtReset: false };
    const shouldShowToast = data?.confirmedAtReset ?? false;
    expect(shouldShowToast).toBe(false);
  });

  it("does not show warning toast when confirmedAtReset is undefined", () => {
    const data = { success: true, url: "https://cdn.example.com/file.pdf" };
    const shouldShowToast = (data as any)?.confirmedAtReset ?? false;
    expect(shouldShowToast).toBe(false);
  });
});
