import fs from 'fs';
import path from 'path';
import { validateBackupRelational, validateBackupStructural } from '../core/db/backupValidation';

// A real backup exported from the dev build on 7 Oct 2026, before day_rules existed.
const file = fs.readFileSync(path.join(__dirname, 'fixtures/backup-v2-before-day-rules.json'), 'utf8');

describe('backups across app versions', () => {
  it('an older backup without the schedule-change table still restores', () => {
    const s = validateBackupStructural(file);
    expect(s.valid).toBe(true);
    expect(s.parsed!.tables.day_rules).toEqual([]);
    expect(validateBackupRelational(s.parsed!).valid).toBe(true);
  });
  it('a file that is not a backup is rejected with a clear reason', () => {
    expect(validateBackupStructural('{"hello": 1}')).toMatchObject({ valid: false, error: expect.stringMatching(/Not a UniOS backup/) });
    expect(validateBackupStructural('PK\u0003\u0004 xlsx bytes')).toMatchObject({ valid: false });
    const noAttendance = JSON.parse(file); delete noAttendance.tables.attendance;
    expect(validateBackupStructural(noAttendance)).toMatchObject({ valid: false, error: expect.stringMatching(/attendance/) });
  });
});
