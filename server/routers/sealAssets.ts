/**
 * server/routers/sealAssets.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * tRPC router for managing custom seal graphics per status.
 * Admins can upload PNG/SVG images to replace the default CDN graphics.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { sealAssets } from "../../drizzle/schema";
import { storagePut } from "../storage";
import { eq, and, desc } from "drizzle-orm";

// ─── Default CDN fallbacks ────────────────────────────────────────────────────
export const DEFAULT_SEAL_URLS: Record<"verified" | "in_progress" | "not_verified", string> = {
  verified:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-verified_75b748c3.png",
  in_progress:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-in-progress_65b28caf.png",
  not_verified:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663310227526/kgkV5LdecSJ3HqPv7WFR7a/seal-not-verified_119c8334.png",
};

export type SealStatusKey = keyof typeof DEFAULT_SEAL_URLS;

/** Returns the active seal URL for a given status and tenant (DB override or CDN default) */
export async function getActiveSealUrl(
  tenantId: number,
  status: SealStatusKey
): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return DEFAULT_SEAL_URLS[status];
    const rows = await db
      .select()
      .from(sealAssets)
      .where(and(eq(sealAssets.tenantId, tenantId), eq(sealAssets.status, status)))
      .orderBy(desc(sealAssets.createdAt))
      .limit(1);
    return rows[0]?.url ?? DEFAULT_SEAL_URLS[status];
  } catch {
    return DEFAULT_SEAL_URLS[status];
  }
}

/** Returns all three active seal URLs for a tenant */
export async function getAllActiveSealUrls(
  tenantId: number
): Promise<Record<SealStatusKey, string>> {
  const [verified, in_progress, not_verified] = await Promise.all([
    getActiveSealUrl(tenantId, "verified"),
    getActiveSealUrl(tenantId, "in_progress"),
    getActiveSealUrl(tenantId, "not_verified"),
  ]);
  return { verified, in_progress, not_verified };
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const sealAssetsRouter = router({
  /** Get the currently active seal URLs for all three statuses */
  getActive: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = (ctx.user as any).tenantId ?? 1;
    return getAllActiveSealUrls(tenantId);
  }),

  /** Upload a new seal graphic for a specific status (base64 encoded) */
  upload: protectedProcedure
    .input(
      z.object({
        status: z.enum(["verified", "in_progress", "not_verified"]),
        fileName: z.string().min(1),
        fileBase64: z.string().min(1),
        mimeType: z.enum(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user as any;
      // Only admins and compliance managers can upload seal graphics
      if (!["admin", "administrator", "compliance_manager"].includes(user.complianceRole ?? user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Nur Administratoren können Siegel-Grafiken hochladen." });
      }

      const tenantId = user.tenantId ?? 1;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Datenbankverbindung nicht verfügbar." });

      // Decode base64 and upload to S3
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      if (fileBuffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Datei zu groß (max. 5 MB)." });
      }

      const ext = input.mimeType === "image/svg+xml" ? "svg" : input.mimeType.split("/")[1];
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const fileKey = `seal-assets/tenant-${tenantId}/${input.status}-${randomSuffix}.${ext}`;

      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);

      // Save to DB
      await db.insert(sealAssets).values({
        tenantId,
        status: input.status,
        url,
        fileKey,
        originalName: input.fileName,
        uploadedByUserId: user.id,
      });

      return { url, status: input.status };
    }),

  /** Reset a status back to the default CDN graphic (deletes custom entry) */
  resetToDefault: protectedProcedure
    .input(z.object({ status: z.enum(["verified", "in_progress", "not_verified"]) }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user as any;
      if (!["admin", "administrator", "compliance_manager"].includes(user.complianceRole ?? user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Nur Administratoren können Siegel-Grafiken zurücksetzen." });
      }
      const tenantId = user.tenantId ?? 1;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .delete(sealAssets)
        .where(and(eq(sealAssets.tenantId, tenantId), eq(sealAssets.status, input.status)));

      return { defaultUrl: DEFAULT_SEAL_URLS[input.status] };
    }),
});
