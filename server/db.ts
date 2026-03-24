import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  aiAnalysisResults,
  approvalHistory,
  auditLogs,
  comments,
  componentDocuments,
  documents,
  InsertComponentDocument,
  InsertProductComponent,
  missingRequirements,
  notifications,
  productComponents,
  productSafetyEntries,
  products,
  requirementTypes,
  suppliers,
  systemSettings,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (user.openId === ENV.ownerOpenId) {
    values.complianceRole = "administrator";
    updateSet.complianceRole = "administrator";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? null;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, id));
}

// ─── Suppliers ───────────────────────────────────────────────────────────────
export async function getAllSuppliers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppliers).orderBy(suppliers.name);
}

export async function getSupplierById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createSupplier(data: typeof suppliers.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(suppliers).values(data);
  return result;
}

export async function updateSupplier(id: number, data: Partial<typeof suppliers.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
}

// ─── Products ────────────────────────────────────────────────────────────────
export async function getAllProducts(filters?: {
  supplierId?: number;
  status?: string;
  brand?: string;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.supplierId) conditions.push(eq(products.supplierId, filters.supplierId));
  if (filters?.status) conditions.push(eq(products.status, filters.status as any));
  if (filters?.brand) conditions.push(eq(products.brand, filters.brand));
  if (filters?.search) {
    conditions.push(
      or(
        like(products.productName, `%${filters.search}%`),
        like(products.internalArticleNumber, `%${filters.search}%`),
        like(products.ean, `%${filters.search}%`)
      )
    );
  }
  const query = db
    .select()
    .from(products)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(products.lastUpdatedAt));
  return query;
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createProduct(data: typeof products.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(products).values(data);
  return result;
}

export async function updateProduct(id: number, data: Partial<typeof products.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function getProductsBySupplier(supplierId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(products)
    .where(eq(products.supplierId, supplierId))
    .orderBy(desc(products.lastUpdatedAt));
}

// ─── Missing Requirements ────────────────────────────────────────────────────
export async function getMissingRequirementsByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(missingRequirements)
    .where(eq(missingRequirements.productId, productId))
    .orderBy(missingRequirements.requirementType);
}

export async function createMissingRequirement(data: typeof missingRequirements.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(missingRequirements).values(data);
}

export async function updateMissingRequirement(
  id: number,
  data: Partial<typeof missingRequirements.$inferInsert>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(missingRequirements).set(data).where(eq(missingRequirements.id, id));
}

// ─── Documents ───────────────────────────────────────────────────────────────
export async function getDocumentsByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(documents)
    .where(eq(documents.productId, productId))
    .orderBy(desc(documents.uploadedAt));
}

export async function createDocument(data: typeof documents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(documents).values(data);
  return result;
}

export async function updateDocument(id: number, data: Partial<typeof documents.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(documents).set(data).where(eq(documents.id, id));
}

export async function deleteDocument(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documents).where(eq(documents.id, id));
}

// ─── Product Safety ──────────────────────────────────────────────────────────
export async function getProductSafety(productId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(productSafetyEntries)
    .where(eq(productSafetyEntries.productId, productId))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertProductSafety(data: typeof productSafetyEntries.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .insert(productSafetyEntries)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        safetyText: data.safetyText,
        warningText: data.warningText,
        ageGrading: data.ageGrading,
        materialInformation: data.materialInformation,
        usageRestrictions: data.usageRestrictions,
        safetyNotes: data.safetyNotes,
        submittedByUserId: data.submittedByUserId,
      },
    });
}

// ─── Comments ────────────────────────────────────────────────────────────────
export async function getCommentsByProduct(productId: number, internalOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(comments.productId, productId)];
  if (!internalOnly) conditions.push(eq(comments.visibilityInternalOnly, false));
  return db
    .select()
    .from(comments)
    .where(and(...conditions))
    .orderBy(desc(comments.createdAt));
}

export async function createComment(data: typeof comments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(comments).values(data);
}

// ─── Approval History ────────────────────────────────────────────────────────
export async function getApprovalHistory(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(approvalHistory)
    .where(eq(approvalHistory.productId, productId))
    .orderBy(desc(approvalHistory.createdAt));
}

export async function createApprovalHistoryEntry(data: typeof approvalHistory.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(approvalHistory).values(data);
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────
export async function createAuditLog(data: typeof auditLogs.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function getAuditLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

// ─── Notifications ───────────────────────────────────────────────────────────
export async function createNotification(data: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function getNotificationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

// ─── Requirement Types ───────────────────────────────────────────────────────
export async function getAllRequirementTypes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(requirementTypes).orderBy(requirementTypes.sortOrder);
}

export async function createRequirementType(data: typeof requirementTypes.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(requirementTypes).values(data);
}

export async function updateRequirementType(
  id: number,
  data: Partial<typeof requirementTypes.$inferInsert>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(requirementTypes).set(data).where(eq(requirementTypes.id, id));
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────
export async function getSupplierDashboardStats(supplierId: number) {
  const db = await getDb();
  if (!db) return { open: 0, submitted: 0, clarification: 0, completed: 0 };

  const allProducts = await db
    .select()
    .from(products)
    .where(eq(products.supplierId, supplierId));

  return {
    open: allProducts.filter((p) => p.status === "open" || p.status === "in_progress").length,
    submitted: allProducts.filter((p) => p.status === "submitted" || p.status === "under_review")
      .length,
    clarification: allProducts.filter((p) => p.status === "clarification_needed").length,
    completed: allProducts.filter((p) => p.status === "completed" || p.status === "approved")
      .length,
    total: allProducts.length,
  };
}

export async function getInternalDashboardStats() {
  const db = await getDb();
  if (!db) return {};

  const allProducts = await db.select().from(products);
  const allSuppliers = await db.select().from(suppliers);

  return {
    totalProducts: allProducts.length,
    openItems: allProducts.filter((p) => p.status === "open" || p.status === "in_progress").length,
    awaitingReview: allProducts.filter(
      (p) => p.status === "submitted" || p.status === "under_review"
    ).length,
    clarificationNeeded: allProducts.filter((p) => p.status === "clarification_needed").length,
    completed: allProducts.filter((p) => p.status === "completed").length,
    approved: allProducts.filter((p) => p.status === "approved").length,
    rejected: allProducts.filter((p) => p.status === "rejected").length,
    totalSuppliers: allSuppliers.length,
    activeSuppliers: allSuppliers.filter((s) => s.active).length,
  };
}

export async function computeCompletenessScore(productId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const reqs = await db
    .select()
    .from(missingRequirements)
    .where(and(eq(missingRequirements.productId, productId), eq(missingRequirements.required, true)));

  if (reqs.length === 0) return 100;
  const fulfilled = reqs.filter((r) => r.status === "approved" || r.status === "provided").length;
  return Math.round((fulfilled / reqs.length) * 100);
}

// ─── System Settings ─────────────────────────────────────────────────────────
export async function getSystemSetting(key: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.settingKey, key))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertSystemSetting(
  key: string,
  value: string,
  isEncrypted = false,
  userId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .insert(systemSettings)
    .values({ settingKey: key, settingValue: value, isEncrypted, updatedByUserId: userId })
    .onDuplicateKeyUpdate({
      set: { settingValue: value, isEncrypted, updatedByUserId: userId },
    });
}

// ─── AI Analysis Results ─────────────────────────────────────────────────────
export async function createAiAnalysis(data: typeof aiAnalysisResults.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(aiAnalysisResults).values(data);
  return result;
}

export async function updateAiAnalysis(
  id: number,
  data: Partial<typeof aiAnalysisResults.$inferInsert>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiAnalysisResults).set(data).where(eq(aiAnalysisResults.id, id));
}

export async function getLatestAiAnalysisByProduct(productId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(aiAnalysisResults)
    .where(eq(aiAnalysisResults.productId, productId))
    .orderBy(desc(aiAnalysisResults.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getAiAnalysisHistory(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aiAnalysisResults)
    .where(eq(aiAnalysisResults.productId, productId))
    .orderBy(desc(aiAnalysisResults.createdAt))
    .limit(10);
}

// ─── Product Components ───────────────────────────────────────────────────────
export async function getComponentsByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(productComponents)
    .where(and(eq(productComponents.productId, productId), eq(productComponents.active, true)))
    .orderBy(productComponents.sortOrder, productComponents.createdAt);
}

export async function getComponentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(productComponents).where(eq(productComponents.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createComponent(data: InsertProductComponent) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(productComponents).values(data);
}

export async function updateComponent(id: number, data: Partial<InsertProductComponent>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(productComponents).set(data).where(eq(productComponents.id, id));
}

export async function deleteComponent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Soft-delete
  return db.update(productComponents).set({ active: false }).where(eq(productComponents.id, id));
}

// ─── Component Documents ──────────────────────────────────────────────────────
export async function getDocumentsByComponent(componentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(componentDocuments)
    .where(eq(componentDocuments.componentId, componentId))
    .orderBy(desc(componentDocuments.createdAt));
}

export async function getAllComponentDocumentsByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(componentDocuments)
    .where(eq(componentDocuments.productId, productId))
    .orderBy(desc(componentDocuments.createdAt));
}

export async function createComponentDocument(data: InsertComponentDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(componentDocuments).values(data);
}

export async function deleteComponentDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(componentDocuments).where(eq(componentDocuments.id, id));
}

export async function updateComponentDocumentReview(
  id: number,
  reviewStatus: "pending" | "approved" | "rejected",
  reviewNote: string | null,
  reviewedByUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .update(componentDocuments)
    .set({ reviewStatus, reviewNote, reviewedByUserId, reviewedAt: new Date() })
    .where(eq(componentDocuments.id, id));
}
