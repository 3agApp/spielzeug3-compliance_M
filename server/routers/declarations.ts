/**
 * server/routers/declarations.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * tRPC procedures for Declarations of Conformity (DoC).
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { declarationService } from "../domains/declarations/declarationService";
import { TRPCError } from "@trpc/server";

export const declarationsRouter = router({
  // ── List declarations for a product ──────────────────────────────────────
  listByProduct: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      return declarationService.listByProduct(ctx.user, input.productId);
    }),

  // ── List all declarations (index page) ───────────────────────────────────
  listAll: protectedProcedure
    .query(async ({ ctx }) => {
      return declarationService.listAll(ctx.user);
    }),

  // ── Get single declaration ────────────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return declarationService.getById(ctx.user, input.id);
    }),

  // ── Create declaration ────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      productId: z.number(),
      supplierId: z.number(),
      effectiveProductName: z.string().optional(),
      effectiveAgeGrading: z.string().optional(),
      euDirectives: z.array(z.string()).optional(),
      chRegulations: z.array(z.string()).optional(),
      standards: z.array(z.string()).optional(),
      testReportRef: z.string().optional(),
      notifiedBody: z.string().optional(),
      chConformityBody: z.string().optional(),
      issuedDate: z.string().optional(),
      issuedPlace: z.string().optional(),
      manufacturerContactName: z.string().optional(),
      manufacturerContactEmail: z.string().email().optional(),
      annexArticleIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return declarationService.create(ctx.user, input);
    }),

  // ── Update draft fields ───────────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      effectiveProductName: z.string().optional(),
      effectiveAgeGrading: z.string().optional(),
      euDirectives: z.array(z.string()).optional(),
      chRegulations: z.array(z.string()).optional(),
      standards: z.array(z.string()).optional(),
      testReportRef: z.string().optional(),
      notifiedBody: z.string().optional(),
      chConformityBody: z.string().optional(),
      issuedDate: z.string().optional(),
      issuedPlace: z.string().optional(),
      manufacturerContactName: z.string().optional(),
      manufacturerContactEmail: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      return declarationService.update(ctx.user, id, fields);
    }),

  // ── Send to manufacturer ──────────────────────────────────────────────────
  sendToManufacturer: protectedProcedure
    .input(z.object({
      id: z.number(),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      return declarationService.sendToManufacturer(ctx.user, input.id, input.origin);
    }),

  // ── Regenerate portal token ───────────────────────────────────────────────
  regenerateToken: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return declarationService.regenerateToken(ctx.user, input.id);
    }),

  // ── AI validation ─────────────────────────────────────────────────────────
  validateWithAi: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return declarationService.validateWithAi(ctx.user, input.id);
    }),

  // ── Archive ───────────────────────────────────────────────────────────────
  archive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return declarationService.archive(ctx.user, input.id);
    }),

  // ── Public: get by portal token (no auth) ────────────────────────────────
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      try {
        return await declarationService.getByToken(input.token);
      } catch (e: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: e.message ?? "Not found" });
      }
    }),

  // ── Public: submit signed PDF via manufacturer portal ────────────────────
  submitSignedPdf: publicProcedure
    .input(z.object({
      token: z.string(),
      signedPdfBase64: z.string(),
      signatoryName: z.string().min(1),
      signatoryPosition: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        return await declarationService.submitSignedPdf(input.token, {
          signedPdfBase64: input.signedPdfBase64,
          signatoryName: input.signatoryName,
          signatoryPosition: input.signatoryPosition,
        });
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: e.message ?? "Submission failed" });
      }
    }),
});
