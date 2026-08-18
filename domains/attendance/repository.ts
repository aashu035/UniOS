import { db } from '../../core/db/client';
import { attendance, portalAttendance } from './model';
import { eq, desc, and } from 'drizzle-orm';

export class AttendanceRepository {
  static async getAttendanceHistory(workspaceId: number) {
    const { courseComponents } = require('../workspace/model');
    return await db.select({
      id: attendance.id,
      componentId: attendance.componentId,
      componentType: courseComponents.type,
      date: attendance.date,
      status: attendance.status,
      markedAt: attendance.markedAt,
      notes: attendance.notes,
    })
      .from(attendance)
      .innerJoin(courseComponents, eq(attendance.componentId, courseComponents.id))
      .where(eq(courseComponents.workspaceId, workspaceId))
      .orderBy(desc(attendance.date));
  }

  static async getPortalAttendance(workspaceId: number) {
    const result = await db.select()
      .from(portalAttendance)
      .where(eq(portalAttendance.workspaceId, workspaceId))
      .orderBy(desc(portalAttendance.checkedDate))
      .limit(1);
    
    return result[0] || null;
  }

  static async markAttendance(workspaceId: number, date: string, status: 'present' | 'absent' | 'cancelled' | 'holiday' | 'exempt', notes?: string, componentId?: number) {
    const { courseComponents } = require('../workspace/model');
    
    let targetComponentId = componentId;
    
    if (!targetComponentId) {
      const components = await db.select().from(courseComponents).where(eq(courseComponents.workspaceId, workspaceId)).all();
      
      if (components.length === 0) {
        throw new Error("No component found for workspace");
      }
      
      if (components.length === 1) {
        targetComponentId = components[0].id;
      } else {
        // Resolve component scheduled on this date
        try {
          const { CalendarService } = require('../calendar/service');
          const events = await CalendarService.getEffectiveSchedule(date, date);
          const wsEvents = events.filter((e: any) => e.workspaceId === workspaceId && e.componentId);
          if (wsEvents.length > 0) {
            targetComponentId = wsEvents[0].componentId;
          } else {
            const theoryComp = components.find((c: any) => c.type === 'theory');
            targetComponentId = theoryComp ? theoryComp.id : components[0].id;
          }
        } catch {
          const theoryComp = components.find((c: any) => c.type === 'theory');
          targetComponentId = theoryComp ? theoryComp.id : components[0].id;
        }
      }
    }

    const finalComponentId = targetComponentId as number;

    const result = await db.insert(attendance).values({
      componentId: finalComponentId,
      date,
      status,
      notes: notes || null,
    }).onConflictDoUpdate({
      target: [attendance.componentId, attendance.date],
      set: { status, notes: notes || null }
    }).returning();
    
    return result[0];
  }
}
