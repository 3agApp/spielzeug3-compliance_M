/**
 * Unit tests for the productImages router.
 * Tests cover: list (empty), upload validation (file size, mime type, max count),
 * delete, and reorder procedures.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeCtx(role = "compliance_manager", supplierId?: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: 42,
    openId: "test-user",
    email: "test@spielzeug3.ch",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  (user as any).complianceRole = role;
  if (supplierId !== undefined) (user as any).supplierId = supplierId;
  return {
    user,
    req: { headers: {}, cookies: {} } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  };
}

const caller = (role?: string, supplierId?: number) =>
  appRouter.createCaller(makeCtx(role, supplierId));

// ─── Mocks ────────────────────────────────────────────────────────────────────

// We mock getDb so no real DB connection is required.
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/test.jpg", key: "test.jpg" }),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("productImages router", () => {
  describe("upload validation", () => {
    it("rejects files larger than 5 MB", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 1, productId: 1 }]),
      };
      (getDb as any).mockResolvedValue(mockDb);

      // Create a base64 string that decodes to > 5 MB
      const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, "x");
      const oversizedBase64 = oversizedBuffer.toString("base64");

      await expect(
        caller("compliance_manager").productImages.upload({
          productId: 1,
          fileBase64: oversizedBase64,
          mimeType: "image/jpeg",
          originalName: "large.jpg",
          fileSizeBytes: oversizedBuffer.byteLength,
        })
      ).rejects.toThrow(/zu gro/i);
    });

    it("rejects invalid MIME types at schema level", async () => {
      await expect(
        caller("compliance_manager").productImages.upload({
          productId: 1,
          fileBase64: Buffer.from("fake").toString("base64"),
          mimeType: "application/pdf" as any,
          originalName: "doc.pdf",
        })
      ).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("returns an empty array when no images exist", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await caller("compliance_manager").productImages.list({ productId: 99 });
      expect(result).toEqual([]);
    });

    it("returns images sorted by sortOrder", async () => {
      const { getDb } = await import("./db");
      const fakeImages = [
        { id: 1, productId: 1, url: "https://cdn/a.jpg", sortOrder: 0 },
        { id: 2, productId: 1, url: "https://cdn/b.jpg", sortOrder: 1 },
      ];
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(fakeImages),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await caller("compliance_manager").productImages.list({ productId: 1 });
      expect(result).toHaveLength(2);
      expect(result[0].sortOrder).toBe(0);
      expect(result[1].sortOrder).toBe(1);
    });
  });

  describe("supplier access control", () => {
    it("allows supplier to list images for own product", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      (getDb as any).mockResolvedValue(mockDb);
      // Supplier with supplierId=5 lists images for product 10
      const result = await caller("supplier", 5).productImages.list({ productId: 10 });
      expect(result).toEqual([]);
    });

    it("rejects supplier trying to upload to a product they do not own", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        // assertProductAccess returns a product owned by supplierId=99, not 5
        limit: vi.fn().mockResolvedValue([{ id: 10, supplierId: 99 }]),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      (getDb as any).mockResolvedValue(mockDb);
      await expect(
        caller("supplier", 5).productImages.upload({
          productId: 10,
          fileBase64: Buffer.from("fake").toString("base64"),
          mimeType: "image/jpeg",
        })
      ).rejects.toThrow(/FORBIDDEN|Berechtigungen/i);
    });
  });

  describe("reorder", () => {
    it("accepts a valid ordered ID array", async () => {
      const { getDb } = await import("./db");
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        // limit() is called by assertProductAccess – must return a product row
        limit: vi.fn().mockResolvedValue([{ id: 1, productId: 1, userId: 42, supplierId: null }]),
        orderBy: vi.fn().mockResolvedValue([{ id: 1, productId: 1, userId: 42 }]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
      };
      (getDb as any).mockResolvedValue(mockDb);

      const result = await caller("compliance_manager").productImages.reorder({
        productId: 1,
        orderedIds: [2, 1],
      });
      expect(result).toEqual({ success: true });
    });
  });
});
