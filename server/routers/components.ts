import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createAuditLog,
  createComponent,
  createComponentDocument,
  deleteComponent,
  deleteComponentDocument,
  getAllComponentDocumentsByProduct,
  getComponentById,
  getComponentsByProduct,
  getDocumentsByComponent,
  getProductById,
  updateComponent,
  updateComponentDocumentReview,
} from "../db";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

// ─── helpers ─────────────────────────────────────────────────────────────────
function canAccessProduct(role: string, product: any, userId: number, supplierId: number | null) {
  if (role === "supplier") {
    return product.supplierId === supplierId;
  }
  return true; // internal_employee, compliance_manager, administrator
}

function canEdit(role: string) {
  return ["supplier", "internal_employee", "compliance_manager", "administrator"].includes(role);
}

function canReview(role: string) {
  return ["compliance_manager", "administrator"].includes(role);
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const componentsRouter = router({
  // ── List components for a product ──────────────────────────────────────────
  listByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (!canAccessProduct(role, product, ctx.user.id, ctx.user.supplierId ?? null)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const components = await getComponentsByProduct(input.productId);
      // Attach document counts per component
      const withDocs = await Promise.all(
        components.map(async (c) => {
          const docs = await getDocumentsByComponent(c.id);
          return {
            ...c,
            documentCount: docs.length,
            approvedDocumentCount: docs.filter((d) => d.reviewStatus === "approved").length,
            pendingDocumentCount: docs.filter((d) => d.reviewStatus === "pending").length,
          };
        })
      );
      return withDocs;
    }),

  // ── Get single component with its documents ─────────────────────────────────
  getWithDocuments: protectedProcedure
    .input(z.object({ componentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const component = await getComponentById(input.componentId);
      if (!component) throw new TRPCError({ code: "NOT_FOUND" });
      const product = await getProductById(component.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (!canAccessProduct(role, product, ctx.user.id, ctx.user.supplierId ?? null)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const documents = await getDocumentsByComponent(input.componentId);
      return { ...component, documents };
    }),

  // ── Create component ────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        materialType: z
          .enum(["wood", "metal", "plastic", "textile", "electronic", "paint_coating", "rubber", "glass", "other"])
          .optional(),
        supplierName: z.string().optional(),
        partNumber: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (!canEdit(role)) throw new TRPCError({ code: "FORBIDDEN" });
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const result = await createComponent({
        productId: input.productId,
        name: input.name,
        description: input.description ?? null,
        materialType: input.materialType ?? null,
        supplierName: input.supplierName ?? null,
        partNumber: input.partNumber ?? null,
        sortOrder: input.sortOrder ?? 0,
        createdByUserId: ctx.user.id,
      });

      await createAuditLog({
        entityType: "product_component",
        entityId: input.productId,
        action: "component_created",
        performedByUserId: ctx.user.id,
        payloadSnapshot: { componentName: input.name } as any,
      });

      return { success: true, insertId: (result as any).insertId };
    }),

  // ── Update component ────────────────────────────────────────────────────────
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        materialType: z
          .enum(["wood", "metal", "plastic", "textile", "electronic", "paint_coating", "rubber", "glass", "other"])
          .optional(),
        supplierName: z.string().optional(),
        partNumber: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const component = await getComponentById(input.id);
      if (!component) throw new TRPCError({ code: "NOT_FOUND" });
      const product = await getProductById(component.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (!canEdit(role)) throw new TRPCError({ code: "FORBIDDEN" });
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { id, ...updateData } = input;
      await updateComponent(id, updateData);

      await createAuditLog({
        entityType: "product_component",
        entityId: component.productId,
        action: "component_updated",
        performedByUserId: ctx.user.id,
        payloadSnapshot: { componentId: id, changes: updateData } as any,
      });

      return { success: true };
    }),

  // ── Delete (soft) component ─────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const component = await getComponentById(input.id);
      if (!component) throw new TRPCError({ code: "NOT_FOUND" });
      const product = await getProductById(component.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (!canEdit(role)) throw new TRPCError({ code: "FORBIDDEN" });
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await deleteComponent(input.id);

      await createAuditLog({
        entityType: "product_component",
        entityId: component.productId,
        action: "component_deleted",
        performedByUserId: ctx.user.id,
        payloadSnapshot: { componentId: input.id, componentName: component.name } as any,
      });

      return { success: true };
    }),

  // ── Upload document to a component ─────────────────────────────────────────
  uploadDocument: protectedProcedure
    .input(
      z.object({
        componentId: z.number(),
        documentType: z.enum([
          "test_report",
          "declaration_of_conformity",
          "material_certificate",
          "reach_declaration",
          "rohs_declaration",
          "certificate",
          "regulatory_document",
          "other",
        ]),
        standard: z.string().optional(), // e.g. "EN 71-3"
        fileName: z.string(),
        fileBase64: z.string(), // base64-encoded file content
        mimeType: z.string(),
        fileSizeBytes: z.number().optional(),
        expiryDate: z.string().optional(), // ISO date string
      })
    )
    .mutation(async ({ ctx, input }) => {
      const component = await getComponentById(input.componentId);
      if (!component) throw new TRPCError({ code: "NOT_FOUND" });
      const product = await getProductById(component.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (!canEdit(role)) throw new TRPCError({ code: "FORBIDDEN" });
      if (role === "supplier" && product.supplierId !== ctx.user.supplierId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Upload to S3
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      const suffix = Date.now().toString(36);
      const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `component-docs/${component.productId}/${input.componentId}/${suffix}-${safeFileName}`;
      const { url: fileUrl } = await storagePut(fileKey, fileBuffer, input.mimeType);

      // Get current version count
      const existingDocs = await getDocumentsByComponent(input.componentId);
      const sameTypeDocs = existingDocs.filter((d) => d.documentType === input.documentType);
      const version = sameTypeDocs.length + 1;

      await createComponentDocument({
        componentId: input.componentId,
        productId: component.productId,
        documentType: input.documentType,
        standard: input.standard ?? null,
        fileName: input.fileName,
        fileUrl,
        fileKey,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes ?? null,
        version,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        uploadedByUserId: ctx.user.id,
      });

      await createAuditLog({
        entityType: "component_document",
        entityId: component.productId,
        action: "component_document_uploaded",
        performedByUserId: ctx.user.id,
        payloadSnapshot: {
          componentId: input.componentId,
          componentName: component.name,
          documentType: input.documentType,
          standard: input.standard,
          fileName: input.fileName,
        } as any,
      });

      return { success: true, fileUrl };
    }),

  // ── Delete a component document ─────────────────────────────────────────────
  deleteDocument: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (!canEdit(role)) throw new TRPCError({ code: "FORBIDDEN" });

      await deleteComponentDocument(input.documentId);

      await createAuditLog({
        entityType: "component_document",
        action: "component_document_deleted",
        performedByUserId: ctx.user.id,
        payloadSnapshot: { documentId: input.documentId } as any,
      });

      return { success: true };
    }),

  // ── Review a component document (Compliance Manager / Admin) ────────────────
  reviewDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        reviewStatus: z.enum(["approved", "rejected"]),
        reviewNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (!canReview(role)) throw new TRPCError({ code: "FORBIDDEN" });

      await updateComponentDocumentReview(
        input.documentId,
        input.reviewStatus,
        input.reviewNote ?? null,
        ctx.user.id
      );

      await createAuditLog({
        entityType: "component_document",
        action: `component_document_${input.reviewStatus}`,
        performedByUserId: ctx.user.id,
        payloadSnapshot: { documentId: input.documentId, reviewNote: input.reviewNote } as any,
      });

      return { success: true };
    }),

  // ── Get all component documents for a product (for KI-Analyse) ─────────────
  getAllDocumentsByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const product = await getProductById(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const role = ctx.user.complianceRole ?? "internal_employee";
      if (!canAccessProduct(role, product, ctx.user.id, ctx.user.supplierId ?? null)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getAllComponentDocumentsByProduct(input.productId);
    }),
});
