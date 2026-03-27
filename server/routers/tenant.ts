/**
 * server/routers/tenant.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for the Tenant + Seal domain.
 * All business logic lives in server/domains/tenants/tenantService.ts.
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { tenantService } from "../domains/tenants/tenantService";
import { toTRPCError } from "../shared/errors";
import { storagePut } from "../storage";
import { TRPCError } from "@trpc/server";
import { updateTenant } from "../tenantDb";

export const tenantRouter = router({
  // ── Get current tenant for logged-in user ──────────────────────────────────
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await tenantService.getCurrent(ctx.user as any);
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  // ── Get tenant by slug (public) ───────────────────────────────────────────
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return tenantService.getBySlug(input.slug);
    }),

  // ── List all tenants with stats (super_admin only) ────────────────────────
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await tenantService.list(ctx.user as any);
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  // ── Create tenant (super_admin only) ──────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
      name: z.string().min(1).max(255),
      plan: z.enum(["starter", "professional", "enterprise"]).default("starter"),
      modulesEnabled: z.array(z.string()).default(["compliance"]),
      contactEmail: z.string().email().optional(),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#C8102E"),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await tenantService.create(ctx.user as any, {
          slug: input.slug,
          name: input.name,
          plan: input.plan,
          modulesEnabled: input.modulesEnabled,
          contactEmail: input.contactEmail ?? null,
          primaryColor: input.primaryColor,
          isActive: true,
          logoUrl: null,
        });
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  // ── Update tenant (super_admin only) ──────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      plan: z.enum(["starter", "professional", "enterprise"]).optional(),
      modulesEnabled: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
      contactEmail: z.string().email().optional().nullable(),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      websiteUrl: z.string().max(255).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await tenantService.update(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

    // ── Update own tenant portal settings (admin / compliance_manager) ────
  updateMyTenant: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255).optional(),
      websiteUrl: z.string().max(255).optional().nullable(),
      contactEmail: z.string().email().optional().nullable(),
      logoUrl: z.string().url().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await tenantService.updateMyTenant(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  // ── Upload tenant logo (admin / compliance_manager) ──────────────────────
  uploadLogo: protectedProcedure
    .input(z.object({
      fileBase64: z.string().min(1),
      mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
      fileName: z.string().max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user as any;
      const role = user.complianceRole ?? "internal_employee";
      if (!["super_admin", "administrator", "compliance_manager"].includes(role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Keine Berechtigung für Logo-Upload" });
      }
      const tenantId: number = user.tenantId ?? 1;

      // Decode base64 and upload to S3
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      if (fileBuffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Logo-Datei zu groß (max. 5 MB)" });
      }
      const ext = input.mimeType.split("/")[1].replace("svg+xml", "svg");
      const fileKey = `tenant-logos/tenant-${tenantId}-logo-${Date.now()}.${ext}`;
      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);

      // Persist URL in tenant record
      await updateTenant(tenantId, { logoUrl: url } as any);

      return { url, fileKey };
    }),

  // ── Activate seal for a product (generate UUID + QR code) ─────────────────
  activateSeal: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await tenantService.activateSeal(ctx.user as any, input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  // ── Get seal info for a product ───────────────────────────────────────────
  getSealInfo: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await tenantService.getSealInfo(ctx.user as any, input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  // ── Public product page data (no auth required) ───────────────────────────
  getPublicProduct: publicProcedure
    .input(z.object({ uuid: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        return await tenantService.getPublicProduct(input.uuid);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  // ── Toggle public visibility ──────────────────────────────────────────────
  setPublicVisible: protectedProcedure
    .input(z.object({ productId: z.number(), visible: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await tenantService.setPublicVisible(ctx.user as any, input.productId, input.visible);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  // ── Override seal status (admin only) ────────────────────────────────────
  setSealStatusOverride: protectedProcedure
    .input(z.object({
      productId: z.number(),
      override: z.enum(["verified", "in_progress", "not_verified"]).nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await tenantService.setSealStatusOverride(
          ctx.user as any,
          input.productId,
          input.override
        );
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
