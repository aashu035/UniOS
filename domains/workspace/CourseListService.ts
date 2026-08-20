import { db } from '../../core/db/client';
import { workspaces, courseComponents } from './model';
import { attendance } from '../attendance/model';
import { eq, inArray } from 'drizzle-orm';
import { calculateAttendanceMetrics } from '../../core/utils/attendance';

export type CourseListItem = {
  id: number;
  name: string;
  code: string | null;
  credits: number | null;
  color: string;
  iconId: string | null;
  componentTypes: Array<'theory' | 'lab' | 'tutorial'>;
  actualAttendancePercentage: number | null;
  targetAttendance: number;
};

export class CourseListService {
  static async getCourses(): Promise<CourseListItem[]> {
    // 1. Fetch all workspaces
    const allWorkspaces = await db.select().from(workspaces).all();
    if (allWorkspaces.length === 0) return [];

    // 2. Fetch all components
    const allComponents = await db.select().from(courseComponents).all();
    
    // 3. Fetch all attendance
    const allAttendance = await db.select().from(attendance).all();

    // 4. Map them together
    return allWorkspaces.map(ws => {
      const wsComps = allComponents.filter(c => c.workspaceId === ws.id);
      const componentTypes = wsComps.map(c => c.type as 'theory' | 'lab' | 'tutorial');
      
      const compIds = wsComps.map(c => c.id);
      const wsAttendance = allAttendance.filter(a => compIds.includes(a.componentId));
      const metrics = calculateAttendanceMetrics(wsAttendance);

      return {
        id: ws.id,
        name: ws.name,
        code: ws.code,
        credits: ws.credits,
        color: ws.color || '#6C5CE7',
        iconId: ws.icon,
        componentTypes,
        actualAttendancePercentage: metrics.percentage,
        targetAttendance: ws.targetAttendance ?? 75,
      };
    });
  }
}
