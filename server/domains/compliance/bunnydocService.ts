/**
 * server/domains/compliance/bunnydocService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for the BunnyDoc digital signature domain.
 *
 * Handles settings management, sending signature requests via the BunnyDoc API,
 * and cancelling / querying existing requests.
 */

import { TRPCError } from "@trpc/server";
import {
  cancelSignatureRequest,
  createSignatureRequest,
  getProductById,
  getSignatureRequestById,
  getSignatureRequestsByProduct,
  getSystemSetting,
  upsertSystemSetting,
} from "../../db";
import { bunnydocCreateSignatureRequest } from "../../bunnydocApi";
import { requireRole } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendSignatureInput {
  productId: number;
  signerName: string;
  signerEmail: string;
  signerRole?: string;
  title?: string;
  emailMessage?: string;
  fields?: Array<{
    apiLabel: string;
    value: string | boolean | number;
    readOnly?: 0 | 1;
  }>;
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

const SIGNATURE_ROLES = ["administrator", "compliance_manager"] as const;
const VIEW_ROLES = ["administrator", "compliance_manager", "internal_employee"] as const;

// ─── Service ──────────────────────────────────────────────────────────────────

export const bunnydocService = {
  /** Get BunnyDoc integration settings (compliance_manager / admin only). */
  async getSettings(user: UserContext) {
    requireRole(user.complianceRole, [...SIGNATURE_ROLES]);
    const apiKeySetting   = await getSystemSetting("bunnydoc_api_key");
    const templateSetting = await getSystemSetting("bunnydoc_template_id");
    const webhookSetting  = await getSystemSetting("bunnydoc_webhook_id");
    return {
      hasApiKey:  !!apiKeySetting?.settingValue,
      templateId: templateSetting?.settingValue ?? null,
      webhookId:  webhookSetting?.settingValue ?? null,
    };
  },

  /** Save BunnyDoc API key and template ID (admin only). */
  async saveSettings(user: UserContext, apiKey: string, templateId: string) {
    requireRole(user.complianceRole, ["administrator"]);
    const userId = typeof user.id === "number" ? user.id : undefined;
    await upsertSystemSetting("bunnydoc_api_key",    apiKey,      true,  userId);
    await upsertSystemSetting("bunnydoc_template_id", templateId, false, userId);
    return { success: true };
  },

  /**
   * Return the most recent non-cancelled signature request for a product.
   * Used for the header badge. Returns null for supplier / unknown roles.
   */
  async latestByProduct(user: UserContext, productId: number) {
    if (!VIEW_ROLES.includes(user.complianceRole as any)) return null;
    const all = await getSignatureRequestsByProduct(productId);
    return all.find((r) => r.status !== "cancelled") ?? all[0] ?? null;
  },

  /** List all signature requests for a product. */
  async listByProduct(user: UserContext, productId: number) {
    requireRole(user.complianceRole, [...VIEW_ROLES]);
    return getSignatureRequestsByProduct(productId);
  },

  /**
   * Send a new signature request via BunnyDoc API and persist it to the DB.
   * Requires compliance_manager or administrator role.
   */
  async send(user: UserContext, input: SendSignatureInput) {
    requireRole(user.complianceRole, [...SIGNATURE_ROLES]);

    // Load credentials
    const apiKeySetting   = await getSystemSetting("bunnydoc_api_key");
    const templateSetting = await getSystemSetting("bunnydoc_template_id");

    if (!apiKeySetting?.settingValue) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Kein BunnyDoc API-Schlüssel konfiguriert. Bitte in den Einstellungen hinterlegen.",
      });
    }
    if (!templateSetting?.settingValue) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Keine BunnyDoc Template-ID konfiguriert. Bitte in den Einstellungen hinterlegen.",
      });
    }

    const product = await getProductById(input.productId);
    if (!product) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Produkt nicht gefunden." });
    }

    const title = input.title ?? `Compliance-Dokument: ${product.productName}`;
    const emailMessage =
      input.emailMessage ?? `Bitte unterzeichnen Sie das Compliance-Dokument für ${product.productName}.`;

    // Call BunnyDoc API
    const result = await bunnydocCreateSignatureRequest({
      apiKey:       apiKeySetting.settingValue,
      templateId:   templateSetting.settingValue,
      title,
      emailMessage,
      signingOrder: false,
      recipients: [{
        role:  input.signerRole ?? "signer",
        name:  input.signerName,
        email: input.signerEmail,
      }],
      fields: input.fields,
    });

    if (result.error !== 0) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `BunnyDoc Fehler: ${result.message}`,
      });
    }

    const recipientData = result.recipients?.find(
      (r) => r.email.toLowerCase() === input.signerEmail.toLowerCase()
    );

    await createSignatureRequest({
      productId:          input.productId,
      envelopeId:         result.envelopeId ?? null,
      title,
      status:             "pending",
      signerName:         input.signerName,
      signerEmail:        input.signerEmail,
      signerRole:         input.signerRole ?? "signer",
      signingLink:        recipientData?.signatureRequestLink ?? null,
      emailMessage:       input.emailMessage ?? null,
      bunnydocTemplateId: templateSetting.settingValue,
      createdByUserId:    typeof user.id === "number" ? user.id : 0,
    });

    return {
      success:     true,
      envelopeId:  result.envelopeId,
      signingLink: recipientData?.signatureRequestLink ?? null,
      message:     result.message,
    };
  },

  /** Cancel a pending signature request. */
  async cancel(user: UserContext, id: number) {
    requireRole(user.complianceRole, [...SIGNATURE_ROLES]);
    const req = await getSignatureRequestById(id);
    if (!req) throw new TRPCError({ code: "NOT_FOUND" });
    if (req.status === "completed") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Abgeschlossene Signaturanfragen können nicht storniert werden.",
      });
    }
    await cancelSignatureRequest(id);
    return { success: true };
  },
};
