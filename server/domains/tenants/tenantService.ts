/**
 * server/domains/tenants/tenantService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for the Tenants domain (multi-tenant platform management)
 * and the Seal sub-domain (QR codes, public product pages, seal status).
 *
 * Only super_admin users may manage tenants.
 * Seal operations require administrator / compliance_manager / super_admin.
 */

import {
  getTenantById,
  getTenantBySlug,
  listTenants,
  createTenant,
  updateTenant,
  getTenantStats,
  ensureProductPublicUuid,
} from "../../tenantDb";
import { getDb } from "../../db";
import { products, productSafetyEntries, documents } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getSealStatus, getPublicProductUrl } from "../../sealUtils";
import { TRPCError } from "@trpc/server";
import { Errors, requireRole } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateTenantInput {
  name: string;
  slug: string;
  plan?: string;
  modulesEnabled?: string[];
  contactEmail?: string | null;
  logoUrl?: string | null;
  primaryColor?: string;
  isActive?: boolean;
}

export interface UpdateTenantInput {
  id: number;
  name?: string;
  plan?: string;
  modulesEnabled?: string[];
  isActive?: boolean;
  logoUrl?: string | null;
  primaryColor?: string;
  contactEmail?: string | null;
  websiteUrl?: string | null;
}

export interface UpdateMyTenantInput {
  name?: string;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  logoUrl?: string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const tenantService = {
  // ── Tenant management (super_admin only) ────────────────────────────────────

  /** Get the current tenant for a logged-in user. */
  async getCurrent(user: UserContext) {
    const tenantId = user.tenantId ?? 1;
    return getTenantById(tenantId);
  },

  /** Get a tenant by slug (public – no auth required). */
  async getBySlug(slug: string) {
    return getTenantBySlug(slug);
  },

  /** List all tenants with stats (super_admin only). */
  async list(user: UserContext) {
    requireRole(user.complianceRole, ["super_admin"]);
    const allTenants = await listTenants();
    return Promise.all(
      allTenants.map(async (t) => {
        const stats = await getTenantStats(t.id);
        return { ...t, ...stats };
      })
    );
  },

  /** Get a single tenant by ID. */
  async getById(user: UserContext, tenantId: number) {
    const role = user.complianceRole ?? "internal_employee";
    if (role !== "super_admin" && user.tenantId !== tenantId) {
      throw Errors.tenantIsolation();
    }
    const tenant = await getTenantById(tenantId);
    if (!tenant) throw Errors.notFound("Tenant", tenantId);
    return tenant;
  },

  /** Create a new tenant (super_admin only). */
  async create(user: UserContext, input: CreateTenantInput) {
    requireRole(user.complianceRole, ["super_admin"]);
    const existing = await getTenantBySlug(input.slug);
    if (existing) {
      throw Errors.validation(`Tenant slug '${input.slug}' is already taken`);
    }
    return createTenant({
      name: input.name,
      slug: input.slug,
      plan: (input.plan ?? "starter") as any,
      modulesEnabled: input.modulesEnabled ?? ["compliance"],
      contactEmail: input.contactEmail ?? null,
      logoUrl: input.logoUrl ?? null,
      primaryColor: input.primaryColor ?? "#C8102E",
      isActive: input.isActive ?? true,
    });
  },

  /** Update tenant settings (super_admin only). */
  async update(user: UserContext, input: UpdateTenantInput) {
    requireRole(user.complianceRole, ["super_admin"]);
    const { id, ...data } = input;
    await updateTenant(id, data as any);
    return getTenantById(id);
  },

  /** Update own tenant's portal settings (admin / compliance_manager / super_admin). */
  async updateMyTenant(user: UserContext, input: UpdateMyTenantInput) {
    requireRole(user.complianceRole, ["super_admin", "administrator", "compliance_manager"]);
    const tenantId = user.tenantId ?? 1;
    await updateTenant(tenantId, input as any);
    return getTenantById(tenantId);
  },

  /** Get aggregated stats for a tenant (super_admin only). */
  async getStats(user: UserContext, tenantId: number) {
    requireRole(user.complianceRole, ["super_admin"]);
    return getTenantStats(tenantId);
  },

  // ── Seal domain ─────────────────────────────────────────────────────────────

  /** Get seal info for a product (QR code URL, seal status, public URL). */
  async getSealInfo(_user: UserContext, productId: number) {
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
        publicVisible: products.publicVisible,
        sealStatusOverride: products.sealStatusOverride,
        importerName: products.importerName,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    const product = result[0];
    if (!product) return null;
    const sealStatus = getSealStatus(product);
    return {
      ...product,
      sealStatus,
      publicUrl: product.publicUuid ? getPublicProductUrl(product.publicUuid) : null,
    };
  },

  /**
   * Activate the seal for a product: generate a public UUID and QR code.
   * Requires administrator / compliance_manager / super_admin.
   */
  async activateSeal(user: UserContext, productId: number) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager", "super_admin"]);
    const tenantId = user.tenantId ?? 1;
    const tenant = await getTenantById(tenantId);
    if (!tenant) throw Errors.notFound("Tenant", tenantId);

    const modules = (tenant.modulesEnabled as string[]) ?? [];
    if (!modules.includes("seal") && user.complianceRole !== "super_admin") {
      throw Errors.forbidden("Seal module not enabled for this tenant");
    }

    const result = await ensureProductPublicUuid(productId, tenant.slug);
    return {
      ...result,
      publicUrl: getPublicProductUrl(result.publicUuid),
    };
  },

  /**
   * Return the full public product data for the QR landing page.
   * No authentication required.
   */
  async getPublicProduct(uuid: string) {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

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
        publicVisible: products.publicVisible,
        sealStatusOverride: products.sealStatusOverride,
        importerName: products.importerName,
        batchInfo: products.batchInfo,
        supplierId: products.supplierId,
        internalArticleNumber: products.internalArticleNumber,
        supplierConfirmedAt: products.supplierConfirmedAt,
        supplierConfirmedBy: products.supplierConfirmedBy,
      })
      .from(products)
      .where(eq(products.publicUuid, uuid))
      .limit(1);

    const product = result[0];
    if (!product) throw Errors.notFound("Product", uuid);
    if (!product.publicVisible) throw Errors.notFound("Product", uuid); // treat as 404

    const tenant = await getTenantById(product.tenantId);

    const safetyResult = await db
      .select({
        safetyText: productSafetyEntries.safetyText,
        warningText: productSafetyEntries.warningText,
        ageGrading: productSafetyEntries.ageGrading,
        materialInformation: productSafetyEntries.materialInformation,
        usageRestrictions: productSafetyEntries.usageRestrictions,
      })
      .from(productSafetyEntries)
      .where(eq(productSafetyEntries.productId, product.id))
      .limit(1);

    const docsResult = await db
      .select({
        documentType: documents.documentType,
        reviewStatus: documents.reviewStatus,
        uploadedAt: documents.uploadedAt,
      })
      .from(documents)
      .where(eq(documents.productId, product.id));

    const docSummary = docsResult.reduce(
      (acc, doc) => {
        const key = doc.documentType;
        if (!acc[key]) acc[key] = { type: key, total: 0, approved: 0, pending: 0, rejected: 0 };
        acc[key].total++;
        if (doc.reviewStatus === "approved") acc[key].approved++;
        else if (doc.reviewStatus === "rejected") acc[key].rejected++;
        else acc[key].pending++;
        return acc;
      },
      {} as Record<string, { type: string; total: number; approved: number; pending: number; rejected: number }>
    );

    const sealStatus = getSealStatus(product);

    return {
      productName: product.productName,
      brand: product.brand,
      ean: product.ean,
      internalArticleNumber: product.internalArticleNumber,
      imageUrl: product.imageUrl,
      sealStatus,
      approvedAt: product.approvedAt,
      sealEnabledAt: product.sealEnabledAt,
      completenessScore: Number(product.completenessScore ?? 0),
      batchInfo: product.batchInfo as Record<string, string> | null,
      importerName: product.importerName,
      supplierConfirmedAt: product.supplierConfirmedAt,
      supplierConfirmedBy: product.supplierConfirmedBy,
      documentSummary: Object.values(docSummary),
      totalDocuments: docsResult.length,
      approvedDocuments: docsResult.filter((d) => d.reviewStatus === "approved").length,
      safety: safetyResult[0] ?? null,
      tenant: tenant
        ? {
            name: tenant.name,
            slug: tenant.slug,
            logoUrl: tenant.logoUrl,
            primaryColor: tenant.primaryColor,
            contactEmail: (tenant as any).contactEmail ?? null,
          }
        : null,
    };
  },

  /** Toggle the public visibility of a product's landing page. */
  async setPublicVisible(user: UserContext, productId: number, visible: boolean) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager", "super_admin"]);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    await db.update(products).set({ publicVisible: visible }).where(eq(products.id, productId));
    return { success: true };
  },

  /** Override the seal status for a product (admin only). */
  async setSealStatusOverride(
    user: UserContext,
    productId: number,
    override: "verified" | "in_progress" | "not_verified" | null
  ) {
    requireRole(user.complianceRole, ["administrator", "super_admin"]);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    await db
      .update(products)
      .set({ sealStatusOverride: override as any })
      .where(eq(products.id, productId));
    return { success: true };
  },
};
