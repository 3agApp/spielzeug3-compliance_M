import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { tenants, products, suppliers, users } from "../drizzle/schema";
import type { InsertTenant } from "../drizzle/schema";
import { randomUUID } from "crypto";
import { generateAndStoreQrCode } from "./sealUtils";

// ─── Tenant Queries ───────────────────────────────────────────────────────────

export async function getTenantById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getTenantBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return result[0] ?? null;
}

export async function listTenants() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tenants).orderBy(tenants.createdAt);
}

export async function createTenant(data: Omit<InsertTenant, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(tenants).values(data);
  const insertId = (result as any)[0]?.insertId ?? 0;
  return getTenantById(insertId);
}

export async function updateTenant(
  id: number,
  data: Partial<Pick<InsertTenant, "name" | "plan" | "modulesEnabled" | "isActive" | "logoUrl" | "primaryColor" | "contactEmail" | "websiteUrl">>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(tenants).set({ ...data, updatedAt: new Date() }).where(eq(tenants.id, id));
}

// ─── Tenant Stats (for Super Admin) ──────────────────────────────────────────

export async function getTenantStats(tenantId: number) {
  const db = await getDb();
  if (!db) return { productCount: 0, verifiedCount: 0, supplierCount: 0, userCount: 0 };
  const allProducts = await db
    .select({ status: products.status, completenessScore: products.completenessScore })
    .from(products)
    .where(eq(products.tenantId, tenantId));
  const productCount = allProducts.length;
  const verifiedCount = allProducts.filter((p) => p.status === "approved").length;
  // Count suppliers for this tenant
  const allSuppliers = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.tenantId, tenantId));
  const supplierCount = allSuppliers.length;
  // Count users for this tenant
  const allUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.tenantId, tenantId));
  const userCount = allUsers.length;
  return { productCount, verifiedCount, supplierCount, userCount };
}

// ─── QR Code Generation for Product ──────────────────────────────────────────

export async function ensureProductPublicUuid(
  productId: number,
  tenantSlug: string
): Promise<{ publicUuid: string; qrCodeUrl: string; qrCodeSvgUrl: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Check if already has UUID
  const existing = await db
    .select({ publicUuid: products.publicUuid, qrCodeUrl: products.qrCodeUrl, qrCodeSvgUrl: products.qrCodeSvgUrl })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  const product = existing[0];
  if (product?.publicUuid && product.qrCodeUrl) {
    return {
      publicUuid: product.publicUuid,
      qrCodeUrl: product.qrCodeUrl,
      qrCodeSvgUrl: product.qrCodeSvgUrl ?? "",
    };
  }

  // Generate new UUID and QR code
  const publicUuid = product?.publicUuid ?? randomUUID();
  const { pngUrl, svgUrl } = await generateAndStoreQrCode(publicUuid, tenantSlug);

  await db.update(products).set({
    publicUuid,
    qrCodeUrl: pngUrl,
    qrCodeSvgUrl: svgUrl,
    sealEnabledAt: new Date(),
  }).where(eq(products.id, productId));

  return { publicUuid, qrCodeUrl: pngUrl, qrCodeSvgUrl: svgUrl };
}
