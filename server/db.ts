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
  productImages,
  productSafetyEntries,
  products,
  requirementTypes,
  signatureRequests,
  InsertSignatureRequest,
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
  const rows = await db
    .select()
    .from(products)
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(products.lastUpdatedAt));

  // Compute missingCount, latestAiScore and sealStatus per product via separate queries
  const productIds = rows.map((r) => r.products.id);
  if (productIds.length === 0) return [];

  // Get missing counts
  const missingRows = productIds.length > 0
    ? await db.execute(
        sql`SELECT productId, COUNT(*) as cnt FROM missing_requirements WHERE productId IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)}) AND status = 'missing' GROUP BY productId`
      )
    : { rows: [] };
  const missingMap: Record<number, number> = {};
  for (const row of (missingRows as any).rows ?? missingRows) {
    missingMap[Number((row as any).productId)] = Number((row as any).cnt);
  }

  // Get latest AI scores
  const aiRows = productIds.length > 0
    ? await db.execute(
        sql`SELECT productId, overallScore FROM ai_analysis_results WHERE id IN (SELECT MAX(id) FROM ai_analysis_results WHERE productId IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)}) GROUP BY productId)`
      )
    : { rows: [] };
  const aiMap: Record<number, number | null> = {};
  for (const row of (aiRows as any).rows ?? aiRows) {
    aiMap[Number((row as any).productId)] = (row as any).overallScore != null ? Number((row as any).overallScore) : null;
  }

  // Get first image per product
  const imageRows = productIds.length > 0
    ? await db
        .select({ productId: productImages.productId, url: productImages.url })
        .from(productImages)
        .where(sql`${productImages.productId} IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)}) AND ${productImages.sortOrder} = 0`)
    : [];
  const imageMap: Record<number, string | null> = {};
  for (const row of imageRows) {
    imageMap[row.productId] = row.url;
  }
  // Get latest risk assessment score per product
  const riskRows = productIds.length > 0
    ? await db.execute(
        sql`SELECT productId, overallRiskScore, riskLevel FROM product_risk_assessments WHERE id IN (SELECT MAX(id) FROM product_risk_assessments WHERE productId IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)}) AND status = 'completed' GROUP BY productId)`
      )
    : { rows: [] };
  const riskMap: Record<number, { score: number; level: string } | null> = {};
  for (const row of (riskRows as any).rows ?? riskRows) {
    riskMap[Number((row as any).productId)] = {
      score: Number((row as any).overallRiskScore),
      level: String((row as any).riskLevel),
    };
  }
  return rows.map(({ products: p, suppliers: s }) => {
    let sealStatus: 'verified' | 'in_progress' | 'not_verified' = 'not_verified';
    if (p.sealStatusOverride) {
      sealStatus = p.sealStatusOverride as any;
    } else if (p.status === 'approved' || p.status === 'completed') {
      sealStatus = 'verified';
    } else if (p.status === 'in_progress' || p.status === 'submitted' || p.status === 'under_review') {
      sealStatus = 'in_progress';
    }
    return {
      ...p,
      supplierName: s?.name ?? null,
      missingCount: missingMap[p.id] ?? 0,
      latestAiScore: aiMap[p.id] ?? null,
      sealStatus,
      firstImageUrl: imageMap[p.id] ?? null,
      latestRiskScore: riskMap[p.id]?.score ?? null,
      latestRiskLevel: riskMap[p.id]?.level ?? null,
    };
  });
}
export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ product: products, supplier: suppliers })
    .from(products)
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(eq(products.id, id))
    .limit(1);
  if (!rows[0]) return null;
  const { product: p, supplier: s } = rows[0];
  return { ...p, supplierName: s?.name ?? null };
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
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.supplierId, supplierId))
    .orderBy(desc(products.lastUpdatedAt));
  if (rows.length === 0) return [];
  const productIds = rows.map((r) => r.id);
  const imageRows = await db
    .select({ productId: productImages.productId, url: productImages.url })
    .from(productImages)
    .where(sql`${productImages.productId} IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)}) AND ${productImages.sortOrder} = 0`);
  const imageMap: Record<number, string | null> = {};
  for (const row of imageRows) {
    imageMap[row.productId] = row.url;
  }
  return rows.map((p) => ({ ...p, firstImageUrl: imageMap[p.id] ?? null }));
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
export async function getDocumentsByProduct(productId: number, includeArchived = false) {
  const db = await getDb();
  if (!db) return [];
  const condition = includeArchived
    ? eq(documents.productId, productId)
    : and(eq(documents.productId, productId), eq(documents.isArchived, false));
  return db
    .select()
    .from(documents)
    .where(condition)
    .orderBy(desc(documents.uploadedAt));
}

export async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getArchivedDocumentVersions(productId: number, documentType: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.productId, productId),
        eq(documents.documentType, documentType as any),
        eq(documents.isArchived, true)
      )
    )
    .orderBy(desc(documents.uploadedAt));
}

export async function archiveDocument(id: number, replacedByDocumentId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(documents)
    .set({ isArchived: true, replacedByDocumentId })
    .where(eq(documents.id, id));
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

/**
 * Revoke publicDownload=true on all non-archived documents whose expiryDate
 * is in the past.  Returns the list of affected document IDs.
 */
export async function revokeExpiredPublicDocuments(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  // Find expired public documents
  const expired = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.publicDownload, true),
        eq(documents.isArchived, false),
        sql`${documents.expiryDate} IS NOT NULL AND ${documents.expiryDate} < NOW()`
      )
    );
  if (expired.length === 0) return [];
  const ids = expired.map((r) => r.id);
  // Bulk-update: set publicDownload = false
  await db
    .update(documents)
    .set({ publicDownload: false })
    .where(
      and(
        eq(documents.publicDownload, true),
        eq(documents.isArchived, false),
        sql`${documents.expiryDate} IS NOT NULL AND ${documents.expiryDate} < NOW()`
      )
    );
  return ids;
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
        safetyImages: data.safetyImages,
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

/** Returns audit-log entries for a specific product (entityId), newest first. */
export async function getAuditLogsByProduct(productId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.entityId, productId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
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

  // ── 1. Document requirements (weighted by priority) ──────────────────────
  // High-priority docs: test_report, declaration_of_conformity → weight 3
  // Medium-priority docs: certificate, safety_image → weight 2
  // Other required docs → weight 1
  const HIGH_PRIORITY = ["test_report", "declaration_of_conformity"];
  const MEDIUM_PRIORITY = ["certificate", "safety_image"];

  const reqs = await db
    .select()
    .from(missingRequirements)
    .where(and(eq(missingRequirements.productId, productId), eq(missingRequirements.required, true)));

  let docPoints = 0;
  let docMax = 0;
  for (const r of reqs) {
    const w = HIGH_PRIORITY.includes(r.requirementType) ? 3
            : MEDIUM_PRIORITY.includes(r.requirementType) ? 2 : 1;
    docMax += w;
    if (r.status === "approved" || r.status === "provided") docPoints += w;
  }

  // ── 2. Safety data completeness (weight 20% of total) ────────────────────
  const safetyRows = await db
    .select()
    .from(productSafetyEntries)
    .where(eq(productSafetyEntries.productId, productId))
    .limit(1);
  const safety = safetyRows[0];

  // Core safety fields that must be filled
  const SAFETY_FIELDS = ["safetyText", "warningText", "ageGrading"] as const;
  let safetyFilled = 0;
  for (const f of SAFETY_FIELDS) {
    if (safety && safety[f] && String(safety[f]).trim().length > 0) safetyFilled++;
  }
  // Safety data contributes up to 20% of the total score
  // We model it as safetyFilled/SAFETY_FIELDS.length * safetyWeight points
  const safetyWeight = docMax > 0 ? Math.round(docMax * 0.25) : 3; // ~20% of doc weight
  const safetyPoints = Math.round((safetyFilled / SAFETY_FIELDS.length) * safetyWeight);

  const totalMax = docMax + safetyWeight;
  const totalPoints = docPoints + safetyPoints;

  if (totalMax === 0) return 100;
  return Math.round((totalPoints / totalMax) * 100);
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
export async function createAiAnalysis(data: typeof aiAnalysisResults.$inferInsert): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(aiAnalysisResults).values(data);
  // MySQL/TiDB Drizzle returns [ResultSetHeader, ...] – insertId is in result[0]
  const insertId = (result as any)?.[0]?.insertId ?? (result as any)?.insertId ?? 0;
  return insertId;
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

// ─── Signature Requests (BunnyDoc) ───────────────────────────────────────────
export async function createSignatureRequest(data: InsertSignatureRequest) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(signatureRequests).values(data);
}

export async function getSignatureRequestsByProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(signatureRequests)
    .where(eq(signatureRequests.productId, productId))
    .orderBy(desc(signatureRequests.createdAt));
}

export async function getSignatureRequestById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(signatureRequests)
    .where(eq(signatureRequests.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function getSignatureRequestByEnvelopeId(envelopeId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(signatureRequests)
    .where(eq(signatureRequests.envelopeId, envelopeId))
    .limit(1);
  return result[0] ?? null;
}

export async function updateSignatureRequestStatus(
  id: number,
  status: "pending" | "viewed" | "signed" | "completed" | "declined" | "expired" | "cancelled",
  extra?: { completedAt?: Date; signedDocumentUrl?: string; webhookPayload?: string }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(signatureRequests)
    .set({
      status,
      updatedAt: new Date(),
      ...(extra?.completedAt ? { completedAt: extra.completedAt } : {}),
      ...(extra?.signedDocumentUrl ? { signedDocumentUrl: extra.signedDocumentUrl } : {}),
      ...(extra?.webhookPayload ? { webhookPayload: extra.webhookPayload } : {}),
    })
    .where(eq(signatureRequests.id, id));
}

export async function cancelSignatureRequest(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(signatureRequests)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(signatureRequests.id, id));
}
