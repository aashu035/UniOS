import { db } from '../../core/db/client';
import { students } from './model';
import { NewStudent, Student } from './types';
import { eq } from 'drizzle-orm';

export class ProfileRepository {
  static async getProfile(): Promise<Student | null> {
    const result = await db.select().from(students).limit(1);
    return result[0] || null;
  }

  static async createProfile(profile: NewStudent): Promise<Student> {
    const result = await db.insert(students).values(profile).returning();
    return result[0];
  }

  static async updateProfile(id: number, updates: Partial<NewStudent>): Promise<Student> {
    const result = await db.update(students)
      .set(updates)
      .where(eq(students.id, id))
      .returning();
    return result[0];
  }
}
