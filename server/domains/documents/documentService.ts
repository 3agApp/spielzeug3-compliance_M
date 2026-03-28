/**
 * server/domains/documents/documentService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for the Documents domain.
 *
 * Responsibilities:
 * - Upload a document (base64 → S3 → DB record) – for suppliers AND operators
 *   When a document of the same type already exists for the product, the old
 *   document is ARCHIVED (isArchived = true, replacedByDocumentId set) instead
 *   of being deleted.  This preserves the full version history.
 * - Delete a document (hard-delete; operator can optionally archive instead)
 * - Update review status (internal roles only)
 * - List documents for a product (active only by default)
 * - List archived versions for a specific document type
 *
 * Every audit-log entry carries actorRole ('supplier' | 'operator') and
 * actorName so the timeline can distinguish who did what.
 */

import {
  archiveDocument,
  createAuditLog,
  createDocument,
  deleteDocument,
  getArchivedDocumentVersions,
  getDocumentById,
  getDocumentsByProduct,
  getMissingRequirementsByProduct,
  getProductById,
  updateDocument,
  updateMissingRequirement,
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
   * List active (non-archived) documents for a product.
   * Enforces supplier-isolation.
   */
  async listByProduct(user: UserContext, productId: number) {
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);
    return getDocumentsByProduct(productId, false);
  },

  /**
   * List archived (superseded) versions of a specific document type.
   * Accessible to all roles that can see the product.
   */
  async listArchivedVersions(user: UserContext, productId: number, documentType: DocumentType) {
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);
    return getArchivedDocumentVersions(productId, documentType);
  },

  /**
   * Upload a document to S3 and create a DB record.
   * Available to suppliers AND operators (admin / compliance_manager / internal_employee).
   *
   * VERSION ARCHIVING:
   * If a document of the same type already exists for this product, the existing
   * document is archived (isArchived = true, replacedByDocumentId = new doc id)
   * before the new record is inserted.  The version counter increments.
   *
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

    // Determine version number: count ALL docs of this type (incl. archived)
    const allDocs = await getDocumentsByProduct(input.productId, true);
    const sameType = allDocs.filter((d: any) => d.documentType === input.documentType);
    const version = sameType.length + 1;

    // Find the currently active document of the same type (if any)
    const activeDocs = allDocs.filter(
      (d: any) => d.documentType === input.documentType && !d.isArchived
    );

    // Insert the new document first so we have its ID
    const insertResult = await createDocument({
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

    const newDocId = (insertResult as any).insertId as number;

    // Archive all previously active documents of the same type
    let archivedCount = 0;
    // Capture metadata of the most recent predecessor for the audit log
    const primaryPredecessor = activeDocs.length > 0
      ? activeDocs.reduce((latest: any, d: any) =>
          new Date(d.uploadedAt) > new Date(latest.uploadedAt) ? d : latest
        )
      : null;
    for (const oldDoc of activeDocs) {
      await archiveDocument(oldDoc.id, newDocId);
      archivedCount++;
    }

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

    // Audit log: distinguish operator vs. supplier upload
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
        version,
        newDocumentId: newDocId,
        // Predecessor info for version-diff display in the timeline
        ...(primaryPredecessor ? {
          previousVersionId: primaryPredecessor.id,
          previousFileName: primaryPredecessor.fileName,
          previousVersion: primaryPredecessor.version,
          previousFileUrl: primaryPredecessor.fileUrl,
        } : {}),
        ...(archivedCount > 0 ? { archivedPreviousVersions: archivedCount } : {}),
        ...(input.operatorComment ? { operatorComment: input.operatorComment } : {}),
      } as any,
    });

    return { success: true, url, confirmedAtReset, version, archivedPreviousVersions: archivedCount };
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
   * Toggle the publicDownload flag for a document.
   * Only operators (administrator / compliance_manager / internal_employee) may do this.
   */
  async togglePublicDownload(
    user: UserContext & { id: number },
    input: { documentId: number; publicDownload: boolean }
  ) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager", "internal_employee"]);
    await updateDocument(input.documentId, { publicDownload: input.publicDownload });
    await createAuditLog({
      entityType: "document",
      entityId: input.documentId,
      action: input.publicDownload ? "document_public_enabled" : "document_public_disabled",
      performedByUserId: user.id,
      actorRole: "operator",
      actorName: resolveActorName(user),
      payloadSnapshot: { documentId: input.documentId, publicDownload: input.publicDownload } as any,
    });
    return { success: true, publicDownload: input.publicDownload };
  },

  /**
   * Hard-delete a document.
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

    // Fetch doc before deletion for audit payload
    const doc = await getDocumentById(input.documentId);

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
        ...(doc ? {
          fileName: doc.fileName,
          documentType: doc.documentType,
          documentVersion: doc.version,
          fileUrl: doc.fileUrl,
        } : {}),
        ...(input.operatorComment ? { operatorComment: input.operatorComment } : {}),
      } as any,
    });
    return { success: true, confirmedAtReset };
  },
};
