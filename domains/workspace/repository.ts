import { db } from '../../core/db/client';
import { workspaces, workspaceTimeline } from './model';
import { eq, desc } from 'drizzle-orm';
import { faculty } from '../faculty/model';
import { venues } from '../venue/model';

export class WorkspaceRepository {
  static async getAllWorkspaces() {
    return await db.select({
      id: workspaces.id,
      name: workspaces.name,
      code: workspaces.code,
      color: workspaces.color,
      credits: workspaces.credits,
    }).from(workspaces);
  }

  static async getWorkspaceById(id: number) {
    const result = await db.select({
      workspace: workspaces,
      faculty: faculty,
      venue: venues,
    })
    .from(workspaces)
    .leftJoin(faculty, eq(workspaces.facultyId, faculty.id))
    .leftJoin(venues, eq(workspaces.venueId, venues.id))
    .where(eq(workspaces.id, id))
    .limit(1);

    return result[0] || null;
  }

  static async getTimelineEvents(workspaceId: number) {
    return await db.select()
      .from(workspaceTimeline)
      .where(eq(workspaceTimeline.workspaceId, workspaceId))
      .orderBy(desc(workspaceTimeline.timestamp));
  }
}
