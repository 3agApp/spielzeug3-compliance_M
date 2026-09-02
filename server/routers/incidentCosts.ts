import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import {
  INCIDENT_COST_CATEGORIES,
  INCIDENT_COST_STATUSES,
  incidentCostService,
} from "../domains/incidents/incidentCostService";

const CostCategorySchema = z.enum(INCIDENT_COST_CATEGORIES);
const CostStatusSchema = z.enum(INCIDENT_COST_STATUSES);

export const incidentCostsRouter = router({
  getByIncident: protectedProcedure
    .input(z.object({ incidentId: z.number().int().positive() }))
    .query(({ ctx, input }) => incidentCostService.getByIncident(ctx.user, input.incidentId)),

  createCostCenter: protectedProcedure
    .input(z.object({
      incidentId: z.number().int().positive(),
      name: z.string().min(3).max(255).optional(),
      costCenterCode: z.string().min(3).max(64).optional(),
      currency: z.string().length(3).optional(),
      insurerName: z.string().max(255).optional(),
      insurerClaimReference: z.string().max(128).optional(),
      notes: z.string().max(5000).optional(),
    }))
    .mutation(({ ctx, input }) => incidentCostService.createCostCenter(ctx.user, input)),

  updateCostCenter: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(3).max(255).optional(),
      status: z.enum(["open", "on_hold", "closed"]).optional(),
      insurerName: z.string().max(255).nullable().optional(),
      insurerClaimReference: z.string().max(128).nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
    }))
    .mutation(({ ctx, input }) => incidentCostService.updateCostCenter(ctx.user, input)),

  addEntry: protectedProcedure
    .input(z.object({
      incidentId: z.number().int().positive(),
      category: CostCategorySchema,
      description: z.string().min(3).max(10000),
      incurredAt: z.date(),
      counterparty: z.string().max(255).optional(),
      invoiceNumber: z.string().max(128).optional(),
      hours: z.number().min(0).max(10000).optional(),
      hourlyRate: z.number().min(0).max(100000).optional(),
      amountNet: z.number().min(0).max(100000000).optional(),
      vatRate: z.number().min(0).max(100).optional(),
      currency: z.string().length(3).optional(),
      status: CostStatusSchema.optional(),
      insurerReference: z.string().max(128).optional(),
    }).refine((value) => (value.hours === undefined && value.hourlyRate === undefined) || (value.hours !== undefined && value.hourlyRate !== undefined), {
      message: "Hours and hourly rate must be supplied together.",
      path: ["hours"],
    }))
    .mutation(({ ctx, input }) => incidentCostService.addEntry(ctx.user, input)),

  uploadReceipt: protectedProcedure
    .input(z.object({
      entryId: z.number().int().positive(),
      fileName: z.string().min(1).max(512),
      mimeType: z.string().max(128).optional(),
      fileSizeBytes: z.number().int().positive().max(15 * 1024 * 1024).optional(),
      fileBase64: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 15 * 1024 * 1024) throw new Error("Receipt exceeds 15 MB.");
      const key = `incidents/cost-receipts/${input.entryId}/${Date.now().toString(36)}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType ?? "application/octet-stream");
      return incidentCostService.attachReceipt(ctx.user, {
        entryId: input.entryId,
        fileName: input.fileName,
        fileUrl: url,
        fileKey: key,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes ?? buffer.length,
      });
    }),

  updateEntryStatus: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      status: CostStatusSchema,
      insurerReference: z.string().max(128).nullable().optional(),
      voidReason: z.string().max(5000).nullable().optional(),
    }))
    .mutation(({ ctx, input }) => incidentCostService.updateEntryStatus(ctx.user, input)),
});
