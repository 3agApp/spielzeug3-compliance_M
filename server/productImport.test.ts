/**
 * Tests for productImportService (CSV/Excel import)
 * Tests the pure parsing logic (parseImportBuffer / previewImport) without DB.
 */

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseImportBuffer, previewImport } from "./domains/products/productImportService";

// ─── Helper: build an XLSX buffer from a 2D array ────────────────────────────

function makeXlsxBuffer(rows: (string | number)[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("productImportService – parseImportBuffer", () => {
  it("maps Tigermedia column headers correctly", () => {
    const buf = makeXlsxBuffer([
      ["Artnr", "Bestellnr", "Wg1", "Bez1", "Artean", "Name", "Ursprungsland", "Zolltarifnr"],
      ["ART001", "BEST001", "KG1", "Testprodukt", "1234567890123", "TestBrand", "DE", "9503.00"],
    ]);

    const { rows, columnMapping } = parseImportBuffer(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    expect(columnMapping["Artnr"]).toBe("internalArticleNumber");
    expect(columnMapping["Bestellnr"]).toBe("supplierArticleNumber");
    expect(columnMapping["Wg1"]).toBe("kontorId");
    expect(columnMapping["Bez1"]).toBe("productName");
    expect(columnMapping["Artean"]).toBe("ean");
    expect(columnMapping["Name"]).toBe("brand");
    expect(columnMapping["Ursprungsland"]).toBe("countryOfOrigin");
    expect(columnMapping["Zolltarifnr"]).toBe("customsTariffNumber");

    expect(rows).toHaveLength(1);
    expect(rows[0].internalArticleNumber).toBe("ART001");
    expect(rows[0].supplierArticleNumber).toBe("BEST001");
    expect(rows[0].kontorId).toBe("KG1");
    expect(rows[0].productName).toBe("Testprodukt");
    expect(rows[0].ean).toBe("1234567890123");
    expect(rows[0].brand).toBe("TestBrand");
    expect(rows[0].countryOfOrigin).toBe("DE");
    expect(rows[0].customsTariffNumber).toBe("9503.00");
  });

  it("skips completely empty rows", () => {
    const buf = makeXlsxBuffer([
      ["Artnr", "Bez1"],
      ["ART001", "Produkt 1"],
      ["", ""],          // empty row – should be skipped
      ["ART002", "Produkt 2"],
    ]);

    const { rows } = parseImportBuffer(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(rows).toHaveLength(2);
  });

  it("handles case-insensitive column names", () => {
    const buf = makeXlsxBuffer([
      ["artnr", "bez1", "name"],
      ["X001", "My Product", "BrandX"],
    ]);

    const { rows, columnMapping } = parseImportBuffer(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(columnMapping["artnr"]).toBe("internalArticleNumber");
    expect(rows[0].productName).toBe("My Product");
    expect(rows[0].brand).toBe("BrandX");
  });

  it("throws on empty workbook", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["Header"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

    expect(() => parseImportBuffer(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
      .toThrow("no data rows");
  });

  it("adds warning when productName column is missing", () => {
    const buf = makeXlsxBuffer([
      ["Artnr", "Artean"],
      ["ART001", "1234567890123"],
    ]);

    const { warnings } = parseImportBuffer(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(warnings.some((w) => w.includes("productName"))).toBe(true);
  });
});

describe("productImportService – previewImport", () => {
  it("returns correct counts", () => {
    // Note: completely empty rows are filtered out by parseImportBuffer before
    // they reach previewImport, so totalRows only counts non-empty data rows.
    const buf = makeXlsxBuffer([
      ["Artnr", "Bez1"],
      ["ART001", "Produkt 1"],
      ["ART002", "Produkt 2"],
      ["", ""],          // empty row – filtered by parser, not counted
    ]);

    const result = previewImport(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    // Empty rows are stripped in parseImportBuffer; only 2 non-empty rows remain
    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.skippedRows).toBe(0);
    expect(result.rows).toHaveLength(2);
  });

  it("caps preview at 200 rows", () => {
    const dataRows: string[][] = Array.from({ length: 250 }, (_, i) => [`ART${i}`, `Produkt ${i}`]);
    const buf = makeXlsxBuffer([["Artnr", "Bez1"], ...dataRows]);

    const result = previewImport(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(result.totalRows).toBe(250);
    expect(result.validRows).toBe(250);
    expect(result.rows).toHaveLength(200); // capped
  });

  it("includes rowIndex starting from 2 (1-based, header is row 1)", () => {
    const buf = makeXlsxBuffer([
      ["Artnr", "Bez1"],
      ["ART001", "Produkt 1"],
      ["ART002", "Produkt 2"],
    ]);

    const result = previewImport(buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(result.rows[0].rowIndex).toBe(2);
    expect(result.rows[1].rowIndex).toBe(3);
  });
});
