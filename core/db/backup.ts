import { db, expoDb } from './client';
import * as schema from './schema';
import { UniOSBackupV2, BACKUP_FORMAT_STRING, CURRENT_BACKUP_VERSION, CANONICAL_BACKUP_TABLES, BackupTableKey } from './backupSchema';
import { validateBackupStructural, validateBackupRelational } from './backupValidation';

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

/**
 * Exports all canonical tables into a UniOS Backup V2 format.
 */
export async function exportBackup(): Promise<string> {
  const tablesData: Record<string, any[]> = {};

  const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

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

  // 3. Verify Foreign Keys are strictly enforced
  await ensureForeignKeysEnabled();

  // 4. Determine Deletion and Insertion Order
  // Child -> Parent deletion order to respect foreign keys
  const deletionOrder: BackupTableKey[] = [
    'tutor_messages',
    'tutor_conversations',
    'material_index_permissions',
    'ai_connections',
    'learning_profiles',
    'notifications',
    'portal_attendance',
    'attendance',
    'resources',
    'tasks',
    'schedule_exceptions',
    'recurring_schedules',
    'calendar_events',
    'component_faculty_assignments',
    'component_venue_assignments',
    'course_components',
    'workspace_timeline',
    'workspaces',
    'faculty',
    'venues',
    'dcrust_grading',
    'semesters',
    'students'
  ];

  // Sanity check: Ensure our hardcoded deletion order matches the canonical tables exactly
  if (deletionOrder.length !== CANONICAL_BACKUP_TABLES.length) {
    throw new Error('Critical mismatch between deletion order array and canonical tables array.');
  }
  for (const t of CANONICAL_BACKUP_TABLES) {
    if (!deletionOrder.includes(t)) {
      throw new Error(`Table ${t} is missing from the deletion order array.`);
    }
  }

  const insertionOrder = [...deletionOrder].reverse();

  // 5. Execute Atomic Wipe & Replace
  const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

  await db.transaction(async (tx) => {
    // Delete in Child -> Parent order
    for (const tableName of deletionOrder) {
      const exportName = toCamelCase(tableName);
      const tableSchema = (schema as any)[exportName];
      if (tableSchema) {
        await tx.delete(tableSchema);
      }
    }

    // Insert in Parent -> Child order
    for (const tableName of insertionOrder) {
      const rows = parsed.tables[tableName];
      const exportName = toCamelCase(tableName);
      const tableSchema = (schema as any)[exportName];
      
      if (tableSchema && rows && rows.length > 0) {
        // Drizzle allows batch inserts. 
        // NOTE: If rows array is very large, this might hit SQLite parameter limits,
        // but for typical UniOS use cases, a single batch is safe.
        // We chunk it into 100 rows per batch to be safe against SQLite's 999 parameter limit.
        const CHUNK_SIZE = 50; 
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          await tx.insert(tableSchema).values(chunk);
        }
      }
    }
  });
}
