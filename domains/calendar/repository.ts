import { db } from '../../core/db/client';
import { calendarEvents } from './model';
import { eq, asc, or } from 'drizzle-orm';
import { workspaces } from '../workspace/model';
import { venues } from '../venue/model';

export type NewCalendarEvent = typeof calendarEvents.$inferInsert;

export class CalendarRepository {
  // getEventsForDay has been removed. Academic queries should use ScheduleService.

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
