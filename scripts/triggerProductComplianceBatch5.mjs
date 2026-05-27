/**
 * FINAL corrected batch - very short prompts, max 3 items, no CE marking.
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
        { role: "system", content: "Return ONLY valid compact JSON. No markdown. No extra text. Keep all strings under 200 chars." },
        { role: "user", content: prompt }
      ],
      max_tokens: 1800,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  const content = data.choices[0].message.content.trim();
  // Try to extract JSON even if truncated
  const match = content.match(/\{[\s\S]*/);
  if (!match) throw new Error("No JSON found");
  let json = match[0];
  // If truncated, close open arrays/objects
  let opens = (json.match(/\[/g)||[]).length - (json.match(/\]/g)||[]).length;
  let openBraces = (json.match(/\{/g)||[]).length - (json.match(/\}/g)||[]).length;
  // Remove trailing incomplete item
  json = json.replace(/,\s*\{[^}]*$/, '');
  while (opens > 0) { json += ']'; opens--; }
  while (openBraces > 0) { json += '}'; openBraces--; }
  return JSON.parse(json);
}

function getCategory(name) {
  const n = name.toLowerCase();
  if (n.includes("dusch") || n.includes("yuna")) return "shower";
  if (n.includes("camping") || n.includes("outdoor") || n.includes("explorer") || n.includes("safepro") || n.includes("pura")) return "outdoor";
  if (n.includes("ersatz") || n.includes("kartusch")) return "cartridge";
  if (n.includes("adapter") || n.includes("anschluss") || n.includes("eckventil") || n.includes("schlüssel") || n.includes("clean profi")) return "accessory";
  if (n.includes("vorfilter")) return "pre_filter";
  return "drinking";
}

// 3 most critical regs per category (corrected - NO CE)
const REGS = {
  drinking: [
    { code: "VO-1935-2004", name: "VO (EG) 1935/2004 Food Contact Declaration", j: "eu" },
    { code: "TrinkwV-KTW-W270", name: "TrinkwV §17 + KTW-W270 Material Assessment", j: "de" },
    { code: "PrSG-CH", name: "PrSG CH Importer Responsibility (spielzeug3 AG)", j: "ch" },
  ],
  cartridge: [
    { code: "VO-1935-2004", name: "VO (EG) 1935/2004 Food Contact Declaration", j: "eu" },
    { code: "TrinkwV-KTW-W270", name: "TrinkwV §17 + KTW-W270 Material Assessment", j: "de" },
    { code: "Biozid-528-2012", name: "Biozid-VO (EU) 528/2012 (if silver/antimicrobial)", j: "eu" },
  ],
  shower: [
    { code: "UWG-HWG", name: "UWG §5 / HWG Health Claims (skin/hair)", j: "de" },
    { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 General Product Safety", j: "eu" },
    { code: "PrSG-CH", name: "PrSG CH Importer Responsibility", j: "ch" },
  ],
  outdoor: [
    { code: "VO-1935-2004", name: "VO (EG) 1935/2004 Food Contact Declaration", j: "eu" },
    { code: "UWG-HWG", name: "UWG §5 Performance Claims (bacteria/viruses)", j: "de" },
    { code: "PrSG-CH", name: "PrSG CH Importer Responsibility", j: "ch" },
  ],
  pre_filter: [
    { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 General Product Safety", j: "eu" },
    { code: "VO-1935-2004", name: "VO (EG) 1935/2004 Food Contact (if drinking water)", j: "eu" },
    { code: "PrSG-CH", name: "PrSG CH Importer Responsibility", j: "ch" },
  ],
  accessory: [
    { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 General Product Safety", j: "eu" },
    { code: "VO-1935-2004", name: "VO (EG) 1935/2004 (if water-contacting)", j: "eu" },
    { code: "PrSG-CH", name: "PrSG CH Importer Responsibility", j: "ch" },
  ],
};

async function analyzeProduct(product, cat) {
  const regs = REGS[cat] || REGS.drinking;
  const regStr = regs.map((r,i) => `${i+1}.[${r.code}]${r.name}(${r.j})`).join(" | ");
  
  const prompt = `RIVA Filter compliance check. Product:"${product.productName.slice(0,80)}" Cat:${cat}
Known gaps: No VO-1935/2004 declaration, no KTW-W270 certs, no DVGW W512, health claims without evidence, no SVGW.
NOTE: CE marking NOT required for passive water filters (no electrical/pressure components).
Regs: ${regStr}
Return JSON (all strings max 150 chars):
{"overallScore":35,"euScore":30,"deScore":35,"chScore":25,"riskLevel":"critical","items":[{"regulationCode":"VO-1935-2004","regulationName":"VO (EG) 1935/2004","jurisdiction":"eu","status":"not_fulfilled","criticality":"critical","finding":"short finding","evidence":"missing","recommendation":"request declaration","legalRisk":"short risk","chRisk":"short ch risk","documentRequired":"VO 1935/2004 Declaration"}]}`;

  return await callLLM(prompt);
}

const db = await createConnection(DATABASE_URL);
try {
  const [products] = await db.execute(
    "SELECT id, productName, brand FROM products WHERE supplierId = ? ORDER BY id",
    [SUPPLIER_ID]
  );

  console.log(`Found ${products.length} RIVA products`);
  let done = 0, failed = 0;

  for (const product of products) {
    const [existing] = await db.execute(
      "SELECT id FROM product_compliance_checks WHERE productId = ? AND status = 'completed' LIMIT 1",
      [product.id]
    );
    if (existing.length > 0) { console.log(`  ⏭ Skip: ${product.productName}`); continue; }

    const cat = getCategory(product.productName);

    const [ins] = await db.execute(
      "INSERT INTO product_compliance_checks (productId, supplierId, status, tenantId, createdAt, updatedAt) VALUES (?, ?, 'running', 1, NOW(), NOW())",
      [product.id, SUPPLIER_ID]
    );
    const checkId = ins.insertId;

    try {
      console.log(`  🔍 [${done+1}/${products.length}] ${product.productName.slice(0,60)} (${cat})`);
      const result = await analyzeProduct(product, cat);

      await db.execute(
        `UPDATE product_compliance_checks SET status='completed', overallScore=?, euScore=?, deScore=?, chScore=?, riskLevel=?, criticalIssues=?, requiredDocuments=?, updatedAt=NOW() WHERE id=?`,
        [result.overallScore ?? 35, result.euScore ?? 30, result.deScore ?? 35, result.chScore ?? 25,
         result.riskLevel ?? "critical", JSON.stringify([]), JSON.stringify([]), checkId]
      );

      for (const item of (result.items ?? [])) {
        await db.execute(
          `INSERT INTO product_compliance_items (checkId, productId, regulationCode, regulationName, jurisdiction, status, criticality, finding, evidence, recommendation, legalRisk, chRisk, documentRequired, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [checkId, product.id,
           String(item.regulationCode ?? "UNKNOWN").slice(0, 64),
           String(item.regulationName ?? "Unknown").slice(0, 255),
           String(item.jurisdiction ?? "eu").slice(0, 10),
           String(item.status ?? "not_fulfilled").slice(0, 32),
           String(item.criticality ?? "high").slice(0, 32),
           String(item.finding ?? "").slice(0, 1000),
           String(item.evidence ?? "").slice(0, 1000),
           String(item.recommendation ?? "").slice(0, 1000),
           String(item.legalRisk ?? "").slice(0, 1000),
           String(item.chRisk ?? "").slice(0, 1000),
           String(item.documentRequired ?? "").slice(0, 255)]
        );
      }

      done++;
      console.log(`  ✓ Score:${result.overallScore}/100 Risk:${result.riskLevel} Items:${(result.items??[]).length}`);
    } catch (e) {
      await db.execute("UPDATE product_compliance_checks SET status='failed', updatedAt=NOW() WHERE id=?", [checkId]);
      failed++;
      console.error(`  ✗ FAIL: ${product.productName.slice(0,40)}: ${e.message.slice(0,80)}`);
    }

    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`\n✅ Done: ${done} analyzed, ${failed} failed`);
} finally {
  await db.end();
}
