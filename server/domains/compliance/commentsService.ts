/**
 * server/domains/compliance/commentsService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for Product Comments.
 */

import { createComment, getCommentsByProduct, getProductById } from "../../db";
import { Errors, assertSupplierOrInternal } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

export interface CreateCommentInput {
  productId: number;
  commentText: string;
  visibilityInternalOnly?: boolean;
}

export const commentsService = {
  async listByProduct(user: UserContext, productId: number) {
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);
    const isInternal = (user.complianceRole ?? "internal_employee") !== "supplier";
    return getCommentsByProduct(productId, isInternal);
  },

  async create(user: UserContext & { id: number }, input: CreateCommentInput) {
    const product = await getProductById(input.productId);
    if (!product) throw Errors.notFound("Product", input.productId);
    assertSupplierOrInternal(user, product.supplierId);
    const role = user.complianceRole ?? "internal_employee";
    // Suppliers cannot create internal-only comments
    const internalOnly = role === "supplier" ? false : (input.visibilityInternalOnly ?? false);
    await createComment({
      productId: input.productId,
      userId: user.id,
      userRole: role,
      commentText: input.commentText,
      visibilityInternalOnly: internalOnly,
    });
    return { success: true };
  },
};
