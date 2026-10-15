import { calculateAttendanceMetrics } from '../core/utils/attendance';
import { createDeviceDb } from '../testing/expoSqliteHarness';

// Entity resolution runs on the device driver against the real faculty table.
const mockDevice: { db?: any; expoDb?: any } = {};
jest.mock('../core/db/client', () => ({
  get db() { return mockDevice.db; },
  get expoDb() { return mockDevice.expoDb; },
}));
const { WorkspaceRepository } = require('../domains/workspace/repository');
const { atomic } = require('../core/db/atomic');

describe('Phase B Adversarial Verification Suite', () => {
  let sqlite: any;
  beforeEach(() => {
    const h = createDeviceDb();
    mockDevice.db = h.db; mockDevice.expoDb = h.expoDb; sqlite = h.sqlite;
  });
  const facultyRows = () => sqlite.prepare('SELECT id, name FROM faculty ORDER BY id').all();

  // 2. Entity normalization: create / reuse / duplicates reuse the oldest
  it('2. Entity normalization: create / reuse / duplicates reuse the oldest', () => {
    // Case A: no match -> create, with spaces trimmed
    const createdId = atomic((tx: any) => WorkspaceRepository.resolveFaculty(tx, ' Room A '));
    expect(facultyRows()).toEqual([{ id: createdId, name: 'Room A' }]);

    // Case B: same name, other case and spacing -> reuse, no new row
    expect(atomic((tx: any) => WorkspaceRepository.resolveFaculty(tx, ' room  a '))).toBe(createdId);
    expect(facultyRows()).toHaveLength(1);

    // Case C: two rows with the same name (e.g. from an old backup) -> reuse the oldest.
    // It used to throw AMBIGUOUS_ENTITY_RESOLUTION, which blocked creating the course.
    sqlite.exec("INSERT INTO faculty (name) VALUES ('ROOM A')");
    expect(atomic((tx: any) => WorkspaceRepository.resolveFaculty(tx, 'room  a'))).toBe(createdId);
    expect(facultyRows()).toHaveLength(2);
  });

  // 6. Attendance cancellation exclusion
  it('6. Attendance cancellation exclusion', () => {
    const records = [
      { status: 'present' },
      { status: 'present' },
      { status: 'present' },
      { status: 'present' },
      { status: 'absent' },
      { status: 'holiday' },
      { status: 'holiday' },
      { status: 'cancelled' },
      { status: 'cancelled' },
      { status: 'cancelled' },
    ];
    
    const result = calculateAttendanceMetrics(records);
    expect(result.total).toBe(5); // 4 present + 1 absent
    expect(result.present).toBe(4);
    expect(result.percentage).toBe(80);
  });

  // 8. Explicitly resolve the Total vs Exempt attendance semantics contradiction
  it('8. Explicitly resolve the Total vs Exempt attendance semantics contradiction', () => {
    // Formula (DCRUST ordinance 2024-25 clause 9, matches the Samarth portal):
    // denominator = present + absent + exempt
    // numerator = present (leave is condoned later on documents, not attendance)
    // percentage = numerator / denominator * 100
    
    const records = [
      { status: 'present' }, { status: 'present' }, { status: 'present' }, { status: 'present' }, // 4 present
      { status: 'absent' }, // 1 absent
      { status: 'exempt' }, { status: 'exempt' }, // 2 exempt
    ];

    const result = calculateAttendanceMetrics(records);
    
    expect(result.present).toBe(4); // raw present
    expect(result.absent).toBe(1);
    expect(result.exempt).toBe(2);
    expect(result.total).toBe(7); // denominator: 4 present + 1 absent + 2 exempt
    expect(result.percentage).toBe(Math.round((4 / 7) * 100)); // 57%
  });

});
