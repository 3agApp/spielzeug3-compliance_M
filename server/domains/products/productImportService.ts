/**
 * Product Import Service
 * Parses CSV / XLSX files and bulk-creates products for a given supplier.
 *
 * Supported column names (case-insensitive, trimmed):
 *   Artnr / artnr / internal_article_no  → internalArticleNumber  (our internal ID)
 *   Wg1 / wg1 / kontor_id               → kontorId               (ERP / Kontor reference)
 *   Bez1 / bez1 / product_name / name   → productName
 *   Bestellnr / bestellnr / supplier_article_no → supplierArticleNumber (manufacturer's art. no.)
 *   Artean / artean / ean               → ean
 *   Name / name / brand / hersteller    → brand
 *   Ursprungsland / ursprungsland / country_of_origin → countryOfOrigin
 *   Zolltarifnr_ch / zolltarifnr / customs_tariff → customsTariffNumber
 *   HerstellerId / herstellerid         → (ignored – internal ERP field)
 */

import * as XLSX from "xlsx";
import { getDb } from "../../db";
import { products } from "../../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { requireRole, type UserContext } from "../../shared/tenantGuard";

// ─── Column mapping ───────────────────────────────────────────────────────────

const COLUMN_MAP: Record<string, string> = {
  artnr: "internalArticleNumber",
  internal_article_no: "internalArticleNumber",
  internalarticleno: "internalArticleNumber",
  wg1: "kontorId",
  kontor_id: "kontorId",
  kontorid: "kontorId",
  bez1: "productName",
  product_name: "productName",
  productname: "productName",
  bezeichnung: "productName",
  bestellnr: "supplierArticleNumber",
  supplier_article_no: "supplierArticleNumber",
  supplierarticleno: "supplierArticleNumber",
  artean: "ean",
  ean: "ean",
  name: "brand",
  brand: "brand",
  hersteller: "brand",
  ursprungsland: "countryOfOrigin",
  country_of_origin: "countryOfOrigin",
  countryoforigin: "countryOfOrigin",
  zolltarifnr_ch: "customsTariffNumber",
  zolltarifnr: "customsTariffNumber",
  customs_tariff: "customsTariffNumber",
  customstariff: "customsTariffNumber",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportRow {
  rowIndex: number;
  internalArticleNumber?: string;
  supplierArticleNumber?: string;
  productName?: string;
  ean?: string;
  brand?: string;
  kontorId?: string;
  countryOfOrigin?: string;
  customsTariffNumber?: string;
}

export interface ImportPreviewResult {
  rows: ImportRow[];
  columnMapping: Record<string, string>; // detected header → field name
  totalRows: number;
  validRows: number;
  skippedRows: number;
  warnings: string[];
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[\s_\-\.]+/g, "").trim();
}

export function parseImportBuffer(
  buffer: Buffer,
  mimeType: string
): { rows: ImportRow[]; columnMapping: Record<string, string>; warnings: string[] } {
  const warnings: string[] = [];

  // Parse workbook (xlsx handles both .xlsx and .csv)
  const workbook = XLSX.read(buffer, { type: "buffer", cellText: true, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Empty workbook – no sheets found.");
  const sheet = workbook.Sheets[sheetName];

  // Convert to array of arrays (raw values)
  const rawRows: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];

  if (rawRows.length < 2) {
    throw new Error("File contains no data rows (at least a header row and one data row required).");
  }

  // Detect header row (first row with at least 2 non-empty cells)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const nonEmpty = rawRows[i].filter((c) => c && String(c).trim()).length;
    if (nonEmpty >= 2) { headerRowIdx = i; break; }
  }

  const headerRow = rawRows[headerRowIdx];
  const columnMapping: Record<string, string> = {};
  const colIndexToField: Record<number, string> = {};

  headerRow.forEach((header, idx) => {
    const raw = String(header ?? "").trim();
    if (!raw) return;
    const normalized = normalizeKey(raw);
    const field = COLUMN_MAP[normalized];
    if (field) {
      columnMapping[raw] = field;
      colIndexToField[idx] = field;
    }
  });

  if (!columnMapping[Object.keys(columnMapping).find((k) => columnMapping[k] === "productName") ?? ""]) {
    // Try to find any column that maps to productName
    const hasProductName = Object.values(columnMapping).includes("productName");
    if (!hasProductName) {
      warnings.push(
        "No 'productName' column detected. Please ensure a column named 'Bez1', 'product_name', or 'Bezeichnung' exists."
      );
    }
  }

  const rows: ImportRow[] = [];

  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const rawRow = rawRows[r];
    const row: ImportRow = { rowIndex: r + 1 };

    Object.entries(colIndexToField).forEach(([colIdx, field]) => {
      const val = String(rawRow[Number(colIdx)] ?? "").trim();
      if (val) (row as any)[field] = val;
    });

    // Skip completely empty rows
    const hasContent = Object.keys(row).filter((k) => k !== "rowIndex").length > 0;
    if (!hasContent) continue;

    rows.push(row);
  }

  return { rows, columnMapping, warnings };
}

// ─── Preview (no DB writes) ───────────────────────────────────────────────────

export function previewImport(
  buffer: Buffer,
  mimeType: string
): ImportPreviewResult {
  const { rows, columnMapping, warnings } = parseImportBuffer(buffer, mimeType);

  const validRows = rows.filter((r) => r.productName || r.internalArticleNumber);
  const skippedRows = rows.length - validRows.length;

  if (skippedRows > 0) {
    warnings.push(
      `${skippedRows} row(s) skipped because both 'productName' and 'internalArticleNumber' are empty.`
    );
  }

  return {
    rows: validRows.slice(0, 200), // cap preview at 200 rows
    columnMapping,
    totalRows: rows.length,
    validRows: validRows.length,
    skippedRows,
    warnings,
  };
}

// ─── Actual import (DB writes) ────────────────────────────────────────────────

export const productImportService = {
  async importFromBuffer(
    user: UserContext,
    supplierId: number,
    buffer: Buffer,
    mimeType: string,
    options: {
      updateExisting?: boolean; // default: false – skip duplicates
      defaultBrand?: string;    // fallback brand if not in file
    } = {}
  ): Promise<ImportResult> {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin"]);

    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const { rows } = parseImportBuffer(buffer, mimeType);
    const tenantId = user.tenantId ?? 1;

    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      // Must have at least a name or internal article number
      if (!row.productName && !row.internalArticleNumber) {
        result.skipped++;
        continue;
      }

      const productName = row.productName ?? row.internalArticleNumber ?? "Unknown";
      const brand = row.brand || options.defaultBrand || undefined;

      try {
        // Check for existing product by internalArticleNumber within this tenant+supplier
        let existing: { id: number } | undefined;
        if (row.internalArticleNumber) {
          const [found] = await db
            .select({ id: products.id })
            .from(products)
            .where(
              and(
                eq(products.tenantId, tenantId),
                eq(products.supplierId, supplierId),
                eq(products.internalArticleNumber, row.internalArticleNumber)
              )
            )
            .limit(1);
          existing = found;
        }

        if (existing) {
          if (options.updateExisting) {
            await db
              .update(products)
              .set({
                productName,
                supplierArticleNumber: row.supplierArticleNumber ?? undefined,
                ean: row.ean ?? undefined,
                brand: brand ?? undefined,
                kontorId: row.kontorId ?? undefined,
                countryOfOrigin: row.countryOfOrigin ?? undefined,
                customsTariffNumber: row.customsTariffNumber ?? undefined,
              })
              .where(eq(products.id, existing.id));
            result.updated++;
          } else {
            result.skipped++;
          }
        } else {
          await db.insert(products).values({
            productName,
            supplierId,
            tenantId,
            internalArticleNumber: row.internalArticleNumber ?? undefined,
            supplierArticleNumber: row.supplierArticleNumber ?? undefined,
            ean: row.ean ?? undefined,
            brand: brand ?? undefined,
            kontorId: row.kontorId ?? undefined,
            countryOfOrigin: row.countryOfOrigin ?? undefined,
            customsTariffNumber: row.customsTariffNumber ?? undefined,
            status: "open",
          });
          result.created++;
        }
      } catch (err: any) {
        result.errors.push({ row: row.rowIndex, reason: err?.message ?? "Unknown error" });
      }
    }

    return result;
  },
};
