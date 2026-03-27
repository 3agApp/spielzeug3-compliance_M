/**
 * server/routers/admin.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for admin operations.
 * All business logic lives in adminService.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminService } from "../domains/users/adminService";
import { toTRPCError } from "../shared";

export const adminRouter = router({
  // ─── Users ─────────────────────────────────────────────────────────────────
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await adminService.listUsers(ctx.user as any);
    } catch (err) {
      throw toTRPCError(err);
    }
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
      try {
        const { id, ...data } = input;
        return await adminService.updateUser(ctx.user as any, id, data as any);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  // ─── Requirement Types ──────────────────────────────────────────────────────
  listRequirementTypes: protectedProcedure.query(async () => {
    try {
      return await adminService.listRequirementTypes();
    } catch (err) {
      throw toTRPCError(err);
    }
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
      try {
        return await adminService.createRequirementType(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
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
      try {
        const { id, ...data } = input;
        return await adminService.updateRequirementType(ctx.user as any, id, data);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  // ─── Audit Logs ─────────────────────────────────────────────────────────────
  getAuditLogs: protectedProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async ({ ctx, input }) => {
      try {
        return await adminService.getAuditLogs(ctx.user as any, input.limit);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  // ─── User Profile ───────────────────────────────────────────────────────────
  updateMyLanguage: protectedProcedure
    .input(z.object({ language: z.enum(["de", "en"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await adminService.updateMyLanguage(ctx.user as any, input.language);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  // ─── System Settings ────────────────────────────────────────────────────────
  getSystemSetting: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return await adminService.getSystemSetting(ctx.user as any, input.key);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  setSystemSetting: protectedProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await adminService.setSystemSetting(ctx.user as any, input.key, input.value);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
