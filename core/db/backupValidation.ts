import { UniOSBackupV2, isUniOSBackupV2, CANONICAL_BACKUP_TABLES, OPTIONAL_BACKUP_TABLES } from './backupSchema';

export function validateBackupStructural(data: any): { valid: boolean; error?: string; parsed?: UniOSBackupV2 } {
  try {
    let parsed = data;
    if (typeof data === 'string') {
      parsed = JSON.parse(data);
    }
    
    if (!isUniOSBackupV2(parsed)) {
      if (parsed?.format !== 'unios-backup') {
        return { valid: false, error: 'Invalid file format. Not a UniOS backup.' };
      }
      if (parsed?.version !== 2) {
        if (parsed?.version < 2) {
          return { valid: false, error: `Backup version ${parsed.version} is not supported. Please update the app or use a newer backup.` };
        } else {
          return { valid: false, error: `Backup version ${parsed.version} is from a newer version of UniOS. Please update your app.` };
        }
      }
      return { valid: false, error: 'Backup file is corrupted or missing required schema properties.' };
    }

    // Verify all canonical tables exist in the payload
    for (const table of CANONICAL_BACKUP_TABLES) {
      if (parsed.tables[table] === undefined && OPTIONAL_BACKUP_TABLES.includes(table)) (parsed.tables as any)[table] = [];
      if (!Array.isArray(parsed.tables[table])) {
        return { valid: false, error: `Backup is missing canonical table array: ${table}` };
      }
    }

    return { valid: true, parsed };
  } catch (err) {
    return { valid: false, error: 'Failed to parse backup JSON.' };
  }
}

export function validateBackupRelational(backup: UniOSBackupV2): { valid: boolean; error?: string } {
  const { tables } = backup;

  // Build ID Sets for O(1) lookup
  const semesters = new Set(tables.semesters.map((row: any) => row.id));
  const workspaces = new Set(tables.workspaces.map((row: any) => row.id));
  const components = new Set(tables.course_components.map((row: any) => row.id));
  const recurringSchedules = new Set(tables.recurring_schedules.map((row: any) => row.id));
  const faculty = new Set(tables.faculty.map((row: any) => row.id));
  const venues = new Set(tables.venues.map((row: any) => row.id));
  
  // Relational Check: Workspaces -> Semesters
  for (const w of tables.workspaces) {
    if (w.semesterId && !semesters.has(w.semesterId)) {
      return { valid: false, error: `Relational integrity failed: Workspace '${w.name}' references missing semester ID ${w.semesterId}.` };
    }
  }

  // Relational Check: Course Components -> Workspaces
  for (const c of tables.course_components) {
    if (c.workspaceId && !workspaces.has(c.workspaceId)) {
      return { valid: false, error: `Relational integrity failed: Component references missing workspace ID ${c.workspaceId}.` };
    }
  }

  // Relational Check: Recurring Schedules -> Course Components
  for (const rs of tables.recurring_schedules) {
    if (rs.componentId && !components.has(rs.componentId)) {
      return { valid: false, error: `Relational integrity failed: Schedule references missing component ID ${rs.componentId}.` };
    }
  }

  // Relational Check: Schedule Exceptions -> Recurring Schedules
  for (const ex of tables.schedule_exceptions) {
    if (ex.recurringScheduleId && !recurringSchedules.has(ex.recurringScheduleId)) {
      return { valid: false, error: `Relational integrity failed: Schedule exception references missing schedule ID ${ex.recurringScheduleId}.` };
    }
    if (ex.componentId && !components.has(ex.componentId)) {
      return { valid: false, error: `Relational integrity failed: Schedule exception references missing component ID ${ex.componentId}.` };
    }
  }

  // Relational Check: Venue Assignments -> Course Components & Venues
  for (const va of tables.component_venue_assignments) {
    if (va.componentId && !components.has(va.componentId)) {
      return { valid: false, error: `Relational integrity failed: Venue assignment references missing component ID ${va.componentId}.` };
    }
    if (va.venueId && !venues.has(va.venueId)) {
      return { valid: false, error: `Relational integrity failed: Venue assignment references missing venue ID ${va.venueId}.` };
    }
  }

  // Relational Check: Faculty Assignments -> Course Components & Faculty
  for (const fa of tables.component_faculty_assignments) {
    if (fa.componentId && !components.has(fa.componentId)) {
      return { valid: false, error: `Relational integrity failed: Faculty assignment references missing component ID ${fa.componentId}.` };
    }
    if (fa.facultyId && !faculty.has(fa.facultyId)) {
      return { valid: false, error: `Relational integrity failed: Faculty assignment references missing faculty ID ${fa.facultyId}.` };
    }
  }

  // Relational Check: Attendance -> Course Components
  for (const att of tables.attendance) {
    if (att.componentId && !components.has(att.componentId)) {
      return { valid: false, error: `Relational integrity failed: Attendance record references missing component ID ${att.componentId}.` };
    }
  }

  // Relational Check: Tasks -> Workspaces
  for (const task of tables.tasks) {
    if (task.workspaceId && !workspaces.has(task.workspaceId)) {
      return { valid: false, error: `Relational integrity failed: Task '${task.title}' references missing workspace ID ${task.workspaceId}.` };
    }
  }

  // Relational Check: Resources -> Workspaces
  for (const resource of tables.resources) {
    if (resource.workspaceId && !workspaces.has(resource.workspaceId)) {
      return { valid: false, error: `Relational integrity failed: Resource '${resource.name}' references missing workspace ID ${resource.workspaceId}.` };
    }
  }

  // Check unique primary keys within table payload to prevent SQLite unique constraint violations
  for (const tableName of Object.keys(tables) as Array<keyof typeof tables>) {
    const tableData = tables[tableName];
    if (!Array.isArray(tableData)) continue;
    
    const seenIds = new Set<string | number>();
    for (const row of tableData) {
      if (row.id !== undefined) {
        if (seenIds.has(row.id)) {
          return { valid: false, error: `Relational integrity failed: Duplicate primary key ${row.id} found in table ${tableName}.` };
        }
        seenIds.add(row.id);
      }
    }
  }

  return { valid: true };
}
