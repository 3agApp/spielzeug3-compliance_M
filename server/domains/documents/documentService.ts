/**
 * server/domains/documents/documentService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for the Documents domain.
 *
 * Responsibilities:
 * - Upload a document (base64 → S3 → DB record) – for suppliers AND operators
 * - Delete a document (with supplier-confirmation reset)
 * - Update review status (internal roles only)
 * - List documents for a product
 *
 * Every audit-log entry now carries actorRole ('supplier' | 'operator') and
 * actorName so the timeline can distinguish who did what.
 */

import {
  createAuditLog,
  createDocument,
  deleteDocument,
  getDocumentsByProduct,
  getProductById,
  updateDocument,
  updateMissingRequirement,
  getMissingRequirementsByProduct,
  updateProduct,
} from "../../db";
import { storagePut } from "../../storage";
import {
  Errors,
  assertOwnsProduct,
  assertSupplierOrInternal,
  requireRole,
} from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";
import type { DocumentType, ReviewStatus } from "../../shared/validation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadDocumentInput {
  productId: number;
  documentType: DocumentType;
  fileName: string;
  fileBase64: string;
  mimeType: string;
  fileSizeBytes?: number;
  expiryDate?: string;
  operatorComment?: string; // optional note added by operator (admin/compliance_manager)
}

export interface UpdateReviewStatusInput {
  documentId: number;
  reviewStatus: ReviewStatus;
  reviewNote?: string;
}

export interface DeleteDocumentInput {
  documentId: number;
  productId?: number;
  operatorComment?: string; // optional reason added by operator when deleting
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps a complianceRole to 'supplier' or 'operator' for the audit log. */
function resolveActorRole(complianceRole: string | null | undefined): "supplier" | "operator" {
  return complianceRole === "supplier" ? "supplier" : "operator";
}

/** Returns a human-readable display name from the user context. */
function resolveActorName(user: UserContext): string {
  return (user as any).name ?? (user as any).email ?? `User #${(user as any).id ?? "?"}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const documentService = {
  /**
   * List all documents for a product.
   * Enforces supplier-isolation.
   */
  async listByProduct(user: UserContext, productId: number) {
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);
    return getDocumentsByProduct(productId);
  },

  /**
   * Upload a document to S3 and create a DB record.
   * Available to suppliers AND operators (admin / compliance_manager / internal_employee).
   * Resets supplier confirmation only when the uploader is a supplier.
   */
  async upload(user: UserContext & { id: number }, input: UploadDocumentInput) {
    const role = user.complianceRole ?? "internal_employee";
    const actorRole = resolveActorRole(role);
    const actorName = resolveActorName(user);

    const product = await getProductById(input.productId);
    if (!product) throw Errors.notFound("Product", input.productId);
    assertSupplierOrInternal(user, product.supplierId);

    // Decode base64 and upload to S3
    const buffer = Buffer.from(input.fileBase64, "base64");
    const fileKey = `documents/${input.productId}/${Date.now()}-${input.fileName}`;
    const { url } = await storagePut(fileKey, buffer, input.mimeType);

    // Determine version number
    const existing = await getDocumentsByProduct(input.productId);
    const sameType = existing.filter((d: any) => d.documentType === input.documentType);
    const version = sameType.length + 1;

    await createDocument({
      productId: input.productId,
      documentType: input.documentType as any,
      fileName: input.fileName,
      fileUrl: url,
      fileKey,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      version,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
      uploadedByUserId: user.id,
    });

    // Mark requirement as provided
    const requirements = await getMissingRequirementsByProduct(input.productId);
    const matching = requirements.find(
      (r: any) => r.requirementType === input.documentType && r.isMissing
    );
    if (matching) {
      await updateMissingRequirement(matching.id, { isMissing: false });
    }

    // Reset supplier confirmation only when the uploader is a supplier
    let confirmedAtReset = false;
    if (role === "supplier" && (product as any).supplierConfirmedAt) {
      await updateProduct(input.productId, {
        supplierConfirmedAt: null as any,
        supplierConfirmedBy: null as any,
      });
      confirmedAtReset = true;
      await createAuditLog({
        entityType: "product",
        entityId: input.productId,
        action: "supplier_confirmation_reset",
        performedByUserId: user.id,
        actorRole,
        actorName,
        payloadSnapshot: { reason: "document_uploaded", fileName: input.fileName } as any,
      });
    }

    // Distinguish operator vs. supplier upload in the audit log action
    const auditAction = actorRole === "operator" ? "operator_document_uploaded" : "uploaded";
    await createAuditLog({
      entityType: "document",
      entityId: input.productId,
      action: auditAction,
      performedByUserId: user.id,
      actorRole,
      actorName,
      payloadSnapshot: {
        fileName: input.fileName,
        documentType: input.documentType,
        ...(input.operatorComment ? { operatorComment: input.operatorComment } : {}),
      } as any,
    });

    return { success: true, url, confirmedAtReset };
  },

  /**
   * Update the review status of a document (internal roles only).
   */
  async updateReviewStatus(user: UserContext & { id: number }, input: UpdateReviewStatusInput) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager", "internal_employee"]);
    await updateDocument(input.documentId, {
      reviewStatus: input.reviewStatus as any,
      reviewNote: input.reviewNote,
      reviewedAt: new Date(),
      reviewedByUserId: user.id,
    });
    await createAuditLog({
      entityType: "document",
      entityId: input.documentId,
      action: `review_${input.reviewStatus}`,
      performedByUserId: user.id,
      actorRole: "operator",
      actorName: resolveActorName(user),
    });
    return { success: true };
  },

  /**
   * Delete a document.
   * Suppliers can only delete documents on their own products.
   * Operators (admin/compliance_manager/internal_employee) can delete any document.
   * Resets supplier confirmation only when a supplier deletes.
   */
  async delete(user: UserContext & { id: number }, input: DeleteDocumentInput) {
    const role = user.complianceRole ?? "internal_employee";
    const actorRole = resolveActorRole(role);
    const actorName = resolveActorName(user);

    if (role === "supplier") {
      if (!input.productId) {
        throw Errors.validation("productId required for supplier document deletion");
      }
      const product = await getProductById(input.productId);
      if (!product) throw Errors.notFound("Product", input.productId);
      assertOwnsProduct(user, product.supplierId);
    } else {
      requireRole(role, ["administrator", "compliance_manager", "internal_employee"]);
    }

    await deleteDocument(input.documentId);

    // Reset supplier confirmation if supplier had already confirmed
    let confirmedAtReset = false;
    if (role === "supplier" && input.productId) {
      const product = await getProductById(input.productId);
      if (product && (product as any).supplierConfirmedAt) {
        await updateProduct(input.productId, {
          supplierConfirmedAt: null as any,
          supplierConfirmedBy: null as any,
        });
        confirmedAtReset = true;
        await createAuditLog({
          entityType: "product",
          entityId: input.productId,
          action: "supplier_confirmation_reset",
          performedByUserId: user.id,
          actorRole,
          actorName,
          payloadSnapshot: { reason: "document_deleted", documentId: input.documentId } as any,
        });
      }
    }

    const auditAction = actorRole === "operator" ? "operator_document_deleted" : "deleted";
    await createAuditLog({
      entityType: "document",
      entityId: input.documentId,
      action: auditAction,
      performedByUserId: user.id,
      actorRole,
      actorName,
      payloadSnapshot: {
        documentId: input.documentId,
        ...(input.operatorComment ? { operatorComment: input.operatorComment } : {}),
      } as any,
    });
    return { success: true, confirmedAtReset };
  },
};
