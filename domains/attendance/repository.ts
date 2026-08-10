import { db } from '../../core/db/client';
import { attendance, portalAttendance } from './model';
import { eq, desc, and } from 'drizzle-orm';

export class AttendanceRepository {
  static async getAttendanceHistory(workspaceId: number) {
    return await db.select()
      .from(attendance)
      .where(eq(attendance.workspaceId, workspaceId))
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

  static async markAttendance(workspaceId: number, date: string, status: 'present' | 'absent' | 'cancelled' | 'holiday' | 'exempt', notes?: string) {
    // Check if attendance already exists for this date
    const existing = await db.select()
      .from(attendance)
      .where(and(eq(attendance.workspaceId, workspaceId), eq(attendance.date, date)));
    
    if (existing.length > 0) {
      // Update existing record
      await db.update(attendance)
        .set({ status, notes: notes || null })
        .where(eq(attendance.id, existing[0].id));
      return { ...existing[0], status, notes };
    } else {
      // Insert new record
      const result = await db.insert(attendance).values({
        workspaceId,
        date,
        status,
        notes: notes || null,
      }).returning();
      return result[0];
    }
  }
}
