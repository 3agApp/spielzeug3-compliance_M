/**
 * triggerProductComplianceFinal.mjs
 * Full compliance batch analysis for RIVA Filter products
 * Knowledge base: compliance_DE_EU.txt + compliance_CH.txt (May 2026)
 */
import mysql from "mysql2/promise";

import * as fs from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const SUPPLIER_ID = 90001;

const RIVA_KNOWN_GAPS = `
BEKANNTE LÜCKEN BEI RIVA (Audit Mai 2026):
- KEINE VO (EG) 1935/2004 Konformitätserklärung
- KEINE KTW-W270 Konformitätsbescheinigungen
- KEINE UBA-Bewertungsgrundlagen-Nachweise
- KEIN DVGW-Zertifikat (W512, W270)
- KEIN SVGW-Zertifikat (CH)
- Von 8 verlinkten Laborzertifikaten: nur 1 echt akkreditiert (HygCen, rivaALVA-S Jova)
- 3 OEM-Datenblätter nicht an RIVA adressiert (Klasse 4 - unakzeptabel)
- OEM-Lieferkette: Aktivkohle=Carbonit, Membran=Ahlstrom Disruptor (USA)
- "Made in Germany" nur für Endmontage, nicht für wertbestimmende Materialien
- Problematische Werbeaussagen: 99,99% Viren, Krebs, Legionellen, EM-Keramik, "aus jeder Quelle"
- CE-Kennzeichnung: NICHT erforderlich und wäre UNZULÄSSIG für passive Filter
`;

const REGS_BY_CATEGORY = {
  drinking: [
    { code: "VO-1935-2004", name: "VO (EG) 1935/2004 Lebensmittelkontaktmaterialien", j: "eu" },
    { code: "VO-EU-10-2011", name: "VO (EU) 10/2011 Kunststoffe Lebensmittelkontakt", j: "eu" },
    { code: "KTW-W270", name: "TrinkwV §17 + KTW-BWGL + DVGW W270 Materialkonformität", j: "de" },
    { code: "DVGW-W512", name: "DVGW W512 / DIN EN 14652 Wasserfiltergeräte", j: "de" },
    { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 Allgemeine Produktsicherheit", j: "eu" },
    { code: "UWG-HWG", name: "UWG §5 / HWG §3 Werbeaussagen Gesundheitsbehauptungen", j: "de" },
    { code: "FCMV-CH", name: "FCMV SR 817.023.21 CH Lebensmittelkontaktmaterialien", j: "ch" },
    { code: "PrSG-LMG-CH", name: "PrSG SR 930.11 + LMG Art.26 CH Importeurpflichten", j: "ch" },
    { code: "UWG-CH", name: "UWG CH SR 241 Art.3 CH Werbeaussagen Täuschungsverbot", j: "ch" },
  ],
  shower: [
    { code: "VO-1935-2004", name: "VO (EG) 1935/2004 Lebensmittelkontaktmaterialien", j: "eu" },
    { code: "KTW-W270", name: "TrinkwV §17 + KTW-BWGL + DVGW W270 Materialkonformität", j: "de" },
    { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 Allgemeine Produktsicherheit", j: "eu" },
    { code: "UWG-HWG", name: "UWG §5 / HWG §3 Haut-Haar-Werbeaussagen", j: "de" },
    { code: "PrSG-LMG-CH", name: "PrSG SR 930.11 + LMG Art.26 CH Importeurpflichten", j: "ch" },
    { code: "UWG-CH", name: "UWG CH SR 241 CH Werbeaussagen", j: "ch" },
  ],
  outdoor: [
    { code: "VO-1935-2004", name: "VO (EG) 1935/2004 Lebensmittelkontaktmaterialien", j: "eu" },
    { code: "KTW-W270", name: "TrinkwV §17 + KTW-BWGL + DVGW W270 Materialkonformität", j: "de" },
    { code: "DVGW-W512", name: "DVGW W512 / DIN EN 14898 Biologische Verunreinigungen", j: "de" },
    { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 erhöhte Anforderungen Outdoor", j: "eu" },
    { code: "UWG-HWG", name: "UWG §5 / HWG §3 Werbeaussagen Mikrobiologie Outdoor", j: "de" },
    { code: "PrSG-LMG-CH", name: "PrSG SR 930.11 + LMG Art.26 CH Importeurpflichten", j: "ch" },
    { code: "UWG-CH", name: "UWG CH SR 241 CH Werbeaussagen", j: "ch" },
  ],
  cartridge: [
    { code: "VO-1935-2004", name: "VO (EG) 1935/2004 Lebensmittelkontaktmaterialien Kartusche", j: "eu" },
    { code: "KTW-W270", name: "TrinkwV §17 + KTW-BWGL + DVGW W270 Materialkonformität Kartusche", j: "de" },
    { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 Allgemeine Produktsicherheit", j: "eu" },
    { code: "PrSG-LMG-CH", name: "PrSG SR 930.11 CH Importeurpflichten", j: "ch" },
  ],
  pre_filter: [
    { code: "VO-1935-2004", name: "VO (EG) 1935/2004 Lebensmittelkontaktmaterialien Vorfilter", j: "eu" },
    { code: "KTW-W270", name: "TrinkwV §17 + KTW-BWGL Materialkonformität", j: "de" },
    { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 Allgemeine Produktsicherheit", j: "eu" },
    { code: "PrSG-LMG-CH", name: "PrSG SR 930.11 CH Importeurpflichten", j: "ch" },
  ],
  accessory: [
    { code: "GPSR-2023-988", name: "GPSR (EU) 2023/988 Allgemeine Produktsicherheit", j: "eu" },
    { code: "VO-1935-2004", name: "VO (EG) 1935/2004 falls wasserkontaktierend", j: "eu" },
    { code: "PrSG-LMG-CH", name: "PrSG SR 930.11 CH Importeurpflichten", j: "ch" },
  ],
};

function getCategory(name) {
  const n = name.toLowerCase();
  if (n.includes("ersatz") || n.includes("kartusch") || n.includes("refill")) return "cartridge";
  if (n.includes("dusch") || n.includes("shower") || n.includes("skin") || n.includes("hair") || n.includes("kalk slim")) return "shower";
  if (n.includes("outdoor") || n.includes("explorer") || n.includes("overland") || n.includes("camping")) return "outdoor";
  if (n.includes("vorfilter") || n.includes("pre-filter") || n.includes("sediment") || n.includes("hauswasser")) return "pre_filter";
  if (n.includes("adapter") || n.includes("schlauch") || n.includes("halter") || n.includes("montage")) return "accessory";
  return "drinking";
}

async function callLLM(messages) {
  const resp = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FORGE_API_KEY}` },
    body: JSON.stringify({ model: "gpt-4o", messages, max_tokens: 2000, temperature: 0.1 }),
  });
  if (!resp.ok) throw new Error(`LLM ${resp.status}: ${await resp.text().then(t => t.slice(0,100))}`);
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON: " + content.slice(0, 150));
  return JSON.parse(match[0]);
}

function buildPrompt(product, category) {
  const regs = REGS_BY_CATEGORY[category] || REGS_BY_CATEGORY.drinking;
  const regList = regs.map((r, i) => `${i+1}. [${r.code}] ${r.name} (${r.j.toUpperCase()})`).join("\n");
  return `Compliance-Experte Wasserfilter EU/DE/CH. Analysiere RIVA-Produkt.

PRODUKT: "${product.productName}" | Kategorie: ${category}

WICHTIG: Passive Wasserfilter sind NICHT CE-pflichtig. CE wäre UNZULÄSSIG.
Korrekte Anforderungen: VO 1935/2004 DoC, KTW-W270, DVGW W512.

BEKANNTE LÜCKEN RIVA:${RIVA_KNOWN_GAPS}

BELEGE-KLASSEN: 1=Akkreditiert Endprodukt, 2=Akkreditiert ähnlich/Vorlieferant-DoC, 3=Eigentest/OEM-Datenblatt, 4=Unakzeptabel(Brief an Dritten/Flyer)

REGULIERUNGEN FÜR DIESES PRODUKT:
${regList}

RISIKO-FLAGS prüfen: "99,99% Viren" bei >0,02µm, "Zertifiziert" ohne Stelle, "Wasservitalisierung", "PFAS" ohne Stoffliste, Krankheitsbezug, "Made in Germany" bei OEM, "aus jeder Quelle", "Gesünderes Wasser"

Antworte NUR mit JSON (Strings max 200 Zeichen):
{"overallScore":0-100,"euScore":0-100,"deScore":0-100,"chScore":0-100,"riskLevel":"critical|high|medium|low","overallAssessment":"2 Sätze","criticalIssues":["Issue"],"requiredDocuments":[{"document":"Name","regulation":"Rechtsgrundlage","priority":"urgent|high|medium"}],"riskFlags":["Flag"],"items":[{"regulationCode":"code","regulationName":"name","jurisdiction":"eu|de|ch","status":"fulfilled|partially_fulfilled|not_fulfilled|not_applicable|unclear","criticality":"critical|high|medium|low|info","evidenceClass":"1|2|3|4|none","finding":"Befund","evidence":"Belege","recommendation":"Empfehlung","legalRisk":"Risiko RIVA","chRisk":"Risiko spielzeug3 CH","documentRequired":"Dokument"}]}`;
}

const db = await mysql.createConnection(DATABASE_URL);
try {
  const [products] = await db.execute(
    "SELECT id, productName, brand FROM products WHERE supplierId = ? ORDER BY id",
    [SUPPLIER_ID]
  );
  console.log(`\n🚀 RIVA Compliance Batch (${products.length} products) – Wissensbasis DE/EU+CH Mai 2026\n`);

  let done = 0, skipped = 0, failed = 0;

  for (const product of products) {
    const [existing] = await db.execute(
      "SELECT id FROM product_compliance_checks WHERE productId = ? AND status = 'completed' LIMIT 1",
      [product.id]
    );
    if (existing.length > 0) { skipped++; process.stdout.write(`  ⏭ ${product.productName.slice(0,50)}\n`); continue; }

    const category = getCategory(product.productName);
    const [ins] = await db.execute(
      "INSERT INTO product_compliance_checks (productId, supplierId, status, tenantId, createdAt, updatedAt) VALUES (?, ?, 'running', 1, NOW(), NOW())",
      [product.id, SUPPLIER_ID]
    );
    const checkId = ins.insertId;

    try {
      process.stdout.write(`  🔍 [${done+skipped+1}/${products.length}] ${product.productName.slice(0,60)} (${category})\n`);
      const result = await callLLM([
        { role: "system", content: "Compliance-Experte Wasserfilter. Antworte nur mit validem JSON." },
        { role: "user", content: buildPrompt(product, category) }
      ]);

      await db.execute(
        `UPDATE product_compliance_checks SET status='completed',overallScore=?,euScore=?,deScore=?,chScore=?,riskLevel=?,criticalIssues=?,requiredDocuments=?,updatedAt=NOW() WHERE id=?`,
        [
          Math.min(100,Math.max(0,Number(result.overallScore)||35)),
          Math.min(100,Math.max(0,Number(result.euScore)||30)),
          Math.min(100,Math.max(0,Number(result.deScore)||35)),
          Math.min(100,Math.max(0,Number(result.chScore)||25)),
          String(result.riskLevel||"critical").slice(0,32),
          JSON.stringify(result.criticalIssues||[]),
          JSON.stringify(result.requiredDocuments||[]),
          checkId
        ]
      );

      for (const item of (result.items||[])) {
        await db.execute(
          `INSERT INTO product_compliance_items (checkId,productId,regulationCode,regulationName,jurisdiction,status,criticality,finding,evidence,recommendation,legalRisk,chRisk,documentRequired,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
          [checkId,product.id,
           String(item.regulationCode||"UNKNOWN").slice(0,64),
           String(item.regulationName||"Unknown").slice(0,255),
           String(item.jurisdiction||"eu").slice(0,10),
           String(item.status||"not_fulfilled").slice(0,32),
           String(item.criticality||"high").slice(0,32),
           String(item.finding||"").slice(0,1000),
           String(item.evidence||"").slice(0,1000),
           String(item.recommendation||"").slice(0,1000),
           String(item.legalRisk||"").slice(0,1000),
           String(item.chRisk||"").slice(0,1000),
           String(item.documentRequired||"").slice(0,255)]
        );
      }
      done++;
      process.stdout.write(`  ✓ Score:${result.overallScore}/100 Risk:${result.riskLevel} Items:${(result.items||[]).length}\n`);
    } catch(err) {
      await db.execute("UPDATE product_compliance_checks SET status='failed',updatedAt=NOW() WHERE id=?", [checkId]);
      failed++;
      process.stdout.write(`  ✗ FAIL ${product.productName.slice(0,40)}: ${err.message.slice(0,80)}\n`);
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`\n✅ Done: ${done} analysiert, ${skipped} übersprungen, ${failed} fehlgeschlagen`);
} finally {
  await db.end();
}
