import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client';
import { recurringSchedules } from '../calendar/model';
import { semesters } from '../semester/model';
import { courseComponents, workspaces } from '../workspace/model';
import { shortLabel } from './snapshot';
import type { TakenSlot } from './setup';

/** Every weekly slot of the active semester's courses (optionally leaving one course out). */
export async function weeklySlots(exceptWorkspaceId?: number): Promise<TakenSlot[]> {
  const active = (await db.select().from(semesters).all()).find((s) => s.isActive);
  const rows = await db.select({
    workspaceId: workspaces.id, name: workspaces.name, shortName: workspaces.shortName, color: workspaces.color, semesterId: workspaces.semesterId,
    type: courseComponents.type, dayOfWeek: recurringSchedules.dayOfWeek, startTime: recurringSchedules.startTime, endTime: recurringSchedules.endTime,
  }).from(recurringSchedules)
    .innerJoin(courseComponents, eq(recurringSchedules.componentId, courseComponents.id))
    .innerJoin(workspaces, eq(courseComponents.workspaceId, workspaces.id))
    .all();
  return rows
    .filter((r) => (!active || r.semesterId === active.id) && r.workspaceId !== exceptWorkspaceId)
    .map((r) => ({ workspaceId: r.workspaceId, name: r.name, short: shortLabel(r.name, r.shortName), color: r.color || '#6C5CE7', type: r.type, dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime }));
}
