export type SwissBatchVerificationStatus =
  | "verified"
  | "registered_pending"
  | "invalid"
  | "not_configured";

export function normalizeSwissVerificationNumber(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function verifySwissBatchNumber(input: {
  storedVerificationNumber: string | null | undefined;
  submittedVerificationNumber: string;
  sealStatus: "verified" | "in_progress" | "not_verified";
}): SwissBatchVerificationStatus {
  const stored = normalizeSwissVerificationNumber(input.storedVerificationNumber);
  const submitted = normalizeSwissVerificationNumber(input.submittedVerificationNumber);

  if (!stored) return "not_configured";
  if (!submitted || stored !== submitted) return "invalid";
  return input.sealStatus === "verified" ? "verified" : "registered_pending";
}
