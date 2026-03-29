/**
 * server/routers/email.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * tRPC router for email configuration and sending via Emailit API.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { emailService } from "../domains/email/emailService";

export const emailRouter = router({
  /** Get current email settings (masked API key) */
  getSettings: protectedProcedure.query(({ ctx }) =>
    emailService.getSettings(ctx.user)
  ),

  /** Update email settings (admin/compliance_manager only) */
  updateSettings: protectedProcedure
    .input(
      z.object({
        apiKey: z.string().optional(),
        fromName: z.string().optional(),
        fromAddress: z.string().email().optional(),
        htmlSignature: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      emailService.updateSettings(ctx.user, input)
    ),

  /** Send a test email to verify configuration */
  testConnection: protectedProcedure
    .input(z.object({ toAddress: z.string().email() }))
    .mutation(({ ctx, input }) =>
      emailService.sendTestEmail(ctx.user, input.toAddress)
    ),

  /** Send manufacturer email from Document Analysis */
  sendManufacturerEmail: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        to: z.string().email(),
        subject: z.string().min(1),
        htmlBody: z.string().min(1),
        replyTo: z.string().email().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      emailService.sendManufacturerEmail(ctx.user, input)
    ),
});
