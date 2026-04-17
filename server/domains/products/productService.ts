/**
 * server/domains/products/productService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for the Products domain.
 *
 * Design decisions:
 * - All methods receive a plain `user` context object, NOT the full tRPC ctx,
 *   so they can be called from tests without spinning up an HTTP server.
 * - Database access goes through the repository layer (server/db.ts functions).
 *   Direct Drizzle imports are NOT allowed here.
 * - Throws AppError subclasses; the router converts them via toTRPCError().
 */

import {
  computeCompletenessScore,
  createApprovalHistoryEntry,
  createAuditLog,
  createMissingRequirement,
  createNotification,
  createProduct,
  getAllProducts,
  getProductById,
  getProductsBySupplier,
  getSystemSetting,
  updateMissingRequirement,
  updateProduct,
} from "../../db";
import { ensureProductPublicUuid, getTenantById } from "../../tenantDb";
import {
  Errors,
  assertOwnsProduct,
  assertSupplierOrInternal,
  requireRole,
  ADMIN_ROLES,
} from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";
import type { ProductStatus } from "../../shared/validation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListProductsInput {
  supplierId?: number;
  status?: string;
  brand?: string;
  search?: string;
}

export interface CreateProductInput {
  productName: string;
  supplierId: number;
  internalArticleNumber?: string;
  supplierArticleNumber?: string;
  orderNumber?: string;
  ean?: string;
  brand?: string;
  targetMarket?: string;
  ageGroup?: string;
  productCategoryId?: number;
  templateId?: number;
  tenantId?: number;
  /** Optional version label, e.g. "v1", "v2", "2024", "EU" */
  versionNumber?: string;
  /** FK to the root/parent product when this is a variant */
  parentProductId?: number;
}

export interface UpdateProductInput {
  productId: number;
  productName?: string;
  internalArticleNumber?: string;
  supplierArticleNumber?: string;
  orderNumber?: string;
  ean?: string;
  brand?: string;
  targetMarket?: string;
  ageGroup?: string;
  sealStatusOverride?: string | null;
  supplierId?: number;
  categoryId?: number | null;
  templateId?: number | null;
  kontorId?: string;
  /** Update the version label */
  versionNumber?: string | null;
  /** Re-link to a different parent product */
  parentProductId?: number | null;
}

export interface WorkflowActionInput {
  productId: number;
  note?: string;
}

export interface SupplierConfirmInput {
  productId: number;
  confirmedByName: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const productService = {
  /**
   * List products scoped to the caller's role.
   * Suppliers only see their own products.
   */
  async list(user: UserContext, input: ListProductsInput = {}) {
    const role = user.complianceRole ?? "internal_employee";
    if (role === "supplier") {
      if (!user.supplierId) return [];
      return getProductsBySupplier(user.supplierId);
    }
    return getAllProducts(input);
  },

  /**
   * Fetch a single product with tenant-isolation enforcement.
   */
  async getById(user: UserContext, id: number) {
    const product = await getProductById(id);
    if (!product) throw Errors.notFound("Product", id);
    assertSupplierOrInternal(user, product.supplierId);
    return product;
  },

  /**
   * Create a new product. Only internal roles may create products.
   */
  async create(user: UserContext, input: CreateProductInput) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager", "internal_employee"]);
    const productId = await createProduct({
      ...input,
      status: "open",
      tenantId: input.tenantId ?? user.tenantId ?? 1,
    });
    await createAuditLog({
      entityType: "product",
      entityId: typeof productId === "number" ? productId : 0,
      action: "created",
      performedByUserId: (user as any).id,
    });
    return productId;
  },

  /**
   * Update product metadata. Suppliers can update their own products (limited fields).
   */
  async update(user: UserContext & { id: number }, input: UpdateProductInput) {
    const product = await getProductById(input.productId);
    if (!product) throw Errors.notFound("Product", input.productId);
    assertSupplierOrInternal(user, product.supplierId);

    const { productId, ...fields } = input;
    await updateProduct(productId, fields as any);
    await createAuditLog({
      entityType: "product",
      entityId: productId,
      action: "updated",
      performedByUserId: user.id,
    });
  },

  /**
   * Supplier confirms completeness of all documents.
   * Requires all mandatory requirements to be present (not missing).
   */
  async supplierConfirm(user: UserContext & { id: number }, input: SupplierConfirmInput) {
    const product = await getProductById(input.productId);
    if (!product) throw Errors.notFound("Product", input.productId);
    assertOwnsProduct(user, product.supplierId);

    await updateProduct(input.productId, {
      supplierConfirmedAt: new Date() as any,
      supplierConfirmedBy: input.confirmedByName as any,
    });
    await createAuditLog({
      entityType: "product",
      entityId: input.productId,
      action: "supplier_confirmed",
      performedByUserId: user.id,
      payloadSnapshot: { confirmedByName: input.confirmedByName } as any,
    });
    return { success: true };
  },

  // ─── Workflow Actions ──────────────────────────────────────────────────────

  /**
   * Supplier submits a product for review.
   * Pre-condition: supplier must have confirmed completeness.
   */
  async submit(user: UserContext & { id: number }, input: WorkflowActionInput) {
    const product = await getProductById(input.productId);
    if (!product) throw Errors.notFound("Product", input.productId);
    assertSupplierOrInternal(user, product.supplierId);

    const role = user.complianceRole ?? "internal_employee";
    if (role === "supplier" && !(product as any).supplierConfirmedAt) {
      throw Errors.precondition(
        "Bitte bestätigen Sie zuerst die Vollständigkeit der Unterlagen im Siegel-Tab, bevor Sie das Produkt einreichen."
      );
    }

    const fromStatus = product.status;
    await updateProduct(input.productId, { status: "submitted", submittedAt: new Date() });
    await createApprovalHistoryEntry({
      productId: input.productId,
      action: "submitted",
      fromStatus,
      toStatus: "submitted",
      performedByUserId: user.id,
      note: input.note,
    });
    await createAuditLog({
      entityType: "product",
      entityId: input.productId,
      action: "submitted",
      performedByUserId: user.id,
    });
    return { success: true };
  },

  /**
   * Compliance manager approves a product.
   * Optionally auto-activates the seal if SEAL_AUTO_ACTIVATE is enabled.
   */
  async approve(user: UserContext & { id: number; tenantId?: number | null }, input: WorkflowActionInput) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator"]);
    const product = await getProductById(input.productId);
    if (!product) throw Errors.notFound("Product", input.productId);

    const score = await computeCompletenessScore(input.productId);
    await updateProduct(input.productId, {
      status: "approved",
      approvedAt: new Date(),
      completenessScore: String(score) as any,
    });
    await createApprovalHistoryEntry({
      productId: input.productId,
      action: "approved",
      fromStatus: product.status,
      toStatus: "approved",
      performedByUserId: user.id,
      note: input.note,
    });
    await createAuditLog({
      entityType: "product",
      entityId: input.productId,
      action: "approved",
      performedByUserId: user.id,
    });

    // Notify assigned supplier user
    if ((product as any).assignedSupplierUserId) {
      await createNotification({
        userId: (product as any).assignedSupplierUserId,
        type: "approved",
        title: `Produkt genehmigt: ${product.productName}`,
        message: input.note ?? "Ihr Produkt wurde genehmigt.",
        relatedProductId: input.productId,
      });
    }

    // Best-effort seal auto-activation
    let sealActivated = false;
    try {
      const autoActivateSetting = await getSystemSetting("SEAL_AUTO_ACTIVATE");
      const settingValue = autoActivateSetting?.settingValue ?? null;
      const shouldActivate =
        settingValue === null || settingValue === "true" || settingValue === "1";
      if (shouldActivate) {
        const tenantId = user.tenantId ?? 1;
        const tenant = await getTenantById(tenantId);
        if (tenant) {
          const modules = (tenant.modulesEnabled as string[]) ?? [];
          const hasSeal =
            modules.includes("seal") || user.complianceRole === "super_admin";
          if (hasSeal) {
            await ensureProductPublicUuid(input.productId, tenant.slug);
            sealActivated = true;
          }
        }
      }
    } catch {
      // Seal activation is best-effort – do not fail the approval
    }
    return { success: true, sealActivated };
  },

  /**
   * Compliance manager rejects a product with a mandatory note.
   */
  async reject(user: UserContext & { id: number }, input: WorkflowActionInput & { note: string }) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator"]);
    const product = await getProductById(input.productId);
    if (!product) throw Errors.notFound("Product", input.productId);

    await updateProduct(input.productId, { status: "rejected" });
    await createApprovalHistoryEntry({
      productId: input.productId,
      action: "rejected",
      fromStatus: product.status,
      toStatus: "rejected",
      performedByUserId: user.id,
      note: input.note,
    });
    await createAuditLog({
      entityType: "product",
      entityId: input.productId,
      action: "rejected",
      performedByUserId: user.id,
    });

    if ((product as any).assignedSupplierUserId) {
      await createNotification({
        userId: (product as any).assignedSupplierUserId,
        type: "rejected",
        title: `Produkt abgelehnt: ${product.productName}`,
        message: input.note,
        relatedProductId: input.productId,
      });
    }
    return { success: true };
  },

  // ─── Versioning ───────────────────────────────────────────────────────────

  /**
   * Return all versions of a product family (same parentProductId or self as root).
   * The root product is the one where parentProductId IS NULL and id matches.
   */
  async getVersions(user: UserContext, productId: number) {
    const product = await getProductById(productId);
    if (!product) throw Errors.notFound("Product", productId);
    assertSupplierOrInternal(user, product.supplierId);

    // Determine the root id: if this product has a parentProductId, use that; otherwise use self
    const rootId = (product as any).parentProductId ?? product.id;

    // Fetch all products that share this root (root itself + all children)
    const allProducts = await getAllProducts({});
    const family = allProducts.filter(
      (p: any) =>
        p.id === rootId ||
        p.parentProductId === rootId
    );
    return family;
  },

  /**
   * Create a new version of an existing product.
   * Copies core metadata; components and documents are NOT copied (they differ per version).
   */
  async createVersion(
    user: UserContext & { id: number },
    input: { sourceProductId: number; versionNumber: string }
  ) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager", "internal_employee"]);
    const source = await getProductById(input.sourceProductId);
    if (!source) throw Errors.notFound("Product", input.sourceProductId);

    // The root of the family is either the source itself or its parent
    const rootId = (source as any).parentProductId ?? source.id;

    const newProductId = await createProduct({
      productName: source.productName,
      supplierId: source.supplierId,
      internalArticleNumber: source.internalArticleNumber ?? undefined,
      supplierArticleNumber: source.supplierArticleNumber ?? undefined,
      orderNumber: source.orderNumber ?? undefined,
      ean: source.ean ?? undefined,
      brand: source.brand ?? undefined,
      tenantId: source.tenantId ?? 1,
      status: "open",
      versionNumber: input.versionNumber,
      parentProductId: rootId,
    } as any);

    const newId = typeof newProductId === "number" ? newProductId : (newProductId as any).insertId;

    await createAuditLog({
      entityType: "product",
      entityId: newId ?? 0,
      action: "version_created",
      performedByUserId: user.id,
      payloadSnapshot: { sourceProductId: input.sourceProductId, versionNumber: input.versionNumber } as any,
    });
    return { success: true, productId: newId };
  },

  /**
   * Request clarification from the supplier.
   */
  async requestClarification(user: UserContext & { id: number }, input: WorkflowActionInput & { note: string }) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const product = await getProductById(input.productId);
    if (!product) throw Errors.notFound("Product", input.productId);

    await updateProduct(input.productId, { status: "needs_clarification" as any });
    await createApprovalHistoryEntry({
      productId: input.productId,
      action: "clarification_requested",
      fromStatus: product.status,
      toStatus: "needs_clarification",
      performedByUserId: user.id,
      note: input.note,
    });
    await createAuditLog({
      entityType: "product",
      entityId: input.productId,
      action: "needs_clarification",
      performedByUserId: user.id,
    });
    return { success: true };
  },
};
