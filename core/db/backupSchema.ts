export const BACKUP_FORMAT_STRING = 'unios-backup';
export const CURRENT_BACKUP_VERSION = 2;

export const CANONICAL_BACKUP_TABLES = [
  'students',
  'semesters',
  'dcrust_grading',
  'venues',
  'faculty',
  'workspaces',
  'workspace_timeline',
  'course_components',
  'component_venue_assignments',
  'component_faculty_assignments',
  'recurring_schedules',
  'schedule_exceptions',
  'calendar_events',
  'tasks',
  'resources',
  'attendance',
  'portal_attendance',
  'notifications',
  'ai_connections',
  'learning_profiles',
  'material_index_permissions',
  'tutor_conversations',
  'tutor_messages'
] as const;

export type BackupTableKey = typeof CANONICAL_BACKUP_TABLES[number];

export interface UniOSBackupV2 {
  format: typeof BACKUP_FORMAT_STRING;
  version: typeof CURRENT_BACKUP_VERSION;
  exportedAt: string;
  tables: Record<BackupTableKey, any[]>;
}

export function isUniOSBackupV2(data: any): data is UniOSBackupV2 {
  if (!data || typeof data !== 'object') return false;
  if (data.format !== BACKUP_FORMAT_STRING) return false;
  if (data.version !== CURRENT_BACKUP_VERSION) return false;
  if (!data.tables || typeof data.tables !== 'object') return false;
  return true;
}
