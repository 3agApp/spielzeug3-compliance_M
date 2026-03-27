/**
 * server/routers/suppliers.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for Supplier management.
 * All business logic lives in supplierService.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { supplierService } from "../domains/suppliers/supplierService";
import { toTRPCError } from "../shared";

export const suppliersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await supplierService.list(ctx.user as any);
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await supplierService.getById(ctx.user as any, input.id);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        supplierCode: z.string().min(1),
        name: z.string().min(1),
        address: z.string().optional(),
        country: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        kontorId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await supplierService.create(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        address: z.string().optional(),
        country: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        active: z.boolean().optional(),
        kontorId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...rest } = input;
        return await supplierService.update(ctx.user as any, {
          supplierId: id,
          name: rest.name,
          country: rest.country,
          contactEmail: rest.email,
        });
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
