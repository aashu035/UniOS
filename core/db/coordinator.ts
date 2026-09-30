import { useState, useEffect, useCallback } from 'react';
import { db, expoDb } from './client';
import migrations from '../../drizzle/migrations';
import { AttendanceRepairService, type RepairResult } from '../../domains/attendance/repair';

/**
 * Database Coordinator
 * 
 * Owns the entire database initialization lifecycle:
 *   open database → migrations → repair → invariant verification → ready
 * 
 * Guarantees:
 * - No database-consuming hook runs before readiness.
 * - Repair failure blocks readiness and exposes retry.
 * - Retry is safe (idempotent).
 * - Repair runs on every initialization (not a one-time side effect).
 * - Migration and repair do not create nested transactions.
 * - The same database handle is used throughout.
 */

let globalInitPromise: Promise<RepairResult | null> | null = null;

async function initializeDatabase(): Promise<RepairResult | null> {
  // Phase 1: Run Drizzle migrations with FK constraints disabled
  try {
    expoDb.execSync('PRAGMA foreign_keys = OFF;');
    const offCheck = expoDb.getFirstSync('PRAGMA foreign_keys;') as { foreign_keys: number } | undefined;
    if (offCheck?.foreign_keys !== 0) {
      throw new Error('FATAL: Failed to disable foreign keys before migration.');
    }
    
    // @ts-ignore - The migrate function from drizzle-orm/expo-sqlite/migrator is not fully typed
    const { migrate } = require('drizzle-orm/expo-sqlite/migrator');
    await migrate(db, migrations);
  } finally {
    expoDb.execSync('PRAGMA foreign_keys = ON;');
    const fkCheck = expoDb.getFirstSync('PRAGMA foreign_keys;') as { foreign_keys: number } | undefined;
    if (fkCheck?.foreign_keys !== 1) {
      throw new Error('FATAL: Database failed to restore foreign key constraints.');
    }
  }

  // Phase 2: Run idempotent attendance repair using the same db handle
  // This uses raw queries against the same connection — no nested transactions.
  const repairResult = await AttendanceRepairService.repairLegacyIdentities(db);

  // Phase 3: Invariant verification
  // Verify no blank occurrence_id values exist (should have been cleaned by migration)
  const blankCheck = expoDb.getFirstSync(
    "SELECT COUNT(*) as cnt FROM attendance WHERE occurrence_id = ''"
  ) as { cnt: number } | undefined;

  if (blankCheck && blankCheck.cnt > 0) {
    throw new Error(`INVARIANT_VIOLATION: ${blankCheck.cnt} attendance rows have blank occurrence_id. Expected NULL for unresolved.`);
  }

  // Verify no overlapping venue assignments
  const venueOverlapCheck = expoDb.getFirstSync(`
    SELECT COUNT(*) as cnt 
    FROM component_venue_assignments a1
    JOIN component_venue_assignments a2 
      ON a1.component_id = a2.component_id AND a1.id != a2.id
    WHERE a1.effective_from < IFNULL(a2.effective_until, '9999-12-31') 
      AND a2.effective_from < IFNULL(a1.effective_until, '9999-12-31')
  `) as { cnt: number } | undefined;

  if (venueOverlapCheck && venueOverlapCheck.cnt > 0) {
    const msg = `INVARIANT_VIOLATION: ${venueOverlapCheck.cnt} overlapping venue assignments detected.`;
    if (__DEV__) throw new Error(msg);
    else console.error(msg); // In production, log rather than crash
  }

  // Verify no overlapping faculty assignments
  const facultyOverlapCheck = expoDb.getFirstSync(`
    SELECT COUNT(*) as cnt 
    FROM component_faculty_assignments a1
    JOIN component_faculty_assignments a2 
      ON a1.component_id = a2.component_id AND a1.id != a2.id
    WHERE a1.effective_from < IFNULL(a2.effective_until, '9999-12-31') 
      AND a2.effective_from < IFNULL(a1.effective_until, '9999-12-31')
  `) as { cnt: number } | undefined;

  if (facultyOverlapCheck && facultyOverlapCheck.cnt > 0) {
    const msg = `INVARIANT_VIOLATION: ${facultyOverlapCheck.cnt} overlapping faculty assignments detected.`;
    if (__DEV__) throw new Error(msg);
    else console.error(msg); // In production, log rather than crash
  }

  return repairResult;
}

/**
 * React hook for consuming database readiness state.
 * _layout.tsx should use this instead of owning migration logic.
 */
export function useDatabaseCoordinator() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);

  const runInit = useCallback(() => {
    if (!globalInitPromise) {
      globalInitPromise = initializeDatabase().catch((err) => {
        globalInitPromise = null;
        throw err;
      });
    }

    globalInitPromise
      .then((result) => {
        setIsReady(true);
        setError(null);
        setRepairResult(result);
      })
      .catch((e) => {
        setIsReady(false);
        setError(e instanceof Error ? e : new Error(String(e)));
      });
  }, []);

  useEffect(() => {
    runInit();
  }, [runInit]);

  const retry = useCallback(() => {
    globalInitPromise = null;
    setError(null);
    setIsReady(false);
    runInit();
  }, [runInit]);

  return { isReady, error, retry, repairResult };
}
