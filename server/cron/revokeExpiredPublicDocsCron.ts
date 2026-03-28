/**
 * server/cron/revokeExpiredPublicDocsCron.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Daily cron job that revokes publicDownload=true on all documents whose
 * expiryDate has passed, if the AUTO_REVOKE_EXPIRED_PUBLIC_DOCS setting is
 * enabled (default: true).
 *
 * Scheduling: runs once at server start (to catch any overnight expiries) and
 * then every 24 hours.  Uses a lightweight setInterval – no external cron
 * library required.
 */

import { getSystemSetting, revokeExpiredPublicDocuments } from "../db";
import { createAuditLog } from "../db";

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function runRevoke() {
  try {
    // Respect the system setting
    const setting = await getSystemSetting("AUTO_REVOKE_EXPIRED_PUBLIC_DOCS");
    const enabled =
      setting === null ||
      setting === undefined ||
      (setting.settingValue !== "false" && setting.settingValue !== "0");

    if (!enabled) {
      console.log("[cron] AUTO_REVOKE_EXPIRED_PUBLIC_DOCS is disabled – skipping.");
      return;
    }

    const revokedIds = await revokeExpiredPublicDocuments();

    if (revokedIds.length > 0) {
      console.log(
        `[cron] Auto-revoked publicDownload on ${revokedIds.length} expired document(s): [${revokedIds.join(", ")}]`
      );
      // Write a single summary audit-log entry (system actor, userId 0)
      await createAuditLog({
        entityType: "system",
        entityId: 0,
        action: "cron_revoke_expired_public_docs",
        performedByUserId: 0,
        actorRole: "operator",
        actorName: "System (Cron)",
        payloadSnapshot: {
          revokedDocumentIds: revokedIds,
          revokedCount: revokedIds.length,
        } as any,
      });
    } else {
      console.log("[cron] Auto-revoke: no expired public documents found.");
    }
  } catch (err) {
    console.error("[cron] revokeExpiredPublicDocsCron error:", err);
  }
}

/**
 * Start the cron job.  Call this once from the server entry point.
 */
export function startRevokeExpiredPublicDocsCron() {
  // Run immediately on startup to catch overnight expiries
  runRevoke();
  // Then repeat every 24 hours
  setInterval(runRevoke, INTERVAL_MS);
  console.log("[cron] revokeExpiredPublicDocsCron started (interval: 24h).");
}
