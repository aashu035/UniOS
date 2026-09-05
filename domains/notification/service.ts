import { NotificationRepository, NotificationType } from './repository';
import { getLocalDateString } from '../../core/utils/date';

/**
 * NotificationService — producers for the notification domain.
 *
 * A "producer" is a domain event that creates a notification. Producers are
 * called from write paths (e.g. AttendanceRepository.markAttendance) and from
 * the home screen (on-launch scan for overdue tasks).
 *
 * Invariants:
 *   - All producers are idempotent-ish: they create one notification per call.
 *     Callers should NOT call a producer in a loop with the same args.
 *   - The notification table can grow unbounded; `cleanup()` prunes old rows.
 *   - This service does NOT enforce deduplication of "overdue" notifications
 *     across app launches (that would require a per-task "last notified" marker).
 *     For now, the home screen onLaunchScan produces one notification per
 *     overdue task per launch, which is acceptable for the current UX.
 */
export class NotificationService {
  // ─── Producers ──────────────────────────────────────────────────────────

  /**
   * A task crossed its due date and is still pending.
   * Triggered on app launch (home screen) for all currently-overdue tasks.
   */
  static async taskOverdue(task: { id: number; title: string; dueDate: string | null; workspaceId?: number }) {
    return NotificationRepository.create({
      title: 'Task overdue',
      message: `“${task.title}” was due ${task.dueDate ?? 'recently'}.`,
      type: 'warning',
      actionUrl: task.workspaceId ? `/workspace/${task.workspaceId}` : '/(main)/tasks',
    });
  }

  /**
   * A task was just marked as completed/submitted by the user.
   * Triggered from app/(main)/tasks.tsx:toggleTask.
   */
  static async taskCompleted(task: { id: number; title: string; workspaceId?: number }) {
    return NotificationRepository.create({
      title: 'Task completed',
      message: `Nice work — “${task.title}” is done.`,
      type: 'success',
      actionUrl: task.workspaceId ? `/workspace/${task.workspaceId}` : '/(main)/tasks',
    });
  }

  /**
   * A new task was created. Triggered from app/task/add.tsx.
   * Keeps a low-signal trail so the inbox isn't empty after the first action.
   */
  static async taskCreated(task: { id: number; title: string; workspaceId: number }) {
    return NotificationRepository.create({
      title: 'Task added',
      message: `“${task.title}” is on your list.`,
      type: 'info',
      actionUrl: `/workspace/${task.workspaceId}`,
    });
  }

  /**
   * Attendance was marked for a class. Triggered from the attendance hero.
   */
  static async attendanceMarked(occurrence: { componentType: string; date: string; status: string; workspaceId: number }) {
    return NotificationRepository.create({
      title: 'Attendance marked',
      message: `${occurrence.componentType} class on ${occurrence.date} marked as ${occurrence.status}.`,
      type: 'success',
      actionUrl: `/workspace/${occurrence.workspaceId}/attendance`,
    });
  }

  /**
   * A class is cancelled or rescheduled (exception). Triggered when the
   * CalendarService produces an effective exception. Placeholder for now —
   * the wiring is done in the next phase.
   */
  static async scheduleException(workspaceId: number, componentType: string, date: string, action: 'cancel' | 'reschedule') {
    return NotificationRepository.create({
      title: action === 'cancel' ? 'Class cancelled' : 'Class rescheduled',
      message: `Your ${componentType} class on ${date} was ${action === 'cancel' ? 'cancelled' : 'rescheduled'}.`,
      type: 'alert',
      actionUrl: `/workspace/${workspaceId}/attendance`,
    });
  }

  // ─── On-launch scan ────────────────────────────────────────────────────

  /**
   * Called once when the home screen mounts. Scans for overdue tasks and
   * produces one notification per overdue task. The home screen refreshes
   * its unread count after this returns, so the bell dot lights up honestly.
   */
  static async onLaunchScan() {
    try {
      // Lazy import to avoid a hard dependency on the task domain in case
      // the task domain is ever removed.
      const { TaskRepository } = require('../task/repository');
      const today = getLocalDateString(new Date());
      const overdue = await TaskRepository.getTasksDueSoon();
      // getTasksDueSoon returns tasks with dueDate <= today and status='pending'
      for (const t of overdue) {
        if (t.dueDate && t.dueDate <= today) {
          await NotificationService.taskOverdue({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            workspaceId: t.workspaceId,
          });
        }
      }
      return overdue.length;
    } catch (e) {
      // Never crash the home screen on a notification failure.
      console.warn('NotificationService.onLaunchScan failed:', e);
      return 0;
    }
  }

  // ─── Maintenance ────────────────────────────────────────────────────────

  /**
   * Prune notifications older than 30 days. Safe to call from any screen;
   * failures are swallowed.
   */
  static async cleanup(daysAgo = 30) {
    try {
      return await NotificationRepository.deleteOlderThan(daysAgo);
    } catch (e) {
      console.warn('NotificationService.cleanup failed:', e);
      return [];
    }
  }
}

export { NotificationType };
