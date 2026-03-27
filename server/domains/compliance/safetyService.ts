/**
 * server/domains/compliance/safetyService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for Product Safety data.
 */

import { createAuditLog, getProductById, getProductSafety, upsertProductSafety } from "../../db";
import { Errors, assertSupplierOrInternal } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

export interface UpsertSafetyInput {
  productId: number;
  safetyText?: string;
  warningText?: string;
  ageGrading?: string;
  materialInformation?: string;
  usageRestrictions?: string;
  safetyNotes?: string;
}

export const safetyService = {
  async getByProduct(user: UserContext, productId: number) {
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);
    return getProductSafety(productId);
  },

  async upsert(user: UserContext & { id: number }, input: UpsertSafetyInput) {
    const product = await getProductById(input.productId);
    if (!product) throw Errors.notFound("Product", input.productId);
    assertSupplierOrInternal(user, product.supplierId);
    await upsertProductSafety({ ...input, submittedByUserId: user.id });
    await createAuditLog({
      entityType: "product_safety",
      entityId: input.productId,
      action: "updated",
      performedByUserId: user.id,
    });
    return { success: true };
  },
};
