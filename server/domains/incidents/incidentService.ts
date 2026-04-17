/**
 * server/domains/incidents/incidentService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for Incident & Recall Management.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  incidents,
  incidentEvidences,
  incidentAssessments,
  incidentRecalls,
  incidentTimeline,
  products,
  type Incident,
  type InsertIncident,
  type InsertIncidentEvidence,
  type InsertIncidentAssessment,
  type InsertIncidentRecall,
} from "../../../drizzle/schema";
import { getDb } from "../../db";
import { requireRole, ADMIN_ROLES, type UserContext } from "../../shared";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateIncidentInput = {
  productId?: number;
  incidentType: Incident["incidentType"];
  severity: Incident["severity"];
  title: string;
  description: string;
  reportedByName?: string;
  reportedByEmail?: string;
  reportedByType?: Incident["reportedByType"];
  reportedAt: Date;
  affectedVersions?: string[];
  affectedBatchNumbers?: string[];
  affectedUnitsEstimate?: number;
  injuryDescription?: string;
  injuredPersonAge?: number;
  injuredPersonType?: Incident["injuredPersonType"];
  medicalTreatmentRequired?: boolean;
  hospitalisation?: boolean;
};

export type AddEvidenceInput = {
  incidentId: number;
  evidenceType: InsertIncidentEvidence["evidenceType"];
  fileName: string;
  fileUrl: string;
  fileKey: string;
  mimeType?: string;
  fileSizeBytes?: number;
  description?: string;
  sourceType?: InsertIncidentEvidence["sourceType"];
  textContent?: string;
};

export type AddAssessmentInput = {
  incidentId: number;
  assessmentType?: InsertIncidentAssessment["assessmentType"];
  riskLevel: InsertIncidentAssessment["riskLevel"];
  recallRecommended: boolean;
  recallScope?: InsertIncidentAssessment["recallScope"];
  assessmentText: string;
  regulatoryObligation?: boolean;
  regulatoryDeadline?: Date;
  regulatoryBasis?: string;
  requiredDocuments?: string[];
  internalNotes?: string;
};

export type InitiateRecallInput = {
  incidentId: number;
  recallType: InsertIncidentRecall["recallType"];
  recallScope: string;
  announcementText?: string;
  affectedUnitsCount?: number;
  recallStartDate?: Date;
  remediationAction?: InsertIncidentRecall["remediationAction"];
  remediationInstructions?: string;
  authorityNames?: string[];
};

export type UpdateRecallInput = {
  recallId: number;
  status?: InsertIncidentRecall["status"];
  announcementText?: string;
  affectedUnitsCount?: number;
  recallStartDate?: Date;
  recallEndDate?: Date;
  authorityNotified?: boolean;
  authorityNotifiedAt?: Date;
  authorityNames?: string[];
  publicAnnouncement?: boolean;
  publicAnnouncementUrl?: string;
  pressReleaseUrl?: string;
  remediationAction?: InsertIncidentRecall["remediationAction"];
  remediationInstructions?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function addTimelineEntry(
  incidentId: number,
  action: string,
  user: UserContext | null,
  note?: string,
  metadata?: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(incidentTimeline).values({
    incidentId,
    action,
    performedByUserId: user?.id ? Number(user.id) : null,
    performedByName: null,
    note: note ?? null,
    metadata: metadata ?? null,
  } as any);
}

function getTenantId(user: UserContext): number {
  return user.tenantId ?? 1;
}

function getUserId(user: UserContext): number {
  return user.id ? Number(user.id) : 0;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const incidentService = {
  // ── List ──────────────────────────────────────────────────────────────────
  async list(user: UserContext, filters?: {
    status?: Incident["status"];
    severity?: Incident["severity"];
    incidentType?: Incident["incidentType"];
    productId?: number;
  }) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin", "internal_employee"]);
    const db = await getDb();
    if (!db) return [];

    const tenantId = getTenantId(user);
    const conditions = [eq(incidents.tenantId, tenantId)];
    if (filters?.status) conditions.push(eq(incidents.status, filters.status));
    if (filters?.severity) conditions.push(eq(incidents.severity, filters.severity));
    if (filters?.incidentType) conditions.push(eq(incidents.incidentType, filters.incidentType));
    if (filters?.productId) conditions.push(eq(incidents.productId, filters.productId));

    const rows = await db
      .select()
      .from(incidents)
      .where(and(...conditions))
      .orderBy(desc(incidents.createdAt));

    // Enrich with product info
    const productIds = Array.from(new Set(rows.map((r) => r.productId).filter(Boolean))) as number[];
    const productMap: Record<number, { productName: string; internalArticleNumber: string | null }> = {};
    if (productIds.length > 0) {
      const prods = await db
        .select({ id: products.id, productName: products.productName, internalArticleNumber: products.internalArticleNumber })
        .from(products)
        .where(inArray(products.id, productIds));
      for (const p of prods) productMap[p.id] = p;
    }

    return rows.map((r) => ({
      ...r,
      product: r.productId ? (productMap[r.productId] ?? null) : null,
    }));
  },

  // ── Get by ID ─────────────────────────────────────────────────────────────
  async getById(user: UserContext, incidentId: number) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin", "internal_employee"]);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const tenantId = getTenantId(user);
    const [incident] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantId)));

    if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });

    const [evidences, assessments, recall, timeline] = await Promise.all([
      db.select().from(incidentEvidences).where(eq(incidentEvidences.incidentId, incidentId)).orderBy(desc(incidentEvidences.uploadedAt)),
      db.select().from(incidentAssessments).where(eq(incidentAssessments.incidentId, incidentId)).orderBy(desc(incidentAssessments.createdAt)),
      db.select().from(incidentRecalls).where(eq(incidentRecalls.incidentId, incidentId)),
      db.select().from(incidentTimeline).where(eq(incidentTimeline.incidentId, incidentId)).orderBy(desc(incidentTimeline.createdAt)),
    ]);

    let product = null;
    if (incident.productId) {
      const [p] = await db
        .select({ id: products.id, productName: products.productName, internalArticleNumber: products.internalArticleNumber, brand: products.brand, ean: products.ean })
        .from(products)
        .where(eq(products.id, incident.productId));
      product = p ?? null;
    }

    return {
      ...incident,
      product,
      evidences,
      assessments,
      recall: recall[0] ?? null,
      timeline,
    };
  },

  // ── Create ────────────────────────────────────────────────────────────────
  async create(user: UserContext, input: CreateIncidentInput) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const tenantId = getTenantId(user);
    const userId = getUserId(user);

    const [result] = await db.insert(incidents).values({
      tenantId,
      productId: input.productId ?? null,
      incidentType: input.incidentType,
      severity: input.severity,
      status: "open",
      title: input.title,
      description: input.description,
      reportedByName: input.reportedByName ?? null,
      reportedByEmail: input.reportedByEmail ?? null,
      reportedByType: input.reportedByType ?? "customer",
      reportedAt: input.reportedAt,
      affectedVersions: input.affectedVersions ?? [],
      affectedBatchNumbers: input.affectedBatchNumbers ?? [],
      affectedUnitsEstimate: input.affectedUnitsEstimate ?? null,
      injuryDescription: input.injuryDescription ?? null,
      injuredPersonAge: input.injuredPersonAge ?? null,
      injuredPersonType: input.injuredPersonType ?? null,
      medicalTreatmentRequired: input.medicalTreatmentRequired ?? false,
      hospitalisation: input.hospitalisation ?? false,
      createdByUserId: userId,
    } as InsertIncident).$returningId();

    const incidentId = (result as any).id as number;
    await addTimelineEntry(incidentId, "created", user, `Vorfall erfasst: ${input.title}`);

    return { id: incidentId };
  },

  // ── Update ────────────────────────────────────────────────────────────────
  async update(user: UserContext, incidentId: number, data: Partial<{
    status: Incident["status"];
    severity: Incident["severity"];
    title: string;
    description: string;
    assignedToUserId: number;
    reportedToAuthority: boolean;
    authorityName: string;
    authorityReportDate: Date;
    authorityReferenceNumber: string;
    affectedVersions: string[];
    affectedBatchNumbers: string[];
    affectedUnitsEstimate: number;
  }>) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const tenantId = getTenantId(user);
    const [existing] = await db
      .select({ id: incidents.id, status: incidents.status })
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantId)));

    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });

    await db.update(incidents).set(data as any).where(eq(incidents.id, incidentId));

    if (data.status && data.status !== existing.status) {
      await addTimelineEntry(incidentId, "status_changed", user, `Status: ${existing.status} → ${data.status}`);
    }

    return { success: true };
  },

  // ── Add Evidence ──────────────────────────────────────────────────────────
  async addEvidence(user: UserContext, input: AddEvidenceInput) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin", "internal_employee"]);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const tenantId = getTenantId(user);
    const [incident] = await db
      .select({ id: incidents.id })
      .from(incidents)
      .where(and(eq(incidents.id, input.incidentId), eq(incidents.tenantId, tenantId)));

    if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });

    const [result] = await db.insert(incidentEvidences).values({
      incidentId: input.incidentId,
      evidenceType: input.evidenceType,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      fileKey: input.fileKey,
      mimeType: input.mimeType ?? null,
      fileSizeBytes: input.fileSizeBytes ?? null,
      description: input.description ?? null,
      sourceType: input.sourceType ?? "upload",
      textContent: input.textContent ?? null,
      uploadedByUserId: getUserId(user),
    } as InsertIncidentEvidence).$returningId();

    const evidenceId = (result as any).id as number;
    await addTimelineEntry(input.incidentId, "evidence_added", user,
      `Beweis hinzugefügt: ${input.evidenceType} – ${input.fileName}`,
      { evidenceId, evidenceType: input.evidenceType }
    );

    return { id: evidenceId };
  },

  // ── Delete Evidence ───────────────────────────────────────────────────────
  async deleteEvidence(user: UserContext, evidenceId: number) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [evidence] = await db
      .select({ id: incidentEvidences.id, incidentId: incidentEvidences.incidentId, fileName: incidentEvidences.fileName })
      .from(incidentEvidences)
      .where(eq(incidentEvidences.id, evidenceId));

    if (!evidence) throw new TRPCError({ code: "NOT_FOUND", message: "Evidence not found" });

    const tenantId = getTenantId(user);
    const [incident] = await db
      .select({ id: incidents.id })
      .from(incidents)
      .where(and(eq(incidents.id, evidence.incidentId), eq(incidents.tenantId, tenantId)));

    if (!incident) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

    await db.delete(incidentEvidences).where(eq(incidentEvidences.id, evidenceId));
    await addTimelineEntry(evidence.incidentId, "evidence_deleted", user, `Beweis gelöscht: ${evidence.fileName}`);

    return { success: true };
  },

  // ── Add Assessment ────────────────────────────────────────────────────────
  async addAssessment(user: UserContext, input: AddAssessmentInput) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const tenantId = getTenantId(user);
    const [incident] = await db
      .select({ id: incidents.id, status: incidents.status })
      .from(incidents)
      .where(and(eq(incidents.id, input.incidentId), eq(incidents.tenantId, tenantId)));

    if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });

    const [result] = await db.insert(incidentAssessments).values({
      incidentId: input.incidentId,
      assessedByUserId: getUserId(user),
      assessmentType: input.assessmentType ?? "initial",
      riskLevel: input.riskLevel,
      recallRecommended: input.recallRecommended,
      recallScope: input.recallScope ?? "none",
      assessmentText: input.assessmentText,
      regulatoryObligation: input.regulatoryObligation ?? false,
      regulatoryDeadline: input.regulatoryDeadline ?? null,
      regulatoryBasis: input.regulatoryBasis ?? null,
      requiredDocuments: input.requiredDocuments ?? [],
      internalNotes: input.internalNotes ?? null,
    } as InsertIncidentAssessment).$returningId();

    const assessmentId = (result as any).id as number;

    // Auto-advance status to "assessed"
    if (incident.status === "open" || incident.status === "under_review") {
      await db.update(incidents).set({ status: "assessed" }).where(eq(incidents.id, input.incidentId));
    }

    await addTimelineEntry(input.incidentId, "assessed", user,
      `Bewertung hinzugefügt: Risiko ${input.riskLevel}, Rückruf empfohlen: ${input.recallRecommended ? "Ja" : "Nein"}`,
      { assessmentId, riskLevel: input.riskLevel, recallRecommended: input.recallRecommended }
    );

    return { id: assessmentId };
  },

  // ── Initiate Recall ───────────────────────────────────────────────────────
  async initiateRecall(user: UserContext, input: InitiateRecallInput) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const tenantId = getTenantId(user);
    const [incident] = await db
      .select({ id: incidents.id, status: incidents.status })
      .from(incidents)
      .where(and(eq(incidents.id, input.incidentId), eq(incidents.tenantId, tenantId)));

    if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });

    const [existingRecall] = await db
      .select({ id: incidentRecalls.id })
      .from(incidentRecalls)
      .where(eq(incidentRecalls.incidentId, input.incidentId));

    if (existingRecall) {
      throw new TRPCError({ code: "CONFLICT", message: "Recall already initiated for this incident" });
    }

    const [result] = await db.insert(incidentRecalls).values({
      incidentId: input.incidentId,
      recallType: input.recallType,
      recallScope: input.recallScope,
      status: "planned",
      announcementText: input.announcementText ?? null,
      affectedUnitsCount: input.affectedUnitsCount ?? null,
      recallStartDate: input.recallStartDate ?? null,
      authorityNames: input.authorityNames ?? [],
      remediationAction: input.remediationAction ?? null,
      remediationInstructions: input.remediationInstructions ?? null,
      createdByUserId: getUserId(user),
    } as InsertIncidentRecall).$returningId();

    const recallId = (result as any).id as number;

    await db.update(incidents).set({ status: "recall_initiated" }).where(eq(incidents.id, input.incidentId));

    await addTimelineEntry(input.incidentId, "recall_initiated", user,
      `Rückruf eingeleitet: ${input.recallType} – ${input.recallScope}`,
      { recallId, recallType: input.recallType }
    );

    return { id: recallId };
  },

  // ── Update Recall ─────────────────────────────────────────────────────────
  async updateRecall(user: UserContext, input: UpdateRecallInput) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [recall] = await db
      .select({ id: incidentRecalls.id, incidentId: incidentRecalls.incidentId, status: incidentRecalls.status })
      .from(incidentRecalls)
      .where(eq(incidentRecalls.id, input.recallId));

    if (!recall) throw new TRPCError({ code: "NOT_FOUND", message: "Recall not found" });

    const tenantId = getTenantId(user);
    const [incident] = await db
      .select({ id: incidents.id })
      .from(incidents)
      .where(and(eq(incidents.id, recall.incidentId), eq(incidents.tenantId, tenantId)));

    if (!incident) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

    const { recallId, ...updateData } = input;
    await db.update(incidentRecalls).set(updateData as any).where(eq(incidentRecalls.id, recallId));

    if (input.status && input.status !== recall.status) {
      const incidentStatus = input.status === "completed" ? "recall_completed" : "recall_initiated";
      await db.update(incidents).set({ status: incidentStatus }).where(eq(incidents.id, recall.incidentId));

      await addTimelineEntry(recall.incidentId, "recall_status_changed", user,
        `Rückruf-Status: ${recall.status} → ${input.status}`,
        { recallId, newStatus: input.status }
      );
    }

    return { success: true };
  },

  // ── Get Timeline ──────────────────────────────────────────────────────────
  async getTimeline(user: UserContext, incidentId: number) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin", "internal_employee"]);
    const db = await getDb();
    if (!db) return [];

    const tenantId = getTenantId(user);
    const [incident] = await db
      .select({ id: incidents.id })
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantId)));

    if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });

    return db
      .select()
      .from(incidentTimeline)
      .where(eq(incidentTimeline.incidentId, incidentId))
      .orderBy(desc(incidentTimeline.createdAt));
  },

  // ── Get Stats ─────────────────────────────────────────────────────────────
  async getStats(user: UserContext) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin", "internal_employee"]);
    const db = await getDb();
    if (!db) return { total: 0, open: 0, underReview: 0, recallActive: 0, critical: 0, high: 0 };

    const tenantId = getTenantId(user);
    const all = await db
      .select({ status: incidents.status, severity: incidents.severity })
      .from(incidents)
      .where(eq(incidents.tenantId, tenantId));

    return {
      total: all.length,
      open: all.filter((r) => r.status === "open").length,
      underReview: all.filter((r) => r.status === "under_review").length,
      recallActive: all.filter((r) => r.status === "recall_initiated").length,
      critical: all.filter((r) => r.severity === "critical").length,
      high: all.filter((r) => r.severity === "high").length,
    };
  },
};
