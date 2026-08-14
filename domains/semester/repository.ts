import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client';
import { semesters } from './model';
import { students } from '../profile/model';

export class SemesterRepository {
  static async getAllSemesters() {
    return db.select().from(semesters).all();
  }

  static async getActiveSemester() {
    return db.select().from(semesters).where(eq(semesters.isActive, true)).get();
  }

  static async addSemester(data: {
    number: number;
    name?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }) {
    return db.transaction(async (tx) => {
      const existing = await tx.select().from(semesters).limit(1).get();
      const isFirst = !existing;

      const newSemester = await tx.insert(semesters).values({
        number: data.number,
        name: data.name,
        type: data.type || 'odd',
        startDate: data.startDate,
        endDate: data.endDate,
      }).returning().get();

      if (isFirst) {
        // Activate it since it's the first one
        await tx.update(semesters)
          .set({ isActive: true })
          .where(eq(semesters.id, newSemester.id))
          .run();
        
        // Also sync profile (we might not have a profile yet, but update just in case)
        await tx.update(students).set({ currentSemester: newSemester.number }).run();
        newSemester.isActive = true;
      }
      
      return newSemester;
    });
  }

  static async activateSemester(id: number) {
    return db.transaction(async (tx) => {
      const targetSemester = await tx.select().from(semesters).where(eq(semesters.id, id)).get();
      if (!targetSemester) {
        throw new Error(`Semester with id ${id} not found.`);
      }

      // Deactivate all
      await tx.update(semesters).set({ isActive: false }).run();
      
      // Activate target
      const activated = await tx.update(semesters)
        .set({ isActive: true })
        .where(eq(semesters.id, id))
        .returning().get();
      
      // Synchronize canonical context to Profile
      await tx.update(students).set({ currentSemester: targetSemester.number }).run();

      return activated;
    });
  }

  static async updateSemester(id: number, data: Partial<{
    number: number;
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    sgpa: number;
  }>) {
    // Note: isActive is omitted from here; callers must use activateSemester() to change activation state
    return db.update(semesters).set(data).where(eq(semesters.id, id)).returning().get();
  }

  static async deleteSemester(id: number) {
    return db.transaction(async (tx) => {
      const { workspaces } = require('../workspace/model');
      const attachedWorkspaces = await tx.select().from(workspaces).where(eq(workspaces.semesterId, id)).limit(1).get();
      if (attachedWorkspaces) {
        throw new Error("Cannot delete a semester that contains active subjects. Please delete or reassign the subjects first.");
      }
      return tx.delete(semesters).where(eq(semesters.id, id)).run();
    });
  }
}
