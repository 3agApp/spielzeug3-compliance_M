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
} from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
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
  evidences: any[]
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
5. Welche Dokumente für die Fallbearbeitung benötigt werden`);

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

    // ── 4. KI-Analyse ─────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(incident, product, safety, evidences);

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
