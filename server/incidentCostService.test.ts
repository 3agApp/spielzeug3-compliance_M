import { describe, expect, it } from "vitest";
import { calculateIncidentCostAmounts, incidentCostService, makeIncidentCostCenterCode } from "../server/domains/incidents/incidentCostService";

describe("incident cost calculation", () => {
  it("calculates an internal time entry from hours, rate and VAT", () => {
    expect(calculateIncidentCostAmounts({ hours: 3.5, hourlyRate: 145, vatRate: 8.1 })).toEqual({
      amountNet: 507.5,
      vatAmount: 41.11,
      amountGross: 548.61,
    });
  });

  it("retains a direct expense without VAT", () => {
    expect(calculateIncidentCostAmounts({ amountNet: 2400, vatRate: 0 })).toEqual({
      amountNet: 2400,
      vatAmount: 0,
      amountGross: 2400,
    });
  });

  it("rejects incomplete time tracking inputs", () => {
    expect(() => calculateIncidentCostAmounts({ hours: 2, vatRate: 8.1 })).toThrow("Hours and hourly rate");
  });

  it("creates a stable, traceable cost-centre code", () => {
    expect(makeIncidentCostCenterCode(42, new Date("2026-09-02T12:00:00Z"))).toBe("IC-2026-000042");
  });

  it("blocks supplier accounts from reading protected case costs", async () => {
    await expect(incidentCostService.getByIncident({ id: 9, tenantId: 1, complianceRole: "supplier" } as any, 30001)).rejects.toThrow();
  });

  it("blocks supplier accounts from attaching a receipt to an expense", async () => {
    await expect(incidentCostService.attachReceipt({ id: 9, tenantId: 1, complianceRole: "supplier" } as any, {
      entryId: 1,
      fileName: "invoice.pdf",
      fileUrl: "https://example.com/invoice.pdf",
      fileKey: "test/invoice.pdf",
    })).rejects.toThrow();
  });
});
