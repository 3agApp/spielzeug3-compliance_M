/**
 * scripts/triggerRivaCheck.mjs
 * Triggers the compliance check for RIVA Filter GmbH (ID: 90001)
 * by calling the same logic as the tRPC router.
 */

import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!DATABASE_URL) { console.error("DATABASE_URL missing"); process.exit(1); }
if (!FORGE_API_URL) { console.error("BUILT_IN_FORGE_API_URL missing"); process.exit(1); }
if (!FORGE_API_KEY) { console.error("BUILT_IN_FORGE_API_KEY missing"); process.exit(1); }

const SUPPLIER_ID = 90001;
const WEBSITE_URL = "https://www.riva-filter.de";

// ─── Fetch website ────────────────────────────────────────────────────────────
async function fetchWebsiteText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ComplianceBot/1.0; +https://spielzeug3.ch)",
      Accept: "text/html,application/xhtml+xml,*/*",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return text.slice(0, 12_000);
}

// ─── Also fetch subpages ──────────────────────────────────────────────────────
async function fetchAdditionalPages() {
  const pages = [
    "https://www.riva-filter.de/produkte/",
    "https://www.riva-filter.de/impressum/",
    "https://www.riva-filter.de/datenschutz/",
    "https://www.riva-filter.de/zertifikate/",
    "https://www.riva-filter.de/downloads/",
  ];
  const texts = [];
  for (const page of pages) {
    try {
      const t = await fetchWebsiteText(page);
      texts.push(`\n\n[PAGE: ${page}]\n${t.slice(0, 2000)}`);
      console.log(`  ✓ Fetched: ${page}`);
    } catch (e) {
      console.log(`  ✗ Failed: ${page} – ${e.message}`);
    }
  }
  return texts.join("");
}

// ─── Build prompt ─────────────────────────────────────────────────────────────
function buildPrompt(websiteText) {
  const today = new Date().toISOString().split("T")[0];
  return `Du bist ein Experte für Produktsicherheit, CE-Kennzeichnung und Regulatorik (EU, Deutschland, Schweiz).

Analysiere den folgenden Webseiteninhalt des Herstellers "RIVA Filter GmbH" (https://www.riva-filter.de) auf Compliance.
RIVA Filter stellt Wasserfilter, Filterpatronen und Wasseraufbereitungsprodukte her.

WEBSEITENINHALT:
---
${websiteText}
---

Erstelle eine strukturierte Compliance-Analyse als JSON-Objekt. Antworte NUR mit dem JSON-Objekt.

{
  "companyName": "RIVA Filter GmbH",
  "websiteUrl": "https://www.riva-filter.de",
  "analysisDate": "${today}",
  "productCategories": ["Wasserfilter", "Filterpatronen", "Wasseraufbereitung"],
  "overallAssessment": "Gesamtbewertung (3-4 Sätze auf Deutsch)",
  "summaryDE": "Zusammenfassung für Hersteller (DE/EU-Recht) auf Deutsch",
  "summaryEN": "Summary for us as CH retailer (CH law) in English",
  "criticalFindings": ["Kritischer Befund 1", ...],
  "positiveFindings": ["Positiver Befund 1", ...],
  "scores": {
    "overall": 0,
    "eu": 0,
    "de": 0,
    "ch": 0
  },
  "items": [
    {
      "regulationCode": "GPSR",
      "regulationName": "EU General Product Safety Regulation 2023/988",
      "jurisdiction": "eu",
      "status": "fulfilled|partially_fulfilled|not_fulfilled|not_applicable|unclear",
      "criticality": "critical|high|medium|low|info",
      "finding": "Befund",
      "evidence": "Belege aus dem Webseiteninhalt",
      "recommendation": "Handlungsempfehlung",
      "legalRisk": "Rechtliches Risiko für RIVA als Hersteller (DE/EU-Recht)",
      "chRisk": "Rechtliches Risiko für spielzeug3 AG als CH-Importeur (PrSG, OR, USG)"
    }
  ]
}

Prüfe ALLE folgenden Regulierungen:

EU/DE (für RIVA als Hersteller):
1. GPSR – EU General Product Safety Regulation 2023/988 (ab Dez 2024 gültig)
2. CE – CE-Kennzeichnung, Konformitätserklärung (DoC), technische Dokumentation
3. REACH – Verordnung (EG) Nr. 1907/2006 (Schadstoffe in Filtermedien, Kunststoffe)
4. TrinkwV – Trinkwasserverordnung 2023 (KTW-Leitlinie, DVGW W 270, W 291, Prüfberichte)
5. DVGW – DVGW-Zertifizierung für Wasserfilter und -aufbereitung
6. DIN-Normen – DIN EN 14652, DIN 1988-200, EN 13443 (Wasserfilter)
7. ProdHaftG – Produkthaftungsgesetz (Sicherheitshinweise, Warnungen)
8. VerpackG – Verpackungsgesetz (LUCID-Registrierung, Recyclinghinweise)
9. Biozid-VO – EU 528/2012 (falls Filtermedien biozide Wirkung haben)
10. DSGVO – Datenschutzerklärung, Cookie-Consent
11. TMG §5 – Impressumspflicht (Vollständigkeit)
12. VRRL – Widerrufsrecht, AGB (Verbraucherrechte-Richtlinie 2011/83/EU)
13. Health Claims – Verordnung (EG) 1924/2006 (Gesundheits- und Nährwertversprechen)
14. Umweltkennzeichen – Blauer Engel, EU Ecolabel (falls vorhanden)
15. ElektroG – falls elektronische Komponenten (UV-Filter etc.)

CH (für spielzeug3 AG als Importeur):
16. PrSG – Produktsicherheitsgesetz Schweiz (Importeurpflichten, Marktüberwachung)
17. LM-Recht CH – Lebensmittelgesetz (LMG), HMBV (Hygiene Trinkwasserfilter)
18. OR Art. 197ff – Gewährleistung, Produkthaftung
19. USG/Chemikalien CH – Chemikaliengesetz (ChemG), REACH-Äquivalenz
20. Zollrecht CH – Importdeklaration, Ursprungszeugnis, HS-Codes
21. BAG/Swissmedic – falls medizinische Behauptungen (Gesundheitsfilter)
22. WEKO – Preisauszeichnung, Wettbewerbsrecht CH

Vergib Scores (0-100):
- overall: Gesamtbewertung Compliance-Reife
- eu: Erfüllungsgrad EU-Regulierungen (0=gar nicht, 100=vollständig)
- de: Erfüllungsgrad DE-Regulierungen
- ch: CH-Risikoscore für spielzeug3 AG (100=kein Risiko, 0=hohes Risiko)

Sei sehr präzise und faktenbasiert. Wenn etwas auf der Website nicht sichtbar ist, markiere es als "unclear" mit dem Hinweis, dass Dokumente angefordert werden sollten.`;
}

// ─── Call LLM ─────────────────────────────────────────────────────────────────
async function callLLM(prompt) {
  const res = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Du bist ein Experte für Produktsicherheit und Regulatorik. Antworte immer mit validem JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 8000,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const db = await createConnection(DATABASE_URL);

try {
  // 1. Create check record
  const [insertResult] = await db.execute(
    "INSERT INTO supplier_website_checks (supplierId, websiteUrl, status, triggeredByUserId) VALUES (?, ?, 'running', 1)",
    [SUPPLIER_ID, WEBSITE_URL]
  );
  const checkId = insertResult.insertId;
  console.log(`Created check record ID: ${checkId}`);

  try {
    // 2. Fetch website
    console.log("Fetching main page...");
    const mainText = await fetchWebsiteText(WEBSITE_URL);
    console.log(`Main page: ${mainText.length} chars`);

    console.log("Fetching subpages...");
    const subpageText = await fetchAdditionalPages();
    const fullText = (mainText + subpageText).slice(0, 14_000);
    console.log(`Total text: ${fullText.length} chars`);

    // 3. Call LLM
    console.log("Calling LLM (this may take 30-60s)...");
    const llmResponse = await callLLM(buildPrompt(fullText));
    const rawContent = llmResponse?.choices?.[0]?.message?.content ?? "{}";
    console.log("LLM response received, parsing...");

    const analysis = JSON.parse(rawContent);
    console.log(`Analysis: overall=${analysis.scores?.overall}, eu=${analysis.scores?.eu}, de=${analysis.scores?.de}, ch=${analysis.scores?.ch}`);
    console.log(`Items: ${analysis.items?.length ?? 0}`);

    // 4. Store items
    if (analysis.items && analysis.items.length > 0) {
      for (const item of analysis.items) {
        await db.execute(
          `INSERT INTO supplier_check_items 
           (checkId, supplierId, regulationCode, regulationName, jurisdiction, status, criticality, finding, evidence, recommendation, legalRisk, chRisk)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            checkId, SUPPLIER_ID,
            item.regulationCode ?? "UNKNOWN",
            item.regulationName ?? "Unknown",
            item.jurisdiction ?? "eu",
            item.status ?? "unclear",
            item.criticality ?? "medium",
            item.finding ?? "",
            item.evidence ?? null,
            item.recommendation ?? null,
            item.legalRisk ?? null,
            item.chRisk ?? null,
          ]
        );
      }
      console.log(`Stored ${analysis.items.length} items`);
    }

    // 5. Update check record
    await db.execute(
      `UPDATE supplier_website_checks SET 
       status = 'completed',
       scrapedSummary = ?,
       overallScore = ?,
       euScore = ?,
       deScore = ?,
       chScore = ?,
       analysisResult = ?
       WHERE id = ?`,
      [
        fullText.slice(0, 2000),
        analysis.scores?.overall ?? null,
        analysis.scores?.eu ?? null,
        analysis.scores?.de ?? null,
        analysis.scores?.ch ?? null,
        JSON.stringify(analysis),
        checkId,
      ]
    );

    console.log("✅ Compliance check completed successfully!");
    console.log(`Check ID: ${checkId}`);
    console.log(`Overall: ${analysis.scores?.overall}/100`);
    console.log(`EU: ${analysis.scores?.eu}/100`);
    console.log(`DE: ${analysis.scores?.de}/100`);
    console.log(`CH: ${analysis.scores?.ch}/100`);
    console.log(`Critical findings: ${analysis.criticalFindings?.length ?? 0}`);
    console.log(`Positive findings: ${analysis.positiveFindings?.length ?? 0}`);

  } catch (err) {
    await db.execute(
      "UPDATE supplier_website_checks SET status = 'failed', errorMessage = ? WHERE id = ?",
      [err.message, checkId]
    );
    throw err;
  }
} finally {
  await db.end();
}
