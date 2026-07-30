import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const semesters = sqliteTable('semesters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  number: integer('number').notNull(),
  name: text('name'),
  type: text('type').default('odd'), // odd/even
  startDate: text('start_date'),
  endDate: text('end_date'),
  isActive: integer('is_active', { mode: 'boolean' }).default(false),
  sgpa: real('sgpa'),
});

export const dcrustGrading = sqliteTable('dcrust_grading', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gradeLetter: text('grade_letter').notNull().unique(),
  gradePoint: real('grade_point').notNull(),
  minMarks: integer('min_marks'),
  maxMarks: integer('max_marks'),
  description: text('description'),
});
