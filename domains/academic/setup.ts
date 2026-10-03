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
