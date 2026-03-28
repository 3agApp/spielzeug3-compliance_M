/**
 * Product Images Router
 * Handles upload, listing, deletion and reordering of product images.
 * Images are stored in S3; metadata is persisted in product_images table.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { productImages, products } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { storagePut } from "../storage";
import { Errors } from "../shared/errors";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGES_PER_PRODUCT = 10;

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

async function assertProductAccess(db: Awaited<ReturnType<typeof getDb>>, productId: number, userId: number, role: string) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [product] = await db.select({ id: products.id, supplierId: products.supplierId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) throw Errors.notFound("Product", String(productId));
  // Suppliers can only manage images for their own products
  if (role === "supplier" && product.supplierId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const productImagesRouter = {
  /**
   * Upload a product image (base64-encoded).
   * Allowed roles: supplier (own products), internal_employee, compliance_manager, administrator.
   */
  upload: protectedProcedure
    .input(z.object({
      productId: z.number().int().positive(),
      fileBase64: z.string().min(1),
      mimeType: z.string().refine(v => ALLOWED_MIME_TYPES.includes(v), {
        message: "Nur JPEG, PNG, WebP oder GIF erlaubt.",
      }),
      originalName: z.string().max(255).optional(),
      fileSizeBytes: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await assertProductAccess(db, input.productId, ctx.user.id, ctx.user.complianceRole ?? "supplier");

      // Validate file size
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      if (fileBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Datei zu groß. Max. 5 MB." });
      }

      // Check image count limit
      const existing = await db.select({ id: productImages.id })
        .from(productImages)
        .where(eq(productImages.productId, input.productId));
      if (existing.length >= MAX_IMAGES_PER_PRODUCT) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Maximal ${MAX_IMAGES_PER_PRODUCT} Bilder pro Produkt erlaubt.` });
      }

      // Upload to S3
      const ext = input.mimeType === "image/png" ? "png"
        : input.mimeType === "image/webp" ? "webp"
        : input.mimeType === "image/gif" ? "gif"
        : "jpg";
      const fileKey = `product-images/${input.productId}/${randomSuffix()}.${ext}`;
      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);

      // Determine sort order (append at end)
      const sortOrder = existing.length;

      // Persist metadata
      await db.insert(productImages).values({
        productId: input.productId,
        url,
        fileKey,
        originalName: input.originalName ?? null,
        mimeType: input.mimeType,
        fileSizeBytes: fileBuffer.byteLength,
        sortOrder,
        uploadedByUserId: ctx.user.id,
      });

      // Return the newly created image
      const [created] = await db.select()
        .from(productImages)
        .where(eq(productImages.productId, input.productId))
        .orderBy(asc(productImages.sortOrder));
      // Return the last inserted (highest sortOrder)
      const all = await db.select()
        .from(productImages)
        .where(eq(productImages.productId, input.productId))
        .orderBy(asc(productImages.sortOrder));
      return { image: all[all.length - 1], images: all };
    }),

  /**
   * List all images for a product (ordered by sortOrder).
   */
  list: protectedProcedure
    .input(z.object({ productId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const images = await db.select()
        .from(productImages)
        .where(eq(productImages.productId, input.productId))
        .orderBy(asc(productImages.sortOrder));
      return images;
    }),

  /**
   * Delete a product image by ID.
   */
  delete: protectedProcedure
    .input(z.object({ imageId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [image] = await db.select()
        .from(productImages)
        .where(eq(productImages.id, input.imageId))
        .limit(1);
      if (!image) throw Errors.notFound("ProductImage", String(input.imageId));

      await assertProductAccess(db, image.productId, ctx.user.id, ctx.user.complianceRole ?? "supplier");

      await db.delete(productImages).where(eq(productImages.id, input.imageId));

      // Re-normalize sortOrder after deletion
      const remaining = await db.select({ id: productImages.id })
        .from(productImages)
        .where(eq(productImages.productId, image.productId))
        .orderBy(asc(productImages.sortOrder));
      for (let i = 0; i < remaining.length; i++) {
        await db.update(productImages)
          .set({ sortOrder: i })
          .where(eq(productImages.id, remaining[i].id));
      }

      return { success: true };
    }),

  /**
   * Reorder images by providing an ordered array of image IDs.
   */
  reorder: protectedProcedure
    .input(z.object({
      productId: z.number().int().positive(),
      orderedIds: z.array(z.number().int().positive()),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await assertProductAccess(db, input.productId, ctx.user.id, ctx.user.complianceRole ?? "supplier");

      for (let i = 0; i < input.orderedIds.length; i++) {
        await db.update(productImages)
          .set({ sortOrder: i })
          .where(eq(productImages.id, input.orderedIds[i]));
      }
      return { success: true };
    }),
};
