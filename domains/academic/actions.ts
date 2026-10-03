import { AttendanceRepository } from '../attendance/repository';
import { NotificationService } from '../notification/service';
import { TaskRepository } from '../task/repository';
import type { Occ } from './snapshot';

export type Mark = 'present' | 'absent' | 'off';

/** "Off" is stored as `cancelled`: the class wasn't held and isn't counted. */
export const markToStatus = (m: Mark) => (m === 'off' ? 'cancelled' : m) as 'present' | 'absent' | 'cancelled';
export const statusToMark = (s: string | null | undefined): Mark | null =>
  s === 'present' || s === 'exempt' ? 'present' : s === 'absent' ? 'absent' : s === 'cancelled' || s === 'holiday' ? 'off' : null;

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

export async function setTaskDone(t: { id: number; title: string; workspaceId: number | null }, done: boolean): Promise<void> {
  await TaskRepository.updateTaskStatus(t.id, done ? 'submitted' : 'pending');
  if (done) NotificationService.taskCompleted({ id: t.id, title: t.title, workspaceId: t.workspaceId ?? undefined }).catch(() => {});
}
