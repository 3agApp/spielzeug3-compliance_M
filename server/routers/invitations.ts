/**
 * server/routers/invitations.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for Supplier Invitations.
 * All business logic lives in invitationService.
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { invitationService } from "../domains/invitations/invitationService";
import { toTRPCError } from "../shared";

export const invitationsRouter = router({
  /** List all invitations (admin only). */
  list: protectedProcedure
    .input(z.object({ supplierId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        return await invitationService.list(ctx.user as any, input?.supplierId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Create a new invitation (admin/compliance_manager only). */
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
      try {
        return await invitationService.create(ctx.user as any, {
          supplierId: input.supplierId,
          email: input.email,
          expiryDays: input.validDays,
          origin: input.origin,
        });
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Validate a token (public – called from the accept page).
   * Returns the invitation details on success, or null when not found/expired.
   * The old API returned { valid: false } – we keep that shape for the frontend. */
  validateToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      try {
        return await invitationService.validateToken(input.token);
      } catch (err: any) {
        // Return null (falsy) for unknown / expired tokens so the frontend can
        // check `if (!validation)` without a thrown error.
        if (err?.code === "NOT_FOUND" || err?.code === "PRECONDITION_FAILED") {
          return null;
        }
        throw toTRPCError(err);
      }
    }),

  /** Accept an invitation – links the current logged-in user to the supplier. */
  accept: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await invitationService.accept({ token: input.token, userId: ctx.user!.id });
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Revoke a pending invitation (admin only). */
  revoke: protectedProcedure
    .input(z.object({ invitationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await invitationService.revoke(ctx.user as any, input.invitationId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
