/**
 * scripts/uploadRivaDocs.mjs
 * Uploads the 5 RIVA compliance PDFs as supplier documents to S3 and DB
 */
import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!DATABASE_URL || !FORGE_API_URL || !FORGE_API_KEY) {
  console.error("Missing env vars"); process.exit(1);
}

const SUPPLIER_ID = 90001;

// PDF metadata
const DOCS = [
  {
    path: "/home/ubuntu/upload/3_Anforderungen_Deutschland_EU.pdf",
    fileName: "3_Anforderungen_Deutschland_EU.pdf",
    title: "Anforderungen Deutschland & EU – Trinkwasserfilter",
    documentType: "compliance_note",
    description: "Vollständige Übersicht der rechtlichen Anforderungen für Trinkwasserfilter in Deutschland und der EU: TrinkwV, DVGW, REACH, GPSR, Health Claims, HWG, UWG, VerpackG.",
    regulationRef: "TrinkwV 2023, DVGW W270/W291/W512, REACH, GPSR 2023/988, HWG, UWG §5, VO (EG) 1935/2004",
    isConfidential: true,
  },
  {
    path: "/home/ubuntu/upload/4_Rechtliche_Konsequenzen.pdf",
    fileName: "4_Rechtliche_Konsequenzen.pdf",
    title: "Rechtliche Konsequenzen – Compliance-Verstösse RIVA Filter",
    documentType: "compliance_note",
    description: "Analyse der rechtlichen Konsequenzen bei Compliance-Verstössen: UWG §5 Irreführung, HWG §3/§11, LFGB §11, Health Claims, Art. 18 LMG (CH). Befunde zu Kalkschutz-Widerspruch, Gesundheitsaussagen, Made-in-Germany, parallele CH-Vertriebsstruktur.",
    regulationRef: "UWG §5, HWG §3/§11, LFGB §11, VO (EG) 1924/2006, Art. 18 LMG CH",
    isConfidential: true,
  },
  {
    path: "/home/ubuntu/upload/Aktennotiz-Nr-2_Riva-Vollpruefung_2026-05-21.pdf",
    fileName: "Aktennotiz-Nr-2_Riva-Vollpruefung_2026-05-21.pdf",
    title: "Aktennotiz Nr. 2 – Vollprüfung RIVA Website (21.05.2026)",
    documentType: "audit_report",
    description: "Vollständige Website-Prüfung riva-filter.de: 63 Einzelbefunde (12 kritisch, 14 hoch). Kritische Befunde: Abkochgebot-Widerspruch (B-COL-01), Outdoor-Filter Mikrobiologie (B-OUT-01/02/03), Neurodermitis-Versprechen (B-DSCH-01), Wasserhahnfilter Performance (B-WH-01/02), PFAS/Nano-Beleg-Manipulation (B-PDF-PFAS-01/NANO-01). Eskalationsschwelle überschritten – Verkaufsstopp-Prüfung empfohlen.",
    regulationRef: "TrinkwV §16/§18a, DVGW W551, HWG §3/§11, UWG §5, Health Claims VO (EG) 1924/2006",
    isConfidential: true,
  },
  {
    path: "/home/ubuntu/upload/Aktennotiz-Nr-3_Labor-Forensik_2026-05-21.pdf",
    fileName: "Aktennotiz-Nr-3_Labor-Forensik_2026-05-21.pdf",
    title: "Aktennotiz Nr. 3 – Labor-Forensik RIVA PDFs (21.05.2026)",
    documentType: "audit_report",
    description: "Forensische Analyse der von RIVA verlinkten Prüfberichte: PFAS/Nano-PDF (VORGESCHOBEN – Eigenerklärung, kein akkreditierter Test), Druckprüfungs-PDF (NICHT PRÜFBAR – nicht OCR-fähig), MEX-Flyer (VORGESCHOBEN – Werbedokument), Jova-Testzertifikat HygCen 2022 (ECHT – akkreditierter Prüfbericht Pseudomonas). Selbstwiderspruch im PFAS-PDF: Labornamen genannt aber gleichzeitig als verboten deklariert.",
    regulationRef: "ISO/IEC 17025, DAkkS, TrinkwV, UWG §5 (Irreführung durch falsche Belege)",
    isConfidential: true,
  },
  {
    path: "/home/ubuntu/upload/Interne_Pruefung_Riva_Befund_und_Beschluss.pdf",
    fileName: "Interne_Pruefung_Riva_Befund_und_Beschluss.pdf",
    title: "Interne Prüfung RIVA – Befund und Beschluss (21.05.2026)",
    documentType: "compliance_note",
    description: "Interne Compliance-Prüfung mit Befunden und Beschlüssen: Kalkschutz-Widerspruch (keine chemische Veränderung aber Kalkwandlung), Gesundheitsaussagen (Krebs, Alzheimer, Parkinson ohne EFSA-Zulassung), Vergleichstabelle MEX (als Einzelfilter unzureichend), Made-in-Germany-Zweifel (Filtermaterial-Produzent unbekannt), parallele CH-Vertriebsstruktur (Naturalaqua.ch). Massnahmen: Sofortige Korrektur eigener Werbung, Originaldokumente von Wessling/Eurofins/SGS Fresenius anfordern.",
    regulationRef: "UWG §5, HWG §3/§11, Art. 18 LMG CH, VO (EG) 1935/2004 Art. 17, VO (EU) 10/2011",
    isConfidential: true,
  },
];

async function uploadToS3(filePath, fileKey, mimeType) {
  const fileBuffer = readFileSync(filePath);
  const baseUrl = FORGE_API_URL.replace(/\/+$/, "");
  const uploadUrl = new URL(`${baseUrl}/v1/storage/upload`);
  uploadUrl.searchParams.set("path", fileKey);

  // Use FormData with multipart/form-data (same as server/storage.ts)
  // Node 22 has global FormData and Blob
  const blob = new globalThis.Blob([fileBuffer], { type: mimeType });
  const form = new globalThis.FormData();
  form.append("file", blob, fileKey.split("/").pop() ?? "file");

  const res = await fetch(uploadUrl.toString(), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${FORGE_API_KEY}`,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`S3 upload failed ${res.status}: ${err}`);
  }

  const data = await res.json();
  return { url: data.url, fileKey };
}

const db = await createConnection(DATABASE_URL);

try {
  for (const doc of DOCS) {
    // Check if already uploaded
    const [existing] = await db.execute(
      "SELECT id FROM supplier_documents WHERE supplierId = ? AND fileName = ?",
      [SUPPLIER_ID, doc.fileName]
    );
    if (existing.length > 0) {
      console.log(`  ~ SKIP: ${doc.fileName} (already exists)`);
      continue;
    }

    console.log(`Uploading: ${doc.fileName}...`);
    const fileStats = readFileSync(doc.path);
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const fileKey = `supplier-docs/${SUPPLIER_ID}/${Date.now()}-${randomSuffix}-${doc.fileName}`;

    const { url } = await uploadToS3(doc.path, fileKey, "application/pdf");
    console.log(`  ✓ Uploaded to S3: ${url.slice(0, 80)}...`);

    await db.execute(
      `INSERT INTO supplier_documents 
       (supplierId, productId, fileName, fileKey, fileUrl, mimeType, fileSizeBytes, documentType, title, description, regulationRef, isConfidential, uploadedByUserId, tenantId)
       VALUES (?, NULL, ?, ?, ?, 'application/pdf', ?, ?, ?, ?, ?, ?, 1, 1)`,
      [
        SUPPLIER_ID,
        doc.fileName,
        fileKey,
        url,
        fileStats.length,
        doc.documentType,
        doc.title,
        doc.description,
        doc.regulationRef,
        doc.isConfidential ? 1 : 0,
      ]
    );
    console.log(`  ✓ Saved to DB: ${doc.title}`);
  }

  console.log("\n✅ All documents uploaded successfully!");

  // Verify
  const [docs] = await db.execute(
    "SELECT id, title, documentType FROM supplier_documents WHERE supplierId = ?",
    [SUPPLIER_ID]
  );
  console.log(`\nDocuments for RIVA Filter (${docs.length} total):`);
  for (const d of docs) {
    console.log(`  [${d.documentType}] ${d.title}`);
  }

} finally {
  await db.end();
}
