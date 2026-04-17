/**
 * server/domains/incidents/incidentAiService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * KI-gestützte Fallbewertung für Schadensfälle und Rückrufe.
 *
 * Die KI analysiert den Schadensfall (Typ, Schweregrad, Beschreibung,
 * betroffene Produktdaten, Sicherheitsdaten) und schlägt eine strukturierte
 * interne Bewertung vor: Risikolevel, Rückruf-Empfehlung, Behördenpflicht,
 * betroffene Normen und benötigte Dokumente.
 */

import { invokeLLM } from "../../_core/llm";
import { getDb } from "../../db";
import {
  incidents,
  incidentEvidences,
  products,
  productSafetyEntries,
  documents,
  productComponents,
  componentDocuments,
  declarations,
  batchRecords,
  productLabellingChecks,
} from "../../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireRole } from "../../shared";
import { TRPCError } from "@trpc/server";

export type UserContext = {
  id: number;
  complianceRole: string | null;
  tenantId?: number | null;
};

// ─── Output Schema ────────────────────────────────────────────────────────────

export interface AiAssessmentSuggestion {
  /** Empfohlenes Risikolevel: low | medium | high | critical */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** Empfiehlt die KI einen Rückruf? */
  recallRecommended: boolean;
  /** Umfang des empfohlenen Rückrufs (wenn recallRecommended = true) */
  recallScope: string;
  /** Besteht eine behördliche Meldepflicht? */
  regulatoryObligation: boolean;
  /** Begründung für die Meldepflicht */
  regulatoryObligationReason: string;
  /** Geschätzte Meldefrist in Tagen (0 = sofort) */
  regulatoryDeadlineDays: number | null;
  /** Relevante Normen und Gesetze */
  applicableRegulations: string[];
  /** Benötigte Dokumente für die Fallbearbeitung */
  requiredDocuments: string[];
  /** Ausführliche Begründung der KI-Einschätzung */
  assessmentText: string;
  /** Zusammenfassung in 1–2 Sätzen */
  summary: string;
  /** Konfidenz der KI-Einschätzung: low | medium | high */
  confidence: "low" | "medium" | "high";
  /** Wichtige Warnhinweise oder Unsicherheiten */
  caveats: string[];
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `Du bist ein erfahrener Produktsicherheits- und Compliance-Experte mit Spezialisierung auf
Spielzeug und Konsumgüter im Schweizer und EU-Markt. Du analysierst Schadensfälle und Produktrückrufe
nach folgenden Rechtsgrundlagen:

**Schweiz:**
- Produktsicherheitsgesetz (PrSG, SR 930.11)
- Spielzeugverordnung (SR 817.023.11)
- Bundesgesetz über die Produkthaftpflicht (PrHG, SR 221.112.944)
- BAZL-Meldepflichten für gefährliche Produkte

**EU:**
- EU-Spielzeugrichtlinie 2009/48/EG
- EU-Produktsicherheitsverordnung (GPSR) 2023/988
- RAPEX/ICSMS-Meldepflichten
- EN 71 Normenreihe (Spielzeugsicherheit)
- EN 62115 (Elektrisches Spielzeug)

**Aufgabe:**
Analysiere den Schadensfall und erstelle eine strukturierte Risikoeinschätzung.
Sei präzise, konservativ (im Zweifel höheres Risiko) und begründe alle Empfehlungen.
Antworte ausschliesslich auf Deutsch.`;
}

function buildUserPrompt(
  incident: any,
  product: any,
  safety: any,
  evidences: any[],
  docs: any[],
  components: any[],
  componentDocs: any[],
  declarations: any[],
  batches: any[],
  labellingChecks: any[]
): string {
  const parts: string[] = [];

  parts.push(`## Schadensfall-Details`);
  parts.push(`**Fallnummer:** #${incident.id}`);
  parts.push(`**Typ:** ${formatIncidentType(incident.incidentType)}`);
  parts.push(`**Gemeldeter Schweregrad:** ${formatSeverity(incident.severity)}`);
  parts.push(`**Titel:** ${incident.title}`);
  parts.push(`**Beschreibung:** ${incident.description}`);

  if (incident.injuryDescription) {
    parts.push(`**Verletzungsbeschreibung:** ${incident.injuryDescription}`);
  }
  if (incident.injuredPersonAge) {
    parts.push(`**Alter der verletzten Person:** ${incident.injuredPersonAge} Jahre`);
  }
  if (incident.injuredPersonType) {
    parts.push(`**Personentyp:** ${incident.injuredPersonType}`);
  }
  if (incident.medicalTreatmentRequired) {
    parts.push(`**Medizinische Behandlung erforderlich:** Ja`);
  }
  if (incident.hospitalisation) {
    parts.push(`**Krankenhausaufenthalt:** Ja`);
  }
  if (incident.reportedToAuthority) {
    parts.push(`**Bereits bei Behörde gemeldet:** Ja (${incident.authorityName ?? "unbekannt"})`);
  }

  const affectedVersions = parseJsonField(incident.affectedVersions);
  const affectedBatches = parseJsonField(incident.affectedBatchNumbers);
  if (affectedVersions?.length > 0) {
    parts.push(`**Betroffene Versionen:** ${affectedVersions.join(", ")}`);
  }
  if (affectedBatches?.length > 0) {
    parts.push(`**Betroffene Chargennummern:** ${affectedBatches.join(", ")}`);
  }

  if (product) {
    parts.push(`\n## Produktinformationen`);
    parts.push(`**Produktname:** ${product.productName}`);
    parts.push(`**Interne Artikelnummer:** ${product.internalArticleNumber ?? "n/a"}`);
    if (product.brand) parts.push(`**Marke:** ${product.brand}`);
    if (product.ean) parts.push(`**EAN:** ${product.ean}`);
    if (product.category) parts.push(`**Kategorie:** ${product.category}`);
    if (product.ageGrading) parts.push(`**Altersangabe:** ${product.ageGrading}`);
    if (product.countryOfOrigin) parts.push(`**Herkunftsland:** ${product.countryOfOrigin}`);
  }

  if (safety) {
    parts.push(`\n## Sicherheitsdaten des Produkts`);
    if (safety.safetyText) parts.push(`**Sicherheitstext:** ${safety.safetyText}`);
    if (safety.warningText) parts.push(`**Warnhinweise:** ${safety.warningText}`);
    if (safety.ageGrading) parts.push(`**Altersangabe (Safety):** ${safety.ageGrading}`);
    if (safety.materialInformation) parts.push(`**Materialangaben:** ${safety.materialInformation}`);
  }

  // ── Dokumente des Produkts ──
  if (docs.length > 0) {
    parts.push(`\n## Vorhandene Produktdokumente (${docs.length})`);
    docs.forEach((d) => {
      const status = d.reviewStatus === "approved" ? "✓ genehmigt" : d.reviewStatus === "rejected" ? "✗ abgelehnt" : "ausstehend";
      const expiry = d.expiryDate ? ` (gültig bis ${new Date(d.expiryDate).toLocaleDateString("de-CH")})` : "";
      parts.push(`- ${d.documentType ?? "Dokument"}: ${d.fileName} [${status}]${expiry}`);
    });
  } else {
    parts.push(`\n## Vorhandene Produktdokumente`);
    parts.push(`Keine Dokumente hinterlegt – erhöhtes Risiko bei Behördenanfragen.`);
  }

  // ── Deklarationen (Konformitätserklärungen) ──
  if (declarations.length > 0) {
    parts.push(`\n## Konformitätserklärungen (${declarations.length})`);
    declarations.forEach((d) => {
      const standards = parseJsonField(d.standards);
      const directives = parseJsonField(d.euDirectives);
      parts.push(`- ${d.docNumber} (v${d.version}) Status: ${d.status}${d.aiValidationPassed !== null ? `, KI-Validierung: ${d.aiValidationPassed ? "bestanden" : "NICHT bestanden"}` : ""}`);
      if (standards.length > 0) parts.push(`  Normen: ${standards.join(", ")}`);
      if (directives.length > 0) parts.push(`  EU-Richtlinien: ${directives.join(", ")}`);
      if (d.testReportRef) parts.push(`  Prüfbericht-Referenz: ${d.testReportRef}`);
    });
  } else {
    parts.push(`\n## Konformitätserklärungen`);
    parts.push(`Keine Konformitätserklärungen vorhanden – kritisch für Behördenanfragen.`);
  }

  // ── Komponenten ──
  if (components.length > 0) {
    parts.push(`\n## Produktkomponenten (${components.length})`);
    components.forEach((c) => {
      const cDocs = componentDocs.filter((cd) => cd.componentId === c.id);
      const docSummary = cDocs.length > 0
        ? ` [${cDocs.length} Dokument(e): ${cDocs.map((cd) => cd.documentType).join(", ")}]`
        : " [KEINE Dokumente]";
      parts.push(`- ${c.name} (${c.materialType ?? "Material unbekannt"})${c.supplierName ? `, Lieferant: ${c.supplierName}` : ""}${c.partNumber ? `, Teilenr.: ${c.partNumber}` : ""}${docSummary}`);
    });
  }

  // ── Chargeninformationen ──
  if (batches.length > 0) {
    parts.push(`\n## Chargeninformationen (${batches.length} Chargen)`);
    batches.forEach((b) => {
      const receiptDate = b.goodsReceiptDate ? ` (Wareneingang: ${new Date(b.goodsReceiptDate).toLocaleDateString("de-CH")})` : "";
      parts.push(`- Charge ${b.batchNumber}${receiptDate}${b.notes ? `: ${b.notes}` : ""}`);
    });
  }

  // ── Kennzeichnungs-Checks ──
  if (labellingChecks.length > 0) {
    const checked = labellingChecks.filter((l) => l.checked).length;
    const unchecked = labellingChecks.filter((l) => !l.checked && l.isMandatory).length;
    parts.push(`\n## Kennzeichnungs-Prüfungen`);
    parts.push(`${checked} abgehakt, ${unchecked} Pflichtprüfungen noch offen`);
    if (unchecked > 0) {
      const openChecks = labellingChecks.filter((l) => !l.checked && l.isMandatory);
      parts.push(`Offene Pflichtprüfungen: ${openChecks.map((l) => l.label).join(", ")}`);
    }
  }

  // ── Herstellervorgaben (aus Sicherheitsdaten) ──
  if (safety?.usageRestrictions) {
    parts.push(`\n## Herstellervorgaben und Nutzungsbeschränkungen`);
    parts.push(safety.usageRestrictions);
    parts.push(`**Wichtig:** Prüfen ob der Kunde die Herstellervorgaben (Altersangabe, Originalzubehör, Nutzungsbedingungen) eingehalten hat.`);
  }

  if (evidences.length > 0) {
    parts.push(`\n## Vorliegende Beweise`);
    evidences.forEach((e, i) => {
      parts.push(`${i + 1}. ${formatEvidenceType(e.evidenceType)}: ${e.fileName}${e.description ? ` – ${e.description}` : ""}`);
    });
  }

  parts.push(`\n## Aufgabe`);
  parts.push(`Erstelle eine vollständige interne Risikoeinschätzung für diesen Schadensfall.
Berücksichtige dabei:
1. Schweregrad und Wahrscheinlichkeit einer Wiederholung
2. Ob ein Rückruf notwendig oder empfehlenswert ist
3. Ob eine behördliche Meldepflicht besteht (BAZL Schweiz / RAPEX EU)
4. Welche Normen und Gesetze relevant sind
5. Welche Dokumente für die Fallbearbeitung benötigt werden
6. Ob vorhandene Prüfberichte und Konformitätserklärungen den Vorfall abdecken
7. Ob der Kunde die Herstellervorgaben eingehalten hat (Altersangabe, Originalzubehör, Nutzungsbedingungen)
8. Ob fehlende Dokumente (Komponenten ohne Prüfberichte, keine Deklarationen) das Risiko erhöhen`);

  return parts.join("\n");
}

function formatIncidentType(type: string): string {
  const map: Record<string, string> = {
    personal_injury: "Personenschaden",
    product_defect: "Produktmangel",
    near_miss: "Beinahe-Unfall",
    property_damage: "Sachschaden",
    complaint: "Kundenbeschwerde",
    regulatory_inquiry: "Behördenanfrage",
    other: "Sonstiges",
  };
  return map[type] ?? type;
}

function formatSeverity(severity: string): string {
  const map: Record<string, string> = {
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
    critical: "Kritisch",
  };
  return map[severity] ?? severity;
}

function formatEvidenceType(type: string): string {
  const map: Record<string, string> = {
    customer_photo: "Kundenfoto",
    internal_photo: "Internes Foto",
    customer_statement: "Kundenaussage",
    internal_report: "Interner Bericht",
    authority_correspondence: "Behördenkorrespondenz",
    medical_report: "Ärztlicher Bericht",
    test_report: "Prüfbericht",
    other: "Sonstiges",
  };
  return map[type] ?? type;
}

function parseJsonField(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = typeof val === "string" ? JSON.parse(val) : val;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── JSON Schema für strukturierte KI-Antwort ─────────────────────────────────

const AI_ASSESSMENT_SCHEMA = {
  type: "object",
  properties: {
    riskLevel: {
      type: "string",
      enum: ["low", "medium", "high", "critical"],
      description: "Empfohlenes Risikolevel basierend auf Schadensfall-Analyse",
    },
    recallRecommended: {
      type: "boolean",
      description: "Ob ein Produktrückruf empfohlen wird",
    },
    recallScope: {
      type: "string",
      description: "Umfang des empfohlenen Rückrufs (leer wenn kein Rückruf)",
    },
    regulatoryObligation: {
      type: "boolean",
      description: "Ob eine behördliche Meldepflicht besteht",
    },
    regulatoryObligationReason: {
      type: "string",
      description: "Begründung für die Meldepflicht (leer wenn keine Pflicht)",
    },
    regulatoryDeadlineDays: {
      type: ["integer", "null"],
      description: "Meldefrist in Tagen (null wenn keine Pflicht, 0 = sofort)",
    },
    applicableRegulations: {
      type: "array",
      items: { type: "string" },
      description: "Relevante Normen, Gesetze und Richtlinien",
    },
    requiredDocuments: {
      type: "array",
      items: { type: "string" },
      description: "Für die Fallbearbeitung benötigte Dokumente",
    },
    assessmentText: {
      type: "string",
      description: "Ausführliche Begründung der Risikoeinschätzung (mind. 3 Sätze)",
    },
    summary: {
      type: "string",
      description: "Kurzzusammenfassung der Einschätzung in 1–2 Sätzen",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "Konfidenz der KI-Einschätzung basierend auf verfügbaren Informationen",
    },
    caveats: {
      type: "array",
      items: { type: "string" },
      description: "Wichtige Vorbehalte oder fehlende Informationen",
    },
  },
  required: [
    "riskLevel",
    "recallRecommended",
    "recallScope",
    "regulatoryObligation",
    "regulatoryObligationReason",
    "regulatoryDeadlineDays",
    "applicableRegulations",
    "requiredDocuments",
    "assessmentText",
    "summary",
    "confidence",
    "caveats",
  ],
  additionalProperties: false,
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const incidentAiService = {
  /**
   * Erstellt einen KI-gestützten Bewertungsvorschlag für einen Schadensfall.
   * Nur für compliance_manager und administrator zugänglich.
   */
  async suggestAssessment(
    user: UserContext,
    incidentId: number
  ): Promise<AiAssessmentSuggestion> {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin"]);

    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database unavailable" });
    }

    const tenantId = user.tenantId ?? 1;

    // ── 1. Schadensfall laden ──────────────────────────────────────────────
    const [incident] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantId)));

    if (!incident) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Schadensfall nicht gefunden" });
    }

    // ── 2. Produktdaten laden (optional) ──────────────────────────────────
    let product: any = null;
    let safety: any = null;

    if (incident.productId) {
      const [p] = await db
        .select()
        .from(products)
        .where(eq(products.id, incident.productId));
      product = p ?? null;

      if (product) {
        const [s] = await db
          .select()
          .from(productSafetyEntries)
          .where(eq(productSafetyEntries.productId, incident.productId));
        safety = s ?? null;
      }
    }

    // ── 3. Beweise laden ──────────────────────────────────────────────────
    const evidences = await db
      .select({
        id: incidentEvidences.id,
        evidenceType: incidentEvidences.evidenceType,
        fileName: incidentEvidences.fileName,
        description: incidentEvidences.description,
      })
      .from(incidentEvidences)
      .where(eq(incidentEvidences.incidentId, incidentId));

    // ── 4. Erweiterte Produktdaten laden (Dokumente, Komponenten, Deklarationen, Chargen) ──
    let productDocs: any[] = [];
    let productComponents_: any[] = [];
    let componentDocs_: any[] = [];
    let productDeclarations: any[] = [];
    let productBatches: any[] = [];
    let productLabellingChecks_: any[] = [];

    if (incident.productId) {
      // Dokumente
      productDocs = await db
        .select({
          id: documents.id,
          documentType: documents.documentType,
          fileName: documents.fileName,
          reviewStatus: documents.reviewStatus,
          expiryDate: documents.expiryDate,
          includeInAiAnalysis: documents.includeInAiAnalysis,
        })
        .from(documents)
        .where(and(eq(documents.productId, incident.productId), eq(documents.isArchived, false)));

      // Konformitätserklärungen
      productDeclarations = await db
        .select({
          id: declarations.id,
          docNumber: declarations.docNumber,
          version: declarations.version,
          status: declarations.status,
          standards: declarations.standards,
          euDirectives: declarations.euDirectives,
          chRegulations: declarations.chRegulations,
          testReportRef: declarations.testReportRef,
          aiValidationPassed: declarations.aiValidationPassed,
          aiValidationSummary: declarations.aiValidationSummary,
        })
        .from(declarations)
        .where(eq(declarations.productId, incident.productId));

      // Komponenten
      productComponents_ = await db
        .select({
          id: productComponents.id,
          name: productComponents.name,
          materialType: productComponents.materialType,
          supplierName: productComponents.supplierName,
          partNumber: productComponents.partNumber,
        })
        .from(productComponents)
        .where(and(eq(productComponents.productId, incident.productId), eq(productComponents.active, true)));

      // Komponenten-Dokumente
      if (productComponents_.length > 0) {
        const componentIds = productComponents_.map((c) => c.id);
        componentDocs_ = await db
          .select({
            id: componentDocuments.id,
            componentId: componentDocuments.componentId,
            documentType: componentDocuments.documentType,
            fileName: componentDocuments.fileName,
          })
          .from(componentDocuments)
          .where(inArray(componentDocuments.componentId, componentIds));
      }

      // Chargeninformationen
      productBatches = await db
        .select({
          id: batchRecords.id,
          batchNumber: batchRecords.batchNumber,
          goodsReceiptDate: batchRecords.goodsReceiptDate,
          notes: batchRecords.notes,
        })
        .from(batchRecords)
        .where(eq(batchRecords.productId, incident.productId));

      // Kennzeichnungs-Checks
      productLabellingChecks_ = await db
        .select({
          id: productLabellingChecks.id,
          label: productLabellingChecks.label,
          checked: productLabellingChecks.checked,
          isMandatory: productLabellingChecks.isMandatory,
          checkKey: productLabellingChecks.checkKey,
        })
        .from(productLabellingChecks)
        .where(eq(productLabellingChecks.productId, incident.productId));
    }

    // ── 5. KI-Analyse ─────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(
      incident, product, safety, evidences,
      productDocs, productComponents_, componentDocs_,
      productDeclarations, productBatches, productLabellingChecks_
    );

    let rawResult: any;
    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "incident_assessment",
            strict: true,
            schema: AI_ASSESSMENT_SCHEMA,
          },
        } as any,
      });

      const content = response.choices[0]?.message?.content;
      rawResult = typeof content === "string" ? JSON.parse(content) : content;
    } catch (err) {
      console.error("[incidentAiService] LLM call failed:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "KI-Analyse fehlgeschlagen. Bitte versuchen Sie es erneut.",
      });
    }

    // ── 5. Ergebnis validieren und zurückgeben ────────────────────────────
    const result: AiAssessmentSuggestion = {
      riskLevel: rawResult.riskLevel ?? "medium",
      recallRecommended: rawResult.recallRecommended ?? false,
      recallScope: rawResult.recallScope ?? "",
      regulatoryObligation: rawResult.regulatoryObligation ?? false,
      regulatoryObligationReason: rawResult.regulatoryObligationReason ?? "",
      regulatoryDeadlineDays: rawResult.regulatoryDeadlineDays ?? null,
      applicableRegulations: Array.isArray(rawResult.applicableRegulations)
        ? rawResult.applicableRegulations
        : [],
      requiredDocuments: Array.isArray(rawResult.requiredDocuments)
        ? rawResult.requiredDocuments
        : [],
      assessmentText: rawResult.assessmentText ?? "",
      summary: rawResult.summary ?? "",
      confidence: rawResult.confidence ?? "medium",
      caveats: Array.isArray(rawResult.caveats) ? rawResult.caveats : [],
    };

    console.log(
      `[incidentAiService] Suggestion for incident #${incidentId}: ` +
      `riskLevel=${result.riskLevel}, recall=${result.recallRecommended}, ` +
      `regulatory=${result.regulatoryObligation}, confidence=${result.confidence}`
    );

    return result;
  },
};
