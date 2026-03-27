/**
 * server/domains/compliance/complianceRepository.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Data-access layer for the Compliance Workflow domain.
 * Covers: signature requests, product safety, audit logs.
 */

export {
  createSignatureRequest,
  getSignatureRequestsByProduct,
  getSignatureRequestById,
  getSignatureRequestByEnvelopeId,
  updateSignatureRequestStatus,
  cancelSignatureRequest,
  getProductSafety,
  upsertProductSafety,
  createAuditLog,
  getAuditLogs,
} from "../../db";
