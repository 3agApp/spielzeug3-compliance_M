/**
 * server/domains/email/emailService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Emailit API wrapper for sending transactional emails.
 * API: POST https://api.emailit.com/v2/emails
 * Auth: Bearer token (API key stored in system_settings)
 *
 * All outgoing emails automatically append the configured HTML signature.
 */

import { getSystemSetting, upsertSystemSetting } from "../../db";
import { Errors, requireRole, ADMIN_ROLES } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

const EMAILIT_API_URL = "https://api.emailit.com/v2/emails";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  /** Plain text body – will be wrapped in HTML if no htmlBody provided */
  textBody?: string;
  /** HTML body – signature will be appended automatically */
  htmlBody?: string;
  replyTo?: string;
  cc?: string | string[];
}

export interface EmailSettings {
  apiKey: string | null;
  fromName: string | null;
  fromAddress: string | null;
  htmlSignature: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getEmailSettings(): Promise<EmailSettings> {
  const [apiKey, fromName, fromAddress, htmlSignature] = await Promise.all([
    getSystemSetting("emailit_api_key"),
    getSystemSetting("email_from_name"),
    getSystemSetting("email_from_address"),
    getSystemSetting("email_html_signature"),
  ]);
  return {
    apiKey: apiKey?.settingValue ?? null,
    fromName: fromName?.settingValue ?? null,
    fromAddress: fromAddress?.settingValue ?? null,
    htmlSignature: htmlSignature?.settingValue ?? null,
  };
}

function buildHtmlBody(textOrHtml: string, isHtml: boolean, signature: string | null): string {
  const signatureBlock = signature
    ? `\n<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;">${signature}</div>`
    : "";

  if (isHtml) {
    // Append signature before closing </body> if present, otherwise at the end
    if (textOrHtml.includes("</body>")) {
      return textOrHtml.replace("</body>", `${signatureBlock}</body>`);
    }
    return textOrHtml + signatureBlock;
  }

  // Convert plain text to HTML
  const escaped = textOrHtml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1f2937;">${escaped}</div>${signatureBlock}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const emailService = {
  /**
   * Send an email via Emailit API.
   * Automatically appends the configured HTML signature.
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; emailId?: string; error?: string }> {
    const settings = await getEmailSettings();

    if (!settings.apiKey) {
      throw Errors.precondition("Email service not configured. Please add an Emailit API key in Settings → Email.");
    }
    if (!settings.fromAddress) {
      throw Errors.precondition("Sender email address not configured. Please set it in Settings → Email.");
    }

    const fromField = settings.fromName
      ? `${settings.fromName} <${settings.fromAddress}>`
      : settings.fromAddress;

    const htmlBody = options.htmlBody
      ? buildHtmlBody(options.htmlBody, true, settings.htmlSignature)
      : options.textBody
      ? buildHtmlBody(options.textBody, false, settings.htmlSignature)
      : buildHtmlBody("(No content)", false, settings.htmlSignature);

    const payload: Record<string, unknown> = {
      from: fromField,
      to: options.to,
      subject: options.subject,
      html: htmlBody,
    };

    if (options.replyTo) payload.reply_to = options.replyTo;
    if (options.cc) payload.cc = options.cc;

    const response = await fetch(EMAILIT_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Unknown error" }));
      const message = (errorBody as any)?.message ?? `HTTP ${response.status}`;
      throw Errors.precondition(`Emailit API error: ${message}`);
    }

    const result = await response.json() as any;
    return {
      success: true,
      emailId: result?.data?.id ?? result?.id,
    };
  },

  /**
   * Send a test email to verify the configuration.
   */
  async sendTestEmail(user: UserContext, toAddress: string): Promise<{ success: boolean; emailId?: string }> {
    requireRole(user.complianceRole, ADMIN_ROLES);
    return this.sendEmail({
      to: toAddress,
      subject: "spielzeug3 Compliance Portal – Email Configuration Test",
      htmlBody: `
        <div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1f2937;">
          <h2 style="color:#4f46e5;">Email Configuration Test</h2>
          <p>This is a test email from the spielzeug3 AG Compliance Portal.</p>
          <p>If you received this email, your Emailit configuration is working correctly.</p>
          <p style="color:#6b7280;font-size:12px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
    });
  },

  /**
   * Get current email settings (masked API key).
   */
  async getSettings(user: UserContext): Promise<{
    configured: boolean;
    maskedApiKey: string | null;
    fromName: string | null;
    fromAddress: string | null;
    htmlSignature: string | null;
  }> {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const settings = await getEmailSettings();
    const maskedApiKey = settings.apiKey
      ? settings.apiKey.length > 12
        ? `${settings.apiKey.slice(0, 8)}${"*".repeat(settings.apiKey.length - 12)}${settings.apiKey.slice(-4)}`
        : "****"
      : null;
    return {
      configured: !!settings.apiKey && !!settings.fromAddress,
      maskedApiKey,
      fromName: settings.fromName,
      fromAddress: settings.fromAddress,
      htmlSignature: settings.htmlSignature,
    };
  },

  /**
   * Update email settings.
   */
  async updateSettings(
    user: UserContext,
    updates: {
      apiKey?: string;
      fromName?: string;
      fromAddress?: string;
      htmlSignature?: string;
    }
  ): Promise<{ success: boolean }> {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const ops: Promise<void>[] = [];
    if (updates.apiKey !== undefined) ops.push(upsertSystemSetting("emailit_api_key", updates.apiKey));
    if (updates.fromName !== undefined) ops.push(upsertSystemSetting("email_from_name", updates.fromName));
    if (updates.fromAddress !== undefined) ops.push(upsertSystemSetting("email_from_address", updates.fromAddress));
    if (updates.htmlSignature !== undefined) ops.push(upsertSystemSetting("email_html_signature", updates.htmlSignature));
    await Promise.all(ops);
    return { success: true };
  },

  /**
   * Send manufacturer email from Document Analysis.
   */
  async sendManufacturerEmail(
    user: UserContext,
    params: {
      to: string;
      subject: string;
      htmlBody: string;
      replyTo?: string;
    }
  ): Promise<{ success: boolean; emailId?: string }> {
    requireRole(user.complianceRole, ADMIN_ROLES);
    return this.sendEmail({
      to: params.to,
      subject: params.subject,
      htmlBody: params.htmlBody,
      replyTo: params.replyTo,
    });
  },
};
