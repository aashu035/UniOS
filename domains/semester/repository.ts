import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client';
import { atomic } from '../../core/db/atomic';
import { semesters } from './model';
import { students } from '../profile/model';

export class SemesterRepository {
  static async getAllSemesters() {
    return db.select().from(semesters).all();
  }

  static async getActiveSemester() {
    return db.select().from(semesters).where(eq(semesters.isActive, true)).get();
  }

  /** Every semester with how many courses it has, newest (highest number) first. */
  static async listWithCourseCounts() {
    const { workspaces } = require('../workspace/model');
    const all = db.select().from(semesters).all();
    const ws = db.select({ semesterId: workspaces.semesterId }).from(workspaces).all() as Array<{ semesterId: number | null }>;
    return all
      .map((s) => ({ ...s, courses: ws.filter((w) => w.semesterId === s.id).length }))
      .sort((a, b) => b.number - a.number || b.id - a.id);
  }

  static async addSemester(data: {
    number: number;
    name?: string | null;
    type?: string;
    startDate?: string;
    endDate?: string;
    sgpa?: number | null;
  }) {
    return atomic((tx) => {
      if (tx.select().from(semesters).where(eq(semesters.number, data.number)).get()) throw new Error(`Semester ${data.number} already exists`);
      const existing = tx.select().from(semesters).limit(1).get();
      const isFirst = !existing;

      const newSemester = tx.insert(semesters).values({
        number: data.number,
        name: data.name ?? undefined,
        type: data.type || 'odd',
        startDate: data.startDate,
        endDate: data.endDate,
        sgpa: data.sgpa ?? null,
      }).returning().get();

      if (isFirst) {
        // Activate it since it's the first one
        tx.update(semesters)
          .set({ isActive: true })
          .where(eq(semesters.id, newSemester.id))
          .run();
        
        // Also sync profile (we might not have a profile yet, but update just in case)
        tx.update(students).set({ currentSemester: newSemester.number }).run();
        newSemester.isActive = true;
      }
      
      return newSemester;
    });
  }

  static async activateSemester(id: number) {
    return atomic((tx) => {
      const targetSemester = tx.select().from(semesters).where(eq(semesters.id, id)).get();
      if (!targetSemester) {
        throw new Error(`Semester with id ${id} not found.`);
      }

      // Deactivate all
      tx.update(semesters).set({ isActive: false }).run();
      
      // Activate target
      const activated = tx.update(semesters)
        .set({ isActive: true })
        .where(eq(semesters.id, id))
        .returning().get();
      
      // Synchronize canonical context to Profile
      tx.update(students).set({ currentSemester: targetSemester.number }).run();

      return activated;
    });
  }

  static async updateSemester(id: number, data: Partial<{
    number: number;
    name: string | null;
    type: string;
    startDate: string;
    endDate: string;
    sgpa: number | null;
  }>) {
    // Note: isActive is omitted from here; callers must use activateSemester() to change activation state
    return atomic((tx) => {
      if (data.number !== undefined) {
        const clash = tx.select().from(semesters).where(eq(semesters.number, data.number)).all().find((x) => x.id !== id);
        if (clash) throw new Error(`Semester ${data.number} already exists`);
      }
      const row = tx.update(semesters).set(data).where(eq(semesters.id, id)).returning().get();
      // The profile shows the active semester's number.
      if (row?.isActive && data.number !== undefined) tx.update(students).set({ currentSemester: data.number }).run();
      return row;
    });
  }

  static async deleteSemester(id: number) {
    return atomic((tx) => {
      const { workspaces } = require('../workspace/model');
      const attachedWorkspaces = tx.select().from(workspaces).where(eq(workspaces.semesterId, id)).limit(1).get();
      if (attachedWorkspaces) {
        throw new Error("Cannot delete a semester that contains active subjects. Please delete or reassign the subjects first.");
      }
      const row = tx.select().from(semesters).where(eq(semesters.id, id)).get();
      tx.delete(semesters).where(eq(semesters.id, id)).run();
      return row ?? null;
    });
  }

  /** Undo a delete: the same row and id. */
  static async restoreSemester(row: typeof semesters.$inferSelect) {
    return db.insert(semesters).values(row).onConflictDoNothing().returning().get();
  }
}
