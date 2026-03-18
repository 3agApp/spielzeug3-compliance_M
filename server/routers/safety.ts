import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createAuditLog, getProductById, getProductSafety, upsertProductSafety } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const safetyRouter = router({
  getByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getProductSafety(input.productId);
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
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await upsertProductSafety({ ...input, submittedByUserId: ctx.user.id });
      await createAuditLog({
        entityType: "product_safety",
        entityId: input.productId,
        action: "updated",
        performedByUserId: ctx.user.id,
      });
      return { success: true };
    }),
});
