/**
 * server/documentVersioning.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for the document versioning feature:
 * - getDocumentsByProduct filters out archived documents by default
 * - getDocumentsByProduct includes archived documents when includeArchived=true
 * - getArchivedDocumentVersions returns only archived docs of a given type
 * - archiveDocument sets isArchived=true and replacedByDocumentId
 * - documentService.upload archives the previous active document
 * - documentService.listArchivedVersions returns archived docs
 * - documents.listArchivedVersions tRPC endpoint is accessible
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock db module ───────────────────────────────────────────────────────────

const mockDocuments: any[] = [];

vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    getDocumentsByProduct: vi.fn(async (productId: number, includeArchived = false) => {
      const docs = mockDocuments.filter((d) => d.productId === productId);
      return includeArchived ? docs : docs.filter((d) => !d.isArchived);
    }),
    getDocumentById: vi.fn(async (id: number) => mockDocuments.find((d) => d.id === id) ?? null),
    getArchivedDocumentVersions: vi.fn(async (productId: number, documentType: string) => {
      return mockDocuments.filter(
        (d) => d.productId === productId && d.documentType === documentType && d.isArchived
      );
    }),
    archiveDocument: vi.fn(async (id: number, replacedByDocumentId: number) => {
      const doc = mockDocuments.find((d) => d.id === id);
      if (doc) {
        doc.isArchived = true;
        doc.replacedByDocumentId = replacedByDocumentId;
      }
    }),
    createDocument: vi.fn(async (data: any) => {
      const newDoc = { ...data, id: mockDocuments.length + 1, isArchived: false };
      mockDocuments.push(newDoc);
      return { insertId: newDoc.id };
    }),
    getProductById: vi.fn(async (id: number) => ({
      id,
      supplierId: 1,
      supplierConfirmedAt: null,
    })),
    getMissingRequirementsByProduct: vi.fn(async () => []),
    updateProduct: vi.fn(async () => {}),
    updateMissingRequirement: vi.fn(async () => {}),
    createAuditLog: vi.fn(async () => {}),
    updateDocument: vi.fn(async () => {}),
    deleteDocument: vi.fn(async (id: number) => {
      const idx = mockDocuments.findIndex((d) => d.id === id);
      if (idx !== -1) mockDocuments.splice(idx, 1);
    }),
  };
});

vi.mock("./storage", () => ({
  storagePut: vi.fn(async () => ({ url: "https://cdn.example.com/test.pdf", key: "test-key" })),
}));

// Import after mocks are set up
import { getDocumentsByProduct, getArchivedDocumentVersions, archiveDocument } from "./db";
import { documentService } from "./domains/documents/documentService";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      tenantId: 1,
      active: true,
      languagePreference: "de",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

function makeUser(role: string, userId = 1) {
  return {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@test.de`,
    name: `User ${userId}`,
    complianceRole: role,
    supplierId: role === "supplier" ? 1 : null,
    tenantId: 1,
  } as any;
}

beforeEach(() => {
  mockDocuments.length = 0;
  vi.clearAllMocks();
});

// ─── DB helper unit tests ─────────────────────────────────────────────────────

describe("getDocumentsByProduct", () => {
  it("returns only active documents by default", async () => {
    mockDocuments.push(
      { id: 1, productId: 10, documentType: "test_report", isArchived: false, uploadedAt: new Date() },
      { id: 2, productId: 10, documentType: "test_report", isArchived: true, uploadedAt: new Date() }
    );
    const result = await getDocumentsByProduct(10);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("returns all documents when includeArchived=true", async () => {
    mockDocuments.push(
      { id: 1, productId: 10, documentType: "test_report", isArchived: false, uploadedAt: new Date() },
      { id: 2, productId: 10, documentType: "test_report", isArchived: true, uploadedAt: new Date() }
    );
    const result = await getDocumentsByProduct(10, true);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no documents exist", async () => {
    const result = await getDocumentsByProduct(99);
    expect(result).toHaveLength(0);
  });
});

describe("getArchivedDocumentVersions", () => {
  it("returns only archived docs of the specified type", async () => {
    mockDocuments.push(
      { id: 1, productId: 10, documentType: "test_report", isArchived: true, uploadedAt: new Date() },
      { id: 2, productId: 10, documentType: "certificate", isArchived: true, uploadedAt: new Date() },
      { id: 3, productId: 10, documentType: "test_report", isArchived: false, uploadedAt: new Date() }
    );
    const result = await getArchivedDocumentVersions(10, "test_report");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});

describe("archiveDocument", () => {
  it("sets isArchived=true and replacedByDocumentId", async () => {
    mockDocuments.push({ id: 5, productId: 10, isArchived: false, replacedByDocumentId: null });
    await archiveDocument(5, 99);
    const doc = mockDocuments.find((d) => d.id === 5);
    expect(doc?.isArchived).toBe(true);
    expect(doc?.replacedByDocumentId).toBe(99);
  });
});

// ─── documentService tests ────────────────────────────────────────────────────

describe("documentService.upload – version archiving", () => {
  it("creates first document with version 1 (no archiving)", async () => {
    const user = makeUser("supplier");
    const result = await documentService.upload(user, {
      productId: 1,
      documentType: "test_report",
      fileName: "report_v1.pdf",
      fileBase64: Buffer.from("pdf content").toString("base64"),
      mimeType: "application/pdf",
    });
    expect(result.success).toBe(true);
    expect(result.version).toBe(1);
    expect(result.archivedPreviousVersions).toBe(0);
    expect(mockDocuments).toHaveLength(1);
    expect(mockDocuments[0].isArchived).toBe(false);
  });

  it("archives the previous active document when uploading a new version", async () => {
    // Seed an existing active document
    mockDocuments.push({
      id: 1,
      productId: 1,
      documentType: "test_report",
      isArchived: false,
      uploadedAt: new Date(),
    });

    const user = makeUser("administrator");
    const result = await documentService.upload(user, {
      productId: 1,
      documentType: "test_report",
      fileName: "report_v2.pdf",
      fileBase64: Buffer.from("pdf content v2").toString("base64"),
      mimeType: "application/pdf",
    });

    expect(result.success).toBe(true);
    expect(result.archivedPreviousVersions).toBe(1);

    // Old doc should be archived
    const oldDoc = mockDocuments.find((d) => d.id === 1);
    expect(oldDoc?.isArchived).toBe(true);
    expect(oldDoc?.replacedByDocumentId).toBeGreaterThan(0);

    // New doc should be active
    const newDoc = mockDocuments.find((d) => d.fileName === "report_v2.pdf");
    expect(newDoc?.isArchived).toBe(false);
  });

  it("does not archive documents of a different type", async () => {
    mockDocuments.push({
      id: 1,
      productId: 1,
      documentType: "certificate",
      isArchived: false,
      uploadedAt: new Date(),
    });

    const user = makeUser("supplier");
    await documentService.upload(user, {
      productId: 1,
      documentType: "test_report",
      fileName: "report.pdf",
      fileBase64: Buffer.from("pdf").toString("base64"),
      mimeType: "application/pdf",
    });

    // certificate should NOT be archived
    const cert = mockDocuments.find((d) => d.id === 1);
    expect(cert?.isArchived).toBe(false);
  });

  it("version counter reflects all historical versions", async () => {
    // Two archived versions already exist
    mockDocuments.push(
      { id: 1, productId: 1, documentType: "manual", isArchived: true, uploadedAt: new Date() },
      { id: 2, productId: 1, documentType: "manual", isArchived: false, uploadedAt: new Date() }
    );

    const user = makeUser("compliance_manager");
    const result = await documentService.upload(user, {
      productId: 1,
      documentType: "manual",
      fileName: "manual_v3.pdf",
      fileBase64: Buffer.from("manual v3").toString("base64"),
      mimeType: "application/pdf",
    });

    expect(result.version).toBe(3); // 2 existing + 1 new
  });
});

describe("documentService.listArchivedVersions", () => {
  it("returns archived versions for a product and document type", async () => {
    mockDocuments.push(
      { id: 1, productId: 1, documentType: "test_report", isArchived: true, uploadedAt: new Date() },
      { id: 2, productId: 1, documentType: "test_report", isArchived: false, uploadedAt: new Date() }
    );

    const user = makeUser("supplier");
    const result = await documentService.listArchivedVersions(user, 1, "test_report");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("returns empty array when no archived versions exist", async () => {
    mockDocuments.push(
      { id: 1, productId: 1, documentType: "test_report", isArchived: false, uploadedAt: new Date() }
    );

    const user = makeUser("supplier");
    const result = await documentService.listArchivedVersions(user, 1, "test_report");
    expect(result).toHaveLength(0);
  });
});

// ─── tRPC router endpoint tests ───────────────────────────────────────────────

describe("documents.listArchivedVersions tRPC endpoint", () => {
  it("is accessible for supplier role", async () => {
    mockDocuments.push(
      { id: 1, productId: 1, documentType: "test_report", isArchived: true, uploadedAt: new Date() }
    );
    const caller = appRouter.createCaller(makeCtx("supplier"));
    const result = await caller.documents.listArchivedVersions({
      productId: 1,
      documentType: "test_report",
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("is accessible for administrator role", async () => {
    const caller = appRouter.createCaller(makeCtx("administrator"));
    const result = await caller.documents.listArchivedVersions({
      productId: 1,
      documentType: "certificate",
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws when called without authentication", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    });
    await expect(
      caller.documents.listArchivedVersions({ productId: 1, documentType: "test_report" })
    ).rejects.toThrow();
  });
});

// ─── Audit-Log Payload Verknüpfung ───────────────────────────────────────────

describe("documentService.upload – audit log payload with version link", () => {
  it("audit log payload contains previousVersionId when replacing an existing document", async () => {
    // Seed an existing active document with a known id, fileName and version
    mockDocuments.push({
      id: 10,
      productId: 1,
      documentType: "test_report",
      isArchived: false,
      fileName: "report_v1.pdf",
      fileUrl: "https://cdn.example.com/report_v1.pdf",
      version: 1,
      uploadedAt: new Date("2026-01-01T10:00:00Z"),
    });

    // Capture createAuditLog calls
    const { createAuditLog } = await import("./db");
    const auditLogSpy = vi.mocked(createAuditLog);

    const user = makeUser("supplier");
    await documentService.upload(user, {
      productId: 1,
      documentType: "test_report",
      fileName: "report_v2.pdf",
      fileBase64: Buffer.from("v2 content").toString("base64"),
      mimeType: "application/pdf",
    });

    // Find the upload audit log call (not the confirmation_reset one)
    const uploadCall = auditLogSpy.mock.calls.find(
      ([args]) => args.action === "uploaded" || args.action === "operator_document_uploaded"
    );
    expect(uploadCall).toBeDefined();
    const payload = uploadCall![0].payloadSnapshot as any;

    expect(payload.previousVersionId).toBe(10);
    expect(payload.previousFileName).toBe("report_v1.pdf");
    expect(payload.previousVersion).toBe(1);
    expect(payload.previousFileUrl).toBe("https://cdn.example.com/report_v1.pdf");
    expect(payload.version).toBe(2);
    expect(payload.newDocumentId).toBeGreaterThan(0);
  });

  it("audit log payload does NOT contain previousVersionId for first upload", async () => {
    const { createAuditLog } = await import("./db");
    const auditLogSpy = vi.mocked(createAuditLog);

    const user = makeUser("supplier");
    await documentService.upload(user, {
      productId: 1,
      documentType: "certificate",
      fileName: "cert_v1.pdf",
      fileBase64: Buffer.from("cert").toString("base64"),
      mimeType: "application/pdf",
    });

    const uploadCall = auditLogSpy.mock.calls.find(
      ([args]) => args.action === "uploaded" || args.action === "operator_document_uploaded"
    );
    expect(uploadCall).toBeDefined();
    const payload = uploadCall![0].payloadSnapshot as any;

    expect(payload.previousVersionId).toBeUndefined();
    expect(payload.previousFileName).toBeUndefined();
    expect(payload.version).toBe(1);
  });

  it("audit log payload selects the most recent predecessor when multiple active docs exist", async () => {
    // Two active docs of the same type (edge case)
    mockDocuments.push(
      {
        id: 20,
        productId: 1,
        documentType: "manual",
        isArchived: false,
        fileName: "manual_old.pdf",
        fileUrl: "https://cdn.example.com/manual_old.pdf",
        version: 1,
        uploadedAt: new Date("2026-01-01T08:00:00Z"),
      },
      {
        id: 21,
        productId: 1,
        documentType: "manual",
        isArchived: false,
        fileName: "manual_newer.pdf",
        fileUrl: "https://cdn.example.com/manual_newer.pdf",
        version: 2,
        uploadedAt: new Date("2026-02-01T08:00:00Z"),
      }
    );

    const { createAuditLog } = await import("./db");
    const auditLogSpy = vi.mocked(createAuditLog);

    const user = makeUser("administrator");
    await documentService.upload(user, {
      productId: 1,
      documentType: "manual",
      fileName: "manual_v3.pdf",
      fileBase64: Buffer.from("v3").toString("base64"),
      mimeType: "application/pdf",
    });

    const uploadCall = auditLogSpy.mock.calls.find(
      ([args]) => args.action === "uploaded" || args.action === "operator_document_uploaded"
    );
    const payload = uploadCall![0].payloadSnapshot as any;

    // The most recent predecessor (id=21, uploadedAt Feb) should be selected
    expect(payload.previousVersionId).toBe(21);
    expect(payload.previousFileName).toBe("manual_newer.pdf");
  });
});

describe("documentService.delete – audit log payload with version info", () => {
  it("audit log payload contains documentVersion and fileUrl for deleted document", async () => {
    mockDocuments.push({
      id: 30,
      productId: 1,
      documentType: "test_report",
      isArchived: false,
      fileName: "report_to_delete.pdf",
      fileUrl: "https://cdn.example.com/report_to_delete.pdf",
      version: 3,
      uploadedAt: new Date(),
    });

    const { createAuditLog } = await import("./db");
    const auditLogSpy = vi.mocked(createAuditLog);

    const user = makeUser("administrator");
    await documentService.delete(user, {
      documentId: 30,
      productId: 1,
    });

    const deleteCall = auditLogSpy.mock.calls.find(
      ([args]) => args.action === "deleted" || args.action === "operator_document_deleted"
    );
    expect(deleteCall).toBeDefined();
    const payload = deleteCall![0].payloadSnapshot as any;

    expect(payload.documentVersion).toBe(3);
    expect(payload.fileUrl).toBe("https://cdn.example.com/report_to_delete.pdf");
    expect(payload.fileName).toBe("report_to_delete.pdf");
  });
});

// ─── publicDownload toggle tests ──────────────────────────────────────────────

describe("documentService.togglePublicDownload", () => {
  it("sets publicDownload=true and writes audit log", async () => {
    mockDocuments.push({
      id: 50,
      productId: 5,
      documentType: "manual",
      isArchived: false,
      publicDownload: false,
      fileName: "manual.pdf",
      fileUrl: "https://cdn.example.com/manual.pdf",
      version: 1,
      uploadedAt: new Date(),
    });

    const { updateDocument, createAuditLog } = await import("./db");
    const updateSpy = vi.mocked(updateDocument);
    const auditSpy = vi.mocked(createAuditLog);

    const user = makeUser("compliance_manager");
    const result = await documentService.togglePublicDownload(user, {
      documentId: 50,
      publicDownload: true,
    });

    expect(result.success).toBe(true);
    expect(result.publicDownload).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(50, { publicDownload: true });

    const auditCall = auditSpy.mock.calls.find(
      ([args]) => args.action === "document_public_enabled"
    );
    expect(auditCall).toBeDefined();
    const payload = auditCall![0].payloadSnapshot as any;
    expect(payload.documentId).toBe(50);
    expect(payload.publicDownload).toBe(true);
  });

  it("sets publicDownload=false and writes audit log with disabled action", async () => {
    mockDocuments.push({
      id: 51,
      productId: 5,
      documentType: "manual",
      isArchived: false,
      publicDownload: true,
      fileName: "manual_v2.pdf",
      fileUrl: "https://cdn.example.com/manual_v2.pdf",
      version: 2,
      uploadedAt: new Date(),
    });

    const { createAuditLog } = await import("./db");
    const auditSpy = vi.mocked(createAuditLog);

    const user = makeUser("administrator");
    const result = await documentService.togglePublicDownload(user, {
      documentId: 51,
      publicDownload: false,
    });

    expect(result.success).toBe(true);
    expect(result.publicDownload).toBe(false);

    const auditCall = auditSpy.mock.calls.find(
      ([args]) => args.action === "document_public_disabled"
    );
    expect(auditCall).toBeDefined();
  });

  it("throws FORBIDDEN when a supplier tries to toggle publicDownload", async () => {
    const user = makeUser("supplier");
    await expect(
      documentService.togglePublicDownload(user, { documentId: 50, publicDownload: true })
    ).rejects.toThrow();
  });

  it("togglePublicDownload tRPC endpoint is accessible for compliance_manager", async () => {
    mockDocuments.push({
      id: 52,
      productId: 5,
      documentType: "certificate",
      isArchived: false,
      publicDownload: false,
      fileName: "cert.pdf",
      fileUrl: "https://cdn.example.com/cert.pdf",
      version: 1,
      uploadedAt: new Date(),
    });

    const caller = appRouter.createCaller(makeCtx("compliance_manager"));
    const result = await caller.documents.togglePublicDownload({
      documentId: 52,
      publicDownload: true,
    });
    expect(result.success).toBe(true);
    expect(result.publicDownload).toBe(true);
  });
});
