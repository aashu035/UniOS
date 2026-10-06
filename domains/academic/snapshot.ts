import { and, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../core/db/client';
import { getLocalDateString } from '../../core/utils/date';
import { attendance, portalAttendance } from '../attendance/model';
import { recurringSchedules, scheduleExceptions } from '../calendar/model';
import { CalendarService, type EffectiveOccurrence } from '../calendar/service';
import { NotificationRepository } from '../notification/repository';
import { resources } from '../resource/model';
import { semesters } from '../semester/model';
import { tasks } from '../task/model';
import { courseComponents, workspaces } from '../workspace/model';
import { CourseListService } from '../workspace/CourseListService';
import { addDays, countAttendance, mondayOf, type AttCounts, type AttStatus } from './logic';

export interface Course {
  id: number;
  name: string;
  short: string;
  code: string | null;
  credits: number | null;
  color: string;
  icon: string | null;
  target: number;
  faculty: string | null;
  venue: string | null;
  componentIds: number[];
  componentTypes: string[];
  att: AttCounts;
  /** Counts per part (theory / lab / tutorial). The 75% rule applies to `att`, the combined count. */
  parts: CoursePart[];
}

export interface CoursePart { type: string; componentIds: number[]; att: AttCounts }

export interface Occ extends EffectiveOccurrence {
  status: AttStatus | null;
  /** The class was cancelled for this date (CalendarService drops these; we keep them to show "Off"). */
  cancelled?: boolean;
  /** For moved classes, the regular slot it moved from. */
  original?: { startTime: string; endTime: string };
}

export interface TaskRow {
  id: number;
  title: string;
  type: string | null;
  dueDate: string | null;
  status: string | null;
  priority: string;
  workspaceId: number | null;
}

export interface FileRow { id: number; title: string; type: string | null; uri: string | null; workspaceId: number | null; createdAt: string | null; sizeBytes: number | null }

export interface Portal { workspaceId: number; total: number | null; present: number | null; percent: number | null; checkedDate: string }

export interface AttRow { occurrenceId: string; componentId: number; date: string; status: string; workspaceId: number }

export interface Snapshot {
  today: string;
  from: string;
  to: string;
  semester: { id: number; name: string | null; number: number; startDate: string | null } | null;
  courses: Course[];
  courseById: Map<number, Course>;
  occurrences: Occ[];
  records: AttRow[];
  tasks: TaskRow[];
  files: FileRow[];
  portal: Portal[];
  unread: number;
}

/**
 * Due dates are stored as YYYY-MM-DD by the current task form, but older rows can
 * hold a full timestamp (e.g. toISOString()). Reduce anything parseable to a local
 * YYYY-MM-DD so date math never sees NaN; unparseable values become null.
 */
export function normalizeDate(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (!t) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const ok = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null;
  // Explicit patterns rather than Date parsing: Hermes (the phone's JS engine) rejects some formats Node accepts.
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(t);
  if (m) {
    if (!m[6]) return ok(+m[1], +m[2], +m[3]); // no zone: already local wall time
    const d = new Date(t.replace(' ', 'T'));
    return isNaN(d.getTime()) ? ok(+m[1], +m[2], +m[3]) : getLocalDateString(d);
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t); // day first, as written in India
  if (m) return ok(+m[3], +m[2], +m[1]);
  if (/^\d{10,13}$/.test(t)) { const d = new Date(t.length === 10 ? +t * 1000 : +t); return isNaN(d.getTime()) ? null : getLocalDateString(d); }
  return null;
}

export function shortLabel(name: string, shortName?: string | null): string {
  if (shortName && shortName.trim()) return shortName.trim();
  const words = name.split(/\s+/).filter((w) => w && !/^(and|of|the|&|to|for|in)$/i.test(w));
  if (words.length === 1) return words[0].length <= 6 ? words[0] : words[0].slice(0, 4);
  return words.map((w) => w[0].toUpperCase()).join('').slice(0, 5);
}

/**
 * Everything the redesigned screens read, in one pass. `from`/`to` bound the
 * schedule window; by default the current week plus one week either side.
 */
export async function loadSnapshot(opts: { today?: string; from?: string; to?: string } = {}): Promise<Snapshot> {
  const today = opts.today ?? getLocalDateString(new Date());
  const monday = mondayOf(today);
  const from = opts.from ?? addDays(monday, -7);
  const to = opts.to ?? addDays(monday, 20);

  const [allWs, allComps, allAtt, allTasks, allFiles, allPortal, active, courseList, unread] = await Promise.all([
    db.select().from(workspaces).all(),
    db.select().from(courseComponents).all(),
    db.select().from(attendance).all(),
    db.select().from(tasks).all(),
    db.select({ id: resources.id, title: resources.title, type: resources.type, uri: resources.uri, workspaceId: resources.workspaceId, createdAt: resources.createdAt, sizeBytes: resources.sizeBytes })
      .from(resources).orderBy(desc(resources.createdAt)).all(),
    db.select().from(portalAttendance).orderBy(desc(portalAttendance.checkedDate)).all(),
    (async () => (await db.select().from(semesters).all()).find((s) => s.isActive) ?? null)(),
    CourseListService.getCourses(),
    NotificationRepository.countUnread().catch(() => 0),
  ]);

  // Courses in the active semester (all courses when no semester is active).
  const inScope = active ? allWs.filter((w) => w.semesterId === active.id) : allWs;
  const meta = new Map(courseList.map((c) => [c.id, c]));
  const compToWs = new Map(allComps.map((c) => [c.id, c.workspaceId]));

  const records: AttRow[] = allAtt
    .filter((a) => compToWs.has(a.componentId))
    .map((a) => ({ occurrenceId: a.occurrenceId, componentId: a.componentId, date: normalizeDate(a.date) ?? a.date, status: a.status, workspaceId: compToWs.get(a.componentId)! }));

  const courses: Course[] = inScope.map((w) => {
    const comps = allComps.filter((c) => c.workspaceId === w.id);
    const m = meta.get(w.id);
    return {
      id: w.id,
      name: w.name,
      short: shortLabel(w.name, w.shortName),
      code: w.code,
      credits: w.credits,
      color: w.color || '#6C5CE7',
      icon: w.icon,
      target: w.targetAttendance ?? 75,
      faculty: m?.primaryFacultyName ?? null,
      venue: m?.primaryVenueName ?? null,
      componentIds: comps.map((c) => c.id),
      componentTypes: comps.map((c) => c.type),
      att: countAttendance(records.filter((r) => r.workspaceId === w.id)),
      parts: [...new Set(comps.map((c) => c.type))].map((type) => {
        const ids = comps.filter((c) => c.type === type).map((c) => c.id);
        return { type, componentIds: ids, att: countAttendance(records.filter((r) => ids.includes(r.componentId))) };
      }),
    };
  });
  const courseById = new Map(courses.map((c) => [c.id, c]));

  // Schedule window, plus the cancelled classes CalendarService removes and the
  // original slot of moved classes.
  const [effective, exceptions, recurring] = await Promise.all([
    CalendarService.getEffectiveSchedule(from, to),
    db.select().from(scheduleExceptions).where(and(gte(scheduleExceptions.specificDate, from), lte(scheduleExceptions.specificDate, to))).all(),
    db.select().from(recurringSchedules).all(),
  ]);
  const recById = new Map(recurring.map((r) => [r.id, r]));
  const statusByOcc = new Map(records.map((r) => [r.occurrenceId, r.status as AttStatus]));
  const wsById = new Map(allWs.map((w) => [w.id, w]));
  const compById = new Map(allComps.map((c) => [c.id, c]));

  const occurrences: Occ[] = effective
    .filter((o) => courseById.has(o.workspaceId))
    .map((o) => {
      const occ: Occ = { ...o, status: statusByOcc.get(o.id) ?? null };
      const m = /^rec_(\d+)_/.exec(o.id);
      if (o.exceptionAction === 'move' && m) {
        const rec = recById.get(Number(m[1]));
        if (rec) occ.original = { startTime: rec.startTime, endTime: rec.endTime };
      }
      return occ;
    });

  for (const ex of exceptions) {
    if (ex.action !== 'cancel' || !ex.recurringScheduleId) continue;
    const rec = recById.get(ex.recurringScheduleId);
    const comp = rec && compById.get(rec.componentId);
    const ws = comp && wsById.get(comp.workspaceId);
    if (!rec || !comp || !ws || !courseById.has(ws.id)) continue;
    const id = `rec_${rec.id}_${ex.specificDate}`;
    occurrences.push({
      id, workspaceId: ws.id, workspaceName: ws.name, workspaceColor: ws.color || '#3B82F6', workspaceIcon: ws.icon || 'book',
      componentId: comp.id, componentType: comp.type, date: ex.specificDate, startTime: rec.startTime, endTime: rec.endTime,
      venueName: courseById.get(ws.id)?.venue ?? undefined, isException: true, exceptionAction: 'cancel', cancelled: true,
      status: statusByOcc.get(id) ?? null,
    });
  }
  occurrences.sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime)));

  const scopeIds = new Set(courses.map((c) => c.id));
  return {
    today, from, to,
    semester: active ? { id: active.id, name: active.name, number: active.number, startDate: normalizeDate(active.startDate) } : null,
    courses,
    courseById,
    occurrences,
    records: records.filter((r) => scopeIds.has(r.workspaceId)),
    tasks: allTasks
      .filter((t) => t.workspaceId === null || scopeIds.has(t.workspaceId))
      .map((t) => ({ id: t.id, title: t.title, type: t.type, dueDate: normalizeDate(t.dueDate), status: t.status, priority: t.priority, workspaceId: t.workspaceId })),
    files: allFiles.filter((f) => f.workspaceId === null || scopeIds.has(f.workspaceId)),
    portal: allPortal
      .filter((p, i, arr) => scopeIds.has(p.workspaceId) && arr.findIndex((q) => q.workspaceId === p.workspaceId) === i)
      .map((p) => ({ workspaceId: p.workspaceId, total: p.portalTotal, present: p.portalPresent, percent: p.portalPercent, checkedDate: p.checkedDate })),
    unread,
  };
}

/** Schedule for an arbitrary window, enriched the same way (used when paging weeks). */
export async function loadWindow(from: string, to: string, today?: string): Promise<Occ[]> {
  const s = await loadSnapshot({ from, to, today });
  return s.occurrences;
}
