import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const venues = sqliteTable('venues', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  building: text('building'),
  floor: text('floor'),
  mapLink: text('map_link'),
});
