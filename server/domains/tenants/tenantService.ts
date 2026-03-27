/**
 * server/domains/tenants/tenantService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for the Tenants domain (multi-tenant platform management).
 *
 * Only super_admin users may manage tenants.
 */

import {
  getTenantById,
  getTenantBySlug,
  listTenants,
  createTenant,
  updateTenant,
  getTenantStats,
} from "../../tenantDb";
import { Errors, requireRole } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateTenantInput {
  name: string;
  slug: string;
  plan?: string;
  contactEmail?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export interface UpdateTenantInput {
  tenantId: number;
  name?: string;
  plan?: string;
  modulesEnabled?: string[];
  isActive?: boolean;
  logoUrl?: string;
  primaryColor?: string;
  contactEmail?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const tenantService = {
  /**
   * List all tenants (super_admin only).
   */
  async list(user: UserContext) {
    requireRole(user.complianceRole, ["super_admin"]);
    return listTenants();
  },

  /**
   * Get a single tenant by ID.
   * Super admins can access any tenant; other roles can only access their own.
   */
  async getById(user: UserContext, tenantId: number) {
    const role = user.complianceRole ?? "internal_employee";
    if (role !== "super_admin" && user.tenantId !== tenantId) {
      throw Errors.tenantIsolation();
    }
    const tenant = await getTenantById(tenantId);
    if (!tenant) throw Errors.notFound("Tenant", tenantId);
    return tenant;
  },

  /**
   * Get a tenant by slug (used for public product pages).
   */
  async getBySlug(_user: UserContext | null, slug: string) {
    const tenant = await getTenantBySlug(slug);
    if (!tenant) throw Errors.notFound("Tenant", slug);
    return tenant;
  },

  /**
   * Create a new tenant (super_admin only).
   */
  async create(user: UserContext, input: CreateTenantInput) {
    requireRole(user.complianceRole, ["super_admin"]);
    const existing = await getTenantBySlug(input.slug);
    if (existing) {
      throw Errors.validation(`Tenant slug '${input.slug}' is already taken`);
    }
    return createTenant({
      name: input.name,
      slug: input.slug,
      plan: (input.plan ?? "starter") as any,
      contactEmail: input.contactEmail,
      logoUrl: input.logoUrl,
      primaryColor: input.primaryColor,
    });
  },

  /**
   * Update tenant settings (super_admin only).
   */
  async update(user: UserContext, input: UpdateTenantInput) {
    requireRole(user.complianceRole, ["super_admin"]);
    const tenant = await getTenantById(input.tenantId);
    if (!tenant) throw Errors.notFound("Tenant", input.tenantId);

    const { tenantId, ...fields } = input;
    await updateTenant(tenantId, fields as any);
    return { success: true };
  },

  /**
   * Get aggregated stats for a tenant (super_admin only).
   */
  async getStats(user: UserContext, tenantId: number) {
    requireRole(user.complianceRole, ["super_admin"]);
    return getTenantStats(tenantId);
  },
};
