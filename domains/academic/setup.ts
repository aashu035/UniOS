/** Course setup wizard: the tap-to-paint weekly grid and what it saves. */

export type Part = 'theory' | 'lab' | 'tutorial';
export const DURATION: Record<Part, number> = { theory: 60, lab: 120, tutorial: 60 };

/** Grid key: `${dayOfWeek}-${hour}` with dayOfWeek 1 = Monday, hour 0–23. */
export type Slots = Record<string, Part>;

const pad = (n: number) => String(n).padStart(2, '0');

/** Cells covered by a painted slot (a lab covers two hours). */
export function covers(slots: Slots): Map<string, string> {
  const m = new Map<string, string>();
  for (const [key, part] of Object.entries(slots)) {
    const [d, h] = key.split('-').map(Number);
    for (let i = 0; i < DURATION[part] / 60; i++) m.set(`${d}-${h + i}`, key);
  }
  return m;
}

/**
 * Paint `part` at a cell. Tapping a slot's own start cell clears it; a cell that an
 * existing slot covers, or one whose span would collide, is left unchanged.
 */
export function paint(slots: Slots, key: string, part: Part, lastHour: number): Slots {
  const owner = covers(slots).get(key);
  if (owner) {
    if (owner !== key) return slots;
    const next = { ...slots };
    delete next[key];
    return next;
  }
  const [d, h] = key.split('-').map(Number);
  const span = DURATION[part] / 60;
  if (h + span - 1 > lastHour) return slots;
  const taken = covers(slots);
  for (let i = 1; i < span; i++) if (taken.has(`${d}-${h + i}`)) return slots;
  return { ...slots, [key]: part };
}

export function sessionsFor(slots: Slots, part: Part) {
  return Object.entries(slots)
    .filter(([, p]) => p === part)
    .map(([key]) => {
      const [d, h] = key.split('-').map(Number);
      return { dayOfWeek: d, startTime: `${pad(h)}:00`, endTime: `${pad(h + DURATION[part] / 60)}:00` };
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

/** Drop slots for parts the course no longer includes. */
export function prune(slots: Slots, parts: Part[]): Slots {
  return Object.fromEntries(Object.entries(slots).filter(([, p]) => parts.includes(p)));
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function slotSummary(slots: Slots): string {
  const n = Object.keys(slots).length;
  if (!n) return 'No weekly slots';
  const days = [...new Set(Object.keys(slots).map((k) => Number(k.split('-')[0])))].sort().map((d) => DAYS[d]);
  return `${n} session${n === 1 ? '' : 's'} · ${days.join(', ')}`;
}

/** A weekly slot already on the timetable (from another course). */
export interface TakenSlot { workspaceId: number; name: string; short: string; color: string; type: string; dayOfWeek: number; startTime: string; endTime: string }

const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const DAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hm = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}`; };

/**
 * Where the new course's sessions overlap classes already on the timetable.
 * Touching (one ends as the next starts) is not a clash.
 */
export function findClashes(sessions: Array<{ dayOfWeek: number; startTime: string; endTime: string }>, taken: TakenSlot[]) {
  const out: Array<{ day: number; start: string; end: string; with: TakenSlot }> = [];
  for (const s of sessions) {
    for (const t of taken) {
      if (t.dayOfWeek === s.dayOfWeek && mins(s.startTime) < mins(t.endTime) && mins(t.startTime) < mins(s.endTime)) {
        out.push({ day: s.dayOfWeek, start: s.startTime, end: s.endTime, with: t });
      }
    }
  }
  return out;
}

/** "Mon 9–10 with Test Course, Tue 2–3 with CN Lab (+3 more)". */
export function clashSummary(clashes: ReturnType<typeof findClashes>, max = 3): string {
  const parts = clashes.slice(0, max).map((c) => `${DAY3[c.day]} ${hm(c.start)}–${hm(c.end)} with ${c.with.name}${c.with.type === 'lab' ? ' Lab' : c.with.type === 'tutorial' ? ' Tutorial' : ''}`);
  return parts.join(', ') + (clashes.length > max ? ` (+${clashes.length - max} more)` : '');
}
