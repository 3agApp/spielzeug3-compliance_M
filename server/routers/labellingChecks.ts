import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { productLabellingChecks, products } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";

// ─── Predefined labelling requirements ────────────────────────────────────────

export const DEFAULT_LABELLING_CHECKS = [
  // CE Marking & Compliance
  {
    checkKey: "ce_marking_on_product",
    label: "CE marking visible on product or packaging",
    category: "CE Marking",
    market: "EU/CH",
    isMandatory: true,
  },
  {
    checkKey: "ce_marking_legible",
    label: "CE marking is legible and at least 5mm in height",
    category: "CE Marking",
    market: "EU/CH",
    isMandatory: true,
  },
  // Manufacturer / Importer
  {
    checkKey: "manufacturer_name_address",
    label: "Manufacturer's name and address on product or packaging",
    category: "Manufacturer Info",
    market: "EU/CH",
    isMandatory: true,
  },
  {
    checkKey: "eu_importer_name_address",
    label: "EU importer's name and address on product or packaging (if manufacturer outside EU)",
    category: "Manufacturer Info",
    market: "EU",
    isMandatory: true,
  },
  {
    checkKey: "ch_importer_name_address",
    label: "Swiss importer's name and address on product or packaging (if manufacturer outside CH)",
    category: "Manufacturer Info",
    market: "CH",
    isMandatory: true,
  },
  // Product Identification
  {
    checkKey: "product_identification_code",
    label: "Product identification code (article/model number) on product or packaging",
    category: "Product Identification",
    market: "EU/CH",
    isMandatory: true,
  },
  {
    checkKey: "batch_lot_number",
    label: "Batch/lot number or serial number on product or packaging",
    category: "Product Identification",
    market: "EU/CH",
    isMandatory: true,
  },
  // Age Warnings
  {
    checkKey: "age_warning_under_3",
    label: "Age warning 'Not suitable for children under 3 years' with choking hazard symbol (if applicable)",
    category: "Age & Safety Warnings",
    market: "EU/CH",
    isMandatory: false,
  },
  {
    checkKey: "age_grading_label",
    label: "Minimum age recommendation clearly stated on packaging",
    category: "Age & Safety Warnings",
    market: "EU/CH",
    isMandatory: true,
  },
  // Safety Warnings
  {
    checkKey: "safety_warnings_present",
    label: "All required safety warnings present (EN 71-1 Annex V / applicable standard)",
    category: "Age & Safety Warnings",
    market: "EU/CH",
    isMandatory: true,
  },
  {
    checkKey: "warnings_in_local_language",
    label: "Safety warnings in the language(s) of the target country",
    category: "Age & Safety Warnings",
    market: "EU/CH",
    isMandatory: true,
  },
  // Instructions
  {
    checkKey: "instructions_included",
    label: "Instructions for use included (if required by the standard)",
    category: "Instructions",
    market: "EU/CH",
    isMandatory: false,
  },
  {
    checkKey: "instructions_local_language",
    label: "Instructions in the language(s) of the target country",
    category: "Instructions",
    market: "EU/CH",
    isMandatory: false,
  },
  // GPSR (General Product Safety Regulation – from Dec 2024)
  {
    checkKey: "gpsr_digital_product_passport",
    label: "Digital product passport / QR code link to product information (GPSR 2023/988, from Dec 2024)",
    category: "GPSR",
    market: "EU",
    isMandatory: false,
  },
  {
    checkKey: "gpsr_complaint_contact",
    label: "Contact point for complaints/product safety information accessible (GPSR 2023/988)",
    category: "GPSR",
    market: "EU",
    isMandatory: true,
  },
];

// ─── Router ───────────────────────────────────────────────────────────────────

export const labellingChecksRouter = router({
  /** Get all labelling checks for a product (auto-initialise defaults if none exist) */
  getByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const numericTenantId = ctx.user.tenantId ?? 1;
      const tenantId = String(numericTenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify product belongs to tenant
      const product = await db.select().from(products).where(and(eq(products.id, input.productId), eq(products.tenantId, numericTenantId)));
      if (product.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      // Load existing checks
      const existing = await db
        .select()
        .from(productLabellingChecks)
        .where(
          and(
            eq(productLabellingChecks.productId, input.productId),
            eq(productLabellingChecks.tenantId, tenantId)
          )
        );

      // If no checks exist yet, initialise with defaults
      if (existing.length === 0) {
        const now = Date.now();
        const inserts = DEFAULT_LABELLING_CHECKS.map((c) => ({
          productId: input.productId,
          tenantId,
          checkKey: c.checkKey,
          label: c.label,
          category: c.category,
          market: c.market,
          isMandatory: c.isMandatory,
          checked: false,
          notes: null as string | null,
          verifiedAt: null as number | null,
          verifiedBy: null as string | null,
          createdAt: now,
          updatedAt: now,
        }));
        await db.insert(productLabellingChecks).values(inserts);
        return inserts.map((r, i) => ({ ...r, id: i + 1 }));
      }

      return existing;
    }),

  /** Toggle a check and optionally save a note */
  upsert: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        checkKey: z.string(),
        checked: z.boolean(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = String(ctx.user.tenantId ?? 1);
      const now = Date.now();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const existing = await db
        .select()
        .from(productLabellingChecks)
        .where(
          and(
            eq(productLabellingChecks.productId, input.productId),
            eq(productLabellingChecks.tenantId, tenantId),
            eq(productLabellingChecks.checkKey, input.checkKey)
          )
        );

      if (existing.length > 0) {
        await db
          .update(productLabellingChecks)
          .set({
            checked: input.checked,
            notes: input.notes ?? existing[0].notes,
            verifiedAt: input.checked ? now : null,
            verifiedBy: input.checked ? ctx.user.name ?? ctx.user.openId : null,
            updatedAt: now,
          })
          .where(
            and(
              eq(productLabellingChecks.productId, input.productId),
              eq(productLabellingChecks.tenantId, tenantId),
              eq(productLabellingChecks.checkKey, input.checkKey)
            )
          );
      } else {
        // Find default definition
        const def = DEFAULT_LABELLING_CHECKS.find((c) => c.checkKey === input.checkKey);
        await db.insert(productLabellingChecks).values({
          productId: input.productId,
          tenantId,
          checkKey: input.checkKey,
          label: def?.label ?? input.checkKey,
          category: def?.category ?? "general",
          market: def?.market ?? "EU/CH",
          isMandatory: def?.isMandatory ?? false,
          checked: input.checked,
          notes: input.notes ?? null,
          verifiedAt: input.checked ? now : null,
          verifiedBy: input.checked ? ctx.user.name ?? ctx.user.openId : null,
          createdAt: now,
          updatedAt: now,
        });
      }
      return { success: true };
    }),

  /** Update only the note for a check */
  updateNote: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        checkKey: z.string(),
        notes: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = String(ctx.user.tenantId ?? 1);
      const now = Date.now();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .update(productLabellingChecks)
        .set({ notes: input.notes, updatedAt: now })
        .where(
          and(
            eq(productLabellingChecks.productId, input.productId),
            eq(productLabellingChecks.tenantId, tenantId),
            eq(productLabellingChecks.checkKey, input.checkKey)
          )
        );
      return { success: true };
    }),
});
