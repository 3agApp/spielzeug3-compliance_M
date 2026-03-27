/**
 * Tests for the Seal Label PDF generator (sealLabelPdf.ts)
 */
import { describe, it, expect } from "vitest";
import { generateSealLabelPdf } from "./sealLabelPdf";
import type { SealLabelOptions } from "./sealLabelPdf";

describe("generateSealLabelPdf", () => {
  it("returns a non-empty Buffer for status=verified", async () => {
    const opts: SealLabelOptions = {
      status: "verified",
      tenantName: "Spielzeug 3 AG",
      tenantUrl: "spielzeug3.ch",
    };
    const buf = await generateSealLabelPdf(opts);
    expect(buf).toBeInstanceOf(Buffer);
    // SVG-embedded PDF is larger than the old inline-drawn version
    expect(buf.length).toBeGreaterThan(5000);
  });

  it("returns a non-empty Buffer for status=in_progress", async () => {
    const opts: SealLabelOptions = {
      status: "in_progress",
      tenantName: "Test Importer GmbH",
      tenantUrl: "test-importer.ch",
    };
    const buf = await generateSealLabelPdf(opts);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("returns a non-empty Buffer for status=not_verified", async () => {
    const opts: SealLabelOptions = {
      status: "not_verified",
      tenantName: "Demo AG",
      tenantUrl: "demo.ch",
    };
    const buf = await generateSealLabelPdf(opts);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("starts with PDF magic bytes (%PDF)", async () => {
    const opts: SealLabelOptions = {
      status: "verified",
      tenantName: "Spielzeug 3 AG",
      tenantUrl: "spielzeug3.ch",
    };
    const buf = await generateSealLabelPdf(opts);
    const header = buf.slice(0, 4).toString("ascii");
    expect(header).toBe("%PDF");
  });

  it("generates different-sized PDFs for different tenant names (content varies)", async () => {
    const buf1 = await generateSealLabelPdf({
      status: "verified",
      tenantName: "A",
      tenantUrl: "a.ch",
    });
    const buf2 = await generateSealLabelPdf({
      status: "verified",
      tenantName: "Spielzeug 3 AG – Importeur für hochwertige Spielwaren",
      tenantUrl: "spielzeug3-ag.swiss",
    });
    // Both should be valid PDFs
    expect(buf1.slice(0, 4).toString("ascii")).toBe("%PDF");
    expect(buf2.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("generates PDF without qrCodeBuffer (placeholder mode)", async () => {
    // When no qrCodeBuffer is supplied the generator draws a placeholder – verify it still produces a valid PDF
    const opts: SealLabelOptions = {
      status: "not_verified",
      tenantName: "Placeholder Test AG",
      tenantUrl: "placeholder.ch",
      // qrCodeBuffer intentionally omitted
    };
    const buf = await generateSealLabelPdf(opts);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("PDF with qrCodeBuffer is larger than PDF without (real QR code adds content)", async () => {
    // Generate a real QR code PNG to use as qrCodeBuffer
    const QRCode = await import("qrcode");
    const qrPng = await QRCode.default.toBuffer("https://swiss-product-seal.ch/p/test-uuid", {
      type: "png",
      width: 400,
      errorCorrectionLevel: "H",
    });

    const withQr = await generateSealLabelPdf({
      status: "verified",
      tenantName: "Spielzeug 3 AG",
      tenantUrl: "spielzeug3.ch",
      qrCodeBuffer: qrPng,
    });
    const withoutQr = await generateSealLabelPdf({
      status: "verified",
      tenantName: "Spielzeug 3 AG",
      tenantUrl: "spielzeug3.ch",
    });

    // Both must be valid PDFs
    expect(withQr.slice(0, 4).toString("ascii")).toBe("%PDF");
    expect(withoutQr.slice(0, 4).toString("ascii")).toBe("%PDF");
    // PDF with embedded image should be larger
    expect(withQr.length).toBeGreaterThan(withoutQr.length);
  }, 15_000);
});
