/**
 * Every reference check in validateBackupRelational rejects a backup that breaks it
 * (audit 2026-10-14, TEST-07: 91 mutants in these checks had no test).
 */
import { CANONICAL_BACKUP_TABLES } from '../core/db/backupSchema';
import { validateBackupRelational } from '../core/db/backupValidation';

function backup() {
  const tables: Record<string, any[]> = Object.fromEntries(CANONICAL_BACKUP_TABLES.map((t) => [t, []]));
  tables.semesters = [{ id: 1 }];
  tables.venues = [{ id: 1 }];
  tables.faculty = [{ id: 1 }];
  tables.workspaces = [{ id: 1, name: 'OS', semesterId: 1 }];
  tables.course_components = [{ id: 1, workspaceId: 1 }];
  tables.recurring_schedules = [{ id: 1, componentId: 1 }];
  tables.schedule_exceptions = [{ id: 1, recurringScheduleId: 1, componentId: 1 }];
  tables.component_venue_assignments = [{ id: 1, componentId: 1, venueId: 1 }];
  tables.component_faculty_assignments = [{ id: 1, componentId: 1, facultyId: 1 }];
  tables.attendance = [{ id: 1, componentId: 1 }];
  tables.tasks = [{ id: 1, title: 'Lab file', workspaceId: 1 }];
  tables.resources = [{ id: 1, title: 'Notes', workspaceId: 1 }];
  return { format: 'unios-backup', version: 2, exportedAt: '2026-10-14T00:00:00Z', tables } as any;
}

it('accepts the consistent backup', () => {
  expect(validateBackupRelational(backup())).toEqual({ valid: true });
});

it.each([
  ['workspaces', 'semesterId', /Workspace 'OS' references missing semester ID 9/],
  ['course_components', 'workspaceId', /Component references missing workspace ID 9/],
  ['recurring_schedules', 'componentId', /Schedule references missing component ID 9/],
  ['schedule_exceptions', 'recurringScheduleId', /Schedule exception references missing schedule ID 9/],
  ['schedule_exceptions', 'componentId', /Schedule exception references missing component ID 9/],
  ['component_venue_assignments', 'componentId', /Venue assignment references missing component ID 9/],
  ['component_venue_assignments', 'venueId', /Venue assignment references missing venue ID 9/],
  ['component_faculty_assignments', 'componentId', /Faculty assignment references missing component ID 9/],
  ['component_faculty_assignments', 'facultyId', /Faculty assignment references missing faculty ID 9/],
  ['attendance', 'componentId', /Attendance record references missing component ID 9/],
  ['tasks', 'workspaceId', /Task 'Lab file' references missing workspace ID 9/],
  ['resources', 'workspaceId', /Resource 'Notes' references missing workspace ID 9/],
])('%s.%s pointing at a missing row is rejected', (table, field, message) => {
  const b = backup();
  b.tables[table][0][field] = 9;
  const r = validateBackupRelational(b);
  expect(r.valid).toBe(false);
  expect(r.error).toMatch(message);
});

it('a duplicate primary key in any table is rejected', () => {
  const b = backup();
  b.tables.tasks.push({ id: 1, title: 'Copy', workspaceId: 1 });
  expect(validateBackupRelational(b)).toMatchObject({ valid: false, error: expect.stringMatching(/Duplicate primary key 1 found in table tasks/) });
});
