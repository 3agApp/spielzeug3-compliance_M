/**
 * server/domains/suppliers/supplierService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for the Suppliers domain.
 */

import {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  createAuditLog,
} from "../../db";
import {
  Errors,
  requireRole,
  assertOwnsSupplierId,
  ADMIN_ROLES,
} from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateSupplierInput {
  name: string;
  supplierCode?: string;
  contactEmail?: string;
  contactName?: string;
  country?: string;
  tenantId?: number;
}

export interface UpdateSupplierInput {
  supplierId: number;
  name?: string;
  contactEmail?: string;
  contactName?: string;
  country?: string;
  isActive?: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const supplierService = {
  /**
   * List all suppliers. Suppliers can only see themselves.
   */
  async list(user: UserContext) {
    const role = user.complianceRole ?? "internal_employee";
    if (role === "supplier") {
      if (!user.supplierId) return [];
      const s = await getSupplierById(user.supplierId);
      return s ? [s] : [];
    }
    return getAllSuppliers();
  },

  /**
   * Get a single supplier with isolation enforcement.
   */
  async getById(user: UserContext, supplierId: number) {
    assertOwnsSupplierId(user, supplierId);
    const supplier = await getSupplierById(supplierId);
    if (!supplier) throw Errors.notFound("Supplier", supplierId);
    return supplier;
  },

  /**
   * Create a new supplier (admin roles only).
   */
  async create(user: UserContext & { id: number }, input: CreateSupplierInput) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const result = await createSupplier({
      name: input.name,
      supplierCode: input.supplierCode ?? "",
      email: input.contactEmail,
      tenantId: input.tenantId ?? user.tenantId ?? 1,
    } as any);
    await createAuditLog({
      entityType: "supplier",
      entityId: typeof result === "number" ? result : 0,
      action: "created",
      performedByUserId: user.id,
      payloadSnapshot: { name: input.name } as any,
    });
    return result;
  },

  /**
   * Update supplier details.
   * Suppliers can update their own profile; admins can update any.
   */
  async update(user: UserContext & { id: number }, input: UpdateSupplierInput) {
    assertOwnsSupplierId(user, input.supplierId);
    const supplier = await getSupplierById(input.supplierId);
    if (!supplier) throw Errors.notFound("Supplier", input.supplierId);

    const { supplierId, ...fields } = input;
    await updateSupplier(supplierId, fields);
    await createAuditLog({
      entityType: "supplier",
      entityId: supplierId,
      action: "updated",
      performedByUserId: user.id,
    });
    return { success: true };
  },
};
