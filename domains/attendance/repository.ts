import { db } from '../../core/db/client';
import { attendance, portalAttendance } from './model';
import { eq, desc } from 'drizzle-orm';

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
}
