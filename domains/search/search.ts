/** Search (design UniSearch, handoff §6): local, case-insensitive substring match. Pure. */

export type Seg = { t: string; hit: boolean };
export type SearchCourse = { id: number; name: string; code: string | null; short: string; color: string };
export type SearchTask = { id: number; title: string; workspaceId: number | null; sub: string };
export type SearchFile = { id: number; title: string; workspaceId: number | null; sub: string; type: string | null; uri: string | null };
export type SearchNote = { id: number; title: string; workspaceId: number | null; text: string };
export type SearchData = { courses: SearchCourse[]; tasks: SearchTask[]; files: SearchFile[]; notes: SearchNote[] };

export type ResultRow = { kind: 'course' | 'task' | 'file' | 'note'; id: number; workspaceId: number | null; title: Seg[]; sub: Seg[]; type?: string | null; uri?: string | null };
export type ResultGroup = { key: 'courses' | 'tasks' | 'files' | 'notes'; title: string; rows: ResultRow[] };

const PER_GROUP = 30;
export const RECENT_MAX = 8;

/** Split `text` into plain and matching parts, for highlighting. */
export function highlight(text: string, q: string): Seg[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [{ t: text, hit: false }];
  const lo = text.toLowerCase();
  const out: Seg[] = [];
  let i = 0;
  for (let j = lo.indexOf(needle); j >= 0; j = lo.indexOf(needle, i)) {
    if (j > i) out.push({ t: text.slice(i, j), hit: false });
    out.push({ t: text.slice(j, j + needle.length), hit: true });
    i = j + needle.length;
  }
  if (i < text.length) out.push({ t: text.slice(i), hit: false });
  return out;
}

/** The note text from a little before the match, so the match shows in two lines. */
export function snippet(text: string, q: string, before = 28): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const j = flat.toLowerCase().indexOf(q.trim().toLowerCase());
  if (j < 0 || !q.trim()) return flat;
  const start = Math.max(0, j - before);
  return (start ? '…' : '') + flat.slice(start);
}

export function searchAll(data: SearchData, query: string): ResultGroup[] {
  const q = query.trim();
  if (!q) return [];
  const has = (s: string | null | undefined) => !!s && s.toLowerCase().includes(q.toLowerCase());
  const groups: ResultGroup[] = [];

  const courses = data.courses.filter((c) => has(c.name) || has(c.code) || has(c.short)).slice(0, PER_GROUP);
  if (courses.length) groups.push({ key: 'courses', title: 'Courses', rows: courses.map((c) => ({ kind: 'course', id: c.id, workspaceId: c.id, title: highlight(c.name, q), sub: highlight(`${c.code || 'No code'} · ${c.short}`, q) })) });

  const tasks = data.tasks.filter((t) => has(t.title)).slice(0, PER_GROUP);
  if (tasks.length) groups.push({ key: 'tasks', title: 'Tasks', rows: tasks.map((t) => ({ kind: 'task', id: t.id, workspaceId: t.workspaceId, title: highlight(t.title, q), sub: [{ t: t.sub, hit: false }] })) });

  const files = data.files.filter((f) => has(f.title)).slice(0, PER_GROUP);
  if (files.length) groups.push({ key: 'files', title: 'Files', rows: files.map((f) => ({ kind: 'file', id: f.id, workspaceId: f.workspaceId, title: highlight(f.title, q), sub: [{ t: f.sub, hit: false }], type: f.type, uri: f.uri })) });

  const notes = data.notes.filter((n) => has(n.title) || has(n.text)).slice(0, PER_GROUP);
  if (notes.length) groups.push({ key: 'notes', title: 'Notes', rows: notes.map((n) => ({ kind: 'note', id: n.id, workspaceId: n.workspaceId, title: highlight(n.title, q), sub: highlight(has(n.text) ? snippet(n.text, q) : n.text.replace(/\s+/g, ' ').trim(), q) })) });

  return groups;
}

/** Newest first, no case-insensitive duplicates, at most 8. */
export function rememberQuery(recents: readonly string[], query: string): string[] {
  const q = query.trim();
  if (!q) return [...recents];
  return [q, ...recents.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX);
}
