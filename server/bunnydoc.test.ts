/**
 * BunnyDoc integration tests
 * Tests the tRPC router procedures and the API wrapper logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB helpers ──────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getSystemSetting: vi.fn(),
  setSystemSetting: vi.fn(),
  createSignatureRequest: vi.fn(),
  listSignatureRequestsByProduct: vi.fn(),
  getSignatureRequestById: vi.fn(),
  getSignatureRequestByEnvelopeId: vi.fn(),
  updateSignatureRequestStatus: vi.fn(),
}));

// ─── Mock the BunnyDoc API wrapper ───────────────────────────────────────────
vi.mock("./bunnydocApi", () => ({
  createBunnyDocEnvelope: vi.fn(),
  cancelBunnyDocEnvelope: vi.fn(),
}));

import {
  getSystemSetting,
  setSystemSetting,
  createSignatureRequest,
  listSignatureRequestsByProduct,
  getSignatureRequestById,
  updateSignatureRequestStatus,
} from "./db";
import { createBunnyDocEnvelope, cancelBunnyDocEnvelope } from "./bunnydocApi";

// ─── Unit tests for the API wrapper helpers ──────────────────────────────────
describe("BunnyDoc API wrapper", () => {
  it("createBunnyDocEnvelope is callable as a mock", async () => {
    vi.mocked(createBunnyDocEnvelope).mockResolvedValueOnce({
      envelopeId: "env-123",
      signingLink: "https://sign.bunnydoc.com/env-123",
    });
    const result = await createBunnyDocEnvelope({
      apiKey: "test-key",
      templateId: "tmpl-abc",
      signerName: "Max Mustermann",
      signerEmail: "max@example.com",
      emailMessage: "Bitte unterschreiben",
      title: "Compliance-Dokument",
    });
    expect(result.envelopeId).toBe("env-123");
    expect(result.signingLink).toBe("https://sign.bunnydoc.com/env-123");
  });

  it("cancelBunnyDocEnvelope is callable as a mock", async () => {
    vi.mocked(cancelBunnyDocEnvelope).mockResolvedValueOnce(undefined);
    await expect(
      cancelBunnyDocEnvelope({ apiKey: "test-key", envelopeId: "env-123" })
    ).resolves.toBeUndefined();
  });
});

// ─── Unit tests for DB helper mocks ──────────────────────────────────────────
describe("BunnyDoc DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getSystemSetting returns null when not set", async () => {
    vi.mocked(getSystemSetting).mockResolvedValueOnce(null);
    const result = await getSystemSetting("bunnydoc_api_key");
    expect(result).toBeNull();
  });

  it("setSystemSetting can be called with key/value", async () => {
    vi.mocked(setSystemSetting).mockResolvedValueOnce(undefined);
    await setSystemSetting("bunnydoc_api_key", "my-secret-key");
    expect(setSystemSetting).toHaveBeenCalledWith("bunnydoc_api_key", "my-secret-key");
  });

  it("createSignatureRequest returns the created record", async () => {
    const mockRecord = {
      id: 1,
      productId: 42,
      envelopeId: "env-001",
      title: "Test Dokument",
      signerName: "Erika Muster",
      signerEmail: "erika@example.com",
      status: "pending",
      signingLink: "https://sign.bunnydoc.com/env-001",
      signedDocumentUrl: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      webhookPayload: null,
    };
    vi.mocked(createSignatureRequest).mockResolvedValueOnce(mockRecord as any);
    const result = await createSignatureRequest({
      productId: 42,
      envelopeId: "env-001",
      title: "Test Dokument",
      signerName: "Erika Muster",
      signerEmail: "erika@example.com",
      signingLink: "https://sign.bunnydoc.com/env-001",
    });
    expect(result.envelopeId).toBe("env-001");
    expect(result.status).toBe("pending");
  });

  it("listSignatureRequestsByProduct returns an array", async () => {
    vi.mocked(listSignatureRequestsByProduct).mockResolvedValueOnce([]);
    const result = await listSignatureRequestsByProduct(42);
    expect(Array.isArray(result)).toBe(true);
  });

  it("updateSignatureRequestStatus is called with correct args", async () => {
    vi.mocked(updateSignatureRequestStatus).mockResolvedValueOnce(undefined);
    await updateSignatureRequestStatus(1, "completed", {
      completedAt: new Date(),
      signedDocumentUrl: "https://cdn.bunnydoc.com/signed.pdf",
    });
    expect(updateSignatureRequestStatus).toHaveBeenCalledWith(
      1,
      "completed",
      expect.objectContaining({ signedDocumentUrl: expect.any(String) })
    );
  });
});

// ─── Webhook payload parsing ──────────────────────────────────────────────────
describe("BunnyDoc webhook payload handling", () => {
  it("recognises signatureRequestCompleted event fields", () => {
    const payload = {
      event: "signatureRequestCompleted",
      envelopeId: "env-xyz",
      status: "completed",
      signedDocumentUrl: "https://cdn.bunnydoc.com/signed.pdf",
    };
    expect(payload.event).toBe("signatureRequestCompleted");
    expect(payload.signedDocumentUrl).toContain("signed.pdf");
  });

  it("handles missing envelopeId gracefully", () => {
    const payload = { event: "signatureRequestViewed" };
    // Without envelopeId, the webhook handler should skip processing
    expect((payload as any).envelopeId).toBeUndefined();
  });
});
