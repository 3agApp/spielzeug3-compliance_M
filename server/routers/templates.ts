import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  missingRequirements,
  productCategories,
  productTemplates,
  products,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

// ─── Router ───────────────────────────────────────────────────────────────────
export const templatesRouter = router({
  // ── Categories ──────────────────────────────────────────────────────────────

  listCategories: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(productCategories)
      .where(eq(productCategories.active, true))
      .orderBy(asc(productCategories.sortOrder));
  }),

  createCategory: protectedProcedure
    .input(
      z.object({
        key: z.string().min(2).max(64),
        labelDe: z.string().min(1).max(255),
        labelEn: z.string().min(1).max(255),
        description: z.string().optional(),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const role = (ctx.user as any).complianceRole;
      if (role !== "administrator") throw new TRPCError({ code: "FORBIDDEN" });

      await db.insert(productCategories).values({
        key: input.key,
        labelDe: input.labelDe,
        labelEn: input.labelEn,
        description: input.description ?? null,
        sortOrder: input.sortOrder,
        active: true,
      });
      return { success: true };
    }),

  updateCategory: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        labelDe: z.string().min(1).max(255).optional(),
        labelEn: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const role = (ctx.user as any).complianceRole;
      if (role !== "administrator") throw new TRPCError({ code: "FORBIDDEN" });

      const { id, ...rest } = input;
      await db
        .update(productCategories)
        .set(rest as any)
        .where(eq(productCategories.id, id));
      return { success: true };
    }),

  // ── Templates ───────────────────────────────────────────────────────────────

  listTemplates: protectedProcedure
    .input(z.object({ categoryId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select({
          id: productTemplates.id,
          categoryId: productTemplates.categoryId,
          name: productTemplates.name,
          descriptionDe: productTemplates.descriptionDe,
          descriptionEn: productTemplates.descriptionEn,
          requiredDocuments: productTemplates.requiredDocuments,
          optionalDocuments: productTemplates.optionalDocuments,
          requiredDataFields: productTemplates.requiredDataFields,
          active: productTemplates.active,
          createdAt: productTemplates.createdAt,
          categoryKey: productCategories.key,
          categoryLabelDe: productCategories.labelDe,
          categoryLabelEn: productCategories.labelEn,
        })
        .from(productTemplates)
        .innerJoin(productCategories, eq(productTemplates.categoryId, productCategories.id))
        .where(
          and(
            eq(productTemplates.active, true),
            input?.categoryId ? eq(productTemplates.categoryId, input.categoryId) : undefined
          )
        )
        .orderBy(asc(productCategories.sortOrder), asc(productTemplates.name));

      return rows;
    }),

  getTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db
        .select()
        .from(productTemplates)
        .where(eq(productTemplates.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  createTemplate: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
        name: z.string().min(1).max(255),
        descriptionDe: z.string().optional(),
        descriptionEn: z.string().optional(),
        requiredDocuments: z.array(z.string()),
        optionalDocuments: z.array(z.string()).optional(),
        requiredDataFields: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const role = (ctx.user as any).complianceRole;
      if (!["administrator", "compliance_manager"].includes(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.insert(productTemplates).values({
        categoryId: input.categoryId,
        name: input.name,
        descriptionDe: input.descriptionDe ?? null,
        descriptionEn: input.descriptionEn ?? null,
        requiredDocuments: input.requiredDocuments,
        optionalDocuments: input.optionalDocuments ?? [],
        requiredDataFields: input.requiredDataFields ?? [],
        active: true,
        createdByUserId: ctx.user!.id,
      });
      return { success: true };
    }),

  updateTemplate: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        descriptionDe: z.string().optional(),
        descriptionEn: z.string().optional(),
        requiredDocuments: z.array(z.string()).optional(),
        optionalDocuments: z.array(z.string()).optional(),
        requiredDataFields: z.array(z.string()).optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const role = (ctx.user as any).complianceRole;
      if (!["administrator", "compliance_manager"].includes(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { id, ...rest } = input;
      await db
        .update(productTemplates)
        .set(rest as any)
        .where(eq(productTemplates.id, id));
      return { success: true };
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const role = (ctx.user as any).complianceRole;
      if (role !== "administrator") throw new TRPCError({ code: "FORBIDDEN" });

      // Soft-delete
      await db
        .update(productTemplates)
        .set({ active: false })
        .where(eq(productTemplates.id, input.id));
      return { success: true };
    }),

  /**
   * Apply a template to a product: creates/updates missingRequirements rows.
   */
  applyToProduct: protectedProcedure
    .input(z.object({ productId: z.number(), templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const role = (ctx.user as any).complianceRole;
      if (!["administrator", "compliance_manager", "internal_employee"].includes(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Fetch template
      const [template] = await db
        .select()
        .from(productTemplates)
        .where(eq(productTemplates.id, input.templateId))
        .limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Vorlage nicht gefunden" });

      // Update product with templateId and categoryId
      await db
        .update(products)
        .set({ templateId: input.templateId, categoryId: template.categoryId } as any)
        .where(eq(products.id, input.productId));

      // Build requirement list
      const required = (template.requiredDocuments as string[]) ?? [];
      const optional = (template.optionalDocuments as string[]) ?? [];
      const allReqs = [
        ...required.map((r) => ({ key: r, required: true })),
        ...optional.map((r) => ({ key: r, required: false })),
      ];

      // Upsert missing_requirements rows
      for (const req of allReqs) {
        // Check if already exists
        const existing = await db
          .select()
          .from(missingRequirements)
          .where(
            and(
              eq(missingRequirements.productId, input.productId),
              eq(missingRequirements.requirementType, req.key as any)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(missingRequirements).values({
            productId: input.productId,
            requirementType: req.key as any,
            required: req.required,
            isMissing: true,
            status: "missing",
            sourceSystem: "template",
          });
        }
      }

      return { success: true, appliedRequirements: allReqs.length };
    }),
});
