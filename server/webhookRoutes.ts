/**
 * BunnyDoc Webhook Handler
 *
 * BunnyDoc sends POST requests to this endpoint on signature events.
 * During webhook registration, BunnyDoc expects the string
 * 'BUNNYDOC API EVENT RECEIVED' in the response body for verification.
 */
import type { Express } from "express";
import {
  getSignatureRequestByEnvelopeId,
  updateSignatureRequestStatus,
} from "./db";

export function registerWebhookRoutes(app: Express) {
  /**
   * POST /api/webhooks/bunnydoc
   *
   * Handles all BunnyDoc webhook events:
   * - signatureRequestViewed
   * - signatureRequestSigned
   * - signatureRequestCompleted
   *
   * BunnyDoc also sends a verification request when subscribing.
   * We always respond with 'BUNNYDOC API EVENT RECEIVED' to satisfy that check.
   */
  app.post("/api/webhooks/bunnydoc", async (req, res) => {
    // Always respond with the verification string first (BunnyDoc requires this)
    res.status(200).send("BUNNYDOC API EVENT RECEIVED");

    try {
      const payload = req.body as {
        event?: string;
        envelopeId?: string;
        status?: string;
        signedDocumentUrl?: string;
        [key: string]: unknown;
      };

      const { event, envelopeId } = payload;

      if (!envelopeId || !event) {
        // Verification ping or unknown payload – already responded above
        return;
      }

      const signatureReq = await getSignatureRequestByEnvelopeId(envelopeId);
      if (!signatureReq) {
        console.warn(`[BunnyDoc Webhook] Unknown envelopeId: ${envelopeId}`);
        return;
      }

      const rawPayload = JSON.stringify(payload);

      switch (event) {
        case "signatureRequestViewed":
          await updateSignatureRequestStatus(signatureReq.id, "viewed", {
            webhookPayload: rawPayload,
          });
          break;

        case "signatureRequestSigned":
          await updateSignatureRequestStatus(signatureReq.id, "signed", {
            webhookPayload: rawPayload,
          });
          break;

        case "signatureRequestCompleted":
          await updateSignatureRequestStatus(signatureReq.id, "completed", {
            completedAt:       new Date(),
            signedDocumentUrl: payload.signedDocumentUrl ?? undefined,
            webhookPayload:    rawPayload,
          });
          break;

        default:
          console.log(`[BunnyDoc Webhook] Unhandled event: ${event}`);
      }
    } catch (err) {
      // Log but do not change the response (already sent)
      console.error("[BunnyDoc Webhook] Processing error:", err);
    }
  });
}
