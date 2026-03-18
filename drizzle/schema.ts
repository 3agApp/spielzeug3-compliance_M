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
  ]).default("internal_employee"),
  languagePreference: mysqlEnum("languagePreference", ["de", "en"]).default("de").notNull(),
  supplierId: int("supplierId"), // FK to suppliers (for supplier users)
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
  sourceLastSyncAt: timestamp("sourceLastSyncAt"),
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
