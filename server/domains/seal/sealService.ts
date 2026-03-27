/**
 * server/domains/seal/sealService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for the Seal domain.
 *
 * Responsibilities:
 * - Determine seal status from product state
 * - Activate / regenerate QR codes
 * - Override seal status (admin only)
 */

import { getProductById, updateProduct, createAuditLog } from "../../db";
import { ensureProductPublicUuid, getTenantById } from "../../tenantDb";
import { getSealStatus, getSealStatusLabel } from "../../sealUtils";
import { Errors, requireRole, assertSupplierOrInternal, ADMIN_ROLES } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";
import type { SealStatus } from "../../shared/validation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SealInfo {
  status: SealStatus;
  statusLabel: string;
  publicUuid: string | null;
  qrCodeUrl: string | null;
  qrCodeSvgUrl: string | null;
  sealEnabledAt: Date | null;
  sealStatusOverride: string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const sealService = {
  /**
   * Get the current seal info for a product.
   */
  async getSealInfo(user: UserContext, productId: number): Promise<SealInfo> {
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);

    const status = getSealStatus(product as any);
    return {
      status,
      statusLabel: getSealStatusLabel(status),
      publicUuid: (product as any).publicUuid ?? null,
      qrCodeUrl: (product as any).qrCodeUrl ?? null,
      qrCodeSvgUrl: (product as any).qrCodeSvgUrl ?? null,
      sealEnabledAt: (product as any).sealEnabledAt ?? null,
      sealStatusOverride: (product as any).sealStatusOverride ?? null,
    };
  },

  /**
   * Activate the seal for a product (generate QR code if not yet present).
   * Requires the product to be approved and the tenant to have the seal module.
   */
  async activate(
    user: UserContext & { id: number; tenantId?: number | null },
    productId: number
  ) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);

    const tenantId = user.tenantId ?? 1;
    const tenant = await getTenantById(tenantId);
    if (!tenant) throw Errors.notFound("Tenant", tenantId);

    const result = await ensureProductPublicUuid(productId, tenant.slug);
    await createAuditLog({
      entityType: "product",
      entityId: productId,
      action: "seal_activated",
      performedByUserId: user.id,
    });
    return result;
  },

  /**
   * Override the seal status (admin only).
   * Pass null to remove the override and revert to automatic logic.
   */
  async overrideStatus(
    user: UserContext & { id: number },
    productId: number,
    override: SealStatus | null
  ) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);

    await updateProduct(productId, { sealStatusOverride: override as any });
    await createAuditLog({
      entityType: "product",
      entityId: productId,
      action: override ? "seal_status_overridden" : "seal_status_override_removed",
      performedByUserId: user.id,
      payloadSnapshot: { override } as any,
    });
    return { success: true };
  },

  /**
   * Regenerate the QR code for a product (e.g. after URL change).
   */
  async regenerateQrCode(
    user: UserContext & { id: number; tenantId?: number | null },
    productId: number
  ) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);

    const tenantId = user.tenantId ?? 1;
    const tenant = await getTenantById(tenantId);
    if (!tenant) throw Errors.notFound("Tenant", tenantId);

    // Clear existing QR so ensureProductPublicUuid regenerates it
    await updateProduct(productId, { qrCodeUrl: null as any, qrCodeSvgUrl: null as any });
    const result = await ensureProductPublicUuid(productId, tenant.slug);
    await createAuditLog({
      entityType: "product",
      entityId: productId,
      action: "qr_code_regenerated",
      performedByUserId: user.id,
    });
    return result;
  },
};
