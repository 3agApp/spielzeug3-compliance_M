import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { productVersions, documents, aiAnalysisResults } from "../../drizzle/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  return db;
}

// ─── Router ──────────────────────────────────────────────────────────────────
export const versionsRouter = router({
  /** List all versions for a product */
  list: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(productVersions)
        .where(eq(productVersions.productId, input.productId))
        .orderBy(desc(productVersions.createdAt));
      return rows;
    }),

  /** Get a single version with its documents and analyses */
  getWithDocuments: protectedProcedure
    .input(z.object({ versionId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [version] = await db
        .select()
        .from(productVersions)
        .where(eq(productVersions.id, input.versionId));
      if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });

      const docs = await db
        .select()
        .from(documents)
        .where(eq(documents.productVersionId, input.versionId))
        .orderBy(asc(documents.createdAt));

      const analyses = await db
        .select()
        .from(aiAnalysisResults)
        .where(eq(aiAnalysisResults.productVersionId, input.versionId))
        .orderBy(desc(aiAnalysisResults.createdAt));

      return { version, documents: docs, analyses };
    }),

  /** Create a new version */
  create: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        versionNumber: z.string().min(1).max(64),
        label: z.string().max(255).optional(),
        notes: z.string().optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const [result] = await db.insert(productVersions).values({
        productId: input.productId,
        versionNumber: input.versionNumber,
        label: input.label ?? null,
        notes: input.notes ?? null,
        isActive: input.isActive,
        createdByUserId: ctx.user.id,
      });
      const insertId = (result as any).insertId as number;
      const [created] = await db
        .select()
        .from(productVersions)
        .where(eq(productVersions.id, insertId));
      return created;
    }),

  /** Update a version */
  update: protectedProcedure
    .input(
      z.object({
        versionId: z.number(),
        versionNumber: z.string().min(1).max(64).optional(),
        label: z.string().max(255).nullable().optional(),
        notes: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { versionId, ...fields } = input;
      const updateData: Record<string, unknown> = {};
      if (fields.versionNumber !== undefined) updateData.versionNumber = fields.versionNumber;
      if (fields.label !== undefined) updateData.label = fields.label;
      if (fields.notes !== undefined) updateData.notes = fields.notes;
      if (fields.isActive !== undefined) updateData.isActive = fields.isActive;
      if (Object.keys(updateData).length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No fields to update" });
      await db.update(productVersions).set(updateData).where(eq(productVersions.id, versionId));
      const [updated] = await db.select().from(productVersions).where(eq(productVersions.id, versionId));
      return updated;
    }),

  /** Delete a version (only if no documents/analyses are assigned) */
  delete: protectedProcedure
    .input(z.object({ versionId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const docCount = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.productVersionId, input.versionId));
      const anaCount = await db
        .select({ id: aiAnalysisResults.id })
        .from(aiAnalysisResults)
        .where(eq(aiAnalysisResults.productVersionId, input.versionId));
      if (docCount.length > 0 || anaCount.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Version hat noch ${docCount.length} Dokument(e) und ${anaCount.length} Analyse(n) zugeordnet. Bitte zuerst die Zuordnungen entfernen.`,
        });
      }
      await db.delete(productVersions).where(eq(productVersions.id, input.versionId));
      return { success: true };
    }),

  /** Assign a document to a version (or remove assignment with versionId=null) */
  assignDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        versionId: z.number().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db
        .update(documents)
        .set({ productVersionId: input.versionId })
        .where(eq(documents.id, input.documentId));
      return { success: true };
    }),

  /** Assign multiple documents to a version at once */
  assignDocuments: protectedProcedure
    .input(
      z.object({
        documentIds: z.array(z.number()),
        versionId: z.number().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      for (const docId of input.documentIds) {
        await db
          .update(documents)
          .set({ productVersionId: input.versionId })
          .where(eq(documents.id, docId));
      }
      return { assigned: input.documentIds.length };
    }),

  /** Assign an analysis to a version (or remove assignment with versionId=null) */
  assignAnalysis: protectedProcedure
    .input(
      z.object({
        analysisId: z.number(),
        versionId: z.number().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db
        .update(aiAnalysisResults)
        .set({ productVersionId: input.versionId })
        .where(eq(aiAnalysisResults.id, input.analysisId));
      return { success: true };
    }),

  /** Get all documents for a product with their version assignment */
  getProductDocumentsWithVersions: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const docs = await db
        .select()
        .from(documents)
        .where(and(eq(documents.productId, input.productId), eq(documents.isArchived, false)))
        .orderBy(asc(documents.createdAt));
      return docs;
    }),

  /** Get all analyses for a product with their version assignment */
  getProductAnalysesWithVersions: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const analyses = await db
        .select()
        .from(aiAnalysisResults)
        .where(eq(aiAnalysisResults.productId, input.productId))
        .orderBy(desc(aiAnalysisResults.createdAt));
      return analyses;
    }),
});
