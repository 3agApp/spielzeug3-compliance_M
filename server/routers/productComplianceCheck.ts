/**
 * server/routers/productComplianceCheck.ts
 * Per-product compliance analysis for water filter products (EU/DE/CH)
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { REGULATION_PENALTIES, CH_ONLY_RISKS, getChResidualRisks } from "../knowledge/regulation_penalties";
import { getDb } from "../db";
import {
  productComplianceChecks,
  productComplianceItems,
  products,
  supplierDocuments,
} from "../../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";

// ─── Trinkwasser-Regulierungen Checkliste ────────────────────────────────────
// Comprehensive checklist for water filter products (EU/DE/CH)
const WATER_FILTER_REGULATIONS = `
PFLICHTPRÜFUNGEN FÜR TRINKWASSERFILTER (EU/DE/CH):

=== EU-EBENE ===
1. GPSR (EU) 2023/988 – General Product Safety Regulation (ab Dez 2024)
   - Pflicht: CE-Kennzeichnung, Konformitätserklärung (DoC), Hersteller-Identifikation auf Produkt
   - Pflicht: Technische Dokumentation (10 Jahre aufbewahren)
   - Pflicht: Marktüberwachungs-Meldepflicht bei Sicherheitsproblemen

2. VO (EG) 1935/2004 – Materialien im Kontakt mit Lebensmitteln/Wasser
   - Pflicht: Konformitätserklärung für alle wasserberührenden Materialien
   - Pflicht: Rückverfolgbarkeit der Materialien entlang der Lieferkette
   - Pflicht: Migrationstest für Kunststoffe nach VO (EU) 10/2011

3. VO (EU) 10/2011 – Kunststoffe im Lebensmittelkontakt
   - Pflicht: Gesamtmigrationstest (OGM ≤ 10 mg/dm²)
   - Pflicht: Spezifische Migration für relevante Substanzen
   - Pflicht: Konformitätserklärung des Kunststoffherstellers

4. REACH VO (EG) 1907/2006
   - Pflicht: SVHC-Prüfung (Substances of Very High Concern) in Filtermedien
   - Pflicht: Sicherheitsdatenblätter für Filtermedien/Granulate
   - Pflicht: Registrierung von Stoffen >1 Tonne/Jahr

5. Health Claims VO (EG) 1924/2006
   - VERBOT: Gesundheitsbezogene Aussagen ohne EFSA-Zulassung
   - VERBOT: Krankheitsbezogene Aussagen (Krebs, Neurodermitis, etc.)
   - VERBOT: Angst-Botschaften (HWG §11)

6. Biozid-VO (EU) 528/2012 (falls biozide Wirkung)
   - Pflicht: Zulassung biozider Wirkstoffe (Silberionen, etc.)
   - Pflicht: Kennzeichnung biozider Produkte

=== DEUTSCHLAND ===
7. Trinkwasserverordnung 2023 (TrinkwV)
   - §17: Anforderungen an Werkstoffe/Materialien (KTW-Leitlinie)
   - KTW-Leitlinie: Prüfung nach DVGW W 270 (Mikrobiologie) und W 291 (Filtergeräte)
   - §16/§18a: Endpoint-Filter sind KEINE Sanierungsmaßnahme bei Abkochgebot
   - Pflicht: Prüfberichte akkreditierter Labore (DAkkS-akkreditiert)

8. DVGW-Regelwerk
   - DVGW W 291: Reinigung und Desinfektion von Trinkwasserinstallationen
   - DVGW W 270: Vermehrung von Mikroorganismen auf Werkstoffen (Prüfpflicht)
   - DVGW W 551: Trinkwassererwärmungs- und Leitungsanlagen (Legionellen)
   - DVGW W 512: Wasserfiltergeräte für Trinkwasserinstallationen
   - DIN EN 14652: Filtergeräte für Trinkwasserinstallationen

9. ProdHaftG – Produkthaftungsgesetz
   - Pflicht: Vollständige Sicherheitshinweise und Warnungen
   - Pflicht: Wartungsintervalle klar kommunizieren
   - Pflicht: Bestimmungsgemäßer Gebrauch definiert

10. UWG §5 – Irreführungsverbot
    - VERBOT: Physikalisch unmögliche Performance-Aussagen
    - VERBOT: Nicht belegte Filterwirkungen (PFAS, Nano ohne akkreditierte Tests)
    - VERBOT: "Made in Germany" ohne nachweisbare Herstellung in DE

11. HWG – Heilmittelwerbegesetz
    - §3: Verbot irreführender Werbung mit gesundheitlichen Wirkungen
    - §11: Verbot von Angst-Botschaften und Krankheitsbezug

12. LFGB §11 – Lebensmittel- und Futtermittelgesetzbuch
    - Verbot gesundheitsbezogener Werbung für Bedarfsgegenstände ohne Zulassung

13. VerpackG – Verpackungsgesetz
    - Pflicht: LUCID-Registrierung
    - Pflicht: Beteiligung an dualem System

=== SCHWEIZ (für spielzeug3 AG als Importeur) ===
14. PrSG – Produktsicherheitsgesetz CH
    - Pflicht: Importeur trägt Herstellerverantwortung wenn kein CH-Hersteller
    - Pflicht: Sicherheitsnachweise müssen vorliegen (CE/DoC als Minimum)
    - Pflicht: Marktüberwachungspflicht

15. LMG / HMBV – Lebensmittelgesetz / Hygieneverordnung
    - Trinkwasserfilter = Bedarfsgegenstand nach LMG
    - Pflicht: Materialkonformität (analog KTW/VO 10/2011)
    - Pflicht: Hygienische Unbedenklichkeit nachgewiesen

16. Art. 18 LMG – Täuschungsverbot
    - VERBOT: Irreführende Gesundheitsaussagen
    - VERBOT: Nicht belegte Wirkungsversprechen

17. ChemG / ChemV – Chemikaliengesetz CH (REACH-äquivalent)
    - Pflicht: SVHC-Konformität für CH-Markt
    - Pflicht: Sicherheitsdatenblätter in DE/FR/IT

18. OR Art. 197ff – Gewährleistung und Produkthaftung
    - Pflicht: Klare Gewährleistungsbedingungen
    - Pflicht: Rückrufprozess definiert

19. Zollrecht CH
    - Pflicht: Korrekte HS-Codes (8421.21 für Wasserfilter)
    - Pflicht: Ursprungszeugnis
    - Pflicht: Importdeklaration

20. BAG-Empfehlungen / SVGW
    - SVGW (Schweizer Verein des Gas- und Wasserfaches) = CH-Äquivalent zu DVGW
    - Empfehlung: SVGW-Zertifizierung für Trinkwasserprodukte
`;

// ─── Build product-specific prompt ───────────────────────────────────────────
function buildProductPrompt(
  productName: string,
  description: string,
  category: string,
  brand: string,
  pdfContext: string
): string {
  const today = new Date().toISOString().split("T")[0];
  return `Du bist ein Experte für Produktsicherheit, Trinkwasserrecht und Regulatorik (EU, Deutschland, Schweiz).

Analysiere das folgende Produkt des Herstellers RIVA Filter GmbH auf Compliance.

PRODUKT:
Name: ${productName}
Kategorie: ${category}
Marke: ${brand}
Beschreibung: ${description}

KONTEXT AUS INTERNEN PRÜFBERICHTEN:
${pdfContext.slice(0, 3000)}

REGULIERUNGSRAHMEN FÜR TRINKWASSERFILTER:
${WATER_FILTER_REGULATIONS.slice(0, 4000)}

Erstelle eine produktspezifische Compliance-Analyse als JSON-Objekt. Antworte NUR mit dem JSON.

{
  "productName": "${productName}",
  "category": "${category}",
  "analysisDate": "${today}",
  "riskLevel": "critical|high|medium|low",
  "overallAssessment": "2-3 Sätze Gesamtbewertung",
  "criticalIssues": ["Kritisches Problem 1", ...],
  "requiredDocuments": [
    {"document": "Dokumentname", "regulation": "Rechtsgrundlage", "priority": "urgent|high|medium"}
  ],
  "scores": { "overall": 0, "eu": 0, "de": 0, "ch": 0 },
  "items": [
    {
      "regulationCode": "TrinkwV",
      "regulationName": "Trinkwasserverordnung 2023",
      "jurisdiction": "de",
      "status": "fulfilled|partially_fulfilled|not_fulfilled|not_applicable|unclear",
      "criticality": "critical|high|medium|low|info",
      "finding": "Befund für dieses spezifische Produkt",
      "evidence": "Belege oder fehlende Belege",
      "recommendation": "Konkrete Handlungsempfehlung",
      "legalRisk": "Rechtliches Risiko für RIVA (DE/EU)",
      "chRisk": "Risiko für spielzeug3 AG (CH)",
      "documentRequired": "Welches Dokument muss angefordert werden"
    }
  ]
}

Bewerte NUR die für diese Produktkategorie relevanten Regulierungen.
Für Zubehör (Adapter, Schläuche) sind weniger Regulierungen relevant als für Trinkwasserfilter.
Für Outdoor-/Campingfilter sind die Anforderungen besonders streng (Notfall-Wasseraufbereitung).
Sei präzise und produktspezifisch – nicht generisch.`;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const productComplianceCheckRouter = router({
  // List checks for a product
  listForProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(productComplianceChecks)
        .where(eq(productComplianceChecks.productId, input.productId))
        .orderBy(desc(productComplianceChecks.createdAt));
    }),

  // List checks for all products of a supplier
  listForSupplier: protectedProcedure
    .input(z.object({ supplierId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select({
          check: productComplianceChecks,
          product: {
            id: products.id,
            productName: products.productName,
            brand: products.brand,
          },
        })
        .from(productComplianceChecks)
        .innerJoin(products, eq(products.id, productComplianceChecks.productId))
        .where(eq(productComplianceChecks.supplierId, input.supplierId))
        .orderBy(desc(productComplianceChecks.createdAt));
    }),

  // Get items for a check
  getItems: protectedProcedure
    .input(z.object({ checkId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(productComplianceItems)
        .where(eq(productComplianceItems.checkId, input.checkId))
        .orderBy(productComplianceItems.criticality);
    }),

  // Trigger compliance check for a single product
  triggerForProduct: protectedProcedure
    .input(z.object({
      productId: z.number(),
      supplierId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get product info
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, input.productId));
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      // Get existing supplier documents for context
      const docs = await db
        .select({ title: supplierDocuments.title, description: supplierDocuments.description, documentType: supplierDocuments.documentType })
        .from(supplierDocuments)
        .where(eq(supplierDocuments.supplierId, input.supplierId));

      const docContext = docs.length > 0
        ? `Vorhandene Dokumente beim Lieferanten:\n${docs.map(d => `- ${d.documentType}: ${d.title} – ${d.description ?? ""}`).join("\n")}`
        : "Keine Dokumente beim Lieferanten hinterlegt.";

      // Create check record
      const [insertResult] = await db.insert(productComplianceChecks).values({
        productId: input.productId,
        supplierId: input.supplierId,
        status: "running",
        triggeredByUserId: ctx.user.id,
        tenantId: 1,
      });
      const checkId = (insertResult as any).insertId;

      // Run analysis asynchronously (fire and forget, update DB when done)
      (async () => {
        try {
          const category = (product as any).description?.includes("Dusch") ? "Duschfilter"
            : (product as any).description?.includes("Outdoor") || (product as any).description?.includes("Camping") ? "Outdoor-Filter"
            : (product as any).description?.includes("Kartusche") || (product as any).description?.includes("Ersatz") ? "Ersatzkartusche"
            : (product as any).description?.includes("Adapter") || (product as any).description?.includes("Anschluss") ? "Zubehör"
            : "Trinkwasserfilter";

          const prompt = buildProductPrompt(
            product.productName,
            (product as any).description ?? "",
            category,
            product.brand ?? "rivaALVA",
            docContext
          );

          const llmResponse = await invokeLLM({
            messages: [
              { role: "system", content: "Du bist ein Experte für Produktsicherheit und Trinkwasserrecht. Antworte immer mit validem JSON." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
          } as any);

          const rawContent = (llmResponse as any)?.choices?.[0]?.message?.content ?? "{}";
          const analysis = JSON.parse(rawContent);

          // Store items
          if (analysis.items?.length > 0) {
            for (const item of analysis.items) {
              await db.insert(productComplianceItems).values({
                checkId,
                productId: input.productId,
                regulationCode: item.regulationCode ?? "UNKNOWN",
                regulationName: item.regulationName ?? "Unknown",
                jurisdiction: item.jurisdiction ?? "eu",
                status: item.status ?? "unclear",
                criticality: item.criticality ?? "medium",
                finding: item.finding ?? "",
                evidence: item.evidence ?? null,
                recommendation: item.recommendation ?? null,
                legalRisk: item.legalRisk ?? null,
                chRisk: item.chRisk ?? null,
                documentRequired: item.documentRequired ?? null,
              });
            }
          }

          // Determine risk level
          const hasItems = analysis.items ?? [];
          const hasCritical = hasItems.some((i: any) => i.criticality === "critical");
          const hasHigh = hasItems.some((i: any) => i.criticality === "high");
          const riskLevel = hasCritical ? "critical" : hasHigh ? "high" : "medium";

          await db.update(productComplianceChecks)
            .set({
              status: "completed",
              overallScore: analysis.scores?.overall ?? null,
              euScore: analysis.scores?.eu ?? null,
              deScore: analysis.scores?.de ?? null,
              chScore: analysis.scores?.ch ?? null,
              riskLevel,
              analysisResult: analysis,
              criticalIssues: analysis.criticalIssues ?? [],
              requiredDocuments: analysis.requiredDocuments ?? [],
            })
            .where(eq(productComplianceChecks.id, checkId));

        } catch (err: any) {
          await db.update(productComplianceChecks)
            .set({ status: "failed", errorMessage: err.message })
            .where(eq(productComplianceChecks.id, checkId));
        }
      })();

      return { checkId, status: "running" };
    }),

  // Trigger compliance check for ALL products of a supplier (batch)
  triggerBatchForSupplier: protectedProcedure
    .input(z.object({
      supplierId: z.number(),
      productIds: z.array(z.number()).optional(), // if not provided, all products
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get products to analyze
      let productList;
      if (input.productIds && input.productIds.length > 0) {
        productList = await db
          .select()
          .from(products)
          .where(and(
            eq(products.supplierId, input.supplierId),
            inArray(products.id, input.productIds)
          ));
      } else {
        productList = await db
          .select()
          .from(products)
          .where(eq(products.supplierId, input.supplierId));
      }

      if (productList.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No products found" });
      }

      // Limit to 30 products per batch to avoid timeout
      const batch = productList.slice(0, 30);

      // Create check records for all
      const checkIds: number[] = [];
      for (const product of batch) {
        const [insertResult] = await db.insert(productComplianceChecks).values({
          productId: product.id,
          supplierId: input.supplierId,
          status: "pending",
          triggeredByUserId: ctx.user.id,
          tenantId: 1,
        });
        checkIds.push((insertResult as any).insertId);
      }

      // Process asynchronously with delay between each
      (async () => {
        const docs = await db
          .select({ title: supplierDocuments.title, description: supplierDocuments.description, documentType: supplierDocuments.documentType })
          .from(supplierDocuments)
          .where(eq(supplierDocuments.supplierId, input.supplierId));

        const docContext = docs.length > 0
          ? `Vorhandene Dokumente beim Lieferanten:\n${docs.map(d => `- ${d.documentType}: ${d.title}`).join("\n")}`
          : "Keine Dokumente beim Lieferanten hinterlegt.";

        for (let i = 0; i < batch.length; i++) {
          const product = batch[i];
          const checkId = checkIds[i];

          try {
            await db.update(productComplianceChecks)
              .set({ status: "running" })
              .where(eq(productComplianceChecks.id, checkId));

            const desc = (product as any).description ?? "";
            const category = desc.includes("Dusch") ? "Duschfilter"
              : desc.includes("Outdoor") || desc.includes("Camping") ? "Outdoor-Filter"
              : desc.includes("Kartusche") || desc.includes("Ersatz") || product.productName.toLowerCase().includes("ersatz") ? "Ersatzkartusche"
              : desc.includes("Adapter") || desc.includes("Anschluss") || product.productName.toLowerCase().includes("adapter") || product.productName.toLowerCase().includes("anschluss") ? "Zubehör"
              : product.productName.toLowerCase().includes("kalk") ? "Kalkfilter"
              : product.productName.toLowerCase().includes("mex") || product.productName.toLowerCase().includes("pfas") ? "PFAS/Nanoplastik-Filter"
              : "Trinkwasserfilter";

            const prompt = buildProductPrompt(
              product.productName,
              desc,
              category,
              product.brand ?? "rivaALVA",
              docContext
            );

            const llmResponse = await invokeLLM({
              messages: [
                { role: "system", content: "Du bist ein Experte für Produktsicherheit und Trinkwasserrecht. Antworte mit validem JSON." },
                { role: "user", content: prompt },
              ],
              response_format: { type: "json_object" },
            } as any);

            const rawContent = (llmResponse as any)?.choices?.[0]?.message?.content ?? "{}";
            const analysis = JSON.parse(rawContent);

            if (analysis.items?.length > 0) {
              for (const item of analysis.items) {
                await db.insert(productComplianceItems).values({
                  checkId,
                  productId: product.id,
                  regulationCode: item.regulationCode ?? "UNKNOWN",
                  regulationName: item.regulationName ?? "Unknown",
                  jurisdiction: item.jurisdiction ?? "eu",
                  status: item.status ?? "unclear",
                  criticality: item.criticality ?? "medium",
                  finding: item.finding ?? "",
                  evidence: item.evidence ?? null,
                  recommendation: item.recommendation ?? null,
                  legalRisk: item.legalRisk ?? null,
                  chRisk: item.chRisk ?? null,
                  documentRequired: item.documentRequired ?? null,
                });
              }
            }

            const hasItems = analysis.items ?? [];
            const hasCritical = hasItems.some((it: any) => it.criticality === "critical");
            const hasHigh = hasItems.some((it: any) => it.criticality === "high");
            const riskLevel = hasCritical ? "critical" : hasHigh ? "high" : "medium";

            await db.update(productComplianceChecks)
              .set({
                status: "completed",
                overallScore: analysis.scores?.overall ?? null,
                euScore: analysis.scores?.eu ?? null,
                deScore: analysis.scores?.de ?? null,
                chScore: analysis.scores?.ch ?? null,
                riskLevel,
                analysisResult: analysis,
                criticalIssues: analysis.criticalIssues ?? [],
                requiredDocuments: analysis.requiredDocuments ?? [],
              })
              .where(eq(productComplianceChecks.id, checkId));

          } catch (err: any) {
            await db.update(productComplianceChecks)
              .set({ status: "failed", errorMessage: err.message })
              .where(eq(productComplianceChecks.id, checkId));
          }

          // Delay between products to avoid rate limiting
          if (i < batch.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      })();

      return {
        started: batch.length,
        total: productList.length,
        checkIds,
        message: `Started analysis for ${batch.length} products`,
      };
    }),

  // Get regulation penalty database
  getRegulationPenalties: protectedProcedure
    .query(async () => {
      return {
        penalties: REGULATION_PENALTIES,
        chOnlyRisks: CH_ONLY_RISKS,
        chResidualRisks: getChResidualRisks(),
      };
    }),

  // CH residual risk simulation: what CH risks remain if all DE/EU items were fulfilled?
  getChResidualRiskSimulation: protectedProcedure
    .input(z.object({ checkId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const items = await db
        .select()
        .from(productComplianceItems)
        .where(eq(productComplianceItems.checkId, input.checkId));

      const deEuItems = items.filter(i => i.jurisdiction === "eu" || i.jurisdiction === "de");
      const chItems = items.filter(i => i.jurisdiction === "ch");

      // Enrich items with penalty info
      const enrichItem = (item: typeof items[0]) => {
        const penalty = REGULATION_PENALTIES.find(
          p => p.code === item.regulationCode ||
          item.regulationCode?.startsWith(p.code.split("-")[0])
        );
        return { ...item, penaltyInfo: penalty ?? null };
      };

      // CH residual risks from DE/EU regulations (what remains if DE/EU is clean)
      const chResidualFromDeEu = REGULATION_PENALTIES
        .filter(p => p.chResidualRisk !== null)
        .map(p => ({
          code: p.code,
          name: p.name,
          residualRisk: p.chResidualRisk,
          reducedByDeCompliance: p.chReducedByDeCompliance,
          maxFine: p.maxFine,
          currentDeEuStatus: deEuItems.find(i => i.regulationCode === p.code)?.status ?? "unknown",
        }));

      // CH-only risks that always remain
      const alwaysChRisks = CH_ONLY_RISKS.map(r => ({
        ...r,
        currentChStatus: chItems.find(i => i.regulationCode === r.code)?.status ?? "unknown",
      }));

      const deEuIssues = deEuItems.filter(i =>
        i.status === "not_fulfilled" || i.status === "partially_fulfilled"
      ).length;
      const chIssues = chItems.filter(i =>
        i.status === "not_fulfilled" || i.status === "partially_fulfilled"
      ).length;

      return {
        deEuItems: deEuItems.map(enrichItem),
        chItems: chItems.map(enrichItem),
        chResidualFromDeEu,
        alwaysChRisks,
        summary: {
          totalDeEuIssues: deEuIssues,
          totalChIssues: chIssues,
          chRisksIfDeClean:
            chResidualFromDeEu.filter(r => r.residualRisk).length +
            alwaysChRisks.filter(r => !r.reducedByDeCompliance).length,
        },
      };
    }),

  // Delete a check
  deleteCheck: protectedProcedure
    .input(z.object({ checkId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(productComplianceItems).where(eq(productComplianceItems.checkId, input.checkId));
      await db.delete(productComplianceChecks).where(eq(productComplianceChecks.id, input.checkId));
      return { success: true };
    }),
});
