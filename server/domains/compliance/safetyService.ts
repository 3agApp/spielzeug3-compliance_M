/**
 * server/domains/compliance/safetyService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for Product Safety data.
 *
 * Both suppliers (for their own products) and operators
 * (admin / compliance_manager / internal_employee) can read and update safety data.
 * Every audit-log entry carries actorRole ('supplier' | 'operator') and actorName.
 */

import { computeCompletenessScore, createAuditLog, getProductById, getProductSafety, upsertProductSafety } from "../../db";
import { updateProduct } from "../../db";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveActorRole(complianceRole: string | null | undefined): "supplier" | "operator" {
  return complianceRole === "supplier" ? "supplier" : "operator";
}

function resolveActorName(user: UserContext): string {
  return (user as any).name ?? (user as any).email ?? `User #${(user as any).id ?? "?"}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

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
    // Both suppliers (own product) and operators can update safety data
    assertSupplierOrInternal(user, product.supplierId);

    const actorRole = resolveActorRole(user.complianceRole);
    const actorName = resolveActorName(user);

    await upsertProductSafety({ ...input, submittedByUserId: user.id });

    // Recalculate completeness score after safety data update
    try {
      const newScore = await computeCompletenessScore(input.productId);
      await updateProduct(input.productId, { completenessScore: String(newScore) });
    } catch (_) { /* non-critical */ }

    const auditAction =
      actorRole === "operator" ? "operator_safety_updated" : "safety_updated";

    await createAuditLog({
      entityType: "product_safety",
      entityId: input.productId,
      action: auditAction,
      performedByUserId: user.id,
      actorRole,
      actorName,
    });
    return { success: true };
  },
};
