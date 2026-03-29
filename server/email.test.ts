/**
 * server/email.test.ts
 * Tests for the email router (Emailit integration)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { emailService } from "./domains/email/emailService";
import * as db from "./db";

// Mock DB helpers
vi.mock("./db", () => ({
  getEmailLogById: vi.fn(),
  createEmailLog: vi.fn().mockResolvedValue(undefined),
  getEmailLogsByProduct: vi.fn().mockResolvedValue([]),
  getSystemSetting: vi.fn(),
  upsertSystemSetting: vi.fn().mockResolvedValue(undefined),
}));

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const adminUser = {
  id: 1,
  openId: "test-open-id",
  name: "Admin User",
  email: "admin@test.com",
  complianceRole: "administrator" as const,
  supplierId: null,
  tenantId: 1,
};

const nonAdminUser = {
  ...adminUser,
  complianceRole: "supplier" as const,
};

describe("emailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSettings", () => {
    it("returns configured=false when no API key is set", async () => {
      vi.mocked(db.getSystemSetting).mockResolvedValue(null);
      const result = await emailService.getSettings(adminUser as any);
      expect(result.configured).toBe(false);
      expect(result.maskedApiKey).toBeNull();
    });

    it("returns masked API key when configured", async () => {
      vi.mocked(db.getSystemSetting).mockImplementation(async (key) => {
        if (key === "emailit_api_key") return { settingKey: key, settingValue: "em_live_abcdefghijklmnop" } as any;
        if (key === "email_from_address") return { settingKey: key, settingValue: "test@example.com" } as any;
        return null;
      });
      const result = await emailService.getSettings(adminUser as any);
      expect(result.configured).toBe(true);
      expect(result.maskedApiKey).toContain("*");
      expect(result.maskedApiKey).not.toBe("em_live_abcdefghijklmnop");
    });

    it("throws FORBIDDEN for non-admin users", async () => {
      await expect(emailService.getSettings(nonAdminUser as any)).rejects.toThrow();
    });
  });

  describe("updateSettings", () => {
    it("saves API key and sender settings", async () => {
      await emailService.updateSettings(adminUser as any, {
        apiKey: "em_live_test123",
        fromName: "Test Corp",
        fromAddress: "test@example.com",
        htmlSignature: "<p>Signature</p>",
      });
      expect(db.upsertSystemSetting).toHaveBeenCalledWith("emailit_api_key", "em_live_test123");
      expect(db.upsertSystemSetting).toHaveBeenCalledWith("email_from_name", "Test Corp");
      expect(db.upsertSystemSetting).toHaveBeenCalledWith("email_from_address", "test@example.com");
      expect(db.upsertSystemSetting).toHaveBeenCalledWith("email_html_signature", "<p>Signature</p>");
    });

    it("throws FORBIDDEN for non-admin users", async () => {
      await expect(emailService.updateSettings(nonAdminUser as any, { apiKey: "test" })).rejects.toThrow();
    });
  });

  describe("sendEmail", () => {
    it("throws when API key is not configured", async () => {
      vi.mocked(db.getSystemSetting).mockResolvedValue(null);
      await expect(
        emailService.sendEmail({ to: "test@example.com", subject: "Test", textBody: "Hello" })
      ).rejects.toThrow("Email service not configured");
    });

    it("throws when from address is not configured", async () => {
      vi.mocked(db.getSystemSetting).mockImplementation(async (key) => {
        if (key === "emailit_api_key") return { settingKey: key, settingValue: "em_live_test" } as any;
        return null;
      });
      await expect(
        emailService.sendEmail({ to: "test@example.com", subject: "Test", textBody: "Hello" })
      ).rejects.toThrow("Sender email address not configured");
    });

    it("sends email with HTML signature appended", async () => {
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
        json: async () => ({ data: { id: "email_123" } }),
      });

      const result = await emailService.sendEmail({
        to: "recipient@example.com",
        subject: "Compliance Issue",
        htmlBody: "<p>Please fix these issues.</p>",
      });

      expect(result.success).toBe(true);
      expect(result.emailId).toBe("email_123");

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.from).toBe("Test Corp <sender@example.com>");
      expect(body.to).toBe("recipient@example.com");
      expect(body.subject).toBe("Compliance Issue");
      expect(body.html).toContain("<p>Please fix these issues.</p>");
      expect(body.html).toContain("<p>-- Test Corp</p>");
    });

    it("throws on Emailit API error", async () => {
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
        json: async () => ({ message: "Invalid API key" }),
      });

      await expect(
        emailService.sendEmail({ to: "test@example.com", subject: "Test", textBody: "Hello" })
      ).rejects.toThrow("Emailit API error: Invalid API key");
    });
  });
});
