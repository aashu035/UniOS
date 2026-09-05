import { db } from '../../core/db/client';
import { workspaces, courseComponents, componentVenueAssignments, componentFacultyAssignments } from './model';
import { attendance } from '../attendance/model';
import { faculty } from '../faculty/model';
import { venues } from '../venue/model';
import { eq, inArray, isNull, or, lte, and, gte, desc } from 'drizzle-orm';
import { calculateAttendanceMetrics } from '../../core/utils/attendance';
import { getLocalDateString } from '../../core/utils/date';

export type CourseListItem = {
  id: number;
  name: string;
  code: string | null;
  credits: number | null;
  color: string;
  iconId: string | null;
  componentTypes: Array<'theory' | 'lab' | 'tutorial'>;
  primaryFacultyName: string | null;
  primaryVenueName: string | null;
  actualAttendancePercentage: number | null;
  targetAttendance: number;
};

export class CourseListService {
  static async getCourses(): Promise<CourseListItem[]> {
    // 1. Fetch all workspaces
    const allWorkspaces = await db.select().from(workspaces).all();
    if (allWorkspaces.length === 0) return [];

    // 2. Fetch all components (theory/lab/tutorial)
    const allComponents = await db.select().from(courseComponents).all();
    const allComponentIds = allComponents.map(c => c.id);

    // 3. Fetch all attendance
    const allAttendance = await db.select().from(attendance).all();

    // 4. Fetch primary faculty + venue assignments in bulk (active = today, no effectiveUntil or until >= today)
    const todayStr = getLocalDateString(new Date());
    let primaryFacultyByComponent = new Map<number, string>();
    let primaryVenueByComponent = new Map<number, string>();

    if (allComponentIds.length > 0) {
      const facultyRows = await db
        .select({
          componentId: componentFacultyAssignments.componentId,
          facultyName: faculty.name,
          effectiveFrom: componentFacultyAssignments.effectiveFrom,
        })
        .from(componentFacultyAssignments)
        .leftJoin(faculty, eq(componentFacultyAssignments.facultyId, faculty.id))
        .where(inArray(componentFacultyAssignments.componentId, allComponentIds))
        .orderBy(desc(componentFacultyAssignments.effectiveFrom))
        .all();

      const venueRows = await db
        .select({
          componentId: componentVenueAssignments.componentId,
          venueName: venues.name,
          effectiveFrom: componentVenueAssignments.effectiveFrom,
        })
        .from(componentVenueAssignments)
        .leftJoin(venues, eq(componentVenueAssignments.venueId, venues.id))
        .where(inArray(componentVenueAssignments.componentId, allComponentIds))
        .orderBy(desc(componentVenueAssignments.effectiveFrom))
        .all();

      // Pick the most recent assignment whose effectiveFrom <= today
      for (const row of facultyRows) {
        if (primaryFacultyByComponent.has(row.componentId)) continue;
        const fromDate = row.effectiveFrom ? row.effectiveFrom.split('T')[0] : '';
        if (fromDate <= todayStr) {
          primaryFacultyByComponent.set(row.componentId, row.facultyName ?? '');
        }
      }
      for (const row of venueRows) {
        if (primaryVenueByComponent.has(row.componentId)) continue;
        const fromDate = row.effectiveFrom ? row.effectiveFrom.split('T')[0] : '';
        if (fromDate <= todayStr) {
          primaryVenueByComponent.set(row.componentId, row.venueName ?? '');
        }
      }
    }

    // 5. Map them together — primary component = first by id (theory preferred if present)
    return allWorkspaces.map(ws => {
      const wsComps = allComponents.filter(c => c.workspaceId === ws.id);
      const componentTypes = wsComps.map(c => c.type as 'theory' | 'lab' | 'tutorial');

      // Primary = theory if it exists, else first by id
      const primary = wsComps.find(c => c.type === 'theory') ?? wsComps[0];
      const primaryFacultyName = primary ? (primaryFacultyByComponent.get(primary.id) ?? null) : null;
      const primaryVenueName = primary ? (primaryVenueByComponent.get(primary.id) ?? null) : null;

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
        primaryFacultyName: primaryFacultyName || null,
        primaryVenueName: primaryVenueName || null,
        actualAttendancePercentage: metrics.percentage,
        targetAttendance: ws.targetAttendance ?? 75,
      };
    });
  }
}
