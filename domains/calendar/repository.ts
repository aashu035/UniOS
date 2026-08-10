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

  static async createEvent(event: NewCalendarEvent) {
    const [created] = await db.insert(calendarEvents).values(event).returning();
    return created;
  }

  static async createEventsBatch(events: NewCalendarEvent[]) {
    if (events.length === 0) return [];
    return await db.insert(calendarEvents).values(events).returning();
  }
}
