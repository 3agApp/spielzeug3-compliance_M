/**
 * server/shared/tenantGuard.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable guards for multi-tenant safety and role-based access control.
 *
 * All service methods that touch tenant-scoped data MUST call these helpers
 * before executing any database query.
 *
 * Design decisions:
 * - Guards throw typed AppError subclasses (not TRPCError) so they can be
 *   tested independently from the HTTP/tRPC layer.
 * - The `ComplianceRole` type is the single source of truth for role strings.
 * - `assertOwnsProduct` and `assertOwnsSupplierId` cover the two most common
 *   supplier-isolation patterns in this codebase.
 */

import { ForbiddenError, TenantIsolationError } from "./errors";

// ─── Role definitions ─────────────────────────────────────────────────────────

export type ComplianceRole =
  | "super_admin"
  | "administrator"
  | "compliance_manager"
  | "internal_employee"
  | "supplier";

export const INTERNAL_ROLES: ComplianceRole[] = [
  "super_admin",
  "administrator",
  "compliance_manager",
  "internal_employee",
];

export const ADMIN_ROLES: ComplianceRole[] = [
  "super_admin",
  "administrator",
  "compliance_manager",
];

// ─── Role guard ───────────────────────────────────────────────────────────────

/**
 * Assert that the caller has one of the allowed roles.
 * Throws ForbiddenError otherwise.
 */
export function requireRole(
  actualRole: string | null | undefined,
  allowed: ComplianceRole[]
): void {
  const role = (actualRole ?? "internal_employee") as ComplianceRole;
  if (!allowed.includes(role)) {
    throw new ForbiddenError(
      `Role '${role}' is not permitted. Required: ${allowed.join(", ")}`
    );
  }
}

// ─── Tenant isolation guards ──────────────────────────────────────────────────

/**
 * Minimal user context required by the guards below.
 * Matches the shape of ctx.user in tRPC procedures.
 */
export interface UserContext {
  complianceRole?: string | null;
  supplierId?: number | null;
  tenantId?: number | null;
}

/**
 * Assert that a supplier user owns the given supplierId.
 * Internal roles always pass.
 */
export function assertOwnsSupplierId(
  user: UserContext,
  supplierId: number
): void {
  const role = (user.complianceRole ?? "internal_employee") as ComplianceRole;
  if (role === "supplier" && user.supplierId !== supplierId) {
    throw new TenantIsolationError(
      `Supplier user ${user.supplierId} attempted to access supplier ${supplierId}`
    );
  }
}

/**
 * Assert that a supplier user owns the product (via supplierId).
 * Internal roles always pass.
 *
 * @param productSupplierId  The supplierId stored on the product row.
 */
export function assertOwnsProduct(
  user: UserContext,
  productSupplierId: number | null | undefined
): void {
  const role = (user.complianceRole ?? "internal_employee") as ComplianceRole;
  if (role === "supplier" && user.supplierId !== productSupplierId) {
    throw new TenantIsolationError(
      `Supplier user ${user.supplierId} attempted to access product owned by supplier ${productSupplierId}`
    );
  }
}

/**
 * Assert that the user belongs to the given tenant.
 * Super-admins bypass this check.
 */
export function assertTenantAccess(
  user: UserContext,
  resourceTenantId: number | null | undefined
): void {
  const role = (user.complianceRole ?? "internal_employee") as ComplianceRole;
  if (role === "super_admin") return; // super admins see all tenants
  if (resourceTenantId !== null && resourceTenantId !== undefined && user.tenantId !== resourceTenantId) {
    throw new TenantIsolationError(
      `User from tenant ${user.tenantId} attempted to access resource in tenant ${resourceTenantId}`
    );
  }
}

// ─── Convenience: combined role + ownership check ────────────────────────────

/**
 * For supplier-facing procedures: verify the user is either an internal role
 * OR a supplier who owns the resource.
 */
export function assertSupplierOrInternal(
  user: UserContext,
  productSupplierId: number | null | undefined
): void {
  const role = (user.complianceRole ?? "internal_employee") as ComplianceRole;
  if (role === "supplier") {
    assertOwnsProduct(user, productSupplierId);
  }
  // Internal roles pass without further checks
}
