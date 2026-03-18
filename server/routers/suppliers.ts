import { z } from "zod";
import { createAuditLog, createSupplier, getAllSuppliers, getSupplierById, updateSupplier } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

export const suppliersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.user.complianceRole ?? "internal_employee";
    if (role === "supplier") {
      // Suppliers only see their own supplier
      if (!ctx.user.supplierId) return [];
      const s = await getSupplierById(ctx.user.supplierId);
      return s ? [s] : [];
    }
    return getAllSuppliers();
  }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const role = ctx.user.complianceRole ?? "internal_employee";
    if (role === "supplier" && ctx.user.supplierId !== input.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const supplier = await getSupplierById(input.id);
    if (!supplier) throw new TRPCError({ code: "NOT_FOUND" });
    return supplier;
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
      requireRole(ctx.user.complianceRole ?? "", ["administrator", "compliance_manager"]);
      await createSupplier({ ...input, active: true });
      await createAuditLog({
        entityType: "supplier",
        action: "created",
        performedByUserId: ctx.user.id,
        payloadSnapshot: input as any,
      });
      return { success: true };
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
      requireRole(ctx.user.complianceRole ?? "", ["administrator", "compliance_manager"]);
      const { id, ...data } = input;
      await updateSupplier(id, data);
      await createAuditLog({
        entityType: "supplier",
        entityId: id,
        action: "updated",
        performedByUserId: ctx.user.id,
        payloadSnapshot: data as any,
      });
      return { success: true };
    }),
});
