/**
 * Case cost-centre and expense tracking for the Incident & Recall module.
 * Every entry remains linked to the incident and is never hard-deleted.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  incidents,
  incidentCostCenters,
  incidentCostEntries,
  incidentTimeline,
  type IncidentCostCenter,
  type IncidentCostEntry,
} from "../../../drizzle/schema";
import { getDb } from "../../db";
import { requireRole, type UserContext } from "../../shared";

export const INCIDENT_COST_CATEGORIES = [
  "internal_time",
  "logistics",
  "legal",
  "expert_opinion",
  "laboratory",
  "authority_fees",
  "customer_remediation",
  "travel",
  "communication",
  "other",
] as const;

export const INCIDENT_COST_STATUSES = [
  "planned",
  "incurred",
  "invoiced",
  "paid",
  "submitted_to_insurer",
  "partially_reimbursed",
  "reimbursed",
  "disputed",
  "voided",
] as const;

export type IncidentCostCategory = (typeof INCIDENT_COST_CATEGORIES)[number];
export type IncidentCostStatus = (typeof INCIDENT_COST_STATUSES)[number];

const COST_ACCESS_ROLES = ["compliance_manager", "administrator", "super_admin", "internal_employee"] as const;

function tenantIdOf(user: UserContext) {
  return user.tenantId ?? 1;
}

function userIdOf(user: UserContext) {
  return user.id ? Number(user.id) : 0;
}

function toMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Exposed for regression tests and for consistent time-cost calculations. */
export function calculateIncidentCostAmounts(input: {
  hours?: number | null;
  hourlyRate?: number | null;
  amountNet?: number | null;
  vatRate?: number | null;
}) {
  const hasHours = input.hours !== undefined && input.hours !== null;
  const hasRate = input.hourlyRate !== undefined && input.hourlyRate !== null;
  let amountNet: number;

  if (hasHours || hasRate) {
    if (!hasHours || !hasRate) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Hours and hourly rate must be supplied together." });
    }
    if (Number(input.hours) < 0 || Number(input.hourlyRate) < 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Hours and hourly rate cannot be negative." });
    }
    amountNet = toMoney(Number(input.hours) * Number(input.hourlyRate));
  } else {
    if (input.amountNet === undefined || input.amountNet === null || Number(input.amountNet) < 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A non-negative net amount is required." });
    }
    amountNet = toMoney(Number(input.amountNet));
  }

  const vatRate = input.vatRate ?? 0;
  if (vatRate < 0 || vatRate > 100) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "VAT rate must be between 0 and 100." });
  }
  const vatAmount = toMoney(amountNet * (vatRate / 100));
  return { amountNet, vatAmount, amountGross: toMoney(amountNet + vatAmount) };
}

export function makeIncidentCostCenterCode(incidentId: number, date = new Date()) {
  return `IC-${date.getUTCFullYear()}-${String(incidentId).padStart(6, "0")}`;
}

async function assertIncidentAccess(user: UserContext, incidentId: number) {
  requireRole(user.complianceRole, [...COST_ACCESS_ROLES]);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const [incident] = await db
    .select({ id: incidents.id, title: incidents.title, productId: incidents.productId })
    .from(incidents)
    .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantIdOf(user))));
  if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." });
  return { db, incident };
}

async function addCostTimeline(
  incidentId: number,
  user: UserContext,
  action: string,
  note: string,
  metadata?: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) return;
  await db.insert(incidentTimeline).values({
    incidentId,
    action,
    performedByUserId: userIdOf(user),
    performedByName: null,
    note,
    metadata: metadata ?? null,
  } as any);
}

function summarize(entries: IncidentCostEntry[]) {
  const nonVoided = entries.filter((entry) => entry.status !== "voided");
  const total = (key: "amountNet" | "vatAmount" | "amountGross", source = nonVoided) =>
    toMoney(source.reduce((sum, entry) => sum + Number(entry[key] ?? 0), 0));
  const byCategory = Object.fromEntries(INCIDENT_COST_CATEGORIES.map((category) => {
    const source = nonVoided.filter((entry) => entry.category === category);
    return [category, { count: source.length, gross: total("amountGross", source) }];
  }));
  const byStatus = Object.fromEntries(INCIDENT_COST_STATUSES.map((status) => {
    const source = entries.filter((entry) => entry.status === status);
    return [status, { count: source.length, gross: total("amountGross", source) }];
  }));
  return {
    entryCount: entries.length,
    activeEntryCount: nonVoided.length,
    totalNet: total("amountNet"),
    totalVat: total("vatAmount"),
    totalGross: total("amountGross"),
    voidedGross: total("amountGross", entries.filter((entry) => entry.status === "voided")),
    totalHours: toMoney(nonVoided.reduce((sum, entry) => sum + Number(entry.hours ?? 0), 0)),
    documentedEntryCount: nonVoided.filter((entry) => Boolean(entry.receiptFileUrl)).length,
    undocumentedEntryCount: nonVoided.filter((entry) => !entry.receiptFileUrl).length,
    byCategory,
    byStatus,
  };
}

export const incidentCostService = {
  async getByIncident(user: UserContext, incidentId: number) {
    const { db } = await assertIncidentAccess(user, incidentId);
    const [costCenter] = await db
      .select()
      .from(incidentCostCenters)
      .where(and(eq(incidentCostCenters.incidentId, incidentId), eq(incidentCostCenters.tenantId, tenantIdOf(user))));
    const entries = costCenter
      ? await db.select().from(incidentCostEntries)
        .where(and(eq(incidentCostEntries.incidentId, incidentId), eq(incidentCostEntries.tenantId, tenantIdOf(user))) )
        .orderBy(desc(incidentCostEntries.incurredAt), desc(incidentCostEntries.createdAt))
      : [];
    return { costCenter: costCenter ?? null, entries, summary: summarize(entries) };
  },

  async createCostCenter(user: UserContext, input: {
    incidentId: number;
    name?: string;
    costCenterCode?: string;
    currency?: string;
    insurerName?: string;
    insurerClaimReference?: string;
    notes?: string;
  }) {
    const { db, incident } = await assertIncidentAccess(user, input.incidentId);
    const [existing] = await db.select({ id: incidentCostCenters.id }).from(incidentCostCenters)
      .where(and(eq(incidentCostCenters.incidentId, input.incidentId), eq(incidentCostCenters.tenantId, tenantIdOf(user))));
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "A cost centre already exists for this incident." });

    const code = (input.costCenterCode?.trim().toUpperCase() || makeIncidentCostCenterCode(input.incidentId));
    const [result] = await db.insert(incidentCostCenters).values({
      incidentId: input.incidentId,
      tenantId: tenantIdOf(user),
      costCenterCode: code,
      name: input.name?.trim() || `Case costs – ${incident.title}`,
      currency: (input.currency ?? "CHF").toUpperCase(),
      insurerName: input.insurerName?.trim() || null,
      insurerClaimReference: input.insurerClaimReference?.trim() || null,
      notes: input.notes?.trim() || null,
      createdByUserId: userIdOf(user),
    } as any).$returningId();
    const id = (result as any).id as number;
    await addCostTimeline(input.incidentId, user, "cost_center_created", `Kostenstelle eröffnet: ${code}`, { costCenterId: id, code });
    return { id, costCenterCode: code };
  },

  async updateCostCenter(user: UserContext, input: {
    id: number;
    name?: string;
    status?: IncidentCostCenter["status"];
    insurerName?: string | null;
    insurerClaimReference?: string | null;
    notes?: string | null;
  }) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin"]);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const [center] = await db.select().from(incidentCostCenters).where(and(eq(incidentCostCenters.id, input.id), eq(incidentCostCenters.tenantId, tenantIdOf(user))));
    if (!center) throw new TRPCError({ code: "NOT_FOUND", message: "Cost centre not found." });
    const { id, ...data } = input;
    await db.update(incidentCostCenters).set(data as any).where(eq(incidentCostCenters.id, id));
    await addCostTimeline(center.incidentId, user, "cost_center_updated", `Kostenstelle aktualisiert: ${center.costCenterCode}`, { costCenterId: id });
    return { success: true };
  },

  async addEntry(user: UserContext, input: {
    incidentId: number;
    category: IncidentCostCategory;
    description: string;
    incurredAt: Date;
    counterparty?: string;
    invoiceNumber?: string;
    hours?: number;
    hourlyRate?: number;
    amountNet?: number;
    vatRate?: number;
    currency?: string;
    status?: IncidentCostStatus;
    insurerReference?: string;
  }) {
    const { db } = await assertIncidentAccess(user, input.incidentId);
    const [costCenter] = await db.select().from(incidentCostCenters)
      .where(and(eq(incidentCostCenters.incidentId, input.incidentId), eq(incidentCostCenters.tenantId, tenantIdOf(user))));
    if (!costCenter) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Create a cost centre before recording costs." });
    if (costCenter.status === "closed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The cost centre is closed." });

    const amounts = calculateIncidentCostAmounts(input);
    const [result] = await db.insert(incidentCostEntries).values({
      incidentId: input.incidentId,
      costCenterId: costCenter.id,
      tenantId: tenantIdOf(user),
      category: input.category,
      description: input.description.trim(),
      incurredAt: input.incurredAt,
      counterparty: input.counterparty?.trim() || null,
      invoiceNumber: input.invoiceNumber?.trim() || null,
      hours: input.hours !== undefined ? input.hours.toFixed(2) : null,
      hourlyRate: input.hourlyRate !== undefined ? input.hourlyRate.toFixed(2) : null,
      amountNet: amounts.amountNet.toFixed(2),
      vatAmount: amounts.vatAmount.toFixed(2),
      amountGross: amounts.amountGross.toFixed(2),
      currency: (input.currency ?? costCenter.currency ?? "CHF").toUpperCase(),
      status: input.status ?? "incurred",
      insurerReference: input.insurerReference?.trim() || null,
      createdByUserId: userIdOf(user),
    } as any).$returningId();
    const id = (result as any).id as number;
    await addCostTimeline(input.incidentId, user, "cost_entry_added", `Kostenposition erfasst: ${input.category} · ${amounts.amountGross.toFixed(2)} ${(input.currency ?? costCenter.currency ?? "CHF").toUpperCase()}`, { costEntryId: id, category: input.category, amountGross: amounts.amountGross });
    return { id, ...amounts };
  },

  async attachReceipt(user: UserContext, input: {
    entryId: number;
    fileName: string;
    fileUrl: string;
    fileKey: string;
    mimeType?: string;
    fileSizeBytes?: number;
  }) {
    requireRole(user.complianceRole, [...COST_ACCESS_ROLES]);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const [entry] = await db.select().from(incidentCostEntries)
      .where(and(eq(incidentCostEntries.id, input.entryId), eq(incidentCostEntries.tenantId, tenantIdOf(user))));
    if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Cost entry not found." });
    await db.update(incidentCostEntries).set({
      receiptFileName: input.fileName,
      receiptFileUrl: input.fileUrl,
      receiptFileKey: input.fileKey,
      receiptMimeType: input.mimeType ?? null,
      receiptFileSizeBytes: input.fileSizeBytes ?? null,
    } as any).where(eq(incidentCostEntries.id, input.entryId));
    await addCostTimeline(entry.incidentId, user, "cost_receipt_attached", `Beleg zu Kostenposition hinzugefügt: ${input.fileName}`, { costEntryId: input.entryId });
    return { success: true };
  },

  async updateEntryStatus(user: UserContext, input: {
    id: number;
    status: IncidentCostStatus;
    insurerReference?: string | null;
    voidReason?: string | null;
  }) {
    requireRole(user.complianceRole, ["compliance_manager", "administrator", "super_admin"]);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const [entry] = await db.select().from(incidentCostEntries)
      .where(and(eq(incidentCostEntries.id, input.id), eq(incidentCostEntries.tenantId, tenantIdOf(user))));
    if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Cost entry not found." });
    if (input.status === "voided" && !input.voidReason?.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A reason is required when voiding a cost entry." });
    }
    await db.update(incidentCostEntries).set({
      status: input.status,
      insurerReference: input.insurerReference?.trim() || null,
      voidReason: input.status === "voided" ? input.voidReason?.trim() || null : null,
    } as any).where(eq(incidentCostEntries.id, input.id));
    await addCostTimeline(entry.incidentId, user, "cost_entry_status_changed", `Kostenposition-Status: ${entry.status} → ${input.status}`, { costEntryId: entry.id, status: input.status });
    return { success: true };
  },
};
