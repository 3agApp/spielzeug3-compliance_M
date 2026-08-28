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
import { products, productSafetyEntries, documents, productImages } from "../../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { getSealStatus, getPublicProductUrl } from "../../sealUtils";
import { verifySwissBatchNumber } from "./swissBatchVerification";
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
  primaryColor?: string | null;
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
        id: documents.id,
        documentType: documents.documentType,
        fileName: documents.fileName,
        fileUrl: documents.fileUrl,
        mimeType: documents.mimeType,
        fileSizeBytes: documents.fileSizeBytes,
        version: documents.version,
        reviewStatus: documents.reviewStatus,
        reviewNote: documents.reviewNote,
        expiryDate: documents.expiryDate,
        publicDownload: documents.publicDownload,
        isArchived: documents.isArchived,
        uploadedAt: documents.uploadedAt,
      })
      .from(documents)
      .where(eq(documents.productId, product.id));

    // Only non-archived docs for summary
    const activeDocs = docsResult.filter((d) => !d.isArchived);

    const docSummary = activeDocs.reduce(
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

    // Public downloadable documents: approved + publicDownload=true + not archived
    const publicDocuments = activeDocs
      .filter((d) => d.reviewStatus === "approved" && d.publicDownload)
      .map((d) => ({
        id: d.id,
        documentType: d.documentType,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        mimeType: d.mimeType ?? null,
        fileSizeBytes: d.fileSizeBytes ?? null,
        version: d.version,
        expiryDate: d.expiryDate ?? null,
        uploadedAt: d.uploadedAt,
      }));

    // Fetch product images ordered by sortOrder
    const imagesResult = await db
      .select({
        id: productImages.id,
        url: productImages.url,
        originalName: productImages.originalName,
        mimeType: productImages.mimeType,
        sortOrder: productImages.sortOrder,
      })
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(asc(productImages.sortOrder));

    const sealStatus = getSealStatus(product);

    return {
      productName: product.productName,
      brand: product.brand,
      ean: product.ean,
      internalArticleNumber: product.internalArticleNumber,
      imageUrl: product.imageUrl,
      productImages: imagesResult,
      sealStatus,
      approvedAt: product.approvedAt,
      sealEnabledAt: product.sealEnabledAt,
      completenessScore: Number(product.completenessScore ?? 0),
      batchInfo: product.batchInfo as Record<string, string> | null,
      importerName: product.importerName,
      supplierConfirmedAt: product.supplierConfirmedAt,
      supplierConfirmedBy: product.supplierConfirmedBy,
      documentSummary: Object.values(docSummary),
      totalDocuments: activeDocs.length,
      approvedDocuments: activeDocs.filter((d) => d.reviewStatus === "approved").length,
      publicDocuments,
      safety: safetyResult[0] ?? null,
      tenant: tenant
        ? {
            name: tenant.name,
            slug: tenant.slug,
            logoUrl: tenant.logoUrl,
            primaryColor: tenant.primaryColor,
            contactEmail: (tenant as any).contactEmail ?? null,
            websiteUrl: (tenant as any).websiteUrl ?? null,
          }
        : null,
    };
  },

  /** Validate an internal Swiss batch number without exposing the stored value. */
  async verifySwissBatch(uuid: string, verificationNumber: string) {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const result = await db
      .select({
        productName: products.productName,
        publicVisible: products.publicVisible,
        status: products.status,
        completenessScore: products.completenessScore,
        sealStatusOverride: products.sealStatusOverride,
        batchInfo: products.batchInfo,
        importerName: products.importerName,
        tenantId: products.tenantId,
      })
      .from(products)
      .where(eq(products.publicUuid, uuid))
      .limit(1);

    const product = result[0];
    if (!product || !product.publicVisible) throw Errors.notFound("Product", uuid);

    const batchInfo = (product.batchInfo ?? {}) as { swissVerificationNumber?: string | null };
    const sealStatus = getSealStatus(product);
    const tenant = await getTenantById(product.tenantId);
    const status = verifySwissBatchNumber({
      storedVerificationNumber: batchInfo.swissVerificationNumber,
      submittedVerificationNumber: verificationNumber,
      sealStatus,
    });

    return {
      status,
      isSwissMarketCovered: status === "verified",
      productName: product.productName,
      importerName: product.importerName ?? tenant?.name ?? "spielzeug3 AG",
    };
  },

  /**
   * Generate a preview QR code for a product without activating the seal.
   * Creates publicUuid + QR code so the product page can be previewed.
   * The page will show "IN PROGRESS" status until the seal is activated.
   * Requires administrator / compliance_manager / super_admin.
   */
  async generatePreviewQr(user: UserContext, productId: number) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager", "super_admin"]);
    const tenantId = user.tenantId ?? 1;
    const tenant = await getTenantById(tenantId);
    if (!tenant) throw Errors.notFound("Tenant", tenantId);

    // ensureProductPublicUuid creates UUID + QR code if not already present,
    // but does NOT set sealEnabledAt – so the seal stays in "IN PROGRESS" state.
    const result = await ensureProductPublicUuid(productId, tenant.slug);
    return {
      ...result,
      publicUrl: getPublicProductUrl(result.publicUuid),
      isPreview: true,
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
