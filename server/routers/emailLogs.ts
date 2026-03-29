/**
 * server/routers/emailLogs.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * tRPC router for retrieving email send logs per product.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getEmailLogsByProduct, getEmailLogById, createEmailLog } from "../db";
import { requireRole, ADMIN_ROLES } from "../shared";
import { emailService } from "../domains/email/emailService";
import { TRPCError } from "@trpc/server";

export const emailLogsRouter = router({
  /** Get all email logs for a product (admin/compliance_manager/internal_employee) */
  getByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const allowedRoles = ["administrator", "compliance_manager", "internal_employee"] as const;
      requireRole(ctx.user.complianceRole, [...allowedRoles]);
      const logs = await getEmailLogsByProduct(input.productId);
      return logs.map((log) => ({
        id: log.id,
        to: log.to,
        subject: log.subject,
        htmlBody: log.htmlBody,
        sentAt: log.sentAt,
        sentBy: log.sentBy,
        status: log.status,
        errorMessage: log.errorMessage,
      }));
    }),

  /** Resend a previously failed (or any) email by log entry ID */
  resend: protectedProcedure
    .input(z.object({ logId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user.complianceRole, ADMIN_ROLES);
      const original = await getEmailLogById(input.logId);
      if (!original) throw new TRPCError({ code: "NOT_FOUND", message: "Email log entry not found." });

      // Send again via emailService (will also create a new log entry)
      await emailService.sendManufacturerEmail(ctx.user as any, {
        productId: original.productId,
        to: original.to,
        subject: original.subject,
        htmlBody: original.htmlBody ?? "",
      });

      return { success: true };
    }),
});
