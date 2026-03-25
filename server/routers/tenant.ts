import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getTenantById,
  getTenantBySlug,
  listTenants,
  createTenant,
  updateTenant,
  getTenantStats,
  ensureProductPublicUuid,
} from "../tenantDb";
import { getSealStatus, getPublicProductUrl } from "../sealUtils";
import { getDb } from "../db";
import { products, suppliers } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Helper: require super_admin
function requireSuperAdmin(complianceRole: string | null | undefined) {
  if (complianceRole !== "super_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Super admin access required" });
  }
}

export const tenantRouter = router({
  // ── Get current tenant for logged-in user ──────────────────────────────────
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId ?? 1;
    return getTenantById(tenantId);
  }),

  // ── Get tenant by slug (public, for public product pages) ─────────────────
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return getTenantBySlug(input.slug);
    }),

  // ── List all tenants (super_admin only) ───────────────────────────────────
  list: protectedProcedure.query(async ({ ctx }) => {
    requireSuperAdmin(ctx.user.complianceRole);
    const allTenants = await listTenants();
    // Attach stats
    const withStats = await Promise.all(
      allTenants.map(async (t) => {
        const stats = await getTenantStats(t.id);
        return { ...t, ...stats };
      })
    );
    return withStats;
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
      requireSuperAdmin(ctx.user.complianceRole);
      return createTenant({
        slug: input.slug,
        name: input.name,
        plan: input.plan,
        modulesEnabled: input.modulesEnabled,
        contactEmail: input.contactEmail ?? null,
        primaryColor: input.primaryColor,
        isActive: true,
        logoUrl: null,
      });
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
    }))
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.user.complianceRole);
      const { id, ...data } = input;
      await updateTenant(id, data);
      return getTenantById(id);
    }),

  // ── Activate seal for a product (generate UUID + QR code) ─────────────────
  activateSeal: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user.complianceRole;
      if (role !== "administrator" && role !== "compliance_manager" && role !== "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
      }
      const tenantId = ctx.user.tenantId ?? 1;
      const tenant = await getTenantById(tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

      // Check seal module is enabled
      const modules = (tenant.modulesEnabled as string[]) ?? [];
      if (!modules.includes("seal") && role !== "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seal module not enabled for this tenant" });
      }

      const result = await ensureProductPublicUuid(input.productId, tenant.slug);
      return {
        ...result,
        publicUrl: getPublicProductUrl(result.publicUuid),
      };
    }),

  // ── Get seal info for a product ───────────────────────────────────────────
  getSealInfo: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const result = await db
        .select({
          id: products.id,
          publicUuid: products.publicUuid,
          qrCodeUrl: products.qrCodeUrl,
          qrCodeSvgUrl: products.qrCodeSvgUrl,
          sealEnabledAt: products.sealEnabledAt,
          status: products.status,
          completenessScore: products.completenessScore,
          tenantId: products.tenantId,
        })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);
      const product = result[0];
      if (!product) return null;
      const sealStatus = getSealStatus(product);
      return {
        ...product,
        sealStatus,
        publicUrl: product.publicUuid ? getPublicProductUrl(product.publicUuid) : null,
      };
    }),

  // ── Public product page data (no auth required) ───────────────────────────
  getPublicProduct: publicProcedure
    .input(z.object({ uuid: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select({
          id: products.id,
          productName: products.productName,
          brand: products.brand,
          ean: products.ean,
          imageUrl: products.imageUrl,
          status: products.status,
          completenessScore: products.completenessScore,
          publicUuid: products.publicUuid,
          sealEnabledAt: products.sealEnabledAt,
          tenantId: products.tenantId,
          approvedAt: products.approvedAt,
        })
        .from(products)
        .where(eq(products.publicUuid, input.uuid))
        .limit(1);

      const product = result[0];
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      // Get tenant info (importer)
      const tenant = await getTenantById(product.tenantId);

      // Get supplier info
      const supplierResult = await db
        .select({ id: suppliers.id, name: suppliers.name, country: suppliers.country })
        .from(suppliers)
        .where(eq(suppliers.id, product.tenantId)) // Note: we use tenantId as proxy; real FK is supplierId
        .limit(1);

      const sealStatus = getSealStatus(product);

      return {
        productName: product.productName,
        brand: product.brand,
        ean: product.ean,
        imageUrl: product.imageUrl,
        sealStatus,
        approvedAt: product.approvedAt,
        sealEnabledAt: product.sealEnabledAt,
        completenessScore: Number(product.completenessScore ?? 0),
        tenant: tenant ? {
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
        } : null,
      };
    }),
});
