import { db, expoDb } from './client';
import * as schema from './schema';
import { atomic, type Tx } from './atomic';
import { UniOSBackupV2, BACKUP_FORMAT_STRING, CURRENT_BACKUP_VERSION, CANONICAL_BACKUP_TABLES, BackupTableKey } from './backupSchema';
import { sanitizeRestoredValues, validateBackupStructural, validateBackupRelational } from './backupValidation';

/**
 * Ensures that the provided data can be safely inserted.
 * We must check if foreign_keys is actually enabled before running a destructive operation.
 */
async function ensureForeignKeysEnabled(): Promise<void> {
  const result = await expoDb.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys;');
  if (!result || result.foreign_keys !== 1) {
    throw new Error('Database is in an unsafe state: foreign_keys pragma is disabled. Aborting restore to protect data integrity.');
  }
}

/** Every backed-up table, children before parents, so deletes respect foreign keys. */
const USER_TABLES_CHILD_FIRST: readonly BackupTableKey[] = [
  'day_rules', 'tutor_messages', 'tutor_conversations', 'material_index_permissions', 'ai_connections',
  'learning_profiles', 'notifications', 'portal_attendance', 'attendance', 'resources', 'tasks',
  'schedule_exceptions', 'recurring_schedules', 'calendar_events', 'component_faculty_assignments',
  'component_venue_assignments', 'course_components', 'workspace_timeline', 'workspaces', 'faculty',
  'venues', 'dcrust_grading', 'semesters', 'students',
];

// The list above must name every backed-up table exactly once.
if (USER_TABLES_CHILD_FIRST.length !== CANONICAL_BACKUP_TABLES.length || CANONICAL_BACKUP_TABLES.some((t) => !USER_TABLES_CHILD_FIRST.includes(t))) {
  throw new Error('USER_TABLES_CHILD_FIRST does not match CANONICAL_BACKUP_TABLES.');
}

const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

/** Delete every row of every backed-up table inside `tx` (restore and Clear all data). */
export function wipeUserTables(tx: Tx) {
  for (const tableName of USER_TABLES_CHILD_FIRST) {
    const tableSchema = (schema as any)[toCamelCase(tableName)];
    if (!tableSchema) throw new Error(`No schema for table '${tableName}'.`);
    tx.delete(tableSchema).run();
  }
}

/**
 * Exports all canonical tables into a UniOS Backup V2 format.
 */
export async function exportBackup(): Promise<string> {
  const tablesData: Record<string, any[]> = {};

  for (const tableName of CANONICAL_BACKUP_TABLES) {
    const exportName = toCamelCase(tableName);
    const tableSchema = (schema as any)[exportName];
    if (!tableSchema) {
      throw new Error(`Export error: Table schema for '${tableName}' (mapped to '${exportName}') is missing from schema imports.`);
    }
    const rows = await db.select().from(tableSchema).all();
    tablesData[tableName] = rows;
  }

  const backup: UniOSBackupV2 = {
    format: BACKUP_FORMAT_STRING,
    version: CURRENT_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables: tablesData as Record<BackupTableKey, any[]>,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Validates and imports a JSON backup payload atomically.
 * Throws an error on validation failure or if the transaction rolls back.
 */
export async function importBackup(jsonString: string): Promise<void> {
  // 1. Level A: Structural Validation
  const structuralCheck = validateBackupStructural(jsonString);
  if (!structuralCheck.valid || !structuralCheck.parsed) {
    throw new Error(`Backup structural validation failed: ${structuralCheck.error}`);
  }

  const parsed = structuralCheck.parsed;

  // 2. Level B: Relational Validation
  const relationalCheck = validateBackupRelational(parsed);
  if (!relationalCheck.valid) {
    throw new Error(relationalCheck.error);
  }

  // 2b. Level C: clear file paths and links that the app did not write itself.
  sanitizeRestoredValues(parsed);

  // 3. Verify Foreign Keys are strictly enforced
  await ensureForeignKeysEnabled();

  const deletionOrder = USER_TABLES_CHILD_FIRST;
  const insertionOrder = [...deletionOrder].reverse();

  // 5. Execute Atomic Wipe & Replace

  // One transaction: if any row fails to insert, the wipe is rolled back too and
  // the phone keeps what it had. Synchronous on purpose (see core/db/atomic.ts).
  atomic((tx) => {
    wipeUserTables(tx);

    // Insert in Parent -> Child order, 50 rows per statement (SQLite's 999-parameter limit).
    const CHUNK_SIZE = 50;
    for (const tableName of insertionOrder) {
      const rows = parsed.tables[tableName];
      const tableSchema = (schema as any)[toCamelCase(tableName)];
      if (!tableSchema || !rows?.length) continue;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        tx.insert(tableSchema).values(rows.slice(i, i + CHUNK_SIZE)).run();
      }
    }
  });
}
