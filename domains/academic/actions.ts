import { AttendanceRepository } from '../attendance/repository';
import { NotificationService } from '../notification/service';
import { TaskRepository } from '../task/repository';
import type { AttStatus } from './logic';
import type { Occ } from './snapshot';

export type Mark = 'present' | 'absent' | 'off';

/** "Off" is stored as `cancelled`: the class wasn't held and isn't counted. */
export const markToStatus = (m: Mark) => (m === 'off' ? 'cancelled' : m) as 'present' | 'absent' | 'cancelled';
export const statusToMark = (s: string | null | undefined): Mark | null =>
  s === 'present' ? 'present' : s === 'absent' || s === 'exempt' ? 'absent' : s === 'cancelled' || s === 'holiday' ? 'off' : null;

/** Mark one class, or clear its mark with `null`. */
export async function markOccurrence(o: Occ, mark: Mark | null): Promise<void> {
  if (!o.componentId) throw new Error('This class has no course component to mark.');
  if (mark === null) {
    await AttendanceRepository.deleteAttendance(o.id);
    return;
  }
  const status = markToStatus(mark);
  await AttendanceRepository.markAttendance(o.workspaceId, o.date, status, o.id, o.componentId);
  NotificationService.attendanceMarked({ componentType: o.componentType, date: o.date, status, workspaceId: o.workspaceId }).catch(() => {});
}

/** Set any stored status on one class (leave included), or clear it with `null`. */
export async function setOccurrenceStatus(
  o: { id: string; workspaceId: number; date: string; componentId?: number | null; componentType?: string | null },
  status: AttStatus | null,
  note: string | null = null,
): Promise<void> {
  if (status === null) {
    await AttendanceRepository.deleteAttendance(o.id);
    return;
  }
  // An existing mark is updated in place, so old classes stay editable after their slot changes.
  const updated = await AttendanceRepository.updateExistingStatus(o.id, status, note);
  if (!updated) {
    if (!o.componentId) throw new Error('This class has no course component to mark.');
    try {
      await AttendanceRepository.markAttendance(o.workspaceId, o.date, status, o.id, o.componentId, note ?? undefined);
    } catch (e: any) {
      if (/SECURITY_VIOLATION/.test(e?.message ?? '')) throw new Error("This class isn't on your timetable for that day anymore, so it can't be marked. Check the course's weekly slots.");
      throw e;
    }
  }
  NotificationService.attendanceMarked({ componentType: o.componentType ?? 'theory', date: o.date, status, workspaceId: o.workspaceId }).catch(() => {});
}

export async function setTaskDone(t: { id: number; title: string; workspaceId: number | null }, done: boolean): Promise<void> {
  await TaskRepository.updateTaskStatus(t.id, done ? 'submitted' : 'pending');
  if (done) NotificationService.taskCompleted({ id: t.id, title: t.title, workspaceId: t.workspaceId ?? undefined }).catch(() => {});
}
