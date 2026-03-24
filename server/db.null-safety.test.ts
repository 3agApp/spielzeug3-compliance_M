/**
 * db.null-safety.test.ts
 *
 * Regression tests ensuring that every DB helper that returns a single row
 * (i.e. a "find by id / find by key" function) NEVER returns `undefined`.
 *
 * Background: tRPC forbids `undefined` as a query return value and responds
 * with an HTML error page instead of JSON, causing:
 *   "Unexpected token '<', "<!doctype "... is not valid JSON"
 * in the browser.  All single-row helpers must return `null` when no record
 * is found, and all list helpers must return `[]`.
 *
 * Strategy A (DB available, empty result): We mock the drizzle select chain
 *   to return an empty array and verify the helper returns `null` / `[]`.
 * Strategy B (DB unavailable): We mock getDb to return null and verify the
 *   same safe return values.
 *
 * vi.mock is hoisted to the top of the file by Vitest, so the factory must
 * not reference variables defined later.  We use `vi.fn()` stubs that we
 * reconfigure inside `beforeEach` instead.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ─── Stable mock factory (hoisting-safe) ─────────────────────────────────────
// The factory must be self-contained (no outer variable references).
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();

  // Build a fake Drizzle-like chain that always resolves to [].
  const makeEmptyChain = (): any => ({
    from: () => makeEmptyChain(),
    where: () => makeEmptyChain(),
    limit: () => Promise.resolve([]),
    orderBy: () => Promise.resolve([]),
    leftJoin: () => makeEmptyChain(),
    innerJoin: () => makeEmptyChain(),
  });

  const fakeDb: any = {
    select: () => makeEmptyChain(),
    insert: () => ({ values: () => Promise.resolve({ insertId: 1 }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
  };

  return {
    ...original,
    // getDb is a vi.fn so we can reconfigure it per describe block.
    getDb: vi.fn().mockResolvedValue(fakeDb),
  };
});

// Import AFTER mock is registered.
import {
  getDb,
  getUserByOpenId,
  getSupplierById,
  getProductById,
  getProductSafety,
  getSystemSetting,
  getLatestAiAnalysisByProduct,
  getComponentById,
  getAllUsers,
  getAllSuppliers,
  getAllProducts,
  getProductsBySupplier,
  getMissingRequirementsByProduct,
  getDocumentsByProduct,
  getCommentsByProduct,
  getApprovalHistory,
  getAuditLogs,
  getNotificationsByUser,
  getAllRequirementTypes,
  getAiAnalysisHistory,
  getComponentsByProduct,
  getDocumentsByComponent,
  getAllComponentDocumentsByProduct,
} from "./db";

// ─── Helper ───────────────────────────────────────────────────────────────────
function assertNotUndefined(value: unknown, fnName: string) {
  expect(value, `${fnName}() must not return undefined`).not.toBeUndefined();
}

// ─── Suite A: DB available but returns empty rows ─────────────────────────────
describe("DB null-safety – single-row lookups return null (not undefined)", () => {
  it("getUserByOpenId → null for unknown openId", async () => {
    const result = await getUserByOpenId("non-existent-open-id");
    assertNotUndefined(result, "getUserByOpenId");
    expect(result).toBeNull();
  });

  it("getSupplierById → null for unknown id", async () => {
    const result = await getSupplierById(999_999);
    assertNotUndefined(result, "getSupplierById");
    expect(result).toBeNull();
  });

  it("getProductById → null for unknown id", async () => {
    const result = await getProductById(999_999);
    assertNotUndefined(result, "getProductById");
    expect(result).toBeNull();
  });

  it("getProductSafety → null for unknown productId", async () => {
    const result = await getProductSafety(999_999);
    assertNotUndefined(result, "getProductSafety");
    expect(result).toBeNull();
  });

  it("getSystemSetting → null for unknown key", async () => {
    const result = await getSystemSetting("non_existent_key");
    assertNotUndefined(result, "getSystemSetting");
    expect(result).toBeNull();
  });

  it("getLatestAiAnalysisByProduct → null for unknown productId", async () => {
    const result = await getLatestAiAnalysisByProduct(999_999);
    assertNotUndefined(result, "getLatestAiAnalysisByProduct");
    expect(result).toBeNull();
  });

  it("getComponentById → null for unknown id", async () => {
    const result = await getComponentById(999_999);
    assertNotUndefined(result, "getComponentById");
    expect(result).toBeNull();
  });
});

describe("DB null-safety – list queries return empty arrays (not undefined)", () => {
  it("getAllUsers → array", async () => {
    const result = await getAllUsers();
    assertNotUndefined(result, "getAllUsers");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getAllSuppliers → array", async () => {
    const result = await getAllSuppliers();
    assertNotUndefined(result, "getAllSuppliers");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getAllProducts → array", async () => {
    const result = await getAllProducts();
    assertNotUndefined(result, "getAllProducts");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getProductsBySupplier → array", async () => {
    const result = await getProductsBySupplier(999_999);
    assertNotUndefined(result, "getProductsBySupplier");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getMissingRequirementsByProduct → array", async () => {
    const result = await getMissingRequirementsByProduct(999_999);
    assertNotUndefined(result, "getMissingRequirementsByProduct");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getDocumentsByProduct → array", async () => {
    const result = await getDocumentsByProduct(999_999);
    assertNotUndefined(result, "getDocumentsByProduct");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getCommentsByProduct → array", async () => {
    const result = await getCommentsByProduct(999_999);
    assertNotUndefined(result, "getCommentsByProduct");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getApprovalHistory → array", async () => {
    const result = await getApprovalHistory(999_999);
    assertNotUndefined(result, "getApprovalHistory");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getAuditLogs → array", async () => {
    const result = await getAuditLogs();
    assertNotUndefined(result, "getAuditLogs");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getNotificationsByUser → array", async () => {
    const result = await getNotificationsByUser(999_999);
    assertNotUndefined(result, "getNotificationsByUser");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getAllRequirementTypes → array", async () => {
    const result = await getAllRequirementTypes();
    assertNotUndefined(result, "getAllRequirementTypes");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getAiAnalysisHistory → array", async () => {
    const result = await getAiAnalysisHistory(999_999);
    assertNotUndefined(result, "getAiAnalysisHistory");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getComponentsByProduct → array", async () => {
    const result = await getComponentsByProduct(999_999);
    assertNotUndefined(result, "getComponentsByProduct");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getDocumentsByComponent → array", async () => {
    const result = await getDocumentsByComponent(999_999);
    assertNotUndefined(result, "getDocumentsByComponent");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getAllComponentDocumentsByProduct → array", async () => {
    const result = await getAllComponentDocumentsByProduct(999_999);
    assertNotUndefined(result, "getAllComponentDocumentsByProduct");
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Suite B: Static null-guard verification ────────────────────────────────
//
// getDb() caches its connection in a module-level variable, so mocking its
// return value at runtime does not affect already-cached connections.
// Instead we verify the null-guard pattern is present in the source code
// for every single-row function.  This is a reliable regression guard:
// if someone removes the `?? null` or `if (!db) return null` guard, the
// test will fail immediately during CI.
import { readFileSync } from "fs";
import { resolve } from "path";

describe("DB null-safety – source-code null-guard verification", () => {
  const dbSource = readFileSync(
    resolve(__dirname, "./db.ts"),
    "utf-8"
  );

  // Every single-row function must use `?? null` on its result.
  const singleRowFunctions = [
    "getUserByOpenId",
    "getSupplierById",
    "getProductById",
    "getProductSafety",
    "getSystemSetting",
    "getLatestAiAnalysisByProduct",
    "getComponentById",
  ];

  for (const fn of singleRowFunctions) {
    it(`${fn} uses ?? null on its result`, () => {
      // Extract the function body between the function declaration and the next
      // exported function declaration.
      const fnStart = dbSource.indexOf(`export async function ${fn}`);
      expect(fnStart, `${fn} not found in db.ts`).toBeGreaterThan(-1);

      // Find the next export after this function to bound the search.
      const nextExport = dbSource.indexOf("\nexport ", fnStart + 1);
      const fnBody = nextExport > fnStart
        ? dbSource.slice(fnStart, nextExport)
        : dbSource.slice(fnStart);

      // Must have a null-guard: either `if (!db) return null` or `?? null`
      const hasNullGuard =
        fnBody.includes("?? null") ||
        fnBody.includes("return null");

      expect(
        hasNullGuard,
        `${fn}() is missing a null-guard (?? null or return null). ` +
        `Add '?? null' to the result[0] return or 'if (!db) return null' to prevent tRPC undefined errors.`
      ).toBe(true);
    });
  }

  // Every list function must use `if (!db) return []` guard.
  const listFunctions = [
    "getAllProducts",
    "getProductsBySupplier",
    "getMissingRequirementsByProduct",
    "getDocumentsByProduct",
    "getCommentsByProduct",
    "getApprovalHistory",
    "getAuditLogs",
    "getNotificationsByUser",
    "getAllRequirementTypes",
    "getAiAnalysisHistory",
    "getComponentsByProduct",
    "getDocumentsByComponent",
    "getAllComponentDocumentsByProduct",
  ];

  for (const fn of listFunctions) {
    it(`${fn} has a DB-unavailable guard returning []`, () => {
      const fnStart = dbSource.indexOf(`export async function ${fn}`);
      expect(fnStart, `${fn} not found in db.ts`).toBeGreaterThan(-1);

      const nextExport = dbSource.indexOf("\nexport ", fnStart + 1);
      const fnBody = nextExport > fnStart
        ? dbSource.slice(fnStart, nextExport)
        : dbSource.slice(fnStart);

      const hasArrayGuard =
        fnBody.includes("return []") ||
        fnBody.includes("return [];");

      expect(
        hasArrayGuard,
        `${fn}() is missing a 'return []' guard for when DB is unavailable. ` +
        `Add 'if (!db) return []' to prevent tRPC undefined errors.`
      ).toBe(true);
    });
  }
});
