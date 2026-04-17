/**
 * server/domains/products/copyProductDataService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Service for copying compliance data from one source product to one or more
 * target products.
 *
 * Copyable data categories:
 *   - safety      → productSafetyEntries (upsert)
 *   - documents   → documents (new rows referencing same S3 URLs)
 *   - components  → productComponents + componentDocuments
 *   - batchInfo   → products.batchInfo JSON field
 *   - labelling   → productLabellingChecks (upsert by checkKey)
 *   - requirements→ missingRequirements (upsert by requirementType)
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import {
  products,
  documents,
  productSafetyEntries,
  productComponents,
  componentDocuments,
  productLabellingChecks,
  missingRequirements,
  type InsertDocument,
  type InsertProductSafetyEntry,
  type InsertProductComponent,
  type InsertComponentDocument,
  type InsertProductLabellingCheck,
  type InsertMissingRequirement,
} from "../../../drizzle/schema";
import { Errors, requireRole } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CopyCategory =
  | "safety"
  | "documents"
  | "components"
  | "batchInfo"
  | "labelling"
  | "requirements";

export interface CopyProductDataInput {
  sourceProductId: number;
  targetProductIds: number[];
  categories: CopyCategory[];
  /** When true, existing data on target is overwritten; when false, only missing data is added */
  overwrite: boolean;
}

export interface CopyProductDataResult {
  targetProductId: number;
  targetProductName: string;
  copied: Partial<Record<CopyCategory, number>>; // count of rows copied per category
  skipped: Partial<Record<CopyCategory, number>>; // count skipped (already exists + overwrite=false)
  errors: string[];
}

export interface CopyPreview {
  sourceProduct: { id: number; name: string; articleNumber: string | null };
  availableCategories: Array<{
    key: CopyCategory;
    label: string;
    count: number;
    description: string;
  }>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const copyProductDataService = {
  // ── Preview: what data is available on the source product ───────────────
  async preview(user: UserContext, sourceProductId: number): Promise<CopyPreview> {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin", "internal_employee"]);
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, sourceProductId), eq(products.tenantId, user.tenantId ?? 1)));
    if (!product) throw Errors.notFound("Source product not found");

    // Count available data per category
    const [safetyRows, docRows, compRows, labelRows, reqRows] = await Promise.all([
      db.select().from(productSafetyEntries).where(eq(productSafetyEntries.productId, sourceProductId)),
      db.select().from(documents).where(and(eq(documents.productId, sourceProductId), eq(documents.isArchived, false))),
      db.select().from(productComponents).where(and(eq(productComponents.productId, sourceProductId), eq(productComponents.active, true))),
      db.select().from(productLabellingChecks).where(eq(productLabellingChecks.productId, sourceProductId)),
      db.select().from(missingRequirements).where(eq(missingRequirements.productId, sourceProductId)),
    ]);

    const hasBatch = !!(product.batchInfo);

    return {
      sourceProduct: {
        id: product.id,
        name: product.productName,
        articleNumber: product.internalArticleNumber ?? null,
      },
      availableCategories: [
        {
          key: "safety",
          label: "Sicherheitsdaten",
          count: safetyRows.length,
          description: "Sicherheitstext, Warnhinweise, Altersangabe, Materialinformationen",
        },
        {
          key: "documents",
          label: "Dokumente",
          count: docRows.length,
          description: `${docRows.length} Dokument(e) – Prüfberichte, Zertifikate, Konformitätserklärungen`,
        },
        {
          key: "components",
          label: "Komponenten",
          count: compRows.length,
          description: `${compRows.length} Komponente(n) inkl. Komponentendokumenten`,
        },
        {
          key: "batchInfo",
          label: "Chargeninformationen",
          count: hasBatch ? 1 : 0,
          description: "Chargennummer, Produktionsdatum, Ablaufdatum, Importeur",
        },
        {
          key: "labelling",
          label: "Kennzeichnungs-Checkliste",
          count: labelRows.length,
          description: `${labelRows.length} Kennzeichnungs-Prüfpunkte (EU/CH)`,
        },
        {
          key: "requirements",
          label: "Fehlende Anforderungen",
          count: reqRows.length,
          description: `${reqRows.length} Anforderungseinträge (Status, Notizen)`,
        },
      ],
    };
  },

  // ── Execute copy ─────────────────────────────────────────────────────────
  async execute(
    user: UserContext,
    input: CopyProductDataInput
  ): Promise<CopyProductDataResult[]> {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin"]);
    const db = await getDb();
    if (!db) throw Errors.precondition("Database unavailable");

    const tenantId = user.tenantId ?? 1;

    // Validate source product
    const [source] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, input.sourceProductId), eq(products.tenantId, tenantId)));
    if (!source) throw Errors.notFound("Source product not found");

    // Validate all target products belong to same tenant
    const targetProducts = await db
      .select()
      .from(products)
      .where(and(inArray(products.id, input.targetProductIds), eq(products.tenantId, tenantId)));

    if (targetProducts.length !== input.targetProductIds.length) {
      throw Errors.precondition("One or more target products not found or belong to a different tenant");
    }

    // Load source data once
    const [sourceSafety, sourceDocs, sourceComps, sourceLabellings, sourceReqs] = await Promise.all([
      input.categories.includes("safety")
        ? db.select().from(productSafetyEntries).where(eq(productSafetyEntries.productId, input.sourceProductId))
        : Promise.resolve([]),
      input.categories.includes("documents")
        ? db.select().from(documents).where(and(eq(documents.productId, input.sourceProductId), eq(documents.isArchived, false)))
        : Promise.resolve([]),
      input.categories.includes("components")
        ? db.select().from(productComponents).where(and(eq(productComponents.productId, input.sourceProductId), eq(productComponents.active, true)))
        : Promise.resolve([]),
      input.categories.includes("labelling")
        ? db.select().from(productLabellingChecks).where(eq(productLabellingChecks.productId, input.sourceProductId))
        : Promise.resolve([]),
      input.categories.includes("requirements")
        ? db.select().from(missingRequirements).where(eq(missingRequirements.productId, input.sourceProductId))
        : Promise.resolve([]),
    ]);

    // Load component documents for all source components
    const sourceCompIds = sourceComps.map((c) => c.id);
    const sourceCompDocs = sourceCompIds.length > 0
      ? await db.select().from(componentDocuments).where(inArray(componentDocuments.componentId, sourceCompIds))
      : [];

    const results: CopyProductDataResult[] = [];

    for (const target of targetProducts) {
      const result: CopyProductDataResult = {
        targetProductId: target.id,
        targetProductName: target.productName,
        copied: {},
        skipped: {},
        errors: [],
      };

      try {
        // ── Safety data ────────────────────────────────────────────────────
        if (input.categories.includes("safety") && sourceSafety.length > 0) {
          const src = sourceSafety[0];
          const [existing] = await db
            .select({ id: productSafetyEntries.id })
            .from(productSafetyEntries)
            .where(eq(productSafetyEntries.productId, target.id));

          if (existing && !input.overwrite) {
            result.skipped.safety = 1;
          } else if (existing) {
            await db.update(productSafetyEntries).set({
              safetyText: src.safetyText,
              warningText: src.warningText,
              ageGrading: src.ageGrading,
              materialInformation: src.materialInformation,
              usageRestrictions: src.usageRestrictions,
              safetyNotes: src.safetyNotes,
              safetyImages: src.safetyImages,
            }).where(eq(productSafetyEntries.productId, target.id));
            result.copied.safety = 1;
          } else {
            await db.insert(productSafetyEntries).values({
              productId: target.id,
              safetyText: src.safetyText,
              warningText: src.warningText,
              ageGrading: src.ageGrading,
              materialInformation: src.materialInformation,
              usageRestrictions: src.usageRestrictions,
              safetyNotes: src.safetyNotes,
              safetyImages: src.safetyImages,
            } as InsertProductSafetyEntry);
            result.copied.safety = 1;
          }
        }

        // ── Documents ──────────────────────────────────────────────────────
        if (input.categories.includes("documents") && sourceDocs.length > 0) {
          // Check existing document types on target
          const existingDocs = await db
            .select({ documentType: documents.documentType, fileName: documents.fileName })
            .from(documents)
            .where(and(eq(documents.productId, target.id), eq(documents.isArchived, false)));

          let copied = 0;
          let skipped = 0;

          for (const doc of sourceDocs) {
            const alreadyExists = existingDocs.some(
              (e) => e.documentType === doc.documentType && e.fileName === doc.fileName
            );
            if (alreadyExists && !input.overwrite) {
              skipped++;
              continue;
            }
            await db.insert(documents).values({
              productId: target.id,
              documentType: doc.documentType,
              fileName: doc.fileName,
              fileUrl: doc.fileUrl,
              fileKey: doc.fileKey,
              mimeType: doc.mimeType,
              fileSizeBytes: doc.fileSizeBytes,
              version: 1,
              isArchived: false,
              publicDownload: doc.publicDownload,
              includeInAiAnalysis: doc.includeInAiAnalysis,
              expiryDate: doc.expiryDate,
              reviewStatus: "pending",
              uploadedByUserId: null,
              uploadedByRole: "compliance_manager",
              uploadedAt: new Date(),
            } as InsertDocument);
            copied++;
          }
          result.copied.documents = copied;
          result.skipped.documents = skipped;
        }

        // ── Components ─────────────────────────────────────────────────────
        if (input.categories.includes("components") && sourceComps.length > 0) {
          // Check existing component names on target
          const existingComps = await db
            .select({ name: productComponents.name })
            .from(productComponents)
            .where(and(eq(productComponents.productId, target.id), eq(productComponents.active, true)));

          let copied = 0;
          let skipped = 0;

          for (const comp of sourceComps) {
            const alreadyExists = existingComps.some((e) => e.name === comp.name);
            if (alreadyExists && !input.overwrite) {
              skipped++;
              continue;
            }

            const [newComp] = await db.insert(productComponents).values({
              productId: target.id,
              name: comp.name,
              description: comp.description,
              materialType: comp.materialType,
              supplierName: comp.supplierName,
              partNumber: comp.partNumber,
              sortOrder: comp.sortOrder,
              active: true,
            } as InsertProductComponent).$returningId();

            const newCompId = (newComp as any).id as number;

            // Copy component documents
            const compDocs = sourceCompDocs.filter((d) => d.componentId === comp.id);
            for (const cd of compDocs) {
              await db.insert(componentDocuments).values({
                componentId: newCompId,
                productId: target.id,
                documentType: cd.documentType,
                standard: cd.standard,
                fileName: cd.fileName,
                fileUrl: cd.fileUrl,
                fileKey: cd.fileKey,
                mimeType: cd.mimeType,
                fileSizeBytes: cd.fileSizeBytes,
                version: 1,
                expiryDate: cd.expiryDate,
                reviewStatus: "pending",
                uploadedAt: new Date(),
              } as InsertComponentDocument);
            }
            copied++;
          }
          result.copied.components = copied;
          result.skipped.components = skipped;
        }

        // ── Batch info ─────────────────────────────────────────────────────
        if (input.categories.includes("batchInfo") && source.batchInfo) {
          const [targetProduct] = await db
            .select({ batchInfo: products.batchInfo })
            .from(products)
            .where(eq(products.id, target.id));

          if (targetProduct.batchInfo && !input.overwrite) {
            result.skipped.batchInfo = 1;
          } else {
            await db.update(products)
              .set({ batchInfo: source.batchInfo })
              .where(eq(products.id, target.id));
            result.copied.batchInfo = 1;
          }
        }

        // ── Labelling checks ───────────────────────────────────────────────
        if (input.categories.includes("labelling") && sourceLabellings.length > 0) {
          const existingLabels = await db
            .select({ checkKey: productLabellingChecks.checkKey })
            .from(productLabellingChecks)
            .where(eq(productLabellingChecks.productId, target.id));

          const existingKeys = new Set(existingLabels.map((l) => l.checkKey));
          let copied = 0;
          let skipped = 0;
          const now = Date.now();

          for (const lbl of sourceLabellings) {
            if (existingKeys.has(lbl.checkKey) && !input.overwrite) {
              skipped++;
              continue;
            }
            if (existingKeys.has(lbl.checkKey) && input.overwrite) {
              await db.update(productLabellingChecks).set({
                checked: lbl.checked,
                notes: lbl.notes,
                label: lbl.label,
                category: lbl.category,
                market: lbl.market,
                isMandatory: lbl.isMandatory,
                updatedAt: now,
              }).where(
                and(
                  eq(productLabellingChecks.productId, target.id),
                  eq(productLabellingChecks.checkKey, lbl.checkKey)
                )
              );
            } else {
              await db.insert(productLabellingChecks).values({
                productId: target.id,
                tenantId: String(tenantId),
                checkKey: lbl.checkKey,
                label: lbl.label,
                category: lbl.category,
                market: lbl.market,
                isMandatory: lbl.isMandatory,
                checked: lbl.checked,
                notes: lbl.notes,
                createdAt: now,
                updatedAt: now,
              } as InsertProductLabellingCheck);
            }
            copied++;
          }
          result.copied.labelling = copied;
          result.skipped.labelling = skipped;
        }

        // ── Missing requirements ───────────────────────────────────────────
        if (input.categories.includes("requirements") && sourceReqs.length > 0) {
          const existingReqs = await db
            .select({ requirementType: missingRequirements.requirementType })
            .from(missingRequirements)
            .where(eq(missingRequirements.productId, target.id));

          const existingTypes = new Set(existingReqs.map((r) => r.requirementType));
          let copied = 0;
          let skipped = 0;

          for (const req of sourceReqs) {
            if (existingTypes.has(req.requirementType) && !input.overwrite) {
              skipped++;
              continue;
            }
            if (existingTypes.has(req.requirementType) && input.overwrite) {
              await db.update(missingRequirements).set({
                required: req.required,
                isMissing: req.isMissing,
                status: req.status,
                note: req.note,
                sourceSystem: "copy",
              }).where(
                and(
                  eq(missingRequirements.productId, target.id),
                  eq(missingRequirements.requirementType, req.requirementType)
                )
              );
            } else {
              await db.insert(missingRequirements).values({
                productId: target.id,
                requirementType: req.requirementType,
                required: req.required,
                isMissing: req.isMissing,
                status: req.status,
                note: req.note,
                sourceSystem: "copy",
              } as InsertMissingRequirement);
            }
            copied++;
          }
          result.copied.requirements = copied;
          result.skipped.requirements = skipped;
        }
      } catch (err: any) {
        result.errors.push(err?.message ?? String(err));
      }

      results.push(result);
    }

    return results;
  },
};
