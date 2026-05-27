/**
 * server/routers/supplierDocuments.ts
 * Supplier document management: upload, list, delete
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { supplierDocuments } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { storagePut } from "../storage";
import { TRPCError } from "@trpc/server";

const DOCUMENT_TYPES = [
  "test_report", "certificate", "declaration", "safety_datasheet",
  "technical_doc", "compliance_note", "audit_report", "product_datasheet", "other",
] as const;

export const supplierDocumentsRouter = router({
  // List all documents for a supplier (optionally filtered by productId)
  list: protectedProcedure
    .input(z.object({
      supplierId: z.number(),
      productId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const conditions = [eq(supplierDocuments.supplierId, input.supplierId)];
      if (input.productId !== undefined) {
        conditions.push(eq(supplierDocuments.productId, input.productId));
      }

      const docs = await db
        .select()
        .from(supplierDocuments)
        .where(and(...conditions))
        .orderBy(desc(supplierDocuments.createdAt));

      return docs;
    }),

  // Upload a document (base64 encoded)
  upload: protectedProcedure
    .input(z.object({
      supplierId: z.number(),
      productId: z.number().optional(),
      fileName: z.string().max(512),
      mimeType: z.string().max(128),
      fileSizeBytes: z.number().optional(),
      fileBase64: z.string(), // base64 encoded file content
      documentType: z.enum(DOCUMENT_TYPES).default("other"),
      title: z.string().max(512).optional(),
      description: z.string().optional(),
      regulationRef: z.string().max(256).optional(),
      isConfidential: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Decode base64
      const buffer = Buffer.from(input.fileBase64, "base64");

      // Upload to S3
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `supplier-docs/${input.supplierId}/${Date.now()}-${randomSuffix}-${safeFileName}`;

      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Save metadata to DB
      const [result] = await db.insert(supplierDocuments).values({
        supplierId: input.supplierId,
        productId: input.productId ?? null,
        fileName: input.fileName,
        fileKey,
        fileUrl: url,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes ?? buffer.length,
        documentType: input.documentType,
        title: input.title ?? input.fileName,
        description: input.description ?? null,
        regulationRef: input.regulationRef ?? null,
        isConfidential: input.isConfidential,
        uploadedByUserId: ctx.user.id,
        tenantId: 1,
      });

      return { success: true, id: (result as any).insertId };
    }),

  // Delete a document
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(supplierDocuments).where(eq(supplierDocuments.id, input.id));
      return { success: true };
    }),

  // Update document metadata
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().max(512).optional(),
      description: z.string().optional(),
      documentType: z.enum(DOCUMENT_TYPES).optional(),
      regulationRef: z.string().max(256).optional(),
      isConfidential: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, ...updates } = input;
      await db.update(supplierDocuments)
        .set(updates)
        .where(eq(supplierDocuments.id, id));
      return { success: true };
    }),
});
