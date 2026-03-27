/**
 * server/shared/errors.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised error types for the Spielzeug3 Compliance backend.
 *
 * Design decisions:
 * - All domain errors extend a base AppError so catch-blocks can distinguish
 *   them from unexpected runtime errors.
 * - Factory helpers (notFound, forbidden, …) keep router code concise and
 *   ensure consistent TRPCError codes everywhere.
 * - Services throw AppError subclasses; the router layer converts them to
 *   TRPCError only at the boundary (see shared/trpcErrorMapper.ts).
 */

import { TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

// ─── Base ─────────────────────────────────────────────────────────────────────

export class AppError extends Error {
  readonly code: TRPC_ERROR_CODE_KEY;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: TRPC_ERROR_CODE_KEY = "INTERNAL_SERVER_ERROR",
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.context = context;
  }
}

// ─── Domain-specific subclasses ───────────────────────────────────────────────

/** Entity was not found in the database. */
export class NotFoundError extends AppError {
  constructor(entity: string, id?: number | string) {
    super(
      id !== undefined ? `${entity} with id ${id} not found` : `${entity} not found`,
      "NOT_FOUND",
      { entity, id }
    );
    this.name = "NotFoundError";
  }
}

/** Caller lacks the required role or permission. */
export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

/** Cross-tenant access attempt. */
export class TenantIsolationError extends AppError {
  constructor(detail?: string) {
    super(
      detail ?? "Cross-tenant access is not permitted",
      "FORBIDDEN",
      { type: "tenant_isolation" }
    );
    this.name = "TenantIsolationError";
  }
}

/** A required pre-condition was not met (e.g. supplier must confirm before submit). */
export class PreconditionError extends AppError {
  constructor(message: string) {
    super(message, "PRECONDITION_FAILED");
    this.name = "PreconditionError";
  }
}

/** Input validation failed at the service layer (beyond Zod schema). */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "BAD_REQUEST", context);
    this.name = "ValidationError";
  }
}

/** An external service (S3, OpenAI, BunnyDoc, …) returned an error. */
export class ExternalServiceError extends AppError {
  constructor(service: string, detail?: string) {
    super(
      `External service error [${service}]${detail ? `: ${detail}` : ""}`,
      "INTERNAL_SERVER_ERROR",
      { service }
    );
    this.name = "ExternalServiceError";
  }
}

// ─── TRPCError mapper ─────────────────────────────────────────────────────────

/**
 * Convert any AppError (or unknown throw) into a TRPCError.
 * Use this in router procedures to keep the boundary clean:
 *
 *   .mutation(async ({ ctx, input }) => {
 *     try {
 *       return await productService.submit(ctx, input);
 *     } catch (err) {
 *       throw toTRPCError(err);
 *     }
 *   })
 *
 * Services that already throw AppError subclasses will be mapped correctly;
 * unexpected errors become INTERNAL_SERVER_ERROR.
 */
export function toTRPCError(err: unknown): TRPCError {
  if (err instanceof TRPCError) return err;
  if (err instanceof AppError) {
    return new TRPCError({ code: err.code, message: err.message, cause: err });
  }
  const message = err instanceof Error ? err.message : "An unexpected error occurred";
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: err as Error });
}

// ─── Convenience factories (for use inside services) ─────────────────────────

export const Errors = {
  notFound: (entity: string, id?: number | string) => new NotFoundError(entity, id),
  forbidden: (msg?: string) => new ForbiddenError(msg),
  tenantIsolation: (detail?: string) => new TenantIsolationError(detail),
  precondition: (msg: string) => new PreconditionError(msg),
  validation: (msg: string, ctx?: Record<string, unknown>) => new ValidationError(msg, ctx),
  external: (service: string, detail?: string) => new ExternalServiceError(service, detail),
} as const;
