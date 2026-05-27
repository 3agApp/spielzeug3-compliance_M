/**
 * server/routers/supplierWebsiteCheck.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Supplier Website Compliance Check – AI-powered analysis of a supplier's
 * website against EU / DE / CH regulations.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  supplierWebsiteChecks,
  supplierCheckItems,
  suppliers,
  type SupplierComplianceAnalysis,
} from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";

// ─── Helper: get DB or throw ──────────────────────────────────────────────────

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ─── Helper: fetch website text ───────────────────────────────────────────────

async function fetchWebsiteText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ComplianceBot/1.0; +https://spielzeug3.ch)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return text.slice(0, 12_000);
  } catch (err: any) {
    throw new Error(`Website konnte nicht geladen werden: ${err?.message ?? err}`);
  }
}

// ─── AI Prompt ────────────────────────────────────────────────────────────────

function buildPrompt(websiteUrl: string, websiteText: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `Du bist ein Experte für Produktsicherheit, CE-Kennzeichnung und Regulatorik (EU, Deutschland, Schweiz).

Analysiere den folgenden Webseiteninhalt des Herstellers/Lieferanten "${websiteUrl}" auf Compliance mit relevanten Vorschriften.

WEBSEITENINHALT (gekürzt):
---
${websiteText}
---

Erstelle eine strukturierte Compliance-Analyse als JSON-Objekt. Antworte NUR mit dem JSON-Objekt.

Pflichtfelder:
- companyName: string
- websiteUrl: "${websiteUrl}"
- analysisDate: "${today}"
- productCategories: string[]
- overallAssessment: string (2-3 Sätze auf Deutsch)
- summaryDE: string (Zusammenfassung für Hersteller, DE/EU-Recht, auf Deutsch)
- summaryEN: string (Summary for manufacturer, DE/EU law, in English)
- criticalFindings: string[]
- positiveFindings: string[]
- scores: { overall: number 0-100, eu: number 0-100, de: number 0-100, ch: number 0-100 }
- items: Array von Prüfpunkten mit folgenden Feldern:
  - regulationCode: string (z.B. "GPSR", "CE", "REACH")
  - regulationName: string (vollständiger Name)
  - jurisdiction: "eu" | "de" | "ch" | "international"
  - status: "fulfilled" | "partially_fulfilled" | "not_fulfilled" | "not_applicable" | "unclear"
  - criticality: "critical" | "high" | "medium" | "low" | "info"
  - finding: string (Was wurde gefunden/bewertet)
  - evidence: string (Konkrete Textstellen)
  - recommendation: string (Handlungsempfehlung)
  - legalRisk: string (Rechtliches Risiko für Hersteller DE/EU)
  - chRisk: string (Rechtliches Risiko für CH-Händler)

Prüfe ALLE folgenden Regulierungen:

EU/DE (für den Hersteller):
1. GPSR – EU General Product Safety Regulation 2023/988
2. CE – CE-Kennzeichnung, Konformitätserklärung, technische Dokumentation
3. REACH – Verordnung (EG) Nr. 1907/2006
4. RoHS – Richtlinie 2011/65/EU (falls relevant)
5. TrinkwV – Trinkwasserverordnung 2023, KTW-Leitlinie, DVGW-Zertifizierung
6. DIN-Normen – DIN EN 14652, DIN 1988 (Wasserfilter)
7. ProdHaftG – Produkthaftungsgesetz, Sicherheitshinweise
8. VerpackG – Verpackungsgesetz, LUCID-Registrierung
9. Biozid-VO – EU 528/2012 (falls Filtermedien als Biozid)
10. DSGVO – Datenschutzerklärung, Cookie-Hinweise
11. TMG §5 – Impressumspflicht
12. VRRL – Widerrufsrecht, AGB (Verbraucherrechte-Richtlinie 2011/83/EU)
13. Health Claims – Verordnung (EG) 1924/2006 (Gesundheitsversprechen)

CH (für uns als Schweizer Händler):
14. PrSG – Produktsicherheitsgesetz Schweiz, Importeurpflichten
15. LM-Recht CH – LMKV, HMBV (Hygiene Trinkwasserfilter)
16. OR – Obligationenrecht, Gewährleistung, Produkthaftung
17. USG/Chemikalien CH – REACH-Äquivalenz
18. Zollrecht CH – Importdeklaration, Ursprungszeugnis
19. BAG/Swissmedic – falls medizinische Behauptungen

Score-Vergabe (0-100):
- overall: Gesamtbewertung Compliance-Reife
- eu: Erfüllungsgrad EU-Regulierungen
- de: Erfüllungsgrad DE-Regulierungen
- ch: CH-Risikoscore (100 = kein Risiko für CH-Händler, 0 = hohes Risiko)`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const supplierWebsiteCheckRouter = router({
  triggerCheck: protectedProcedure
    .input(z.object({ supplierId: z.number(), websiteUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      // Verify supplier exists
      const [supplier] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, input.supplierId))
        .limit(1);
      if (!supplier) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Supplier not found" });
      }

      // Create check record in "running" state
      const [insertResult] = await db.insert(supplierWebsiteChecks).values({
        supplierId: input.supplierId,
        websiteUrl: input.websiteUrl,
        status: "running",
        triggeredByUserId: ctx.user.id,
      });
      const checkId = (insertResult as any).insertId as number;

      try {
        // 1. Fetch website content
        const websiteText = await fetchWebsiteText(input.websiteUrl);

        // 2. Send to LLM
        const prompt = buildPrompt(input.websiteUrl, websiteText);
        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "Du bist ein Experte für Produktsicherheit und Regulatorik. Antworte immer mit validem JSON.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" } as any,
        });

        const rawContent =
          typeof llmResponse?.choices?.[0]?.message?.content === "string"
            ? llmResponse.choices[0].message.content
            : "{}";

        let analysis: SupplierComplianceAnalysis;
        try {
          analysis = JSON.parse(rawContent) as SupplierComplianceAnalysis;
        } catch {
          throw new Error("LLM returned invalid JSON");
        }

        // 3. Store items
        if (analysis.items && analysis.items.length > 0) {
          await db.insert(supplierCheckItems).values(
            analysis.items.map((item) => ({
              checkId,
              supplierId: input.supplierId,
              regulationCode: item.regulationCode ?? "UNKNOWN",
              regulationName: item.regulationName ?? "Unknown",
              jurisdiction: (item.jurisdiction ?? "eu") as any,
              status: (item.status ?? "unclear") as any,
              criticality: (item.criticality ?? "medium") as any,
              finding: item.finding ?? "",
              evidence: item.evidence ?? null,
              recommendation: item.recommendation ?? null,
              legalRisk: item.legalRisk ?? null,
              chRisk: item.chRisk ?? null,
            }))
          );
        }

        // 4. Update check record
        await db
          .update(supplierWebsiteChecks)
          .set({
            status: "completed",
            scrapedSummary: websiteText.slice(0, 2000),
            overallScore: analysis.scores?.overall ?? null,
            euScore: analysis.scores?.eu ?? null,
            deScore: analysis.scores?.de ?? null,
            chScore: analysis.scores?.ch ?? null,
            analysisResult: analysis,
          })
          .where(eq(supplierWebsiteChecks.id, checkId));

        return { checkId, status: "completed" as const };
      } catch (err: any) {
        await db
          .update(supplierWebsiteChecks)
          .set({ status: "failed", errorMessage: err?.message ?? String(err) })
          .where(eq(supplierWebsiteChecks.id, checkId));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Analyse fehlgeschlagen: ${err?.message ?? err}`,
        });
      }
    }),

  listChecks: protectedProcedure
    .input(z.object({ supplierId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      return db
        .select()
        .from(supplierWebsiteChecks)
        .where(eq(supplierWebsiteChecks.supplierId, input.supplierId))
        .orderBy(desc(supplierWebsiteChecks.createdAt));
    }),

  getCheck: protectedProcedure
    .input(z.object({ checkId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [check] = await db
        .select()
        .from(supplierWebsiteChecks)
        .where(eq(supplierWebsiteChecks.id, input.checkId))
        .limit(1);
      if (!check) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Check not found" });
      }
      const items = await db
        .select()
        .from(supplierCheckItems)
        .where(eq(supplierCheckItems.checkId, input.checkId))
        .orderBy(supplierCheckItems.criticality);
      return { ...check, items };
    }),

  deleteCheck: protectedProcedure
    .input(z.object({ checkId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(supplierCheckItems).where(eq(supplierCheckItems.checkId, input.checkId));
      await db.delete(supplierWebsiteChecks).where(eq(supplierWebsiteChecks.id, input.checkId));
      return { success: true };
    }),
});
