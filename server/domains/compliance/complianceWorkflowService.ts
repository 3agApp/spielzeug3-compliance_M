/**
 * server/domains/compliance/complianceWorkflowService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrates the compliance review workflow:
 *   open → submitted → under_review → approved | rejected | needs_clarification
 *
 * This service coordinates across the Products and Documents domains.
 * It does NOT duplicate logic already in productService; instead it adds
 * higher-level workflow transitions that involve multiple aggregates.
 */

import {
  getProductById,
  getMissingRequirementsByProduct,
  computeCompletenessScore,
  getApprovalHistory,
  createAuditLog,
  updateProduct,
} from "../../db";
import { Errors, requireRole, assertSupplierOrInternal, ADMIN_ROLES } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompletenessReport {
  productId: number;
  score: number;
  totalRequirements: number;
  fulfilledRequirements: number;
  missingRequirements: Array<{
    id: number;
    requirementType: string;
    status: string;
    isMissing: boolean;
  }>;
  canSubmit: boolean;
  canConfirm: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const complianceWorkflowService = {
  /**
   * Compute a detailed completeness report for a product.
   * Used by the Siegel-Tab checkliste and the submit-gate.
   */
  async getCompletenessReport(
    user: UserContext,
    productId: number
  ): Promise<CompletenessReport> {
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);

    const requirements = await getMissingRequirementsByProduct(productId);
    const score = await computeCompletenessScore(productId);

    const totalRequirements = requirements.length;
    const fulfilledRequirements = requirements.filter(
      (r: any) => !r.isMissing && r.status !== "rejected"
    ).length;

    // Supplier can confirm when all mandatory requirements are not missing
    const canConfirm =
      requirements.filter((r: any) => r.isMissing).length === 0;

    // Supplier can submit when confirmed AND all requirements fulfilled
    const canSubmit =
      canConfirm && !!(product as any).supplierConfirmedAt;

    return {
      productId,
      score,
      totalRequirements,
      fulfilledRequirements,
      missingRequirements: requirements.map((r: any) => ({
        id: r.id,
        requirementType: r.requirementType,
        status: r.status,
        isMissing: r.isMissing,
      })),
      canSubmit,
      canConfirm,
    };
  },

  /**
   * Move a product into "under_review" status (compliance manager picks it up).
   */
  async startReview(user: UserContext & { id: number }, productId: number) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);

    if (product.status !== "submitted") {
      throw Errors.precondition(
        `Product must be in 'submitted' status to start review, got '${product.status}'`
      );
    }

    await updateProduct(productId, { status: "under_review" as any });
    await createAuditLog({
      entityType: "product",
      entityId: productId,
      action: "review_started",
      performedByUserId: user.id,
    });
    return { success: true };
  },

  /**
   * Get the full approval history for a product.
   */
  async getApprovalHistory(user: UserContext, productId: number) {
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);
    return getApprovalHistory(productId);
  },
};
