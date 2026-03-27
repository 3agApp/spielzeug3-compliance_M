/**
 * Tests für die öffentliche REST-API (/api/v1/products/:uuid und /by-ean/:ean)
 *
 * Geprüft werden:
 * - CORS-Header (Access-Control-Allow-Origin: *)
 * - Korrekte JSON-Felder (uuid, sealStatus, landingPageUrl, qrCodeUrl, …)
 * - Korrekte Seal-Status-Berechnung via getSealStatus()
 * - 404 für unbekannte UUIDs / EANs
 * - 400 für ungültige UUID-/EAN-Formate
 * - OPTIONS-Preflight antwortet mit 204
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Wir mocken die DB-Hilfsfunktionen, damit keine echte Datenbank benötigt wird.
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./tenantDb", () => ({
  getTenantById: vi.fn(),
}));

vi.mock("./sealUtils", () => ({
  getSealStatus: vi.fn(),
  getPublicProductUrl: vi.fn((uuid: string) => `https://seal.example.com/p/${uuid}`),
}));

import { getDb } from "./db";
import { getTenantById } from "./tenantDb";
import { getSealStatus } from "./sealUtils";
import { registerPublicApiRoutes } from "./publicApiRoutes";

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  registerPublicApiRoutes(app);
  return app;
}

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_EAN = "4006381333931";

const MOCK_PRODUCT_ROW = {
  publicUuid: VALID_UUID,
  productName: "Testspielzeug Pro",
  brand: "TestBrand",
  ean: VALID_EAN,
  status: "approved",
  completenessScore: "95",
  sealStatusOverride: null,
  publicVisible: true,
  qrCodeUrl: "https://cdn.example.com/qr/test.png",
  approvedAt: new Date("2025-01-15T10:00:00Z"),
  sealEnabledAt: new Date("2025-01-15T10:00:00Z"),
  tenantId: 1,
  importerName: "Test Importer AG",
};

const MOCK_TENANT = { id: 1, name: "Test Importer AG", slug: "test-importer" };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/v1/products/:uuid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("antwortet mit CORS-Header Access-Control-Allow-Origin: *", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([MOCK_PRODUCT_ROW]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
    vi.mocked(getTenantById).mockResolvedValue(MOCK_TENANT as any);
    vi.mocked(getSealStatus).mockReturnValue("verified");

    const app = buildApp();
    const res = await request(app)
      .get(`/api/v1/products/${VALID_UUID}`)
      .set("Origin", "https://shop.example.com");

    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("gibt 200 mit korrekten JSON-Feldern zurück", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([MOCK_PRODUCT_ROW]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
    vi.mocked(getTenantById).mockResolvedValue(MOCK_TENANT as any);
    vi.mocked(getSealStatus).mockReturnValue("verified");

    const app = buildApp();
    const res = await request(app).get(`/api/v1/products/${VALID_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.uuid).toBe(VALID_UUID);
    expect(res.body.productName).toBe("Testspielzeug Pro");
    expect(res.body.sealStatus).toBe("verified");
    expect(res.body.landingPageUrl).toContain(VALID_UUID);
    expect(res.body.qrCodeUrl).toBe("https://cdn.example.com/qr/test.png");
    expect(res.body.importer).toEqual({ name: "Test Importer AG", slug: "test-importer" });
  });

  it("gibt 404 zurück wenn UUID nicht gefunden", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const app = buildApp();
    const res = await request(app).get(`/api/v1/products/${VALID_UUID}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Product not found");
  });

  it("gibt 400 zurück bei ungültigem UUID-Format", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/products/not-a-valid-uuid!!");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid UUID format");
  });

  it("sealStatus=in_progress wird korrekt weitergegeben", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ ...MOCK_PRODUCT_ROW, status: "submitted" }]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
    vi.mocked(getTenantById).mockResolvedValue(MOCK_TENANT as any);
    vi.mocked(getSealStatus).mockReturnValue("in_progress");

    const app = buildApp();
    const res = await request(app).get(`/api/v1/products/${VALID_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.sealStatus).toBe("in_progress");
    expect(res.body.sealStatusLabel).toBe("IN PROGRESS");
  });

  it("importer ist null wenn kein Tenant gefunden", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([MOCK_PRODUCT_ROW]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
    vi.mocked(getTenantById).mockResolvedValue(null as any);
    vi.mocked(getSealStatus).mockReturnValue("verified");

    const app = buildApp();
    const res = await request(app).get(`/api/v1/products/${VALID_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.importer).toBeNull();
  });
});

describe("GET /api/v1/products/by-ean/:ean", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("antwortet mit CORS-Header Access-Control-Allow-Origin: *", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([MOCK_PRODUCT_ROW]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
    vi.mocked(getTenantById).mockResolvedValue(MOCK_TENANT as any);
    vi.mocked(getSealStatus).mockReturnValue("verified");

    const app = buildApp();
    const res = await request(app)
      .get(`/api/v1/products/by-ean/${VALID_EAN}`)
      .set("Origin", "https://woocommerce.example.com");

    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("gibt 200 mit korrekten Feldern zurück", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([MOCK_PRODUCT_ROW]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
    vi.mocked(getTenantById).mockResolvedValue(MOCK_TENANT as any);
    vi.mocked(getSealStatus).mockReturnValue("verified");

    const app = buildApp();
    const res = await request(app).get(`/api/v1/products/by-ean/${VALID_EAN}`);

    expect(res.status).toBe(200);
    expect(res.body.ean).toBe(VALID_EAN);
    expect(res.body.sealStatus).toBe("verified");
  });

  it("gibt 404 zurück wenn EAN nicht gefunden", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const app = buildApp();
    const res = await request(app).get("/api/v1/products/by-ean/9999999999999");
    expect(res.status).toBe(404);
  });

  it("gibt 400 zurück bei zu kurzem EAN", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/products/by-ean/123");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid EAN format");
  });
});

describe("OPTIONS /api/v1/* (CORS Preflight)", () => {
  it("antwortet mit 204 und CORS-Headern", async () => {
    const app = buildApp();
    const res = await request(app)
      .options("/api/v1/products/some-uuid")
      .set("Origin", "https://shopify.example.com")
      .set("Access-Control-Request-Method", "GET");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-methods"]).toContain("GET");
  });
});
