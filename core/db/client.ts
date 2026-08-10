import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

// This name represents the local SQLite database file on the device
export const DATABASE_NAME = 'unios.db';

// Initialize the SQLite connection synchronously
export const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
expoDb.execSync('PRAGMA foreign_keys = ON;');

// Pass the schema to Drizzle so it knows about our tables
export const db = drizzle(expoDb, { schema });
