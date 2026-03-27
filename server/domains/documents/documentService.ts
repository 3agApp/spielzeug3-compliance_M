/**
 * server/domains/documents/documentService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for the Documents domain.
 *
 * Responsibilities:
 * - Upload a document (base64 → S3 → DB record)
 * - Delete a document (with supplier-confirmation reset)
 * - Update review status (internal roles only)
 * - List documents for a product
 *
 * The service is decoupled from tRPC: it receives plain data objects and
 * returns plain results. Routers call toTRPCError() on any thrown AppError.
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
}

export interface UpdateReviewStatusInput {
  documentId: number;
  reviewStatus: ReviewStatus;
  reviewNote?: string;
}

export interface DeleteDocumentInput {
  documentId: number;
  productId?: number;
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
   * Resets supplier confirmation if the supplier had already confirmed.
   */
  async upload(user: UserContext & { id: number }, input: UploadDocumentInput) {
    const role = user.complianceRole ?? "internal_employee";
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

    // Reset supplier confirmation if already confirmed
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
        payloadSnapshot: { reason: "document_uploaded", fileName: input.fileName } as any,
      });
    }

    await createAuditLog({
      entityType: "document",
      entityId: input.productId,
      action: "uploaded",
      performedByUserId: user.id,
      payloadSnapshot: { fileName: input.fileName, documentType: input.documentType } as any,
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
    });
    return { success: true };
  },

  /**
   * Delete a document.
   * Suppliers can only delete documents on their own products.
   * Resets supplier confirmation if already confirmed.
   */
  async delete(user: UserContext & { id: number }, input: DeleteDocumentInput) {
    const role = user.complianceRole ?? "internal_employee";

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
          payloadSnapshot: { reason: "document_deleted", documentId: input.documentId } as any,
        });
      }
    }

    await createAuditLog({
      entityType: "document",
      entityId: input.documentId,
      action: "deleted",
      performedByUserId: user.id,
    });
    return { success: true, confirmedAtReset };
  },
};
