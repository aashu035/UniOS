import { db } from '../../core/db/client';
import { attendance, portalAttendance } from './model';
import { eq, desc, and } from 'drizzle-orm';

export class AttendanceRepository {
  static async getAttendanceHistory(workspaceId: number) {
    const { courseComponents } = require('../workspace/model');
    return await db.select({
      id: attendance.id,
      occurrenceId: attendance.occurrenceId,
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

  static async markAttendance(
    workspaceId: number, 
    date: string, 
    status: 'present' | 'absent' | 'cancelled' | 'holiday' | 'exempt', 
    occurrenceKey: string,
    componentId: number,
    notes?: string
  ) {
    const { CalendarService } = require('../calendar/service');
    // Security: Validate the occurrence actually exists for this component and date
    const eligible = await CalendarService.getEffectiveSchedule(date, date);
    const validOccurrence = eligible.find((e: any) => e.id === occurrenceKey && e.componentId === componentId);
    
    if (!validOccurrence) {
      throw new Error(`SECURITY_VIOLATION: Occurrence ${occurrenceKey} is not valid for component ${componentId} on ${date}`);
    }

    const finalComponentId = validOccurrence.componentId;

    const result = await db.insert(attendance).values({
      componentId: finalComponentId,
      occurrenceId: occurrenceKey,
      identityStatus: 'resolved',
      date: validOccurrence.date,
      status,
      notes: notes || null,
    }).onConflictDoUpdate({
      target: [attendance.occurrenceId],
      set: { status, identityStatus: 'resolved', notes: notes || null }
    }).returning();
    
    return result[0];
  }

  /**
   * Change the status of a mark that already exists. No schedule check: the class
   * was valid when first marked, and its slot may since have moved, been cancelled
   * or been edited. Returns false when there is no mark to change.
   */
  static async updateExistingStatus(occurrenceId: string, status: 'present' | 'absent' | 'cancelled' | 'holiday' | 'exempt', notes?: string | null): Promise<boolean> {
    const rows = await db.update(attendance)
      .set({ status, ...(notes !== undefined ? { notes } : {}) })
      .where(eq(attendance.occurrenceId, occurrenceId))
      .returning();
    return rows.length > 0;
  }

  static async deleteAttendance(occurrenceId: string) {
    const result = await db.delete(attendance)
      .where(eq(attendance.occurrenceId, occurrenceId))
      .returning();
      
    return result[0];
  }
}
