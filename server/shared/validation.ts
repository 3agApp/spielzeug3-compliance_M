/**
 * server/shared/validation.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared Zod schemas used across multiple domains.
 *
 * Keep domain-specific schemas in their own domain folder.
 * Only put schemas here when they are reused by ≥ 2 domains.
 */

import { z } from "zod";

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});
export type PaginationInput = z.infer<typeof PaginationInput>;

// ─── Product status ───────────────────────────────────────────────────────────

export const PRODUCT_STATUSES = [
  "open",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "needs_clarification",
] as const;
export const ProductStatusSchema = z.enum(PRODUCT_STATUSES);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

// ─── Document types ───────────────────────────────────────────────────────────

export const DOCUMENT_TYPES = [
  "test_report",
  "declaration_of_conformity",
  "technical_file",
  "safety_data_sheet",
  "reach_declaration",
  "rohs_declaration",
  "packaging_declaration",
  "other",
] as const;
export const DocumentTypeSchema = z.enum(DOCUMENT_TYPES);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

// ─── Document review status ───────────────────────────────────────────────────

export const REVIEW_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
] as const;
export const ReviewStatusSchema = z.enum(REVIEW_STATUSES);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

// ─── Requirement status ───────────────────────────────────────────────────────

export const REQUIREMENT_STATUSES = [
  "missing",
  "provided",
  "under_review",
  "approved",
  "rejected",
] as const;
export const RequirementStatusSchema = z.enum(REQUIREMENT_STATUSES);
export type RequirementStatus = z.infer<typeof RequirementStatusSchema>;

// ─── Seal status ──────────────────────────────────────────────────────────────

export const SEAL_STATUSES = ["verified", "in_progress", "not_verified"] as const;
export const SealStatusSchema = z.enum(SEAL_STATUSES);
export type SealStatus = z.infer<typeof SealStatusSchema>;

// ─── Compliance roles ─────────────────────────────────────────────────────────

export const COMPLIANCE_ROLES = [
  "super_admin",
  "administrator",
  "compliance_manager",
  "internal_employee",
  "supplier",
] as const;
export const ComplianceRoleSchema = z.enum(COMPLIANCE_ROLES);

// ─── Common ID inputs ─────────────────────────────────────────────────────────

export const IdInput = z.object({ id: z.number().int().positive() });
export const ProductIdInput = z.object({ productId: z.number().int().positive() });
export const SupplierIdInput = z.object({ supplierId: z.number().int().positive() });

// ─── Note / comment ───────────────────────────────────────────────────────────

export const OptionalNoteInput = z.object({ note: z.string().max(2000).optional() });
export const RequiredNoteInput = z.object({ note: z.string().min(1).max(2000) });
