/**
 * server/domains/products/productRepository.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Data-access layer for the Products domain.
 *
 * Re-exports the relevant functions from the central db.ts so that:
 * - Services import from their own domain repository (clear ownership)
 * - db.ts remains the single source of truth (no duplication)
 * - Future migration to a per-domain DB file is a one-line change here
 */

export {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  getProductsBySupplier,
  getMissingRequirementsByProduct,
  createMissingRequirement,
  updateMissingRequirement,
  computeCompletenessScore,
  getSupplierDashboardStats,
  getInternalDashboardStats,
  getApprovalHistory,
  createApprovalHistoryEntry,
  getCommentsByProduct,
  createComment,
} from "../../db";
