/**
 * Improved batch compliance analysis using json_schema for reliable LLM responses
 */

import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/spielzeug3-compliance/.env" });

const DATABASE_URL = process.env.DATABASE_URL;
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const SUPPLIER_ID = 90001;

if (!DATABASE_URL || !FORGE_API_URL || !FORGE_API_KEY) {
  console.error("Missing env vars"); process.exit(1);
}

// ─── LLM call with json_schema ────────────────────────────────────────────────
async function invokeLLM(messages, schema) {
  const body = { messages, response_format: { type: "json_schema", json_schema: schema } };
  const res = await fetch(`${FORGE_API_URL.replace(/\/+$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${FORGE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

const SCHEMA = {
  name: "product_compliance",
  strict: true,
  schema: {
    type: "object",
    properties: {
      overallScore: { type: "integer" },
      euScore: { type: "integer" },
      deScore: { type: "integer" },
      chScore: { type: "integer" },
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
          },
          required: ["regulationCode", "regulationName", "jurisdiction", "status", "criticality", "finding", "evidence", "recommendation", "legalRisk", "chRisk", "documentRequired"],
          additionalProperties: false,
        },
      },
    },
    required: ["overallScore", "euScore", "deScore", "chScore", "riskLevel", "overallAssessment", "criticalIssues", "requiredDocuments", "items"],
    additionalProperties: false,
  },
};

function getCategory(name) {
  const n = name.toLowerCase();
  if (n.includes("dusch")) return "Duschfilter";
  if (n.includes("camping") || n.includes("outdoor") || n.includes("explorer") || n.includes("life safepro") || n.includes("pura")) return "Outdoor-Campingfilter";
  if (n.includes("ersatz") || n.includes("kartusch")) return "Ersatzkartusche";
  if (n.includes("adapter") || n.includes("anschluss") || n.includes("wasserhahn") || n.includes("eckventil") || n.includes("schlüssel") || n.includes("clean profi")) return "Zubehör";
  if (n.includes("vorfilter")) return "Vorfilter";
  if (n.includes("kalk")) return "Kalkfilter";
  if (n.includes("mex") || n.includes("pfas")) return "PFAS/Nanoplastik-Filter";
  if (n.includes("waschmaschine") || n.includes("geschirrspüler")) return "Haushaltsgeräte-Filter";
  return "Trinkwasserfilter";
}

const PDF_CONTEXT = `
Interne Prüfberichte zeigen:
- Keine CE-Kennzeichnung oder DoC auf der Website nachweisbar
- Keine DVGW W270/W291 Zertifikate öffentlich verfügbar
- Keine KTW-Leitlinie Konformitätserklärung
- Keine DVGW W512 Zertifizierung für Filtergehäuse
- Gesundheitsaussagen wie "gesünderes Wasser", "Legionellenschutz", "PFAS-Filterung" ohne akkreditierte Laborbelege
- "Made in Germany" Aussage ohne Nachweis
- Keine Biozid-Zulassung für Silberionen-Aktivkohle
- Keine Materialkonformitätserklärung nach VO (EG) 1935/2004
- Fehlende SVHC-Prüfung nach REACH
- Keine LUCID-Registrierung nachweisbar
- Für CH-Import: spielzeug3 AG trägt als Importeur Herstellerverantwortung
`;

const db = await createConnection(DATABASE_URL);

try {
  const [products] = await db.execute(
    "SELECT id, productName, brand, supplierArticleNumber FROM products WHERE supplierId = ? ORDER BY id",
    [SUPPLIER_ID]
  );

  console.log(`Found ${products.length} RIVA products`);
  let done = 0, failed = 0, skipped = 0;

  for (const product of products) {
    // Skip if already has completed check
    const [existing] = await db.execute(
      "SELECT id FROM product_compliance_checks WHERE productId = ? AND status = 'completed' LIMIT 1",
      [product.id]
    );
    if (existing.length > 0) { skipped++; continue; }

    const category = getCategory(product.productName);
    const isAccessory = category === "Zubehör";

    // Insert running check
    const [ins] = await db.execute(
      "INSERT INTO product_compliance_checks (productId, supplierId, status, tenantId, createdAt, updatedAt) VALUES (?, ?, 'running', 1, NOW(), NOW())",
      [product.id, SUPPLIER_ID]
    );
    const checkId = ins.insertId;

    try {
      console.log(`  🔍 [${done + 1}/${products.length - skipped}] ${product.productName} (${category})`);

      const systemPrompt = `You are a senior compliance expert for drinking water filters (Trinkwasserfilter) in EU, Germany, and Switzerland.
Analyze the product for compliance. Be concise but specific. For accessories (Zubehör), fewer regulations apply.`;

      const userPrompt = `Product: "${product.productName}" | Brand: ${product.brand ?? "RIVA Filter"} | Category: ${category}

Known compliance issues with RIVA Filter GmbH:
${PDF_CONTEXT}

Analyze this specific product against the most relevant regulations for its category.
For ${isAccessory ? "accessories (Zubehör), focus on CE, GPSR, PrSG, UWG only (4-6 items)" : "water filters, check all relevant regulations (8-12 items)"}.
Scores: 0-100 (100 = fully compliant). CH score = risk for Swiss importer spielzeug3 AG.`;

      const result = await invokeLLM(
        [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        SCHEMA
      );

      // Update check
      await db.execute(
        `UPDATE product_compliance_checks SET status='completed', overallScore=?, euScore=?, deScore=?, chScore=?, riskLevel=?, criticalIssues=?, requiredDocuments=?, updatedAt=NOW() WHERE id=?`,
        [result.overallScore, result.euScore, result.deScore, result.chScore, result.riskLevel,
         JSON.stringify(result.criticalIssues), JSON.stringify(result.requiredDocuments), checkId]
      );

      // Insert items
      for (const item of result.items) {
        await db.execute(
          `INSERT INTO product_compliance_items (checkId, productId, regulationCode, regulationName, jurisdiction, status, criticality, finding, evidence, recommendation, legalRisk, chRisk, documentRequired, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [checkId, product.id, item.regulationCode, item.regulationName, item.jurisdiction,
           item.status, item.criticality, item.finding, item.evidence, item.recommendation,
           item.legalRisk, item.chRisk, item.documentRequired]
        );
      }

      done++;
      console.log(`  ✓ Score: ${result.overallScore}/100 | Risk: ${result.riskLevel} | Items: ${result.items.length}`);
    } catch (e) {
      await db.execute("UPDATE product_compliance_checks SET status='failed', updatedAt=NOW() WHERE id=?", [checkId]);
      failed++;
      console.error(`  ✗ FAILED: ${product.productName}: ${e.message.slice(0, 80)}`);
    }

    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n✅ Done: ${done} analyzed, ${skipped} skipped, ${failed} failed`);
} finally {
  await db.end();
}
