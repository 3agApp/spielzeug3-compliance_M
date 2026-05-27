/**
 * CORRECTED batch compliance analysis for RIVA Filter passive water filters.
 * 
 * KEY CORRECTION: CE marking is NOT required for passive water filters.
 * (No electrical components, no pressure vessels above threshold, no moving parts.)
 * CE would only apply to UV-lamp or electrically-pumped RO systems.
 * 
 * Correct regulatory framework for passive drinking water filters (EU/DE/CH):
 * - VO (EG) 1935/2004 – Food contact materials (declaration required, NOT CE)
 * - VO (EU) 10/2011 – Plastic food contact materials (migration tests)
 * - EU Drinking Water Directive 2020/2184 (transitional from 2023)
 * - GPSR (EU) 2023/988 – General product safety (risk assessment, no CE required)
 * - TrinkwV 2023 §17 + KTW-W270 – German drinking water regulation
 * - DVGW W512 / DIN EN 14652 – Filter device standard
 * - DVGW W270 – Microbiological material testing
 * - UWG §5 / HWG – Misleading advertising prohibition
 * - LFGB §31 – Food law (consumer goods in contact with food/water)
 * - REACH VO (EG) 1907/2006 – SVHC substances in filter media
 * - Biozid-VO (EU) 528/2012 – If silver ions or biocidal effect claimed
 * - LMG / TBDV CH – Swiss food law + drinking water ordinance
 * - PrSG CH – Swiss product safety (importer responsibility)
 * - SVGW – Swiss equivalent of DVGW certification
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
        { role: "system", content: "You are a compliance expert for drinking water filters. Return ONLY valid compact JSON, no markdown, no extra text. Be concise." },
        { role: "user", content: prompt }
      ],
      max_tokens: 2500,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  const content = data.choices[0].message.content.trim();
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in response");
  return JSON.parse(match[0]);
}

function getCategory(name) {
  const n = name.toLowerCase();
  if (n.includes("dusch")) return "shower_filter";
  if (n.includes("camping") || n.includes("outdoor") || n.includes("explorer") || n.includes("safepro") || n.includes("pura") || n.includes("trinkflasche")) return "outdoor_camping_filter";
  if (n.includes("ersatz") || n.includes("kartusch")) return "replacement_cartridge";
  if (n.includes("adapter") || n.includes("anschluss") || n.includes("wasserhahn") || n.includes("eckventil") || n.includes("schlüssel") || n.includes("clean profi")) return "accessory";
  if (n.includes("vorfilter")) return "pre_filter";
  if (n.includes("kalk") && !n.includes("trink")) return "scale_filter";
  if (n.includes("mex") || n.includes("pfas") || n.includes("nano")) return "pfas_nano_filter";
  if (n.includes("waschmaschine") || n.includes("geschirrspüler")) return "appliance_filter";
  return "drinking_water_filter";
}

// Corrected regulations per category
const REGS_DRINKING = [
  { code: "VO-1935-2004", name: "VO (EG) 1935/2004 – Food Contact Materials Declaration", j: "eu", crit: "critical",
    note: "Declaration of conformity required (NOT CE marking). All water-contacting materials must be declared." },
  { code: "VO-10-2011", name: "VO (EU) 10/2011 – Plastic Food Contact Materials", j: "eu", crit: "critical",
    note: "Migration tests required for plastics. Overall migration ≤10 mg/dm². Specific migration limits apply." },
  { code: "DWD-2020-2184", name: "EU Drinking Water Directive 2020/2184 (transitional from Jan 2023)", j: "eu", crit: "high",
    note: "New EU-wide conformity assessment for materials in contact with drinking water. Transitional period ongoing." },
  { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 – General Product Safety Regulation", j: "eu", crit: "high",
    note: "Risk assessment, instruction manual, manufacturer contact required. NO CE marking required for passive filters." },
  { code: "TrinkwV-KTW-W270", name: "TrinkwV 2023 §17 + KTW-W270 Material Assessment", j: "de", crit: "critical",
    note: "All materials in contact with drinking water must be assessed per KTW guidelines and DVGW W270 microbiological test." },
  { code: "DVGW-W512", name: "DVGW W512 / DIN EN 14652 – Water Filter Devices", j: "de", crit: "critical",
    note: "Technical standard for drinking water filter devices. DVGW certification is the gold standard." },
  { code: "UWG-HWG", name: "UWG §5 / HWG – Advertising Claims Prohibition", j: "de", crit: "high",
    note: "Health claims (cancer, neurodermatitis, Legionella protection) require scientific evidence. EFSA approval needed for health claims." },
  { code: "TBDV-LMG-CH", name: "TBDV / LMG CH – Swiss Drinking Water + Food Law", j: "ch", crit: "critical",
    note: "Water filters = consumer goods under Swiss food law. Material conformity required (analogous to KTW/VO 10/2011)." },
  { code: "PrSG-Importeur-CH", name: "PrSG CH – Importer Responsibility (spielzeug3 AG)", j: "ch", crit: "critical",
    note: "As Swiss importer, spielzeug3 AG bears manufacturer responsibility. Safety evidence must be on file before import." },
];

const REGS_CARTRIDGE = [
  { code: "VO-1935-2004", name: "VO (EG) 1935/2004 – Food Contact Materials Declaration", j: "eu", crit: "critical",
    note: "Declaration of conformity required for all filter media and housing materials." },
  { code: "VO-10-2011", name: "VO (EU) 10/2011 – Plastic Food Contact Materials", j: "eu", crit: "critical",
    note: "Migration tests for plastic cartridge housing and filter media." },
  { code: "TrinkwV-KTW-W270", name: "TrinkwV 2023 §17 + KTW-W270 Material Assessment", j: "de", crit: "critical",
    note: "Replacement cartridges must meet KTW guidelines for all water-contacting materials." },
  { code: "REACH-SVHC", name: "REACH VO (EG) 1907/2006 – SVHC in Filter Media", j: "eu", crit: "high",
    note: "Activated carbon, ion exchange resins, silver-impregnated media must be SVHC-checked." },
  { code: "Biozid-528-2012", name: "Biozid-VO (EU) 528/2012 – Silver Ions / Biocidal Claims", j: "eu", crit: "high",
    note: "If silver ions or antimicrobial properties are claimed, biocidal product authorisation required." },
  { code: "TBDV-LMG-CH", name: "TBDV / LMG CH – Swiss Drinking Water + Food Law", j: "ch", crit: "critical",
    note: "Replacement cartridges must comply with Swiss food contact material requirements." },
];

const REGS_SHOWER = [
  { code: "VO-1935-2004", name: "VO (EG) 1935/2004 – Food Contact Materials (if drinking use claimed)", j: "eu", crit: "high",
    note: "If product is marketed for drinking water use, full food contact declaration required." },
  { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 – General Product Safety", j: "eu", crit: "high",
    note: "Risk assessment and safety instructions required. No CE needed for passive shower filters." },
  { code: "UWG-HWG", name: "UWG §5 / HWG – Health Claims (skin, hair, eczema)", j: "de", crit: "critical",
    note: "Claims about skin improvement, eczema, hair quality require scientific evidence. HWG §11 prohibits fear-based advertising." },
  { code: "TrinkwV-KTW-W270", name: "TrinkwV 2023 §17 + KTW-W270 (if drinking use)", j: "de", crit: "medium",
    note: "If shower filter also filters drinking water, full KTW assessment required." },
  { code: "PrSG-Importeur-CH", name: "PrSG CH – Importer Responsibility", j: "ch", crit: "high",
    note: "spielzeug3 AG bears importer responsibility. Safety documentation must be available." },
];

const REGS_OUTDOOR = [
  { code: "VO-1935-2004", name: "VO (EG) 1935/2004 – Food Contact Materials Declaration", j: "eu", crit: "critical",
    note: "Emergency water purification devices have highest requirements for food contact materials." },
  { code: "TrinkwV-KTW-W270", name: "TrinkwV 2023 §17 + KTW-W270 Material Assessment", j: "de", crit: "critical",
    note: "All materials must be KTW-assessed. Emergency filters must not leach harmful substances." },
  { code: "DVGW-W270", name: "DVGW W270 – Microbiological Material Testing", j: "de", crit: "critical",
    note: "Microbiological growth on filter materials must be tested. Critical for outdoor/emergency use." },
  { code: "UWG-HWG", name: "UWG §5 / HWG – Performance Claims (bacteria, viruses, parasites)", j: "de", crit: "critical",
    note: "Claims about removing bacteria, viruses, Giardia, Cryptosporidium require accredited lab tests (NSF P231 or equivalent)." },
  { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 – General Product Safety", j: "eu", crit: "high",
    note: "Risk assessment mandatory. Emergency use context requires highest safety documentation." },
  { code: "PrSG-Importeur-CH", name: "PrSG CH – Importer Responsibility", j: "ch", crit: "critical",
    note: "Emergency water filters: spielzeug3 AG must have full safety evidence before import." },
];

const REGS_ACCESSORY = [
  { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 – General Product Safety", j: "eu", crit: "medium",
    note: "Basic safety requirements apply. Risk assessment and manufacturer contact required." },
  { code: "VO-1935-2004", name: "VO (EG) 1935/2004 – Food Contact (if water-contacting)", j: "eu", crit: "medium",
    note: "If accessory contacts drinking water (e.g. hose fittings), food contact declaration required." },
  { code: "PrSG-Importeur-CH", name: "PrSG CH – Importer Responsibility", j: "ch", crit: "medium",
    note: "Basic product safety documentation required for Swiss import." },
];

function getRegs(cat) {
  if (cat === "replacement_cartridge") return REGS_CARTRIDGE;
  if (cat === "shower_filter") return REGS_SHOWER;
  if (cat === "outdoor_camping_filter") return REGS_OUTDOOR;
  if (cat === "accessory") return REGS_ACCESSORY;
  return REGS_DRINKING; // default for all water filters
}

const KNOWN_ISSUES = `Known compliance gaps at RIVA Filter GmbH (from internal review):
- No VO (EG) 1935/2004 declaration of conformity publicly available
- No KTW-W270 material assessment certificates available
- No DVGW W512 certification for filter housings
- No DVGW W270 microbiological test reports available
- Health claims ("gesünderes Wasser", "Legionellenschutz", "PFAS removal") without accredited lab evidence
- "Made in Germany" claim without verifiable proof
- Silver-impregnated activated carbon used without Biozid-VO authorisation
- No SVHC/REACH documentation for filter media
- No SVGW certification for Swiss market
- For spielzeug3 AG: no safety evidence on file → importer liability risk`;

async function analyzeProduct(product, cat, regs) {
  const regList = regs.map((r, i) => `${i+1}. [${r.code}] ${r.name} (${r.j.toUpperCase()}, ${r.crit}): ${r.note}`).join("\n");
  
  const prompt = `Analyze RIVA Filter product for regulatory compliance. Return compact JSON only.

Product: "${product.productName}" | Category: ${cat} | Brand: ${product.brand ?? "RIVA Filter"}

${KNOWN_ISSUES}

IMPORTANT: CE marking is NOT required for passive water filters without electrical components.
The correct framework is VO (EG) 1935/2004 + KTW-W270 + DVGW W512 (not CE).

Regulations to check for this product category:
${regList}

Return JSON (scores 0-100, 100=fully compliant):
{
  "overallScore": 35,
  "euScore": 30,
  "deScore": 35,
  "chScore": 25,
  "riskLevel": "critical",
  "overallAssessment": "2-sentence summary specific to this product",
  "criticalIssues": ["issue1", "issue2"],
  "requiredDocuments": ["doc1", "doc2"],
  "items": [
    {
      "regulationCode": "VO-1935-2004",
      "regulationName": "VO (EG) 1935/2004 – Food Contact Materials",
      "jurisdiction": "eu",
      "status": "not_fulfilled",
      "criticality": "critical",
      "finding": "Product-specific finding (1-2 sentences)",
      "evidence": "What evidence exists or is missing",
      "recommendation": "Specific action required",
      "legalRisk": "Legal risk for RIVA (DE/EU)",
      "chRisk": "Risk for spielzeug3 AG as Swiss importer",
      "documentRequired": "Exact document name to request"
    }
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

  console.log(`Found ${products.length} RIVA products to analyze (corrected regulations)`);
  let done = 0, failed = 0, skipped = 0;

  for (const product of products) {
    const [existing] = await db.execute(
      "SELECT id FROM product_compliance_checks WHERE productId = ? AND status = 'completed' LIMIT 1",
      [product.id]
    );
    if (existing.length > 0) { skipped++; continue; }

    const cat = getCategory(product.productName);
    const regs = getRegs(cat);

    const [ins] = await db.execute(
      "INSERT INTO product_compliance_checks (productId, supplierId, status, tenantId, createdAt, updatedAt) VALUES (?, ?, 'running', 1, NOW(), NOW())",
      [product.id, SUPPLIER_ID]
    );
    const checkId = ins.insertId;

    try {
      console.log(`  🔍 [${done + skipped + 1}/${products.length}] ${product.productName} (${cat})`);
      const result = await analyzeProduct(product, cat, regs);

      await db.execute(
        `UPDATE product_compliance_checks SET status='completed', overallScore=?, euScore=?, deScore=?, chScore=?, riskLevel=?, criticalIssues=?, requiredDocuments=?, updatedAt=NOW() WHERE id=?`,
        [result.overallScore ?? 35, result.euScore ?? 30, result.deScore ?? 35, result.chScore ?? 25,
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
           (item.finding ?? "").slice(0, 2000),
           (item.evidence ?? "").slice(0, 2000),
           (item.recommendation ?? "").slice(0, 2000),
           (item.legalRisk ?? "").slice(0, 2000),
           (item.chRisk ?? "").slice(0, 2000),
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

    await new Promise(r => setTimeout(r, 700));
  }

  console.log(`\n✅ Batch complete: ${done} analyzed, ${skipped} skipped, ${failed} failed`);
} finally {
  await db.end();
}
