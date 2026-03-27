/**
 * server/routers/bunnydoc.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for the BunnyDoc digital signature domain.
 * All business logic lives in server/domains/compliance/bunnydocService.ts.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { bunnydocService } from "../domains/compliance/bunnydocService";
import { toTRPCError } from "../shared/errors";

export const bunnydocRouter = router({
  // ── Settings ────────────────────────────────────────────────────────────────
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await bunnydocService.getSettings(ctx.user as any);
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  saveSettings: protectedProcedure
    .input(z.object({
      apiKey:     z.string().min(1),
      templateId: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await bunnydocService.saveSettings(ctx.user as any, input.apiKey, input.templateId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  // ── Signature Requests ───────────────────────────────────────────────────────
  latestByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await bunnydocService.latestByProduct(ctx.user as any, input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  listByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await bunnydocService.listByProduct(ctx.user as any, input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  send: protectedProcedure
    .input(z.object({
      productId:    z.number(),
      signerName:   z.string().min(1),
      signerEmail:  z.string().email(),
      signerRole:   z.string().default("signer"),
      title:        z.string().optional(),
      emailMessage: z.string().optional(),
      fields: z.array(z.object({
        apiLabel: z.string(),
        value:    z.union([z.string(), z.boolean(), z.number()]),
        readOnly: z.union([z.literal(0), z.literal(1)]).optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await bunnydocService.send(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await bunnydocService.cancel(ctx.user as any, input.id);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
