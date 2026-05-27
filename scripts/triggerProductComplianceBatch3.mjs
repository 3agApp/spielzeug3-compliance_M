/**
 * Compact batch compliance analysis - max 6 items per product, short prompts
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/spielzeug3-compliance/.env" });

const DATABASE_URL = process.env.DATABASE_URL;
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const SUPPLIER_ID = 90001;

async function callLLM(prompt) {
  const res = await fetch(`${FORGE_API_URL.replace(/\/+$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${FORGE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You are a compliance expert. Return ONLY valid compact JSON, no markdown, no extra text." },
        { role: "user", content: prompt }
      ],
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  const content = data.choices[0].message.content.trim();
  // Extract JSON if wrapped in markdown
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in response");
  return JSON.parse(match[0]);
}

function getCategory(name) {
  const n = name.toLowerCase();
  if (n.includes("dusch")) return "shower_filter";
  if (n.includes("camping") || n.includes("outdoor") || n.includes("explorer") || n.includes("safepro") || n.includes("pura")) return "outdoor_filter";
  if (n.includes("ersatz") || n.includes("kartusch")) return "replacement_cartridge";
  if (n.includes("adapter") || n.includes("anschluss") || n.includes("wasserhahn") || n.includes("eckventil") || n.includes("schlüssel") || n.includes("clean profi") || n.includes("camping anschluss")) return "accessory";
  if (n.includes("vorfilter")) return "pre_filter";
  if (n.includes("kalk")) return "scale_filter";
  if (n.includes("mex") || n.includes("pfas")) return "pfas_filter";
  if (n.includes("waschmaschine") || n.includes("geschirrspüler")) return "appliance_filter";
  return "drinking_water_filter";
}

// Key regulations per category
const REGS = {
  accessory: [
    { code: "EU-GPSR", name: "General Product Safety Regulation 2023/988", j: "eu", crit: "high" },
    { code: "CE-Marking", name: "CE Marking & Declaration of Conformity", j: "eu", crit: "high" },
    { code: "PrSG-DE", name: "Produktsicherheitsgesetz Deutschland", j: "de", crit: "medium" },
    { code: "PrSV-CH", name: "Produktesicherheitsverordnung Schweiz", j: "ch", crit: "high" },
  ],
  replacement_cartridge: [
    { code: "EU-1935/2004", name: "Food Contact Materials Regulation EC 1935/2004", j: "eu", crit: "critical" },
    { code: "EU-10/2011", name: "Plastic Food Contact Materials EU 10/2011", j: "eu", crit: "critical" },
    { code: "KTW-Leitlinie", name: "KTW-Leitlinie (Kunststoffe Trinkwasserkontakt)", j: "de", crit: "critical" },
    { code: "DVGW-W270", name: "DVGW W270 Mikrobiologische Prüfung", j: "de", crit: "critical" },
    { code: "TrinkwV-2023", name: "Trinkwasserverordnung 2023", j: "de", crit: "critical" },
    { code: "TBDV-CH", name: "Trinkwasserverordnung CH (TBDV)", j: "ch", crit: "critical" },
  ],
  default: [
    { code: "EU-GPSR", name: "General Product Safety Regulation 2023/988", j: "eu", crit: "critical" },
    { code: "EU-1935/2004", name: "Food Contact Materials EC 1935/2004", j: "eu", crit: "critical" },
    { code: "CE-Marking", name: "CE Marking & Declaration of Conformity", j: "eu", crit: "critical" },
    { code: "TrinkwV-2023", name: "Trinkwasserverordnung 2023 + DVGW W270/W512", j: "de", crit: "critical" },
    { code: "KTW-Leitlinie", name: "KTW-Leitlinie Kunststoffe", j: "de", crit: "critical" },
    { code: "TBDV-CH", name: "Trinkwasserverordnung CH + Importeurpflichten", j: "ch", crit: "critical" },
  ],
};

function getRegs(cat) {
  if (cat === "accessory") return REGS.accessory;
  if (cat === "replacement_cartridge") return REGS.replacement_cartridge;
  return REGS.default;
}

async function analyzeProduct(product) {
  const cat = getCategory(product.productName);
  const regs = getRegs(cat);

  const prompt = `Analyze RIVA Filter product for compliance. Return compact JSON only.

Product: "${product.productName}" | Category: ${cat} | Brand: ${product.brand ?? "RIVA Filter"}

Known issues: No CE/DoC visible, no DVGW W270/W512 certs, no KTW compliance, unproven health claims, no SVHC/REACH docs.

For each regulation below, assess status and provide brief finding (2 sentences max each):
${regs.map((r, i) => `${i + 1}. ${r.code} (${r.j}): ${r.name}`).join("\n")}

Return JSON:
{
  "overallScore": 30,
  "euScore": 25,
  "deScore": 30,
  "chScore": 20,
  "riskLevel": "critical",
  "overallAssessment": "2 sentence summary",
  "criticalIssues": ["issue1", "issue2"],
  "requiredDocuments": ["doc1", "doc2"],
  "items": [
    {"regulationCode":"EU-GPSR","regulationName":"...","jurisdiction":"eu","status":"not_fulfilled","criticality":"critical","finding":"...","evidence":"...","recommendation":"...","legalRisk":"...","chRisk":"...","documentRequired":"..."}
  ]
}`;

  return await callLLM(prompt);
}

const db = await createConnection(DATABASE_URL);
try {
  const [products] = await db.execute(
    "SELECT id, productName, brand, supplierArticleNumber FROM products WHERE supplierId = ? ORDER BY id",
    [SUPPLIER_ID]
  );

  console.log(`Found ${products.length} RIVA products`);
  let done = 0, failed = 0, skipped = 0;

  for (const product of products) {
    const [existing] = await db.execute(
      "SELECT id FROM product_compliance_checks WHERE productId = ? AND status = 'completed' LIMIT 1",
      [product.id]
    );
    if (existing.length > 0) { skipped++; continue; }

    const [ins] = await db.execute(
      "INSERT INTO product_compliance_checks (productId, supplierId, status, tenantId, createdAt, updatedAt) VALUES (?, ?, 'running', 1, NOW(), NOW())",
      [product.id, SUPPLIER_ID]
    );
    const checkId = ins.insertId;

    try {
      console.log(`  🔍 [${done + skipped + 1}/${products.length}] ${product.productName}`);
      const result = await analyzeProduct(product);

      await db.execute(
        `UPDATE product_compliance_checks SET status='completed', overallScore=?, euScore=?, deScore=?, chScore=?, riskLevel=?, criticalIssues=?, requiredDocuments=?, updatedAt=NOW() WHERE id=?`,
        [result.overallScore ?? 30, result.euScore ?? 25, result.deScore ?? 30, result.chScore ?? 20,
         result.riskLevel ?? "high", JSON.stringify(result.criticalIssues ?? []),
         JSON.stringify(result.requiredDocuments ?? []), checkId]
      );

      for (const item of (result.items ?? [])) {
        await db.execute(
          `INSERT INTO product_compliance_items (checkId, productId, regulationCode, regulationName, jurisdiction, status, criticality, finding, evidence, recommendation, legalRisk, chRisk, documentRequired, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [checkId, product.id,
           (item.regulationCode ?? "UNKNOWN").slice(0, 64),
           (item.regulationName ?? "Unknown").slice(0, 512),
           item.jurisdiction ?? "eu",
           item.status ?? "unclear",
           item.criticality ?? "medium",
           item.finding ?? "",
           item.evidence ?? "",
           item.recommendation ?? "",
           item.legalRisk ?? "",
           item.chRisk ?? "",
           (item.documentRequired ?? "").slice(0, 512)]
        );
      }

      done++;
      console.log(`  ✓ Score: ${result.overallScore}/100 | Risk: ${result.riskLevel} | Items: ${(result.items ?? []).length}`);
    } catch (e) {
      await db.execute("UPDATE product_compliance_checks SET status='failed', updatedAt=NOW() WHERE id=?", [checkId]);
      failed++;
      console.error(`  ✗ FAILED: ${product.productName}: ${e.message.slice(0, 100)}`);
    }

    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`\n✅ Batch complete: ${done} analyzed, ${skipped} skipped, ${failed} failed`);
} finally {
  await db.end();
}
