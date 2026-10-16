import { highlight, rememberQuery, searchAll, snippet, type SearchData } from '../domains/search/search';
import { formatBytes, formatDuration } from '../core/utils/format';
import { kindOf } from '../core/fs/fileType';

const data: SearchData = {
  courses: [
    { id: 1, name: 'Computer Networks', code: 'PCCSE305D', short: 'CN', color: '#0f0' },
    { id: 2, name: 'Formal Languages and Automata', code: 'PCCSE301D', short: 'FLA', color: '#f00' },
    { id: 3, name: 'Soft Computing Techniques', code: null, short: 'SC', color: '#00f' },
  ],
  tasks: [{ id: 7, title: 'CN presentation: TCP congestion control', workspaceId: 1, sub: 'Due Tue 13 Oct · Other' }],
  files: [{ id: 9, title: 'Kurose – Computer Networking, chapter 3.pdf', workspaceId: 1, sub: 'PDF · 6.1 MB', type: 'file', uri: 'a.pdf' }],
  notes: [{ id: 11, title: 'CN Unit 4 summary', workspaceId: 1, text: 'UDP has no connection setup. TCP congestion control: slow start, congestion avoidance, fast recovery. Network layer recap at the end.' }],
};

describe('search', () => {
  it('highlights every match, case-insensitively', () => {
    expect(highlight('Network networks', 'NET')).toEqual([{ t: 'Net', hit: true }, { t: 'work ', hit: false }, { t: 'net', hit: true }, { t: 'works', hit: false }]);
    expect(highlight('abc', '')).toEqual([{ t: 'abc', hit: false }]);
  });

  it('groups results and finds courses by code', () => {
    const r = searchAll(data, 'net');
    expect(r.map((g) => [g.key, g.rows.length])).toEqual([['courses', 1], ['files', 1], ['notes', 1]]);
    expect(searchAll(data, 'PCC')[0].rows.map((x) => x.id)).toEqual([1, 2]);
    expect(searchAll(data, 'congestion').map((g) => g.key)).toEqual(['tasks', 'notes']);
    expect(searchAll(data, 'quantum computing')).toEqual([]);
    expect(searchAll(data, '   ')).toEqual([]);
  });

  it('starts a note snippet near the match', () => {
    expect(snippet('UDP has no connection setup. TCP congestion control: slow start', 'slow')).toBe('…up. TCP congestion control: slow start');
    expect(snippet('short', 'zzz')).toBe('short');
  });

  it('keeps 8 recent searches, newest first, without duplicates', () => {
    let r: string[] = [];
    for (const q of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', ' B ']) r = rememberQuery(r, q);
    expect(r).toEqual(['B', 'i', 'h', 'g', 'f', 'e', 'd', 'c']);
  });
});

describe('formatting', () => {
  it('formats sizes and durations', () => {
    expect([640, 1_200_000, 412_000_000, 1_288_490_189].map(formatBytes)).toEqual(['640 B', '1.2 MB', '412 MB', '1.3 GB']);
    expect([3150, 4000, 7].map(formatDuration)).toEqual(['52:30', '1:06:40', '0:07']);
  });
  it('knows file kinds from names', () => {
    expect(['a.PDF', 'b.docx', 'c.xlsx', 'd.pptx', 'e.m4a', 'f.py', 'g.bin', 'noext'].map(kindOf)).toEqual(['pdf', 'word', 'excel', 'ppt', 'audio', 'code', 'other', 'other']);
  });
});
