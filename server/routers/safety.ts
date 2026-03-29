/**
 * server/routers/safety.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for Product Safety data.
 * All business logic lives in safetyService.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { safetyService } from "../domains/compliance/safetyService";
import { toTRPCError } from "../shared";
import { storagePut } from "../storage";
import { getProductSafety, upsertProductSafety } from "../db";

export const safetyRouter = router({
  getByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await safetyService.getByProduct(ctx.user as any, input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        safetyText: z.string().optional(),
        warningText: z.string().optional(),
        ageGrading: z.string().optional(),
        materialInformation: z.string().optional(),
        usageRestrictions: z.string().optional(),
        safetyNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await safetyService.upsert(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Upload a safety/warning image (base64) and append URL to safetyImages JSON array */
  uploadSafetyImage: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        fileName: z.string(),
        mimeType: z.string(),
        base64: z.string(), // raw base64 or data URL
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const user = ctx.user as any;
        // Strip data URL prefix if present
        const raw = input.base64.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(raw, "base64");
        const key = `safety-images/${input.productId}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);

        // Append URL to existing safetyImages array
        const existing = await getProductSafety(input.productId);
        const currentImages: string[] = Array.isArray((existing as any)?.safetyImages)
          ? (existing as any).safetyImages
          : [];
        const updatedImages = [...currentImages, url];

        await upsertProductSafety({
          productId: input.productId,
          safetyImages: updatedImages as any,
          submittedByUserId: user.id,
        });
        return { url, images: updatedImages };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /** Remove a safety image URL from the safetyImages array */
  deleteSafetyImage: protectedProcedure
    .input(z.object({ productId: z.number(), imageUrl: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await getProductSafety(input.productId);
        const currentImages: string[] = Array.isArray((existing as any)?.safetyImages)
          ? (existing as any).safetyImages
          : [];
        const updatedImages = currentImages.filter((u) => u !== input.imageUrl);
        await upsertProductSafety({
          productId: input.productId,
          safetyImages: updatedImages as any,
          submittedByUserId: (ctx.user as any).id,
        });
        return { images: updatedImages };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
