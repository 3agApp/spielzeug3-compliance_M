# Backend Architecture – spielzeug3 Compliance Portal

## Overview

The backend follows a **domain-driven, layered architecture** designed for SaaS scalability, multi-tenant safety, and independent testability of business logic.

```
server/
├── _core/                  ← Framework plumbing (tRPC, OAuth, context) – do not edit
├── domains/                ← Business domains (new)
│   ├── products/
│   │   ├── productService.ts       ← Business logic
│   │   └── productRepository.ts    ← Data-access re-exports
│   ├── documents/
│   │   ├── documentService.ts
│   │   └── documentRepository.ts
│   ├── suppliers/
│   │   ├── supplierService.ts
│   │   └── supplierRepository.ts
│   ├── tenants/
│   │   └── tenantService.ts
│   ├── seal/
│   │   └── sealService.ts
│   ├── compliance/
│   │   ├── complianceWorkflowService.ts
│   │   └── complianceRepository.ts
│   ├── ai/
│   │   ├── aiAnalysisService.ts
│   │   └── aiRepository.ts
│   ├── invitations/
│   │   └── invitationService.ts
│   └── users/
│       └── userRepository.ts
├── routers/                ← Thin tRPC routers (input validation + service calls only)
│   ├── products.ts
│   ├── documents.ts
│   ├── suppliers.ts
│   ├── tenant.ts
│   ├── aiAnalysis.ts
│   ├── invitations.ts
│   └── ...
├── shared/                 ← Cross-cutting concerns (new)
│   ├── errors.ts           ← Typed AppError classes + toTRPCError()
│   ├── tenantGuard.ts      ← Tenant isolation helpers + role checks
│   ├── validation.ts       ← Shared Zod schemas
│   └── index.ts            ← Re-exports
├── db.ts                   ← Central data-access layer (single source of truth)
├── tenantDb.ts             ← Tenant-specific queries (QR codes, slugs)
└── routers.ts              ← Root router (combines all sub-routers)
```

---

## Architectural Principles

### 1. Layered Architecture

```
┌─────────────────────────────────────┐
│  tRPC Router (thin)                 │  ← Input validation (Zod), error mapping
│  server/routers/*.ts                │
├─────────────────────────────────────┤
│  Domain Service                     │  ← Business logic, orchestration
│  server/domains/*/service.ts        │
├─────────────────────────────────────┤
│  Repository                         │  ← Data access (re-exports from db.ts)
│  server/domains/*/repository.ts     │
├─────────────────────────────────────┤
│  Database (Drizzle ORM)             │  ← server/db.ts + drizzle/schema.ts
└─────────────────────────────────────┘
```

**Rule:** Business logic MUST NOT live in routers. Routers call services; services call repositories.

### 2. Separation of Concerns

| Layer | Responsibility | Must NOT |
|-------|---------------|---------|
| Router | Parse input, call service, map errors | Contain business logic |
| Service | Orchestrate domain logic, enforce rules | Query DB directly (use repository) |
| Repository | Execute DB queries | Contain business logic |
| Shared | Cross-cutting utilities | Contain domain logic |

### 3. Multi-Tenant Safety

Every service method that accesses product or supplier data calls one of:

```ts
// Throws FORBIDDEN if supplier user accesses another supplier's data
assertSupplierOrInternal(user, product.supplierId);

// Throws FORBIDDEN if role is not in allowed list
requireRole(user.complianceRole, ["administrator", "compliance_manager"]);
```

These helpers live in `server/shared/tenantGuard.ts` and are the **single enforcement point** for tenant isolation.

### 4. Error Handling

All domain errors extend `AppError` from `server/shared/errors.ts`:

```ts
// In services – throw typed errors:
throw Errors.notFound("Product", productId);
throw Errors.forbidden("Insufficient permissions");
throw Errors.precondition("Supplier must confirm completeness first");

// In routers – convert to TRPCError:
try {
  return await productService.submit(ctx.user, input);
} catch (err) {
  throw toTRPCError(err);   // AppError → TRPCError with correct code
}
```

Error code mapping:

| AppError code | TRPCError code |
|--------------|----------------|
| `NOT_FOUND` | `NOT_FOUND` |
| `FORBIDDEN` | `FORBIDDEN` |
| `VALIDATION` | `BAD_REQUEST` |
| `PRECONDITION` | `PRECONDITION_FAILED` |
| `EXTERNAL` | `INTERNAL_SERVER_ERROR` |

### 5. Testability

Services are designed for independent testing:

```ts
// Services accept a UserContext interface – easy to mock:
const mockUser: UserContext = {
  id: 1,
  complianceRole: "compliance_manager",
  supplierId: null,
  tenantId: 1,
};

// DB functions are imported at module level – mock with vi.mock():
vi.mock("../../db", () => ({
  getProductById: vi.fn().mockResolvedValue({ id: 1, status: "submitted", ... }),
}));

// Test the service directly without HTTP layer:
const result = await productService.approve(mockUser, { productId: 1 });
expect(result.success).toBe(true);
```

---

## Domain Descriptions

### `products`
Core compliance entity. Manages the full lifecycle from `open` → `submitted` → `approved`/`rejected` → `completed`. Contains workflow mutations (submit, approve, reject, requestClarification) and batch info management.

### `documents`
File attachments per product (and per component). Tracks review status (`missing`, `provided`, `under_review`, `approved`, `rejected`). Triggers supplier confirmation reset on upload/delete.

### `suppliers`
Supplier company accounts. Each supplier can have multiple users and multiple products. Tenant-scoped.

### `tenants`
Multi-tenant configuration: slug, enabled modules (seal, ai_analysis, etc.), branding. Controls which features are available per tenant.

### `seal`
QR code generation, public UUID assignment, seal status calculation, and status overrides. Seal status is derived from product status + override field.

### `compliance`
Workflow orchestration across domains: signature requests (BunnyDoc), product safety entries, audit logs. Coordinates multi-step approval processes.

### `ai`
OpenAI-powered compliance analysis. Isolated API call, structured JSON output, analysis history. Feature-flagged via system settings.

### `invitations`
Supplier onboarding via magic-link tokens. Token generation (nanoid), expiry, acceptance, and revocation.

### `users`
User accounts, roles, notifications. Linked to suppliers via `supplierId` foreign key.

---

## Adding a New Domain

1. Create `server/domains/{name}/` directory
2. Add `{name}Service.ts` with business logic
3. Add `{name}Repository.ts` re-exporting relevant functions from `db.ts`
4. Create `server/routers/{name}.ts` as a thin tRPC router
5. Register the router in `server/routers.ts`
6. Write tests in `server/{name}.test.ts`

---

## Key Refactoring Decisions

| Decision | Rationale |
|----------|-----------|
| Keep `db.ts` as single source of truth | Avoids duplication; repositories are thin re-export facades |
| Services import from repositories, not db.ts directly | Clear ownership; easy to swap implementations |
| `toTRPCError()` in every router catch block | Consistent HTTP status codes without leaking internal error details |
| `UserContext` interface instead of raw `ctx.user` | Services can be tested without tRPC context |
| `assertSupplierOrInternal()` as shared utility | Single enforcement point prevents cross-tenant leaks |
| No new features added | Pure structural refactoring – all existing tests remain valid |
