/**
 * server/routers/documents.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin tRPC router for the Documents domain.
 * All business logic lives in documentService.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { documentService } from "../domains/documents/documentService";
import { riskAssessmentService } from "../domains/risk/riskAssessmentService";
import { getSystemSetting } from "../db";
import { toTRPCError } from "../shared";
import { invokeLLM } from "../_core/llm";

const DOCUMENT_TYPES = [
  "test_report",
  "declaration_of_conformity",
  "manual",
  "certificate",
  "product_image",
  "safety_image",
  "regulatory_document",
  "other",
] as const;

const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;

export const documentsRouter = router({
  listArchivedVersions: protectedProcedure
    .input(z.object({ productId: z.number(), documentType: z.enum(DOCUMENT_TYPES) }))
    .query(async ({ ctx, input }) => {
      try {
        return await documentService.listArchivedVersions(ctx.user as any, input.productId, input.documentType);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  listByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        return await documentService.listByProduct(ctx.user as any, input.productId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  upload: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        documentType: z.enum(DOCUMENT_TYPES),
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string(),
        fileSizeBytes: z.number().optional(),
        expiryDate: z.string().optional(),
        requirementId: z.number().optional(),
        operatorComment: z.string().max(500).optional(),
        replacesDocumentId: z.number().optional(),
        addAsNew: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await documentService.upload(ctx.user as any, input);
        // Fire-and-forget: auto risk re-assessment after every document upload
        void (async () => {
          try {
            const setting = await getSystemSetting("RISK_AUTO_REASSESS");
            const enabled =
              setting === null ||
              setting?.settingValue === null ||
              setting?.settingValue === "true" ||
              setting?.settingValue === "1";
            if (enabled) {
              await riskAssessmentService.runAutomatic(
                input.productId,
                (ctx.user as any).id
              );
            }
          } catch {
            // never block the upload response
          }
        })();
        return result;
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  updateReviewStatus: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        reviewStatus: z.enum(REVIEW_STATUSES),
        reviewNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await documentService.updateReviewStatus(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      productId: z.number().optional(),
      operatorComment: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await documentService.delete(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /**
   * KI-gestützte Dokumenttyp-Erkennung für mehrere Dateien gleichzeitig.
   * Analysiert Dateinamen und MIME-Typen und gibt Typ-Vorschläge mit Konfidenz zurück.
   */
  classifyBatch: protectedProcedure
    .input(
      z.object({
        files: z.array(
          z.object({
            fileName: z.string(),
            mimeType: z.string(),
            fileSizeBytes: z.number().optional(),
          })
        ).max(20),
        productContext: z.object({
          name: z.string().optional(),
          category: z.string().optional(),
        }).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const docTypeDescriptions: Record<string, string> = {
          test_report: "Prüfbericht / Test Report (z.B. EN 71, CPSIA, Sicherheitstest)",
          declaration_of_conformity: "Konformitätserklärung / Declaration of Conformity / DoC / CE-Erklärung",
          manual: "Bedienungsanleitung / Manual / Gebrauchsanweisung / Instructions",
          certificate: "Zertifikat / Certificate (z.B. ISO, GS-Zeichen, TÜV)",
          product_image: "Produktbild / Product Image / Foto des Produkts",
          safety_image: "Sicherheitsbild / Safety Image / Warnhinweis-Grafik",
          regulatory_document: "Regulatorisches Dokument / Regulatory Document (z.B. REACH, RoHS, SVHC)",
          other: "Sonstiges / Other",
        };

        const fileList = input.files
          .map((f, i) => `${i + 1}. Dateiname: "${f.fileName}", MIME: "${f.mimeType}"${f.fileSizeBytes ? `, Größe: ${Math.round(f.fileSizeBytes / 1024)}KB` : ""}`)
          .join("\n");

        const typeList = Object.entries(docTypeDescriptions)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n");

        const productCtx = input.productContext?.name
          ? `Produktkontext: ${input.productContext.name}${input.productContext.category ? ` (Kategorie: ${input.productContext.category})` : ""}`
          : "";

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Du bist ein Experte für Produktcompliance und Dokumentenklassifizierung im Spielzeugbereich. Analysiere die folgenden Dateinamen und weise jedem Dokument den passendsten Typ zu. Antworte ausschließlich mit einem validen JSON-Array.`,
            },
            {
              role: "user",
              content: `${productCtx ? productCtx + "\n\n" : ""}Verfügbare Dokumenttypen:\n${typeList}\n\nDateien zum Klassifizieren:\n${fileList}\n\nAntworte mit einem JSON-Array mit genau ${input.files.length} Objekten, eines pro Datei, in derselben Reihenfolge:\n[{"documentType": "<typ>", "confidence": "high|medium|low", "reason": "<kurze Begründung auf Deutsch>"}]`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "document_classifications",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  classifications: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        documentType: { type: "string" },
                        confidence: { type: "string" },
                        reason: { type: "string" },
                      },
                      required: ["documentType", "confidence", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["classifications"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices?.[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : "{}";
        const parsed = JSON.parse(content) as { classifications: Array<{ documentType: string; confidence: string; reason: string }> };

        // Validate and sanitize: ensure documentType is a valid DOCUMENT_TYPE
        const validTypes = ["test_report","declaration_of_conformity","manual","certificate","product_image","safety_image","regulatory_document","other"];
        return parsed.classifications.map((c, i) => ({
          fileName: input.files[i]?.fileName ?? "",
          documentType: validTypes.includes(c.documentType) ? c.documentType : "other",
          confidence: ["high", "medium", "low"].includes(c.confidence) ? c.confidence : "low",
          reason: c.reason ?? "",
        }));
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /**
   * Batch-Upload: mehrere Dokumente gleichzeitig hochladen.
   */
  uploadBatch: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        files: z.array(
          z.object({
            documentType: z.enum(DOCUMENT_TYPES),
            fileName: z.string(),
            fileBase64: z.string(),
            mimeType: z.string(),
            fileSizeBytes: z.number().optional(),
            expiryDate: z.string().optional(),
            replacesDocumentId: z.number().optional(),
            addAsNew: z.boolean().optional(),
          })
        ).min(1).max(20),
        operatorComment: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const results = [];
        for (const file of input.files) {
          const result = await documentService.upload(ctx.user as any, {
            productId: input.productId,
            documentType: file.documentType,
            fileName: file.fileName,
            fileBase64: file.fileBase64,
            mimeType: file.mimeType,
            fileSizeBytes: file.fileSizeBytes,
            expiryDate: file.expiryDate,
            replacesDocumentId: file.replacesDocumentId,
            addAsNew: file.addAsNew,
            operatorComment: input.operatorComment,
          });
          results.push({ fileName: file.fileName, ...result });
        }
        // Fire-and-forget: auto risk re-assessment after batch upload
        void (async () => {
          try {
            const setting = await getSystemSetting("RISK_AUTO_REASSESS");
            const enabled = setting === null || setting?.settingValue === null || setting?.settingValue === "true" || setting?.settingValue === "1";
            if (enabled) await riskAssessmentService.runAutomatic(input.productId, (ctx.user as any).id);
          } catch { /* never block */ }
        })();
        return { success: true, uploaded: results.length, results };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /**
   * Toggle the publicDownload flag for a document.
   * Only operators (administrator / compliance_manager / internal_employee) may do this.
   */
  togglePublicDownload: protectedProcedure
    .input(z.object({ documentId: z.number(), publicDownload: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await documentService.togglePublicDownload(ctx.user as any, input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /**
   * Manually trigger revocation of expired public documents.
   * Only administrator / compliance_manager may call this.
   * Pass force=true to bypass the AUTO_REVOKE_EXPIRED_PUBLIC_DOCS setting.
   */
  revokeExpiredPublic: protectedProcedure
    .input(z.object({ force: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await documentService.revokeExpiredPublicDocuments(
          ctx.user as any,
          { force: input.force }
        );
      } catch (err) {
        throw toTRPCError(err);
      }
    }),
});
