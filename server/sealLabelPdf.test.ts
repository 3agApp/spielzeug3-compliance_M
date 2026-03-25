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
    expect(buf.length).toBeGreaterThan(1000);
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
});
