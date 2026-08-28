import { describe, expect, it } from "vitest";
import {
  normalizeSwissVerificationNumber,
  verifySwissBatchNumber,
} from "./domains/tenants/swissBatchVerification";

describe("Swiss batch verification", () => {
  it("normalises whitespace and letter case", () => {
    expect(normalizeSwissVerificationNumber(" sps-ch-60001-2026-001 ")).toBe("SPS-CH-60001-2026-001");
  });

  it("verifies a matching registered batch for a verified product", () => {
    expect(verifySwissBatchNumber({
      storedVerificationNumber: "SPS-CH-60001-2026-001",
      submittedVerificationNumber: "sps-ch-60001-2026-001",
      sealStatus: "verified",
    })).toBe("verified");
  });

  it("reports a matching batch as pending while the product is not yet verified", () => {
    expect(verifySwissBatchNumber({
      storedVerificationNumber: "SPS-CH-60001-2026-001",
      submittedVerificationNumber: "SPS-CH-60001-2026-001",
      sealStatus: "in_progress",
    })).toBe("registered_pending");
  });

  it("does not validate a non-matching batch", () => {
    expect(verifySwissBatchNumber({
      storedVerificationNumber: "SPS-CH-60001-2026-001",
      submittedVerificationNumber: "SPS-CH-OTHER",
      sealStatus: "verified",
    })).toBe("invalid");
  });

  it("does not issue a false confirmation if no internal number was assigned", () => {
    expect(verifySwissBatchNumber({
      storedVerificationNumber: null,
      submittedVerificationNumber: "SPS-CH-60001-2026-001",
      sealStatus: "verified",
    })).toBe("not_configured");
  });
});
