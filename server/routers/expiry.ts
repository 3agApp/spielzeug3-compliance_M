import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, isNotNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { documents, products, suppliers } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const expiryRouter = router({
  /**
   * Returns all documents that have an expiryDate set, grouped by urgency:
   *  - expired:  expiryDate < today
   *  - critical: expiryDate within 30 days
   *  - warning:  expiryDate within 31–60 days
   *  - upcoming: expiryDate within 61–90 days
   */
  getExpiringDocuments: protectedProcedure
    .input(
      z.object({
        daysAhead: z.number().min(1).max(365).default(90),
        supplierId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const now = new Date();
      const cutoff = addDays(now, input.daysAhead);

      // Fetch documents with expiry set, within the window (including already expired)
      const rows = await db
        .select({
          docId: documents.id,
          productId: documents.productId,
          documentType: documents.documentType,
          fileName: documents.fileName,
          fileUrl: documents.fileUrl,
          expiryDate: documents.expiryDate,
          reviewStatus: documents.reviewStatus,
          uploadedAt: documents.uploadedAt,
          productName: products.productName,
          internalArticleNumber: products.internalArticleNumber,
          brand: products.brand,
          productStatus: products.status,
          supplierId: products.supplierId,
          supplierName: suppliers.name,
        })
        .from(documents)
        .innerJoin(products, eq(documents.productId, products.id))
        .innerJoin(suppliers, eq(products.supplierId, suppliers.id))
        .where(
          and(
            isNotNull(documents.expiryDate),
            lte(documents.expiryDate, cutoff),
            input.supplierId ? eq(products.supplierId, input.supplierId) : undefined
          )
        )
        .orderBy(asc(documents.expiryDate));

      // Classify each row
      const enriched = rows.map((row) => {
        const expiry = row.expiryDate!;
        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        let urgency: "expired" | "critical" | "warning" | "upcoming";
        if (daysUntilExpiry < 0) urgency = "expired";
        else if (daysUntilExpiry <= 30) urgency = "critical";
        else if (daysUntilExpiry <= 60) urgency = "warning";
        else urgency = "upcoming";

        return { ...row, daysUntilExpiry, urgency };
      });

      return {
        items: enriched,
        summary: {
          expired: enriched.filter((r) => r.urgency === "expired").length,
          critical: enriched.filter((r) => r.urgency === "critical").length,
          warning: enriched.filter((r) => r.urgency === "warning").length,
          upcoming: enriched.filter((r) => r.urgency === "upcoming").length,
          total: enriched.length,
        },
      };
    }),

  /**
   * Returns expiry summary for the dashboard widget (counts only).
   */
  getDashboardSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { expired: 0, critical: 0, warning: 0, upcoming: 0, total: 0 };

    const now = new Date();
    const in90 = addDays(now, 90);

    const rows = await db
      .select({ expiryDate: documents.expiryDate })
      .from(documents)
      .where(and(isNotNull(documents.expiryDate), lte(documents.expiryDate, in90)));

    let expired = 0, critical = 0, warning = 0, upcoming = 0;
    for (const row of rows) {
      const days = Math.ceil((row.expiryDate!.getTime() - now.getTime()) / 86400000);
      if (days < 0) expired++;
      else if (days <= 30) critical++;
      else if (days <= 60) warning++;
      else upcoming++;
    }
    return { expired, critical, warning, upcoming, total: rows.length };
  }),

  /**
   * Update the expiryDate on a document.
   */
  setDocumentExpiry: protectedProcedure
    .input(z.object({ documentId: z.number(), expiryDate: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const role = (ctx.user as any).complianceRole ?? "internal_employee";
      if (!["administrator", "compliance_manager", "internal_employee"].includes(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .update(documents)
        .set({ expiryDate: input.expiryDate ? new Date(input.expiryDate) : null })
        .where(eq(documents.id, input.documentId));

      return { success: true };
    }),
});
