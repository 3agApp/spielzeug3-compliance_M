import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  cancelSignatureRequest,
  createSignatureRequest,
  getProductById,
  getSignatureRequestById,
  getSignatureRequestsByProduct,
  getSystemSetting,
  upsertSystemSetting,
} from "../db";
import { bunnydocCreateSignatureRequest } from "../bunnydocApi";

// ─── Role helper ─────────────────────────────────────────────────────────────
function requireSignatureRole(role: string) {
  if (!["administrator", "compliance_manager"].includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Nur Compliance Manager und Administratoren können Signaturanfragen erstellen." });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const bunnydocRouter = router({
  // ── Settings ────────────────────────────────────────────────────────────────
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    requireSignatureRole(ctx.user.complianceRole ?? "");
    const apiKeySetting   = await getSystemSetting("bunnydoc_api_key");
    const templateSetting = await getSystemSetting("bunnydoc_template_id");
    const webhookSetting  = await getSystemSetting("bunnydoc_webhook_id");
    return {
      hasApiKey:   !!apiKeySetting?.settingValue,
      templateId:  templateSetting?.settingValue ?? null,
      webhookId:   webhookSetting?.settingValue ?? null,
    };
  }),

  saveSettings: protectedProcedure
    .input(z.object({
      apiKey:     z.string().min(1),
      templateId: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.complianceRole !== "administrator") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await upsertSystemSetting("bunnydoc_api_key",    input.apiKey,     true,  ctx.user.id);
      await upsertSystemSetting("bunnydoc_template_id", input.templateId, false, ctx.user.id);
      return { success: true };
    }),

  // ── Signature Requests ───────────────────────────────────────────────────
  listByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.user.complianceRole ?? "";
      if (!["administrator", "compliance_manager", "internal_employee"].includes(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getSignatureRequestsByProduct(input.productId);
    }),

  send: protectedProcedure
    .input(z.object({
      productId:    z.number(),
      signerName:   z.string().min(1),
      signerEmail:  z.string().email(),
      signerRole:   z.string().default("signer"),
      title:        z.string().optional(),
      emailMessage: z.string().optional(),
      // Optional field overrides for the BunnyDoc template
      fields: z.array(z.object({
        apiLabel: z.string(),
        value:    z.union([z.string(), z.boolean(), z.number()]),
        readOnly: z.union([z.literal(0), z.literal(1)]).optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireSignatureRole(ctx.user.complianceRole ?? "");

      // Load BunnyDoc credentials
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

      // Load product for title
      const product = await getProductById(input.productId);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produkt nicht gefunden." });
      }

      const title = input.title ?? `Compliance-Dokument: ${product.productName}`;

      // Call BunnyDoc API
      const result = await bunnydocCreateSignatureRequest({
        apiKey:       apiKeySetting.settingValue,
        templateId:   templateSetting.settingValue,
        title,
        emailMessage: input.emailMessage ?? `Bitte unterzeichnen Sie das Compliance-Dokument für ${product.productName}.`,
        signingOrder: false,
        recipients: [{
          role:  input.signerRole,
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

      // Find signing link for this recipient
      const recipientData = result.recipients?.find(
        (r) => r.email.toLowerCase() === input.signerEmail.toLowerCase()
      );

      // Persist to DB
      await createSignatureRequest({
        productId:          input.productId,
        envelopeId:         result.envelopeId ?? null,
        title,
        status:             "pending",
        signerName:         input.signerName,
        signerEmail:        input.signerEmail,
        signerRole:         input.signerRole,
        signingLink:        recipientData?.signatureRequestLink ?? null,
        emailMessage:       input.emailMessage ?? null,
        bunnydocTemplateId: templateSetting.settingValue,
        createdByUserId:    ctx.user.id,
      });

      return {
        success:     true,
        envelopeId:  result.envelopeId,
        signingLink: recipientData?.signatureRequestLink ?? null,
        message:     result.message,
      };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireSignatureRole(ctx.user.complianceRole ?? "");
      const req = await getSignatureRequestById(input.id);
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      if (req.status === "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Abgeschlossene Signaturanfragen können nicht storniert werden." });
      }
      await cancelSignatureRequest(input.id);
      return { success: true };
    }),
});
