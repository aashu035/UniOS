import { formatReport, LogBuffer, stringify } from '../core/diagnostics/report';

describe('diagnostics log buffer', () => {
  it('keeps the newest entries, collapses repeats and trims long lines', () => {
    const b = new LogBuffer(3);
    const t = new Date('2026-10-06T10:00:00Z');
    b.add('error', ['a'], t); b.add('error', ['a'], t); b.add('warn', ['b'], t); b.add('error', ['c'], t); b.add('error', ['d'], t);
    expect(b.list().map((x) => x.message)).toEqual(['b', 'c', 'd']);
    b.add('info', ['x'.repeat(900)], t);
    expect(b.list().pop()!.message).toHaveLength(500);
    b.add('info', ['   '], t);
    expect(b.list()).toHaveLength(3);
  });
  it('stringifies errors with a short stack and survives circular objects', () => {
    const e = new Error('boom');
    expect(stringify(e)).toMatch(/^Error: boom\n/);
    const o: any = {}; o.self = o;
    expect(stringify(o)).toBe('[object Object]');
  });
});

describe('diagnostics report', () => {
  const info = { app: 'UniOS', version: '1.1.0', build: '4', variant: 'preview', sdk: '56.0.0', os: 'android', osVersion: '35', device: 'Xiaomi 23090RA98I', jsEngine: 'Hermes' };
  it('lists app details, counts and recent errors', () => {
    const r = formatReport({
      info, data: { attendance: 120, tasks: 7, migrations: '14 applied', portal_attendance: null },
      logs: [{ at: '2026-10-06T10:01:02.000Z', level: 'error', message: 'Could not save attendance' }],
      note: 'Marked absent, percentage did not change', screen: 'course', now: new Date('2026-10-06T10:05:00Z'),
    });
    expect(r).toContain('UniOS 1.1.0 (build 4) · preview · Expo SDK 56.0.0 · Hermes');
    expect(r).toContain('android 35 · Xiaomi 23090RA98I');
    expect(r).toContain('- attendance: 120');
    expect(r).toContain('- portal_attendance: ?');
    expect(r).toContain('- 10:01:02 ERROR Could not save attendance');
    expect(r).toContain('Screen: course');
    expect(r).not.toMatch(/undefined|null/);
  });
  it('says so when nothing was recorded', () => {
    const r = formatReport({ info: { ...info, build: null, device: null }, data: {}, logs: [] });
    expect(r).toContain('(no description)');
    expect(r).toContain('(none recorded since the app started)');
    expect(r).not.toMatch(/undefined|null/);
  });
});
