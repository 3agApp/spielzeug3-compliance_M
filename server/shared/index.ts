/**
 * server/shared/index.ts
 * Re-exports all shared utilities for convenient single-import access.
 *
 * Usage:
 *   import { Errors, requireRole, assertOwnsProduct, ProductStatusSchema } from "../shared";
 */

export * from "./errors";
export * from "./tenantGuard";
export * from "./validation";
