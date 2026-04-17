/**
 * server/routers/incidents.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * tRPC router for Incident & Recall Management.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { incidentService } from "../domains/incidents/incidentService";
import { incidentAiService } from "../domains/incidents/incidentAiService";
import { storagePut } from "../storage";

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const IncidentTypeSchema = z.enum([
  "personal_injury",
  "property_damage",
  "near_miss",
  "product_defect",
  "regulatory_complaint",
  "customer_complaint",
  "other",
]);

const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);

const IncidentStatusSchema = z.enum([
  "open",
  "under_review",
  "assessed",
  "recall_initiated",
  "recall_completed",
  "closed",
  "archived",
]);

const RiskLevelSchema = z.enum(["critical", "high", "medium", "low", "none"]);

const RecallScopeSchema = z.enum(["none", "targeted", "voluntary", "mandatory"]);

const RecallTypeSchema = z.enum(["voluntary", "mandatory", "targeted"]);

const EvidenceTypeSchema = z.enum([
  "photo",
  "customer_statement",
  "internal_report",
  "medical_report",
  "authority_document",
  "product_sample",
  "video",
  "other",
]);

const AssessmentTypeSchema = z.enum(["initial", "technical", "legal", "final"]);

const RemediationActionSchema = z.enum(["refund", "replacement", "repair", "disposal", "other"]);

// ─── Router ───────────────────────────────────────────────────────────────────

export const incidentsRouter = router({
  // ── List ──────────────────────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      status: IncidentStatusSchema.optional(),
      severity: SeveritySchema.optional(),
      incidentType: IncidentTypeSchema.optional(),
      productId: z.number().int().positive().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return incidentService.list(ctx.user, input);
    }),

  // ── Get by ID ─────────────────────────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return incidentService.getById(ctx.user, input.id);
    }),

  // ── Stats ─────────────────────────────────────────────────────────────────
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      return incidentService.getStats(ctx.user);
    }),

  // ── Create ────────────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      productId: z.number().int().positive().optional(),
      incidentType: IncidentTypeSchema,
      severity: SeveritySchema,
      title: z.string().min(3).max(512),
      description: z.string().min(10),
      reportedByName: z.string().max(255).optional(),
      reportedByEmail: z.string().email().max(320).optional(),
      reportedByType: z.enum(["customer", "supplier", "internal", "authority", "other"]).optional(),
      reportedAt: z.date(),
      affectedVersions: z.array(z.string()).optional(),
      affectedBatchNumbers: z.array(z.string()).optional(),
      affectedUnitsEstimate: z.number().int().positive().optional(),
      injuryDescription: z.string().optional(),
      injuredPersonAge: z.number().int().min(0).max(150).optional(),
      injuredPersonType: z.enum(["child", "adult", "unknown"]).optional(),
      medicalTreatmentRequired: z.boolean().optional(),
      hospitalisation: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return incidentService.create(ctx.user, input);
    }),

  // ── Update ────────────────────────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      status: IncidentStatusSchema.optional(),
      severity: SeveritySchema.optional(),
      title: z.string().min(3).max(512).optional(),
      description: z.string().min(10).optional(),
      assignedToUserId: z.number().int().positive().optional(),
      reportedToAuthority: z.boolean().optional(),
      authorityName: z.string().max(255).optional(),
      authorityReportDate: z.date().optional(),
      authorityReferenceNumber: z.string().max(128).optional(),
      affectedVersions: z.array(z.string()).optional(),
      affectedBatchNumbers: z.array(z.string()).optional(),
      affectedUnitsEstimate: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return incidentService.update(ctx.user, id, data);
    }),

  // ── Add Evidence (text/link) ───────────────────────────────────────────────
  addEvidence: protectedProcedure
    .input(z.object({
      incidentId: z.number().int().positive(),
      evidenceType: EvidenceTypeSchema,
      fileName: z.string().max(512),
      fileUrl: z.string().url(),
      fileKey: z.string().max(512),
      mimeType: z.string().max(128).optional(),
      fileSizeBytes: z.number().int().positive().optional(),
      description: z.string().optional(),
      sourceType: z.enum(["upload", "link", "text"]).optional(),
      textContent: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return incidentService.addEvidence(ctx.user, input);
    }),

  // ── Upload Evidence (file → S3) ────────────────────────────────────────────
  uploadEvidence: protectedProcedure
    .input(z.object({
      incidentId: z.number().int().positive(),
      evidenceType: EvidenceTypeSchema,
      fileName: z.string().max(512),
      mimeType: z.string().max(128).optional(),
      fileSizeBytes: z.number().int().positive().optional(),
      description: z.string().optional(),
      // Base64-encoded file content (max 10MB)
      fileBase64: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { incidentId, evidenceType, fileName, mimeType, fileSizeBytes, description, fileBase64 } = input;

      // Decode and upload to S3
      const buffer = Buffer.from(fileBase64, "base64");
      const suffix = Date.now().toString(36);
      const fileKey = `incidents/${incidentId}/evidence-${suffix}-${fileName}`;
      const { url: fileUrl } = await storagePut(fileKey, buffer, mimeType ?? "application/octet-stream");

      return incidentService.addEvidence(ctx.user, {
        incidentId,
        evidenceType,
        fileName,
        fileUrl,
        fileKey,
        mimeType,
        fileSizeBytes,
        description,
        sourceType: "upload",
      });
    }),

  // ── Delete Evidence ───────────────────────────────────────────────────────
  deleteEvidence: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return incidentService.deleteEvidence(ctx.user, input.id);
    }),

  // ── Add Assessment ────────────────────────────────────────────────────────
  addAssessment: protectedProcedure
    .input(z.object({
      incidentId: z.number().int().positive(),
      assessmentType: AssessmentTypeSchema.optional(),
      riskLevel: RiskLevelSchema,
      recallRecommended: z.boolean(),
      recallScope: RecallScopeSchema.optional(),
      assessmentText: z.string().min(10),
      regulatoryObligation: z.boolean().optional(),
      regulatoryDeadline: z.date().optional(),
      regulatoryBasis: z.string().optional(),
      requiredDocuments: z.array(z.string()).optional(),
      internalNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return incidentService.addAssessment(ctx.user, input);
    }),

  // ── Initiate Recall ───────────────────────────────────────────────────────
  initiateRecall: protectedProcedure
    .input(z.object({
      incidentId: z.number().int().positive(),
      recallType: RecallTypeSchema,
      recallScope: z.string().min(5),
      announcementText: z.string().optional(),
      affectedUnitsCount: z.number().int().positive().optional(),
      recallStartDate: z.date().optional(),
      remediationAction: RemediationActionSchema.optional(),
      remediationInstructions: z.string().optional(),
      authorityNames: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return incidentService.initiateRecall(ctx.user, input);
    }),

  // ── Update Recall ─────────────────────────────────────────────────────────
  updateRecall: protectedProcedure
    .input(z.object({
      recallId: z.number().int().positive(),
      status: z.enum(["planned", "announced", "active", "completed", "cancelled"]).optional(),
      announcementText: z.string().optional(),
      affectedUnitsCount: z.number().int().positive().optional(),
      recallStartDate: z.date().optional(),
      recallEndDate: z.date().optional(),
      authorityNotified: z.boolean().optional(),
      authorityNotifiedAt: z.date().optional(),
      authorityNames: z.array(z.string()).optional(),
      publicAnnouncement: z.boolean().optional(),
      publicAnnouncementUrl: z.string().url().optional(),
      pressReleaseUrl: z.string().url().optional(),
      remediationAction: RemediationActionSchema.optional(),
      remediationInstructions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return incidentService.updateRecall(ctx.user, input);
    }),

  // ── Get Timeline ──────────────────────────────────────────────────────────
  getTimeline: protectedProcedure
    .input(z.object({ incidentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return incidentService.getTimeline(ctx.user, input.incidentId);
    }),

  // ── KI-gestützte Fallbewertung ───────────────────────────────────────────────
  suggestAssessment: protectedProcedure
    .input(z.object({ incidentId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return incidentAiService.suggestAssessment(ctx.user, input.incidentId);
    }),

  // ── Get by Product (für Produktdetail-Tab) ───────────────────────────────
  getByProduct: protectedProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return incidentService.list(ctx.user, { productId: input.productId });
    }),
});