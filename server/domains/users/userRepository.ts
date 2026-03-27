/**
 * server/domains/users/userRepository.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Data-access layer for the Users domain.
 */

export {
  upsertUser,
  getUserByOpenId,
  getAllUsers,
  updateUser,
  createNotification,
  getNotificationsByUser,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../db";
