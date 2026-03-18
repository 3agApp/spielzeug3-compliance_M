import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { supplierInvitations, suppliers, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const invitationsRouter = router({
  /**
   * List all invitations (admin only).
   */
  list: protectedProcedure
    .input(z.object({ supplierId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const role = (ctx.user as any).complianceRole ?? "internal_employee";
      if (!["administrator", "compliance_manager"].includes(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const rows = await db
        .select({
          id: supplierInvitations.id,
          supplierId: supplierInvitations.supplierId,
          email: supplierInvitations.email,
          status: supplierInvitations.status,
          expiresAt: supplierInvitations.expiresAt,
          acceptedAt: supplierInvitations.acceptedAt,
          createdAt: supplierInvitations.createdAt,
          supplierName: suppliers.name,
          supplierCode: suppliers.supplierCode,
        })
        .from(supplierInvitations)
        .innerJoin(suppliers, eq(supplierInvitations.supplierId, suppliers.id))
        .where(input?.supplierId ? eq(supplierInvitations.supplierId, input.supplierId) : undefined)
        .orderBy(desc(supplierInvitations.createdAt));

      return rows;
    }),

  /**
   * Create a new invitation (admin/compliance_manager only).
   * Returns the invitation token and a magic-link URL.
   */
  create: protectedProcedure
    .input(
      z.object({
        supplierId: z.number(),
        email: z.string().email(),
        validDays: z.number().min(1).max(30).default(7),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const role = (ctx.user as any).complianceRole ?? "internal_employee";
      if (!["administrator", "compliance_manager"].includes(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Verify supplier exists
      const [supplier] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, input.supplierId))
        .limit(1);
      if (!supplier) throw new TRPCError({ code: "NOT_FOUND", message: "Lieferant nicht gefunden" });

      // Revoke any existing pending invitations for same supplier+email
      await db
        .update(supplierInvitations)
        .set({ status: "revoked" })
        .where(
          and(
            eq(supplierInvitations.supplierId, input.supplierId),
            eq(supplierInvitations.email, input.email),
            eq(supplierInvitations.status, "pending")
          )
        );

      const token = nanoid(48);
      const expiresAt = addDays(new Date(), input.validDays);

      await db.insert(supplierInvitations).values({
        supplierId: input.supplierId,
        email: input.email,
        token,
        status: "pending",
        invitedByUserId: ctx.user!.id,
        expiresAt,
      });

      const magicLink = `${input.origin}/invite/accept?token=${token}`;

      return {
        token,
        magicLink,
        expiresAt,
        supplierName: supplier.name,
        email: input.email,
      };
    }),

  /**
   * Validate a token (public – called from the accept page).
   */
  validateToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [inv] = await db
        .select({
          id: supplierInvitations.id,
          supplierId: supplierInvitations.supplierId,
          email: supplierInvitations.email,
          status: supplierInvitations.status,
          expiresAt: supplierInvitations.expiresAt,
          supplierName: suppliers.name,
          supplierCode: suppliers.supplierCode,
        })
        .from(supplierInvitations)
        .innerJoin(suppliers, eq(supplierInvitations.supplierId, suppliers.id))
        .where(eq(supplierInvitations.token, input.token))
        .limit(1);

      if (!inv) return { valid: false, reason: "Token nicht gefunden" };
      if (inv.status === "accepted") return { valid: false, reason: "Einladung bereits angenommen" };
      if (inv.status === "revoked") return { valid: false, reason: "Einladung wurde widerrufen" };
      if (inv.status === "expired" || inv.expiresAt < new Date()) {
        // Mark as expired in DB
        await db
          .update(supplierInvitations)
          .set({ status: "expired" })
          .where(eq(supplierInvitations.id, inv.id));
        return { valid: false, reason: "Einladung ist abgelaufen" };
      }

      return {
        valid: true,
        invitation: {
          id: inv.id,
          email: inv.email,
          supplierId: inv.supplierId,
          supplierName: inv.supplierName,
          supplierCode: inv.supplierCode,
          expiresAt: inv.expiresAt,
        },
      };
    }),

  /**
   * Accept an invitation – links the current logged-in user to the supplier.
   */
  accept: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [inv] = await db
        .select()
        .from(supplierInvitations)
        .where(eq(supplierInvitations.token, input.token))
        .limit(1);

      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Token nicht gefunden" });
      if (inv.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Einladung nicht mehr gültig" });
      }
      if (inv.expiresAt < new Date()) {
        await db
          .update(supplierInvitations)
          .set({ status: "expired" })
          .where(eq(supplierInvitations.id, inv.id));
        throw new TRPCError({ code: "BAD_REQUEST", message: "Einladung ist abgelaufen" });
      }

      // Link user to supplier and set complianceRole
      await db
        .update(users)
        .set({ supplierId: inv.supplierId, complianceRole: "supplier" })
        .where(eq(users.id, ctx.user!.id));

      // Mark invitation as accepted
      await db
        .update(supplierInvitations)
        .set({ status: "accepted", acceptedByUserId: ctx.user!.id, acceptedAt: new Date() })
        .where(eq(supplierInvitations.id, inv.id));

      return { success: true, supplierId: inv.supplierId };
    }),

  /**
   * Revoke a pending invitation (admin only).
   */
  revoke: protectedProcedure
    .input(z.object({ invitationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const role = (ctx.user as any).complianceRole ?? "internal_employee";
      if (!["administrator", "compliance_manager"].includes(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .update(supplierInvitations)
        .set({ status: "revoked" })
        .where(eq(supplierInvitations.id, input.invitationId));

      return { success: true };
    }),
});
