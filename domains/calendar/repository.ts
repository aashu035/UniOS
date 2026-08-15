import { db } from '../../core/db/client';
import { calendarEvents } from './model';
import { eq, asc, or } from 'drizzle-orm';
import { workspaces } from '../workspace/model';
import { venues } from '../venue/model';

export type NewCalendarEvent = typeof calendarEvents.$inferInsert;

export class CalendarRepository {
  static async getEventsForDay(dayOfWeek: number, specificDateString?: string) {
    const conditions = [eq(calendarEvents.dayOfWeek, dayOfWeek)];
    if (specificDateString) {
      conditions.push(eq(calendarEvents.specificDate, specificDateString));
    }

    return await db.select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      description: calendarEvents.description,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      type: calendarEvents.type,
      workspaceId: calendarEvents.workspaceId,
      location: calendarEvents.location,
      workspaceName: workspaces.name,
      workspaceCode: workspaces.code,
      venueName: venues.name
    })
    .from(calendarEvents)
    .leftJoin(workspaces, eq(calendarEvents.workspaceId, workspaces.id))
    .leftJoin(venues, eq(calendarEvents.venueOverrideId, venues.id))
    .where(or(...conditions))
    .orderBy(asc(calendarEvents.startTime));
  }

  static async validateWorkspace(workspaceId: number | null | undefined) {
    if (!workspaceId) return;
    const ws = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
    if (!ws) {
      throw new Error("SECURITY_VIOLATION: Workspace does not exist or unauthorized.");
    }
  }

  static async createEvent(event: NewCalendarEvent) {
    await this.validateWorkspace(event.workspaceId);
    const [created] = await db.insert(calendarEvents).values(event).returning();
    return created;
  }

  static async createEventsBatch(events: NewCalendarEvent[]) {
    if (events.length === 0) return [];
    if (events[0].workspaceId) {
      await this.validateWorkspace(events[0].workspaceId);
    }
    return await db.insert(calendarEvents).values(events).returning();
  }

  static async getEventById(id: number) {
    return await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).get();
  }

  static async updateEvent(id: number, updates: Partial<NewCalendarEvent>) {
    const [updated] = await db.update(calendarEvents).set(updates).where(eq(calendarEvents.id, id)).returning();
    return updated;
  }

  static async deleteEvent(id: number) {
    const [deleted] = await db.delete(calendarEvents).where(eq(calendarEvents.id, id)).returning();
    return deleted;
  }
}
