import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  json,
} from "drizzle-orm/mysql-core";

// ─── Core Users (Manus OAuth) ───────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Extended compliance roles
  complianceRole: mysqlEnum("complianceRole", [
    "supplier",
    "internal_employee",
    "compliance_manager",
    "administrator",
    "super_admin",
  ]).default("internal_employee"),
  languagePreference: mysqlEnum("languagePreference", ["de", "en"]).default("de").notNull(),
  supplierId: int("supplierId"), // FK to suppliers (for supplier users)
  tenantId: int("tenantId").default(1), // FK to tenants (null = super_admin)
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Suppliers ───────────────────────────────────────────────────────────────
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  supplierCode: varchar("supplierCode", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  country: varchar("country", { length: 64 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  active: boolean("active").default(true).notNull(),
  kontorId: varchar("kontorId", { length: 128 }), // ERP reference
  tenantId: int("tenantId").default(1).notNull(), // FK to tenants
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// ─── Products ────────────────────────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  internalArticleNumber: varchar("internalArticleNumber", { length: 128 }),
  supplierArticleNumber: varchar("supplierArticleNumber", { length: 128 }),
  orderNumber: varchar("orderNumber", { length: 128 }),
  productName: varchar("productName", { length: 512 }).notNull(),
  ean: varchar("ean", { length: 32 }),
  brand: varchar("brand", { length: 128 }),
  supplierId: int("supplierId").notNull(),
  imageUrl: text("imageUrl"),
  status: mysqlEnum("status", [
    "open",
    "in_progress",
    "submitted",
    "under_review",
    "clarification_needed",
    "approved",
    "rejected",
    "completed",
  ]).default("open").notNull(),
  completenessScore: decimal("completenessScore", { precision: 5, scale: 2 }).default("0.00"),
  assignedSupplierUserId: int("assignedSupplierUserId"),
  assignedInternalUserId: int("assignedInternalUserId"),
  submittedAt: timestamp("submittedAt"),
  reviewedAt: timestamp("reviewedAt"),
  approvedAt: timestamp("approvedAt"),
  rejectedAt: timestamp("rejectedAt"),
  completedAt: timestamp("completedAt"),
  kontorId: varchar("kontorId", { length: 128 }),
  categoryId: int("categoryId"),
  templateId: int("templateId"),
  sourceLastSyncAt: timestamp("sourceLastSyncAt"),
  // Swiss Product Seal Platform
  tenantId: int("tenantId").default(1).notNull(),
  publicUuid: varchar("publicUuid", { length: 36 }).unique(), // UUID for public product page
  qrCodeUrl: text("qrCodeUrl"),                               // S3 URL of generated QR code PNG
  qrCodeSvgUrl: text("qrCodeSvgUrl"),                        // S3 URL of generated QR code SVG
  sealEnabledAt: timestamp("sealEnabledAt"),                  // When seal was first activated
  publicVisible: boolean("publicVisible").default(true).notNull(), // Toggle: public landing page on/off
  sealStatusOverride: mysqlEnum("sealStatusOverride", ["verified", "in_progress", "not_verified"]), // Admin override
  batchInfo: json("batchInfo"),                               // Batch/traceability info (JSON)
  importerName: varchar("importerName", { length: 255 }),     // Override importer display name
  // Supplier declaration of completeness
  supplierConfirmedAt: timestamp("supplierConfirmedAt"),       // When supplier confirmed completeness
  supplierConfirmedBy: varchar("supplierConfirmedBy", { length: 255 }), // Name of confirming user
  lastUpdatedAt: timestamp("lastUpdatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─── Missing Requirements ────────────────────────────────────────────────────
export const missingRequirements = mysqlTable("missing_requirements", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  requirementType: mysqlEnum("requirementType", [
    "test_report",
    "declaration_of_conformity",
    "manual",
    "certificate",
    "product_image",
    "safety_image",
    "regulatory_document",
    "safety_text",
    "warning_text",
    "age_grading",
    "material_information",
    "usage_restrictions",
    "safety_instructions",
    "additional_notes",
  ]).notNull(),
  required: boolean("required").default(true).notNull(),
  isMissing: boolean("isMissing").default(true).notNull(),
  sourceSystem: varchar("sourceSystem", { length: 64 }).default("manual"),
  note: text("note"),
  status: mysqlEnum("status", [
    "missing",
    "provided",
    "under_review",
    "approved",
    "rejected",
  ]).default("missing").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MissingRequirement = typeof missingRequirements.$inferSelect;
export type InsertMissingRequirement = typeof missingRequirements.$inferInsert;

// ─── Documents ───────────────────────────────────────────────────────────────
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  documentType: mysqlEnum("documentType", [
    "test_report",
    "declaration_of_conformity",
    "manual",
    "certificate",
    "product_image",
    "safety_image",
    "regulatory_document",
    "other",
  ]).notNull(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 512 }),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSizeBytes: int("fileSizeBytes"),
  version: int("version").default(1).notNull(),
  /** When true this document is an archived predecessor; it is hidden in the active list */
  isArchived: boolean("isArchived").default(false).notNull(),
  /** FK to the document that replaced this one (set when archiving) */
  replacedByDocumentId: int("replacedByDocumentId"),
  /** When true this document is publicly downloadable on the product landing page */
  publicDownload: boolean("publicDownload").default(false).notNull(),
  expiryDate: timestamp("expiryDate"),
  uploadedByUserId: int("uploadedByUserId"),
  uploadedByRole: varchar("uploadedByRole", { length: 64 }),
  reviewStatus: mysqlEnum("reviewStatus", [
    "pending",
    "approved",
    "rejected",
  ]).default("pending").notNull(),
  reviewNote: text("reviewNote"),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedAt: timestamp("reviewedAt"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ─── Product Safety Entries ──────────────────────────────────────────────────
export const productSafetyEntries = mysqlTable("product_safety_entries", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().unique(),
  safetyText: text("safetyText"),
  warningText: text("warningText"),
  ageGrading: varchar("ageGrading", { length: 64 }),
  materialInformation: text("materialInformation"),
  usageRestrictions: text("usageRestrictions"),
  safetyNotes: text("safetyNotes"),
  safetyImages: json("safetyImages"), // array of image URLs
  submittedByUserId: int("submittedByUserId"),
  lastUpdatedAt: timestamp("lastUpdatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductSafetyEntry = typeof productSafetyEntries.$inferSelect;
export type InsertProductSafetyEntry = typeof productSafetyEntries.$inferInsert;

// ─── Comments ────────────────────────────────────────────────────────────────
export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  userId: int("userId").notNull(),
  userRole: varchar("userRole", { length: 64 }),
  commentText: text("commentText").notNull(),
  visibilityInternalOnly: boolean("visibilityInternalOnly").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

// ─── Approval History ────────────────────────────────────────────────────────
export const approvalHistory = mysqlTable("approval_history", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  action: mysqlEnum("action", [
    "submitted",
    "approved",
    "rejected",
    "clarification_requested",
    "completed",
    "reopened",
    "updated",
  ]).notNull(),
  fromStatus: varchar("fromStatus", { length: 64 }),
  toStatus: varchar("toStatus", { length: 64 }),
  performedByUserId: int("performedByUserId"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApprovalHistoryEntry = typeof approvalHistory.$inferSelect;
export type InsertApprovalHistoryEntry = typeof approvalHistory.$inferInsert;

// ─── Audit Logs ──────────────────────────────────────────────────────────────
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId"),
  action: varchar("action", { length: 128 }).notNull(),
  performedByUserId: int("performedByUserId"),
  /** 'supplier' | 'operator' – distinguishes who performed the action */
  actorRole: varchar("actorRole", { length: 32 }),
  /** Display name of the actor (user name or email) */
  actorName: varchar("actorName", { length: 255 }),
  payloadSnapshot: json("payloadSnapshot"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── API Sync Logs ───────────────────────────────────────────────────────────
export const apiSyncLogs = mysqlTable("api_sync_logs", {
  id: int("id").autoincrement().primaryKey(),
  direction: mysqlEnum("direction", ["import", "export"]).notNull(),
  endpoint: varchar("endpoint", { length: 512 }),
  relatedEntityType: varchar("relatedEntityType", { length: 64 }),
  relatedEntityId: int("relatedEntityId"),
  status: mysqlEnum("status", ["success", "error", "pending"]).default("pending").notNull(),
  requestPayload: json("requestPayload"),
  responsePayload: json("responsePayload"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiSyncLog = typeof apiSyncLogs.$inferSelect;
export type InsertApiSyncLog = typeof apiSyncLogs.$inferInsert;

// ─── Notifications ───────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "open_items",
    "submitted",
    "review_required",
    "clarification_requested",
    "approved",
    "rejected",
    "completed",
    "sync_success",
    "sync_failed",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  relatedProductId: int("relatedProductId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Requirement Types (Admin configurable) ──────────────────────────────────
export const requirementTypes = mysqlTable("requirement_types", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  labelDe: varchar("labelDe", { length: 255 }).notNull(),
  labelEn: varchar("labelEn", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["document", "data"]).notNull(),
  required: boolean("required").default(true).notNull(),
  active: boolean("active").default(true).notNull(),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RequirementType = typeof requirementTypes.$inferSelect;
export type InsertRequirementType = typeof requirementTypes.$inferInsert;

// ─── Batch Records (future-ready) ────────────────────────────────────────────
export const batchRecords = mysqlTable("batch_records", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  batchNumber: varchar("batchNumber", { length: 128 }).notNull(),
  goodsReceiptDate: timestamp("goodsReceiptDate"),
  recordedByUserId: int("recordedByUserId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BatchRecord = typeof batchRecords.$inferSelect;
export type InsertBatchRecord = typeof batchRecords.$inferInsert;

// ─── System Settings (key-value store for admin config) ──────────────────────
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 128 }).notNull().unique(),
  settingValue: text("settingValue"),
  isEncrypted: boolean("isEncrypted").default(false).notNull(),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

// ─── AI Analysis Results ─────────────────────────────────────────────────────
export const aiAnalysisResults = mysqlTable("ai_analysis_results", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  overallScore: decimal("overallScore", { precision: 5, scale: 2 }).notNull(),
  // Sub-scores (0-100)
  documentCompletenessScore: decimal("documentCompletenessScore", { precision: 5, scale: 2 }),
  contentPlausibilityScore: decimal("contentPlausibilityScore", { precision: 5, scale: 2 }),
  formalCorrectnessScore: decimal("formalCorrectnessScore", { precision: 5, scale: 2 }),
  consistencyScore: decimal("consistencyScore", { precision: 5, scale: 2 }),
  // AI output
  summary: text("summary"),
  findings: json("findings"), // array of { category, severity, description }
  recommendations: json("recommendations"), // array of strings
  analyzedDocumentIds: json("analyzedDocumentIds"), // array of document IDs
  modelUsed: varchar("modelUsed", { length: 64 }),
  tokensUsed: int("tokensUsed"),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  triggeredByUserId: int("triggeredByUserId"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiAnalysisResult = typeof aiAnalysisResults.$inferSelect;
export type InsertAiAnalysisResult = typeof aiAnalysisResults.$inferInsert;

// ─── Supplier Invitations (Magic-Link Onboarding) ────────────────────────────
export const supplierInvitations = mysqlTable("supplier_invitations", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "accepted", "expired", "revoked"]).default("pending").notNull(),
  invitedByUserId: int("invitedByUserId").notNull(),
  acceptedByUserId: int("acceptedByUserId"),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SupplierInvitation = typeof supplierInvitations.$inferSelect;
export type InsertSupplierInvitation = typeof supplierInvitations.$inferInsert;

// ─── Product Categories ──────────────────────────────────────────────────────
export const productCategories = mysqlTable("product_categories", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  labelDe: varchar("labelDe", { length: 255 }).notNull(),
  labelEn: varchar("labelEn", { length: 255 }).notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = typeof productCategories.$inferInsert;

// ─── Product Templates (Requirement sets per category) ───────────────────────
export const productTemplates = mysqlTable("product_templates", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  descriptionDe: text("descriptionDe"),
  descriptionEn: text("descriptionEn"),
  // JSON array of requirement keys that are REQUIRED for this template
  requiredDocuments: json("requiredDocuments").notNull(), // string[]
  // JSON array of requirement keys that are OPTIONAL/RECOMMENDED
  optionalDocuments: json("optionalDocuments"),           // string[]
  // JSON array of data fields required (safety_text, age_grading, etc.)
  requiredDataFields: json("requiredDataFields"),          // string[]
  active: boolean("active").default(true).notNull(),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductTemplate = typeof productTemplates.$inferSelect;
export type InsertProductTemplate = typeof productTemplates.$inferInsert;

// ─── Product → Category assignment ──────────────────────────────────────────
// We add categoryId + templateId to products via ALTER TABLE (migration)
// These are tracked as optional fields on the products table

// ─── Product Components ──────────────────────────────────────────────────────
// A product can consist of multiple components (e.g. wooden wheel, metal axle).
// Each component can have its own test reports and certificates.
export const productComponents = mysqlTable("product_components", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  materialType: mysqlEnum("materialType", [
    "wood",
    "metal",
    "plastic",
    "textile",
    "electronic",
    "paint_coating",
    "rubber",
    "glass",
    "other",
  ]),
  supplierName: varchar("supplierName", { length: 255 }), // component sub-supplier
  partNumber: varchar("partNumber", { length: 128 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductComponent = typeof productComponents.$inferSelect;
export type InsertProductComponent = typeof productComponents.$inferInsert;

// ─── Component Documents ─────────────────────────────────────────────────────
// Documents (test reports, certificates) attached to a specific component.
export const componentDocuments = mysqlTable("component_documents", {
  id: int("id").autoincrement().primaryKey(),
  componentId: int("componentId").notNull(),
  productId: int("productId").notNull(), // denormalized for easier querying
  documentType: mysqlEnum("documentType", [
    "test_report",
    "declaration_of_conformity",
    "material_certificate",
    "reach_declaration",
    "rohs_declaration",
    "certificate",
    "regulatory_document",
    "other",
  ]).notNull(),
  standard: varchar("standard", { length: 128 }), // e.g. "EN 71-3", "REACH"
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 512 }),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSizeBytes: int("fileSizeBytes"),
  version: int("version").default(1).notNull(),
  expiryDate: timestamp("expiryDate"),
  uploadedByUserId: int("uploadedByUserId"),
  reviewStatus: mysqlEnum("reviewStatus", [
    "pending",
    "approved",
    "rejected",
  ]).default("pending").notNull(),
  reviewNote: text("reviewNote"),
  reviewedByUserId: int("reviewedByUserId"),
  reviewedAt: timestamp("reviewedAt"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ComponentDocument = typeof componentDocuments.$inferSelect;
export type InsertComponentDocument = typeof componentDocuments.$inferInsert;

// ─── Tenants (Multi-Tenant Platform) ────────────────────────────────────────
export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  plan: mysqlEnum("plan", ["starter", "professional", "enterprise"]).default("starter").notNull(),
  modulesEnabled: json("modulesEnabled").$type<string[]>().default(["compliance"]).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#C8102E"),
  contactEmail: varchar("contactEmail", { length: 320 }),
  websiteUrl: varchar("websiteUrl", { length: 255 }).default("swiss-product-seal.ch"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// ─── BunnyDoc Signature Requests ─────────────────────────────────────────────
export const signatureRequests = mysqlTable("signature_requests", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  envelopeId: varchar("envelopeId", { length: 128 }), // BunnyDoc envelope UUID
  title: varchar("title", { length: 512 }).notNull(),
  status: mysqlEnum("status", [
    "pending",       // Sent, waiting for signature
    "viewed",        // Signer opened the document
    "signed",        // At least one signer signed
    "completed",     // All signers completed
    "declined",      // Signer declined
    "expired",       // Request expired
    "cancelled",     // Manually cancelled
  ]).default("pending").notNull(),
  signerName: varchar("signerName", { length: 255 }).notNull(),
  signerEmail: varchar("signerEmail", { length: 255 }).notNull(),
  signerRole: varchar("signerRole", { length: 128 }).default("signer"),
  signingLink: text("signingLink"),       // Direct signing URL (if SHOW ME LINKS enabled)
  emailMessage: text("emailMessage"),
  bunnydocTemplateId: varchar("bunnydocTemplateId", { length: 128 }),
  completedAt: timestamp("completedAt"),
  signedDocumentUrl: text("signedDocumentUrl"), // URL to completed signed PDF
  webhookPayload: text("webhookPayload"),  // Raw webhook JSON for audit
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type SignatureRequest = typeof signatureRequests.$inferSelect;
export type InsertSignatureRequest = typeof signatureRequests.$inferInsert;

// ─── Seal Assets (custom seal graphics per status) ───────────────────────────
export const sealAssets = mysqlTable("seal_assets", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  status: mysqlEnum("status", ["verified", "in_progress", "not_verified"]).notNull(),
  url: text("url").notNull(),          // S3/CDN URL of the uploaded image
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3 key for deletion
  originalName: varchar("originalName", { length: 255 }), // original filename
  uploadedByUserId: int("uploadedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SealAsset = typeof sealAssets.$inferSelect;
export type InsertSealAsset = typeof sealAssets.$inferInsert;

// ─── Product Images ───────────────────────────────────────────────────────────
export const productImages = mysqlTable("product_images", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  url: text("url").notNull(),                          // S3/CDN public URL
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3 key for deletion
  originalName: varchar("originalName", { length: 255 }),
  mimeType: varchar("mimeType", { length: 64 }),
  fileSizeBytes: int("fileSizeBytes"),
  sortOrder: int("sortOrder").default(0).notNull(),    // 0 = primary/first image
  uploadedByUserId: int("uploadedByUserId").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});
export type ProductImage = typeof productImages.$inferSelect;
export type InsertProductImage = typeof productImages.$inferInsert;

// ─── Product Risk Assessments (AI-powered) ───────────────────────────────────
export const productRiskAssessments = mysqlTable("product_risk_assessments", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  tenantId: int("tenantId").default(1).notNull(),
  // Overall risk score 1 (low) – 10 (high)
  overallRiskScore: decimal("overallRiskScore", { precision: 4, scale: 1 }).notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high", "critical"]).notNull(),
  // AI output (structured JSON)
  risks: json("risks"),           // Array of { category, score, title, description, mitigations[] }
  summary: text("summary"),       // 2-3 sentence executive summary
  missingInfo: json("missingInfo"), // Array of strings: what info would reduce risk
  modelUsed: varchar("modelUsed", { length: 64 }),
  tokensUsed: int("tokensUsed"),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  triggeredByUserId: int("triggeredByUserId"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductRiskAssessment = typeof productRiskAssessments.$inferSelect;
export type InsertProductRiskAssessment = typeof productRiskAssessments.$inferInsert;
