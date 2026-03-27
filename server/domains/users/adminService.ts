/**
 * server/domains/users/adminService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for admin operations: user management, requirement types,
 * audit logs, and system settings.
 */

import {
  createAuditLog,
  createRequirementType,
  getAllRequirementTypes,
  getAllUsers,
  getAuditLogs,
  getSystemSetting,
  updateRequirementType,
  updateUser,
  upsertSystemSetting,
} from "../../db";
import { Errors, requireRole } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

export const adminService = {
  // ─── Users ─────────────────────────────────────────────────────────────────

  async listUsers(user: UserContext) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager"]);
    return getAllUsers();
  },

  async updateUser(
    actor: UserContext & { id: number },
    targetId: number,
    data: {
      complianceRole?: string;
      supplierId?: number | null;
      active?: boolean;
      languagePreference?: "de" | "en";
    }
  ) {
    requireRole(actor.complianceRole, ["administrator"]);
    await updateUser(targetId, data as any);
    await createAuditLog({
      entityType: "user",
      entityId: targetId,
      action: "updated",
      performedByUserId: actor.id,
      payloadSnapshot: data as any,
    });
    return { success: true };
  },

  async updateMyLanguage(user: UserContext & { id: number }, language: "de" | "en") {
    await updateUser(user.id, { languagePreference: language });
    return { success: true };
  },

  // ─── Requirement Types ──────────────────────────────────────────────────────

  async listRequirementTypes() {
    return getAllRequirementTypes();
  },

  async createRequirementType(
    user: UserContext,
    input: {
      key: string;
      labelDe: string;
      labelEn: string;
      category: "document" | "data";
      required: boolean;
      sortOrder: number;
    }
  ) {
    requireRole(user.complianceRole, ["administrator"]);
    await createRequirementType({ ...input, active: true });
    return { success: true };
  },

  async updateRequirementType(
    user: UserContext,
    id: number,
    data: {
      labelDe?: string;
      labelEn?: string;
      required?: boolean;
      active?: boolean;
      sortOrder?: number;
    }
  ) {
    requireRole(user.complianceRole, ["administrator"]);
    await updateRequirementType(id, data);
    return { success: true };
  },

  // ─── Audit Logs ─────────────────────────────────────────────────────────────

  async getAuditLogs(user: UserContext, limit: number) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager"]);
    return getAuditLogs(limit);
  },

  // ─── System Settings ────────────────────────────────────────────────────────

  async getSystemSetting(user: UserContext, key: string) {
    requireRole(user.complianceRole, ["administrator", "compliance_manager"]);
    return getSystemSetting(key);
  },

  async setSystemSetting(user: UserContext & { id: number }, key: string, value: string) {
    requireRole(user.complianceRole, ["administrator"]);
    await upsertSystemSetting(key, value, false, user.id);
    await createAuditLog({
      entityType: "system_setting",
      action: "updated",
      performedByUserId: user.id,
      payloadSnapshot: { key } as any,
    });
    return { success: true };
  },
};
