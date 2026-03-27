/**
 * server/domains/invitations/invitationService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for Supplier Invitation links.
 *
 * Responsibilities:
 * - Create invitation tokens (nanoid) with expiry
 * - Accept an invitation (link supplier user account)
 * - List and revoke invitations
 */

import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { supplierInvitations, suppliers, users } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { Errors, requireRole, ADMIN_ROLES } from "../../shared";
import type { UserContext } from "../../shared/tenantGuard";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateInvitationInput {
  supplierId: number;
  email: string;
  expiryDays?: number;
  origin: string;
}

export interface AcceptInvitationInput {
  token: string;
  userId: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const invitationService = {
  /**
   * List all invitations (admin only).
   */
  async list(user: UserContext, supplierId?: number) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const db = await getDb();
    if (!db) throw Errors.external("Database", "Connection unavailable");

    const rows = await db
      .select({
        id: supplierInvitations.id,
        supplierId: supplierInvitations.supplierId,
        email: supplierInvitations.email,
        status: supplierInvitations.status,
        expiresAt: supplierInvitations.expiresAt,
        acceptedAt: supplierInvitations.acceptedAt,
        createdAt: supplierInvitations.createdAt,
        supplierName: suppliers.name,
        supplierCode: suppliers.supplierCode,
      })
      .from(supplierInvitations)
      .innerJoin(suppliers, eq(supplierInvitations.supplierId, suppliers.id))
      .where(supplierId ? eq(supplierInvitations.supplierId, supplierId) : undefined)
      .orderBy(desc(supplierInvitations.createdAt));
    return rows;
  },

  /**
   * Create a new invitation token and return the magic-link URL.
   */
  async create(user: UserContext, input: CreateInvitationInput) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const db = await getDb();
    if (!db) throw Errors.external("Database", "Connection unavailable");

    const token = nanoid(32);
    const expiresAt = addDays(new Date(), input.expiryDays ?? 7);

    await db.insert(supplierInvitations).values({
      supplierId: input.supplierId,
      email: input.email,
      token,
      status: "pending",
      expiresAt,
      invitedByUserId: (user as any).id ?? 0,
    } as any);

    const inviteUrl = `${input.origin}/invite/accept?token=${token}`;
    return { token, inviteUrl, expiresAt };
  },

  /**
   * Accept an invitation: link the user to the supplier account.
   */
  async accept(input: AcceptInvitationInput) {
    const db = await getDb();
    if (!db) throw Errors.external("Database", "Connection unavailable");

    const rows = await db
      .select()
      .from(supplierInvitations)
      .where(eq(supplierInvitations.token, input.token))
      .limit(1);

    const invitation = rows[0];
    if (!invitation) throw Errors.notFound("Invitation");
    if (invitation.status !== "pending") {
      throw Errors.precondition("This invitation has already been used or revoked.");
    }
    if (invitation.expiresAt < new Date()) {
      throw Errors.precondition("This invitation has expired.");
    }

    // Link user to supplier
    await db
      .update(users)
      .set({ supplierId: invitation.supplierId } as any)
      .where(eq(users.id, input.userId));

    // Mark invitation as accepted
    await db
      .update(supplierInvitations)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(supplierInvitations.id, invitation.id));

    return { success: true, supplierId: invitation.supplierId };
  },

  /**
   * Revoke a pending invitation (admin only).
   */
  async revoke(user: UserContext, invitationId: number) {
    requireRole(user.complianceRole, ADMIN_ROLES);
    const db = await getDb();
    if (!db) throw Errors.external("Database", "Connection unavailable");

    await db
      .update(supplierInvitations)
      .set({ status: "revoked" })
      .where(and(eq(supplierInvitations.id, invitationId), eq(supplierInvitations.status, "pending")));

    return { success: true };
  },
};
