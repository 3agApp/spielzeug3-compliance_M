/**
 * Triggers product compliance checks for all RIVA Filter products (supplierId=90001)
 * by calling the productComplianceCheck.triggerBatchForSupplier tRPC endpoint via HTTP.
 * 
 * This script inserts pending check records and then processes them sequentially
 * to avoid overwhelming the LLM API.
 */

import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

dotenv.config({ path: "/home/ubuntu/spielzeug3-compliance/.env" });

const DATABASE_URL = process.env.DATABASE_URL;
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const SUPPLIER_ID = 90001;

if (!DATABASE_URL || !FORGE_API_URL || !FORGE_API_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

// ─── LLM call ────────────────────────────────────────────────────────────────
async function invokeLLM(messages, jsonSchema) {
  const body = {
    messages,
    ...(jsonSchema ? { response_format: { type: "json_schema", json_schema: jsonSchema } } : {}),
  };
  const res = await fetch(`${FORGE_API_URL.replace(/\/+$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${FORGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── Trinkwasser-Regulierungen ────────────────────────────────────────────────
const WATER_FILTER_REGULATIONS = [
  // EU
  { code: "EU-BauPVO", name: "EU Construction Products Regulation (305/2011)", jurisdiction: "eu", criticality: "high" },
  { code: "EU-GPSR", name: "General Product Safety Regulation (2023/988)", jurisdiction: "eu", criticality: "critical" },
  { code: "EU-1935/2004", name: "Materials in contact with food/water (EC 1935/2004)", jurisdiction: "eu", criticality: "critical" },
  { code: "EU-10/2011", name: "Plastic materials in contact with food (EU 10/2011)", jurisdiction: "eu", criticality: "high" },
  { code: "EU-1924/2006", name: "Health Claims Regulation (EC 1924/2006)", jurisdiction: "eu", criticality: "high" },
  { code: "EU-98/83/EC", name: "Drinking Water Directive (98/83/EC / 2020/2184)", jurisdiction: "eu", criticality: "critical" },
  { code: "CE-Marking", name: "CE Marking & Declaration of Conformity", jurisdiction: "eu", criticality: "critical" },
  // DE
  { code: "TrinkwV-2023", name: "Trinkwasserverordnung 2023 (TrinkwV)", jurisdiction: "de", criticality: "critical" },
  { code: "DVGW-W270", name: "DVGW W270 – Mikrobiologische Prüfung", jurisdiction: "de", criticality: "critical" },
  { code: "DVGW-W291", name: "DVGW W291 – Reinigung/Desinfektion Trinkwasseranlagen", jurisdiction: "de", criticality: "high" },
  { code: "KTW-Leitlinie", name: "KTW-Leitlinie (Kunststoffe im Trinkwasserkontakt)", jurisdiction: "de", criticality: "critical" },
  { code: "DVGW-W512", name: "DVGW W512 – Wasserfilter für Hausinstallationen", jurisdiction: "de", criticality: "critical" },
  { code: "PrSG-DE", name: "Produktsicherheitsgesetz (PrSG) Deutschland", jurisdiction: "de", criticality: "high" },
  { code: "UWG-DE", name: "Gesetz gegen unlauteren Wettbewerb (UWG) – Werbeaussagen", jurisdiction: "de", criticality: "high" },
  { code: "LFGB-DE", name: "Lebensmittel- und Futtermittelgesetzbuch (LFGB §31)", jurisdiction: "de", criticality: "high" },
  { code: "BfR-Empfehlungen", name: "BfR-Empfehlungen für Kunststoffe im Lebensmittelkontakt", jurisdiction: "de", criticality: "high" },
  // CH
  { code: "TBDV-CH", name: "Trinkwasserverordnung CH (TBDV / SR 817.022.11)", jurisdiction: "ch", criticality: "critical" },
  { code: "LGV-CH", name: "Lebensmittel- und Gebrauchsgegenständeverordnung (LGV)", jurisdiction: "ch", criticality: "critical" },
  { code: "PrSV-CH", name: "Produktesicherheitsverordnung (PrSV) Schweiz", jurisdiction: "ch", criticality: "high" },
  { code: "BAG-CH", name: "BAG Anforderungen Trinkwasseraufbereitung Schweiz", jurisdiction: "ch", criticality: "critical" },
  { code: "VKGV-CH", name: "Verordnung über Gegenstände im Lebensmittelkontakt (VKGV)", jurisdiction: "ch", criticality: "high" },
  { code: "Importeur-CH", name: "Importeurpflichten CH (Inverkehrbringer-Verantwortung)", jurisdiction: "ch", criticality: "critical" },
];

// ─── Analyse a single product ─────────────────────────────────────────────────
async function analyzeProduct(product) {
  const productContext = `
Product: ${product.productName}
Brand: ${product.brand ?? "RIVA Filter"}
Category: ${product.category ?? "Water Filter"}
Supplier Article Number: ${product.supplierArticleNumber ?? "N/A"}
Image URL: ${product.imageUrl ?? "N/A"}

RIVA Filter GmbH is a German manufacturer of drinking water filters (Trinkwasserfilter).
Products include: under-sink filters, countertop filters, shower filters, camping filters, replacement cartridges, accessories.
The products are sold in Germany/EU and imported into Switzerland by spielzeug3 AG.

Known issues from internal compliance review:
- No CE marking or Declaration of Conformity visible on website
- No DVGW W270/W291 certificates publicly available
- No KTW-Leitlinie compliance documentation
- Health claims like "gesünderes Wasser" without scientific backing
- No DVGW W512 certification for filter housings
- Unclear compliance with EU 1935/2004 (food contact materials)
`;

  const systemPrompt = `You are a senior product compliance expert specializing in drinking water filters (Trinkwasserfilter) for the EU, German, and Swiss markets.
Analyze the given product against the provided regulations and return a structured compliance assessment.
Be specific about what is missing, what risks exist, and what documents are required.
For each regulation, assess the status based on publicly available information about RIVA Filter products.`;

  const regulationsJson = JSON.stringify(WATER_FILTER_REGULATIONS.map(r => ({
    code: r.code,
    name: r.name,
    jurisdiction: r.jurisdiction,
    criticality: r.criticality,
  })));

  const schema = {
    name: "product_compliance_result",
    strict: true,
    schema: {
      type: "object",
      properties: {
        overallScore: { type: "integer", description: "Overall compliance score 0-100" },
        euScore: { type: "integer", description: "EU compliance score 0-100" },
        deScore: { type: "integer", description: "DE compliance score 0-100" },
        chScore: { type: "integer", description: "CH compliance score 0-100 (risk for Swiss importer)" },
        riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
        overallAssessment: { type: "string" },
        criticalIssues: { type: "array", items: { type: "string" } },
        requiredDocuments: { type: "array", items: { type: "string" } },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              regulationCode: { type: "string" },
              regulationName: { type: "string" },
              jurisdiction: { type: "string", enum: ["eu", "de", "ch", "international"] },
              status: { type: "string", enum: ["fulfilled", "partially_fulfilled", "not_fulfilled", "not_applicable", "unclear"] },
              criticality: { type: "string", enum: ["critical", "high", "medium", "low", "info"] },
              finding: { type: "string" },
              evidence: { type: "string" },
              recommendation: { type: "string" },
              legalRisk: { type: "string" },
              chRisk: { type: "string" },
              documentRequired: { type: "string" },
              priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
            },
            required: ["regulationCode", "regulationName", "jurisdiction", "status", "criticality", "finding", "evidence", "recommendation", "legalRisk", "chRisk", "documentRequired", "priority"],
            additionalProperties: false,
          },
        },
      },
      required: ["overallScore", "euScore", "deScore", "chScore", "riskLevel", "overallAssessment", "criticalIssues", "requiredDocuments", "items"],
      additionalProperties: false,
    },
  };

  const content = await invokeLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Analyze this product against these regulations:\n\nProduct:\n${productContext}\n\nRegulations to check:\n${regulationsJson}` },
  ], schema);

  return JSON.parse(content);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const db = await createConnection(DATABASE_URL);

try {
  // Get all RIVA products
  const [products] = await db.execute(
    "SELECT id, productName, brand, supplierArticleNumber, imageUrl, categoryId FROM products WHERE supplierId = ? ORDER BY id LIMIT 75",
    [SUPPLIER_ID]
  );

  console.log(`Found ${products.length} RIVA products to analyze`);

  let done = 0;
  let failed = 0;

  for (const product of products) {
    // Check if already has a completed check
    const [existing] = await db.execute(
      "SELECT id FROM product_compliance_checks WHERE productId = ? AND status = 'completed' LIMIT 1",
      [product.id]
    );
    if (existing.length > 0) {
      console.log(`  ⏭ SKIP (already done): ${product.productName}`);
      done++;
      continue;
    }

    // Insert pending check
    const [ins] = await db.execute(
      "INSERT INTO product_compliance_checks (productId, supplierId, status, tenantId, createdAt, updatedAt) VALUES (?, ?, 'running', 1, NOW(), NOW())",
      [product.id, SUPPLIER_ID]
    );
    const checkId = ins.insertId;

    try {
      console.log(`  🔍 Analyzing: ${product.productName} [${product.brand}]`);
      const result = await analyzeProduct(product);

      // Update check with results
      await db.execute(
        `UPDATE product_compliance_checks SET 
          status = 'completed',
          overallScore = ?,
          euScore = ?,
          deScore = ?,
          chScore = ?,
          riskLevel = ?,
          criticalIssues = ?,
          requiredDocuments = ?,
          updatedAt = NOW()
        WHERE id = ?`,
        [
          result.overallScore,
          result.euScore,
          result.deScore,
          result.chScore,
          result.riskLevel,
          JSON.stringify(result.criticalIssues),
          JSON.stringify(result.requiredDocuments),
          checkId,
        ]
      );

      // Insert check items
      for (const item of result.items) {
        await db.execute(
          `INSERT INTO product_compliance_items 
            (checkId, productId, regulationCode, regulationName, jurisdiction, status, criticality, finding, evidence, recommendation, legalRisk, chRisk, documentRequired, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            checkId,
            product.id,
            item.regulationCode,
            item.regulationName,
            item.jurisdiction,
            item.status,
            item.criticality,
            item.finding,
            item.evidence,
            item.recommendation,
            item.legalRisk,
            item.chRisk,
            item.documentRequired,
          ]
        );
      }

      done++;
      console.log(`  ✓ Done: ${product.productName} – Score: ${result.overallScore}/100, Risk: ${result.riskLevel}`);
    } catch (e) {
      await db.execute(
        "UPDATE product_compliance_checks SET status = 'failed', updatedAt = NOW() WHERE id = ?",
        [checkId]
      );
      failed++;
      console.error(`  ✗ FAILED: ${product.productName}: ${e.message}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Batch complete: ${done} analyzed, ${failed} failed`);
} finally {
  await db.end();
}
