import QRCode from "qrcode";
import { storagePut } from "./storage";
import type { Product } from "../drizzle/schema";

// ─── Seal Status ─────────────────────────────────────────────────────────────

export type SealStatus = "verified" | "in_progress" | "not_verified";

export function getSealStatus(product: Pick<Product, "status" | "completenessScore" | "sealStatusOverride">): SealStatus {
  // Admin override takes precedence over automatic logic
  if (product.sealStatusOverride) {
    return product.sealStatusOverride as SealStatus;
  }
  const score = Number(product.completenessScore ?? 0);
  // Approved = fully verified (regardless of score)
  if (product.status === "approved") {
    return "verified";
  }
  // In progress: any non-open/draft status, or score > 0
  if (score > 0 || (product.status !== "open" && product.status !== ("draft" as string))) {
    return "in_progress";
  }
  return "not_verified";
}

export function getSealStatusLabel(status: SealStatus): string {
  switch (status) {
    case "verified":    return "VERIFIED";
    case "in_progress": return "IN PROGRESS";
    case "not_verified": return "NOT VERIFIED";
  }
}

// ─── QR Code Generation ───────────────────────────────────────────────────────

const PUBLIC_BASE_URL = process.env.VITE_PUBLIC_BASE_URL || "https://swiss-seal.ch";

export function getPublicProductUrl(publicUuid: string): string {
  return `${PUBLIC_BASE_URL}/p/${publicUuid}`;
}

export async function generateAndStoreQrCode(
  publicUuid: string,
  tenantSlug: string
): Promise<{ pngUrl: string; svgUrl: string; targetUrl: string }> {
  const targetUrl = getPublicProductUrl(publicUuid);

  // Generate PNG buffer
  const pngBuffer = await QRCode.toBuffer(targetUrl, {
    type: "png",
    width: 800,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
    errorCorrectionLevel: "H", // High – allows logo overlay
  });

  // Generate SVG string
  const svgString = await QRCode.toString(targetUrl, {
    type: "svg",
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
    errorCorrectionLevel: "H",
  });

  const pngKey = `qr/${tenantSlug}/${publicUuid}.png`;
  const svgKey = `qr/${tenantSlug}/${publicUuid}.svg`;

  const { url: pngUrl } = await storagePut(pngKey, pngBuffer, "image/png");
  const { url: svgUrl } = await storagePut(svgKey, Buffer.from(svgString, "utf8"), "image/svg+xml");

  return { pngUrl, svgUrl, targetUrl };
}
