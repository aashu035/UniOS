import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client';
import { semesters } from './model';

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
    // If this is the first semester or the user didn't specify, we might want to make it active, but default is false
    return db.insert(semesters).values({
      number: data.number,
      name: data.name,
      type: data.type || 'odd',
      startDate: data.startDate,
      endDate: data.endDate,
    }).returning().get();
  }

  static async updateSemester(id: number, data: Partial<{
    number: number;
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    sgpa: number;
  }>) {
    if (data.isActive) {
      // Deactivate all others
      await db.update(semesters).set({ isActive: false }).run();
    }
    return db.update(semesters).set(data).where(eq(semesters.id, id)).returning().get();
  }

  static async deleteSemester(id: number) {
    return db.delete(semesters).where(eq(semesters.id, id)).run();
  }
}
