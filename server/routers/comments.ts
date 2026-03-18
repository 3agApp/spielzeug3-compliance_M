import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createComment, getCommentsByProduct, getProductById } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const commentsRouter = router({
  listByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const isInternal = role !== "supplier";
      return getCommentsByProduct(input.productId, isInternal);
    }),

  create: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        commentText: z.string().min(1),
        visibilityInternalOnly: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Suppliers cannot create internal-only comments
      const internalOnly = role === "supplier" ? false : input.visibilityInternalOnly;
      await createComment({
        productId: input.productId,
        userId: ctx.user.id,
        userRole: role,
        commentText: input.commentText,
        visibilityInternalOnly: internalOnly,
      });
      return { success: true };
    }),
});
