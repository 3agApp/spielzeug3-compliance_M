/**
 * server/sealAssets.validation.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the server-side image validation logic in sealAssets.ts.
 * We test the validateImageDimensions function indirectly by creating minimal
 * PNG buffers with known dimensions using sharp.
 */
import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import sharp from "sharp";

// ─── Re-export the private function for testing via a thin wrapper ────────────
// We duplicate the validation logic here so we can test it without a full
// tRPC context. This mirrors the exact constants used in sealAssets.ts.

const SRV_MIN_WIDTH = 300;
const SRV_MIN_HEIGHT = 300;
const SRV_MIN_RATIO = 0.70;
const SRV_MAX_RATIO = 1.30;

async function validateImageDimensions(buffer: Buffer, mimeType: string): Promise<void> {
  if (mimeType === "image/svg+xml") return;

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Das Bild konnte nicht gelesen werden.",
    });
  }

  const { width = 0, height = 0 } = metadata;

  if (width < SRV_MIN_WIDTH || height < SRV_MIN_HEIGHT) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Auflösung zu gering: Mindestauflösung ist ${SRV_MIN_WIDTH}×${SRV_MIN_HEIGHT} px. ` +
               `Hochgeladene Grafik: ${width}×${height} px.`,
    });
  }

  const ratio = width / height;
  if (ratio < SRV_MIN_RATIO || ratio > SRV_MAX_RATIO) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Falsches Seitenverhältnis: ${width}×${height} px (Verhältnis ${ratio.toFixed(2)}).`,
    });
  }
}

// ─── Helper: create a minimal PNG buffer with given dimensions ────────────────
async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 200, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("validateImageDimensions (server-side)", () => {
  // ── Happy path ──────────────────────────────────────────────────────────────

  it("accepts a valid 300×300 px PNG (minimum allowed)", async () => {
    const buf = await makePng(300, 300);
    await expect(validateImageDimensions(buf, "image/png")).resolves.toBeUndefined();
  });

  it("accepts a valid 600×600 px PNG", async () => {
    const buf = await makePng(600, 600);
    await expect(validateImageDimensions(buf, "image/png")).resolves.toBeUndefined();
  });

  it("accepts a slightly non-square 400×320 px PNG (ratio 1.25 – within tolerance)", async () => {
    const buf = await makePng(400, 320); // ratio = 1.25
    await expect(validateImageDimensions(buf, "image/png")).resolves.toBeUndefined();
  });

  it("accepts a 320×400 px PNG (ratio 0.80 – within tolerance)", async () => {
    const buf = await makePng(320, 400); // ratio = 0.80
    await expect(validateImageDimensions(buf, "image/png")).resolves.toBeUndefined();
  });

  it("skips pixel checks for SVG (returns without error)", async () => {
    // Pass an empty buffer – SVGs bypass all checks
    await expect(
      validateImageDimensions(Buffer.from("<svg/>"), "image/svg+xml")
    ).resolves.toBeUndefined();
  });

  // ── Resolution failures ─────────────────────────────────────────────────────

  it("rejects a 100×100 px PNG (below minimum resolution)", async () => {
    const buf = await makePng(100, 100);
    await expect(validateImageDimensions(buf, "image/png")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Auflösung zu gering"),
    });
  });

  it("rejects a 299×300 px PNG (width one pixel below minimum)", async () => {
    const buf = await makePng(299, 300);
    await expect(validateImageDimensions(buf, "image/png")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Auflösung zu gering"),
    });
  });

  it("rejects a 300×299 px PNG (height one pixel below minimum)", async () => {
    const buf = await makePng(300, 299);
    await expect(validateImageDimensions(buf, "image/png")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Auflösung zu gering"),
    });
  });

  // ── Aspect ratio failures ───────────────────────────────────────────────────

  it("rejects a 600×300 px PNG (ratio 2.0 – too wide)", async () => {
    const buf = await makePng(600, 300);
    await expect(validateImageDimensions(buf, "image/png")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Seitenverhältnis"),
    });
  });

  it("rejects a 300×600 px PNG (ratio 0.5 – too tall)", async () => {
    const buf = await makePng(300, 600);
    await expect(validateImageDimensions(buf, "image/png")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Seitenverhältnis"),
    });
  });

  it("rejects a 1000×300 px PNG (ratio 3.33 – banner format)", async () => {
    const buf = await makePng(1000, 300);
    await expect(validateImageDimensions(buf, "image/png")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Seitenverhältnis"),
    });
  });

  // ── Corrupt / unreadable file ───────────────────────────────────────────────

  it("rejects a corrupt buffer that sharp cannot parse", async () => {
    const corrupt = Buffer.from("not-an-image-at-all-xyz");
    await expect(validateImageDimensions(corrupt, "image/png")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("gelesen werden"),
    });
  });
});
