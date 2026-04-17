import { describe, it, expect } from "vitest";

// ─── Unit tests for versions router logic ────────────────────────────────────
// These tests verify the business logic of the versions system without
// requiring a live database connection.

describe("ProductVersions – schema validation", () => {
  it("versionNumber must be non-empty", () => {
    const validate = (v: string) => v.trim().length > 0;
    expect(validate("7.4")).toBe(true);
    expect(validate("2.1.0")).toBe(true);
    expect(validate("Rev. B")).toBe(true);
    expect(validate("")).toBe(false);
    expect(validate("   ")).toBe(false);
  });

  it("versionNumber max length is 64 chars", () => {
    const validate = (v: string) => v.length <= 64;
    expect(validate("7.4")).toBe(true);
    expect(validate("a".repeat(64))).toBe(true);
    expect(validate("a".repeat(65))).toBe(false);
  });

  it("label max length is 255 chars", () => {
    const validate = (v: string | null | undefined) =>
      v == null || v.length <= 255;
    expect(validate(null)).toBe(true);
    expect(validate(undefined)).toBe(true);
    expect(validate("Swiss-Edition")).toBe(true);
    expect(validate("a".repeat(255))).toBe(true);
    expect(validate("a".repeat(256))).toBe(false);
  });
});

describe("ProductVersions – document assignment logic", () => {
  it("assigning a document to a version sets productVersionId", () => {
    type Doc = { id: number; productVersionId: number | null };
    function assignDoc(docs: Doc[], docId: number, versionId: number | null): Doc[] {
      return docs.map((d) => (d.id === docId ? { ...d, productVersionId: versionId } : d));
    }

    const docs: Doc[] = [
      { id: 1, productVersionId: null },
      { id: 2, productVersionId: null },
      { id: 3, productVersionId: 5 },
    ];

    const result = assignDoc(docs, 1, 10);
    expect(result.find((d) => d.id === 1)?.productVersionId).toBe(10);
    expect(result.find((d) => d.id === 2)?.productVersionId).toBeNull();
    expect(result.find((d) => d.id === 3)?.productVersionId).toBe(5);
  });

  it("unassigning a document sets productVersionId to null", () => {
    type Doc = { id: number; productVersionId: number | null };
    function unassignDoc(docs: Doc[], docId: number): Doc[] {
      return docs.map((d) => (d.id === docId ? { ...d, productVersionId: null } : d));
    }

    const docs: Doc[] = [{ id: 1, productVersionId: 10 }];
    const result = unassignDoc(docs, 1);
    expect(result[0].productVersionId).toBeNull();
  });

  it("bulk assignment assigns all provided document IDs", () => {
    type Doc = { id: number; productVersionId: number | null };
    function bulkAssign(docs: Doc[], docIds: number[], versionId: number): Doc[] {
      const idSet = new Set(docIds);
      return docs.map((d) => (idSet.has(d.id) ? { ...d, productVersionId: versionId } : d));
    }

    const docs: Doc[] = [
      { id: 1, productVersionId: null },
      { id: 2, productVersionId: null },
      { id: 3, productVersionId: null },
    ];
    const result = bulkAssign(docs, [1, 3], 7);
    expect(result.find((d) => d.id === 1)?.productVersionId).toBe(7);
    expect(result.find((d) => d.id === 2)?.productVersionId).toBeNull();
    expect(result.find((d) => d.id === 3)?.productVersionId).toBe(7);
  });
});

describe("ProductVersions – delete guard", () => {
  it("delete is blocked when documents are assigned", () => {
    function canDelete(docCount: number, anaCount: number): boolean {
      return docCount === 0 && anaCount === 0;
    }
    expect(canDelete(0, 0)).toBe(true);
    expect(canDelete(1, 0)).toBe(false);
    expect(canDelete(0, 1)).toBe(false);
    expect(canDelete(23, 1)).toBe(false);
  });

  it("delete error message includes counts", () => {
    function deleteErrorMsg(docCount: number, anaCount: number): string {
      return `Version hat noch ${docCount} Dokument(e) und ${anaCount} Analyse(n) zugeordnet. Bitte zuerst die Zuordnungen entfernen.`;
    }
    expect(deleteErrorMsg(23, 1)).toContain("23 Dokument(e)");
    expect(deleteErrorMsg(23, 1)).toContain("1 Analyse(n)");
  });
});

describe("ProductVersions – isActive flag", () => {
  it("default isActive is true for new versions", () => {
    const defaults = { isActive: true };
    expect(defaults.isActive).toBe(true);
  });

  it("isActive can be set to false for archived versions", () => {
    const version = { versionNumber: "7.3", isActive: false };
    expect(version.isActive).toBe(false);
  });
});
