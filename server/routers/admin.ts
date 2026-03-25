import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createAuditLog,
  createRequirementType,
  getAllRequirementTypes,
  getAllUsers,
  getAuditLogs,
  getSystemSetting,
  updateRequirementType,
  updateUser,
  upsertSystemSetting,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

function requireAdmin(role: string) {
  if (role !== "administrator") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access required" });
  }
}

function requireManagerOrAdmin(role: string) {
  if (!["administrator", "compliance_manager"].includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

export const adminRouter = router({
  // ─── Users ────────────────────────────────────────────────────────────────
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    requireManagerOrAdmin(ctx.user.complianceRole ?? "");
    return getAllUsers();
  }),

  updateUser: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        complianceRole: z
          .enum(["supplier", "internal_employee", "compliance_manager", "administrator"])
          .optional(),
        supplierId: z.number().nullable().optional(),
        active: z.boolean().optional(),
        languagePreference: z.enum(["de", "en"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.complianceRole ?? "");
      const { id, ...data } = input;
      await updateUser(id, data as any);
      await createAuditLog({
        entityType: "user",
        entityId: id,
        action: "updated",
        performedByUserId: ctx.user.id,
        payloadSnapshot: data as any,
      });
      return { success: true };
    }),

  // ─── Requirement Types ────────────────────────────────────────────────────
  listRequirementTypes: protectedProcedure.query(async ({ ctx }) => {
    return getAllRequirementTypes();
  }),

  createRequirementType: protectedProcedure
    .input(
      z.object({
        key: z.string().min(1),
        labelDe: z.string().min(1),
        labelEn: z.string().min(1),
        category: z.enum(["document", "data"]),
        required: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.complianceRole ?? "");
      await createRequirementType({ ...input, active: true });
      return { success: true };
    }),

  updateRequirementType: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        labelDe: z.string().optional(),
        labelEn: z.string().optional(),
        required: z.boolean().optional(),
        active: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.complianceRole ?? "");
      const { id, ...data } = input;
      await updateRequirementType(id, data);
      return { success: true };
    }),

  // ─── Audit Logs ───────────────────────────────────────────────────────────
  getAuditLogs: protectedProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async ({ ctx, input }) => {
      requireManagerOrAdmin(ctx.user.complianceRole ?? "");
      return getAuditLogs(input.limit);
    }),

  // ─── User Profile Update ──────────────────────────────────────────────────
  updateMyLanguage: protectedProcedure
    .input(z.object({ language: z.enum(["de", "en"]) }))
    .mutation(async ({ ctx, input }) => {
      await updateUser(ctx.user.id, { languagePreference: input.language });
      return { success: true };
    }),

  // ─── System Settings ──────────────────────────────────────────────────────
  getSystemSetting: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      requireManagerOrAdmin(ctx.user.complianceRole ?? "");
      return getSystemSetting(input.key);
    }),

  setSystemSetting: protectedProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.complianceRole ?? "");
      await upsertSystemSetting(input.key, input.value, false, ctx.user.id);
      await createAuditLog({
        entityType: "system_setting",
        action: "updated",
        performedByUserId: ctx.user.id,
        payloadSnapshot: { key: input.key } as any,
      });
      return { success: true };
    }),
});
