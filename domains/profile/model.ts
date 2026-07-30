import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const students = sqliteTable('students', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  enrollmentNo: text('enrollment_no'),
  university: text('university').default('DCRUST Murthal'),
  branch: text('branch'),
  currentSemester: integer('current_semester').default(1),
  targetCgpa: real('target_cgpa').default(8.0),
  heroPortraitUri: text('hero_portrait_uri'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});
