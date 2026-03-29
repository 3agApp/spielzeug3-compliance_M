/**
 * server/routers/emailLogs.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * tRPC router for retrieving email send logs per product.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getEmailLogsByProduct } from "../db";
import { requireRole, ADMIN_ROLES } from "../shared";

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
});
