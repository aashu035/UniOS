import { db } from '../../core/db/client';
import { notifications } from './model';
import { eq, desc, lt, count } from 'drizzle-orm';

export type NotificationType = 'info' | 'success' | 'warning' | 'alert';

export interface NewNotification {
  title: string;
  message: string;
  type?: NotificationType;
  actionUrl?: string | null;
}

export class NotificationRepository {
  /**
   * Create a single notification row. Producers in NotificationService call this.
   * Returns the inserted row.
   */
  static async create(input: NewNotification) {
    const [row] = await db
      .insert(notifications)
      .values({
        title: input.title,
        message: input.message,
        type: input.type ?? 'info',
        actionUrl: input.actionUrl ?? null,
      })
      .returning()
      .all();
    return row;
  }

  /**
   * List all notifications, newest first. Limit is required to prevent
   * unbounded result sets in long-lived installs.
   */
  static async list(limit = 100) {
    return await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .all();
  }

  /**
   * List only unread notifications (used by the bell badge).
   * Cheap: indexed on is_read + ordered by created_at.
   */
  static async listUnread(limit = 50) {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.isRead, false))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .all();
  }

  /**
   * Count unread notifications. The home screen bell dot uses this.
   * Returns 0 if there are none.
   */
  static async countUnread(): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(notifications)
      .where(eq(notifications.isRead, false))
      .all();
    return row?.value ?? 0;
  }

  /**
   * Mark a single notification as read.
   */
  static async markRead(id: number) {
    return await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning()
      .get();
  }

  /**
   * Mark all unread notifications as read. Used when the user opens
   * the notification screen and we want to clear the badge.
   */
  static async markAllRead() {
    return await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.isRead, false))
      .returning()
      .all();
  }

  /**
   * Delete notifications older than `daysAgo` days.
   * Used by the service's cleanup producer to prevent unbounded growth.
   * createdAt is an ISO 8601 string, so a lexicographic lt is correct.
   */
  static async deleteOlderThan(daysAgo: number) {
    const cutoff = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    return await db
      .delete(notifications)
      .where(lt(notifications.createdAt, cutoff))
      .returning()
      .all();
  }
}
