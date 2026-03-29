/**
 * server/emailLogs.test.ts
 * Tests for the emailLogs router – specifically the resend mutation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { emailService } from "./domains/email/emailService";
import * as db from "./db";

vi.mock("./db", () => ({
  getEmailLogById: vi.fn(),
  createEmailLog: vi.fn().mockResolvedValue(undefined),
  getEmailLogsByProduct: vi.fn().mockResolvedValue([]),
  getSystemSetting: vi.fn(),
  upsertSystemSetting: vi.fn().mockResolvedValue(undefined),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const internalUser = {
  id: 1,
  openId: "test-open-id",
  name: "Compliance Manager",
  email: "cm@test.com",
  complianceRole: "compliance_manager" as const,
  supplierId: null,
  tenantId: 1,
};

const failedLogEntry = {
  id: 42,
  productId: 10,
  to: "manufacturer@example.com",
  subject: "Compliance Issue – Product XY",
  htmlBody: "<p>Please fix these issues.</p>",
  sentAt: new Date("2026-03-01T10:00:00Z"),
  sentBy: "Internal User",
  sentByUserId: 1,
  status: "failed" as const,
  errorMessage: "Emailit API error: Invalid API key",
  tenantId: 1,
};

describe("emailService.sendManufacturerEmail (resend scenario)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully resends a failed email and creates a new log entry", async () => {
    // Configure email settings
    vi.mocked(db.getSystemSetting).mockImplementation(async (key) => {
      const map: Record<string, string> = {
        emailit_api_key: "em_live_test",
        email_from_name: "Test Corp",
        email_from_address: "sender@example.com",
        email_html_signature: "<p>-- Test Corp</p>",
      };
      if (map[key]) return { settingKey: key, settingValue: map[key] } as any;
      return null;
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "email_resent_456" } }),
    });

    const result = await emailService.sendManufacturerEmail(internalUser as any, {
      productId: failedLogEntry.productId,
      to: failedLogEntry.to,
      subject: failedLogEntry.subject,
      htmlBody: failedLogEntry.htmlBody ?? "",
    });

    expect(result.success).toBe(true);
    expect(result.emailId).toBe("email_resent_456");

    // Verify a new log entry was created with status "sent"
    expect(db.createEmailLog).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: failedLogEntry.productId,
        to: failedLogEntry.to,
        subject: failedLogEntry.subject,
        status: "sent",
      })
    );
  });

  it("creates a failed log entry when resend also fails", async () => {
    vi.mocked(db.getSystemSetting).mockImplementation(async (key) => {
      const map: Record<string, string> = {
        emailit_api_key: "em_live_test",
        email_from_address: "sender@example.com",
      };
      if (map[key]) return { settingKey: key, settingValue: map[key] } as any;
      return null;
    });
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Rate limit exceeded" }),
    });

    await expect(
      emailService.sendManufacturerEmail(internalUser as any, {
        productId: failedLogEntry.productId,
        to: failedLogEntry.to,
        subject: failedLogEntry.subject,
        htmlBody: failedLogEntry.htmlBody ?? "",
      })
    ).rejects.toThrow("Emailit API error: Rate limit exceeded");

    // Verify a failed log entry was still created
    expect(db.createEmailLog).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: failedLogEntry.productId,
        status: "failed",
        errorMessage: expect.stringContaining("Rate limit exceeded"),
      })
    );
  });

  it("throws FORBIDDEN when supplier user tries to resend", async () => {
    const supplierUser = { ...internalUser, complianceRole: "supplier" as const };
    await expect(
      emailService.sendManufacturerEmail(supplierUser as any, {
        productId: 1,
        to: "test@example.com",
        subject: "Test",
        htmlBody: "<p>Test</p>",
      })
    ).rejects.toThrow();
  });
});
