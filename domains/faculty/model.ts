import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const faculty = sqliteTable('faculty', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  department: text('department'),
  cabin: text('cabin'),
  officeHours: text('office_hours'),
  photoUri: text('photo_uri'),
  notes: text('notes'),
});
