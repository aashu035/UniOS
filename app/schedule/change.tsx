import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Icon, type IconName } from '../../components/uni/Icon';
import { Card, RoundButton, Screen, Segmented, T, Tap } from '../../components/uni/primitives';
import { tint, useUni } from '../../components/uni/theme';
import { Chips, DateStrip, HourGrid, Label, NoteInput, hh, type Busy } from '../../components/schedule/parts';
import { setOccurrenceStatus } from '../../domains/academic/actions';
import { addDays, clock, dayDate, dayName, minutesOf, mondayOf, shortDate } from '../../domains/academic/logic';
import { loadSnapshot, type Occ, type Snapshot } from '../../domains/academic/snapshot';
import { weeklySlots } from '../../domains/academic/weekSlots';
import type { TakenSlot } from '../../domains/academic/setup';
import { DayRuleRepository, type BorrowedMode } from '../../domains/calendar/dayRules';
import { ScheduleExceptionRepository, parseRecurringOccurrence } from '../../domains/calendar/exceptions';
import { getLocalDateString } from '../../core/utils/date';

type Mode = 'pick' | 'follow' | 'extra' | 'move' | 'cancel';
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const W3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PART: Record<string, string> = { theory: 'Lecture', tutorial: 'Tutorial', lab: 'Lab' };
const wdOf = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12).getDay();
const nextSchoolDay = (iso: string) => (dayName(addDays(iso, 1)) === 'Sun' ? addDays(iso, 2) : addDays(iso, 1));
const reasonText = (r: string | null, note: string) => (r === 'Other' ? note.trim() : r ?? '');

/**
 * Schedule changes (Claude Design "Schedule changes" handoff §1): a day follows
 * another day's timetable, an extra class, one class moved (any day and time),
 * or a class / whole day cancelled. Timetable, attendance and history follow.
 */
export default function ScheduleChange() {
  const p = useUni();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: Mode; occ?: string; date?: string; course?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode ?? (params.occ ? 'move' : 'pick'));
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [slots, setSlots] = useState<TakenSlot[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const today = getLocalDateString(new Date());
    const mon = mondayOf(today);
    const [s, w] = await Promise.all([loadSnapshot({ from: addDays(mon, -14), to: addDays(mon, 27) }), weeklySlots()]);
    setSnap(s);
    setSlots(w);
  };
  useEffect(() => { load().catch((e) => Alert.alert('Could not load the timetable', e?.message ?? String(e))); }, []);

  const close = () => router.back();
  const header = (title: string, eyebrow?: string, onBack?: () => void) => (
    <View style={styles.top}>
      <RoundButton icon="chevron-left" label="Back" onPress={onBack ?? (mode === 'pick' || params.mode ? close : () => setMode('pick'))} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? <T w={700} c={p.muted} size={12}>{eyebrow}</T> : null}
        <T w={800} size={20} numberOfLines={1} style={{ letterSpacing: -0.4 }}>{title}</T>
      </View>
      <RoundButton icon="x" label="Close" onPress={close} />
    </View>
  );

  if (!snap) return <Screen tabs={false}>{header('Schedule change')}<ActivityIndicator style={{ marginTop: 40 }} /></Screen>;

  const run = async (fn: () => Promise<unknown>, done?: () => void) => {
    setSaving(true);
    try { await fn(); done ? done() : router.back(); }
    catch (e: any) { Alert.alert('Could not save the change', e?.message ?? 'Please try again.'); }
    finally { setSaving(false); }
  };
  const common = { p, snap, slots, saving, run, header };

  if (mode === 'follow') return <FollowFlow {...common} initialDate={params.date} />;
  if (mode === 'extra') return <ExtraFlow {...common} initialDate={params.date} initialCourse={params.course ? Number(params.course) : undefined} />;
  if (mode === 'move') return <MoveFlow {...common} initialOcc={params.occ} initialDate={params.date} />;
  if (mode === 'cancel') return <CancelFlow {...common} initialOcc={params.occ} initialDate={params.date} />;

  const rows: Array<[Mode, IconName, string, string, string]> = [
    ['follow', 'calendar-days', "A day follows another day's timetable", 'e.g. Thursday runs Friday’s classes', p.warn],
    ['extra', 'list-plus', 'Extra class', 'Make-up, syllabus catch-up, backlog', p.primary],
    ['move', 'arrow-left-right', 'One class moved', 'To another time or another day', '#8B5CF6'],
    ['cancel', 'circle-slash', 'Class or day cancelled', 'Teacher absent, holiday, fest, strike', p.danger],
  ];
  return (
    <Screen tabs={false}>
      {header('What changed?', 'Schedule change')}
      <View style={styles.body}>
        <T c={p.muted} size={14} style={{ lineHeight: 20 }}>Pick what happened. Your timetable and attendance update together.</T>
        {rows.map(([m, icon, t, sub, col]) => (
          <Tap key={m} onPress={() => setMode(m)} accessibilityRole="button" style={[styles.bigRow, { backgroundColor: p.elev, borderColor: p.hair }]}>
            <View style={[styles.well, { backgroundColor: tint(col, 14) }]}><Icon name={icon} size={20} color={col} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w={800} size={15}>{t}</T>
              <T c={p.muted} size={12.5} style={{ marginTop: 2 }}>{sub}</T>
            </View>
            <Icon name="chevron-right" size={18} color={p.muted} />
          </Tap>
        ))}
        <Tap onPress={() => router.push('/schedule/changes' as any)} style={[styles.link, { backgroundColor: p.surface }]}>
          <Icon name="history" size={17} color={p.muted} />
          <T w={700} size={14} style={{ flex: 1 }}>See all changes</T>
          <Icon name="chevron-right" size={16} color={p.muted} />
        </Tap>
      </View>
    </Screen>
  );
}

type Common = {
  p: ReturnType<typeof useUni>; snap: Snapshot; slots: TakenSlot[]; saving: boolean;
  run: (fn: () => Promise<unknown>, done?: () => void) => Promise<void>;
  header: (title: string, eyebrow?: string, onBack?: () => void) => React.ReactNode;
};

function Cta({ label, onPress, disabled, danger, saving }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean; saving?: boolean }) {
  const p = useUni();
  return (
    <Tap onPress={onPress} disabled={disabled || saving} accessibilityRole="button"
      style={[styles.cta, { backgroundColor: danger ? p.danger : p.primary, opacity: disabled ? 0.45 : 1 }]}>
      {saving ? <ActivityIndicator color="#fff" /> : <T w={800} size={15.5} c="#fff">{label}</T>}
    </Tap>
  );
}

function Note({ tone, children }: { tone: 'warn' | 'danger' | 'muted'; children: string }) {
  const p = useUni();
  const c = tone === 'warn' ? p.warn : tone === 'danger' ? p.danger : p.muted;
  return (
    <View style={[styles.note, { backgroundColor: tint(c, 10) }]}>
      <Icon name={tone === 'muted' ? 'info' : 'triangle-alert'} size={15} color={c} />
      <T w={600} size={12.5} style={{ flex: 1, lineHeight: 17 }}>{children}</T>
    </View>
  );
}

const busyOn = (snap: Snapshot, date: string, exceptId?: string): Busy[] =>
  snap.occurrences.filter((o) => o.date === date && !o.cancelled && o.id !== exceptId)
    .map((o) => ({ label: snap.courseById.get(o.workspaceId)?.short ?? o.workspaceName, start: o.startTime, end: o.endTime }));
const classesOn = (snap: Snapshot, date: string) =>
  snap.occurrences.filter((o) => o.date === date && !o.cancelled && parseRecurringOccurrence(o.id));
const slotLabel = (s: TakenSlot) => `${s.short}${s.type === 'lab' ? ' Lab' : s.type === 'tutorial' ? '-T' : ''}`;

// ─── a. Day follows another day ──────────────────────────────────────────────
function FollowFlow({ p, snap, slots, saving, run, header, initialDate }: Common & { initialDate?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [date, setDate] = useState(initialDate ?? nextSchoolDay(snap.today));
  const [week, setWeek] = useState<number | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [borrowedMode, setBorrowedMode] = useState<BorrowedMode>('holiday');
  const w = wdOf(date);
  const existing = snap.dayRules.find((r) => r.date === date);
  const count = (d: number) => slots.filter((s) => s.dayOfWeek === d).length;
  // The borrowed weekday later in the same week (Thu follows Fri → Fri 9 Oct).
  const borrowed = week !== null && week > w ? addDays(date, week - w) : null;
  const borrowedOk = borrowed && mondayOf(borrowed) === mondayOf(date) ? borrowed : null;
  const why = reasonText(reason, note);
  const ready = week !== null && !!why;
  const own = slots.filter((s) => s.dayOfWeek === w).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const runs = slots.filter((s) => s.dayOfWeek === week).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const stays = snap.occurrences.filter((o) => o.date === date && !o.cancelled && (o.exceptionAction === 'extra' || o.movedFromDate));
  const back = step > 1 ? () => setStep(step === 3 && !borrowedOk ? 1 : step - 1) : undefined;
  const save = () => run(() => DayRuleRepository.follow(date, week!, { reason: reason === 'Other' ? note.trim() : reason!, note: reason === 'Other' ? undefined : note, borrowed: borrowedOk ? { date: borrowedOk, mode: borrowedMode } : undefined }), () => setStep(4));

  if (step === 4) {
    return (
      <Screen tabs={false}>
        {header('Saved', 'Day follows another day', () => router.back())}
        <View style={styles.body}>
          <Card style={{ gap: 10, padding: 16 }}>
            <Icon name="circle-check-big" size={28} color={p.success} />
            <T w={800} size={17}>{`${dayDate(date)} follows ${WEEKDAY[week!]}`}</T>
            <T c={p.muted} size={13.5} style={{ lineHeight: 19 }}>
              {`Classes you mark on ${dayDate(date)} count for ${WEEKDAY[week!]}'s timetable. ${WEEKDAY[w]}'s classes that day won't count.${borrowedOk && borrowedMode === 'holiday' ? ` ${dayDate(borrowedOk)} is a holiday.` : ''}`}
            </T>
          </Card>
          <Cta label="Add another day" onPress={() => { setDate(nextSchoolDay(date)); setWeek(null); setStep(1); }} />
          <Tap onPress={() => router.replace({ pathname: '/(main)/schedule', params: { date } } as any)} style={[styles.link, { backgroundColor: p.surface, justifyContent: 'center' }]}>
            <T w={700} size={14}>Done</T>
          </Tap>
        </View>
      </Screen>
    );
  }

  if (step === 3) {
    return (
      <Screen tabs={false}>
        {header('Preview', `Step 3 of 3 · ${dayDate(date)}`, back)}
        <View style={styles.body}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Card style={{ flex: 1, padding: 12, gap: 6 }}>
              <T w={800} size={12} c={p.muted}>{`${WEEKDAY[w].toUpperCase()} · DROPPED`}</T>
              {own.length ? own.map((s, i) => <T key={i} size={12.5} c={p.muted} style={{ textDecorationLine: 'line-through' }}>{`${clock(s.startTime, false)} ${slotLabel(s)}`}</T>) : <T c={p.muted} size={12.5}>No classes</T>}
              <T w={700} size={11.5} c={p.off}>Off · not counted</T>
            </Card>
            <Card style={{ flex: 1, padding: 12, gap: 6 }}>
              <T w={800} size={12} c={p.success}>{`${WEEKDAY[week!].toUpperCase()} · RUNS`}</T>
              {runs.length ? runs.map((s, i) => <T key={i} w={600} size={12.5}>{`${clock(s.startTime, false)} ${slotLabel(s)}`}</T>) : <T c={p.muted} size={12.5}>No classes</T>}
              <T w={700} size={11.5} c={p.success}>Counts as usual</T>
            </Card>
          </View>
          {stays.length ? <Note tone="muted">{`Still runs that day: ${stays.map((o) => `${snap.courseById.get(o.workspaceId)?.short ?? o.workspaceName} ${clock(o.startTime, false)}`).join(', ')}.`}</Note> : null}
          {borrowedOk ? <Note tone="muted">{`${dayDate(borrowedOk)}: ${borrowedMode === 'holiday' ? 'holiday, no classes' : borrowedMode === 'normal' ? 'normal day' : 'not sure yet, you can settle it later'}.`}</Note> : null}
          <Note tone="muted">Other groups' labs follow the same swap.</Note>
          <Cta label="Save change" onPress={save} saving={saving} />
        </View>
      </Screen>
    );
  }

  if (step === 2 && borrowedOk) {
    return (
      <Screen tabs={false}>
        {header(`${dayDate(borrowedOk)} is…`, 'Step 2 of 3', back)}
        <View style={styles.body}>
          {([['holiday', 'Holiday – no classes', 'Its classes are Off and not counted'], ['normal', `Normal ${WEEKDAY[week!]}`, 'Classes run as usual'], ['unsure', 'Not sure yet', "Tagged 'Not sure'; settle it the evening before"]] as const).map(([k, t, sub]) => (
            <Tap key={k} onPress={() => setBorrowedMode(k)} accessibilityRole="radio" accessibilityState={{ selected: borrowedMode === k }}
              style={[styles.bigRow, { backgroundColor: borrowedMode === k ? tint(p.primary, 8) : p.elev, borderColor: borrowedMode === k ? p.primary : p.hair }]}>
              <View style={{ flex: 1 }}><T w={800} size={15}>{t}</T><T c={p.muted} size={12.5}>{sub}</T></View>
              <View style={[styles.radio, { borderColor: borrowedMode === k ? p.primary : p.border, borderWidth: borrowedMode === k ? 6 : 2 }]} />
            </Tap>
          ))}
          <Cta label="Preview" onPress={() => setStep(3)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen tabs={false}>
      {header('Day follows another day', 'Step 1 of 3')}
      <View style={styles.body}>
        <Label>DATE</Label>
        <DateStrip value={date} onChange={(d) => { setDate(d); if (week === wdOf(d)) setWeek(null); }} start={snap.today} dots={snap.dayRules.map((r) => r.date)} />
        {existing ? <Note tone="warn">{`${dayDate(date)} already has a change (${existing.kind === 'follow' ? `follows ${WEEKDAY[existing.followsWeekday ?? 0]}` : `day off: ${existing.reason}`}). Saving replaces it.`}</Note> : null}
        <Label>RUNS WHICH DAY'S TIMETABLE?</Label>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[1, 2, 3, 4, 5, 6].map((d) => {
            const on = week === d, off = d === w;
            return (
              <Tap key={d} disabled={off} onPress={() => setWeek(d)} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: off }}
                style={[styles.wk, { backgroundColor: on ? p.primary : p.elev, borderColor: on ? p.primary : p.hair, opacity: off ? 0.35 : 1 }]}>
                <T w={800} size={13} c={on ? '#fff' : p.text}>{W3[d]}</T>
                <T w={600} size={10.5} c={on ? '#fff' : p.muted}>{count(d)} cl</T>
              </Tap>
            );
          })}
        </View>
        <Label>WHY</Label>
        <Chips items={[['Event', 'Event'], ['Festival', 'Festival'], ['Holiday shift', 'Holiday shift'], ['Exam', 'Exam'], ['Other', 'Other']]} value={reason} onChange={setReason} />
        <NoteInput value={note} onChange={setNote} placeholder={reason === 'Other' ? 'What happened? (required)' : 'Note, e.g. Techfest (optional)'} />
        <Cta label={week !== null ? `${dayDate(date)} follows ${WEEKDAY[week]}` : 'Pick a weekday'} disabled={!ready} onPress={() => setStep(borrowedOk ? 2 : 3)} />
      </View>
    </Screen>
  );
}

// ─── b. Extra class ──────────────────────────────────────────────────────────
function ExtraFlow({ p, snap, saving, run, header, initialDate, initialCourse }: Common & { initialDate?: string; initialCourse?: number }) {
  const [courseId, setCourseId] = useState<number | null>(initialCourse ?? snap.courses[0]?.id ?? null);
  const course = courseId ? snap.courseById.get(courseId) : undefined;
  const [part, setPart] = useState<string>('theory');
  const [date, setDate] = useState(initialDate ?? snap.today);
  const [hour, setHour] = useState<number | null>(null);
  const [room, setRoom] = useState(course?.venue ?? '');
  const [reason, setReason] = useState<string | null>('Syllabus catch-up');
  const [note, setNote] = useState('');
  useEffect(() => { setRoom(course?.venue ?? ''); if (course && !course.parts.some((x) => x.type === part)) setPart(course.parts[0]?.type ?? 'theory'); }, [courseId]);
  if (!course) return <Screen tabs={false}>{header('Extra class')}<View style={styles.body}><Note tone="muted">Add a course first.</Note></View></Screen>;
  const len = part === 'lab' ? 2 : 1;
  const busy = busyOn(snap, date);
  const clash = hour !== null && busy.find((b) => minutesOf(b.start) < (hour + len) * 60 && hour * 60 < minutesOf(b.end));
  const why = reasonText(reason, note);
  const componentId = course.parts.find((x) => x.type === part)?.componentIds[0];
  const nowH = new Date().getHours();
  const past = hour !== null && (date < snap.today || (date === snap.today && hour + len <= nowH));

  const save = () => run(async () => {
    const ex = await ScheduleExceptionRepository.extra(componentId!, date, hh(hour!), hh(hour! + len), { venueName: room, reason: why });
    if (past) {
      await new Promise<void>((resolve) => Alert.alert('This class already happened', 'Mark it now so your attendance stays right.', [
        { text: 'Later', style: 'cancel', onPress: () => resolve() },
        { text: 'Absent', onPress: () => setOccurrenceStatus({ id: `ex_${ex.id}`, workspaceId: course.id, date, componentId }, 'absent').finally(resolve) },
        { text: 'Present', onPress: () => setOccurrenceStatus({ id: `ex_${ex.id}`, workspaceId: course.id, date, componentId }, 'present').finally(resolve) },
      ]));
    }
  });

  return (
    <Screen tabs={false}>
      {header('Extra class', 'Schedule change')}
      <View style={styles.body}>
        <Label>COURSE</Label>
        <Chips items={snap.courses.map((c) => [String(c.id), c.short] as [string, string])} value={courseId ? String(courseId) : null} onChange={(k) => setCourseId(Number(k))} />
        {course.parts.length > 1 ? <Segmented<string> items={course.parts.map((x) => [x.type, PART[x.type] ?? x.type] as [string, string])} value={part} onChange={setPart} /> : null}
        <Label>DATE</Label>
        <DateStrip value={date} onChange={setDate} start={addDays(snap.today, -7)} weeks={4} focus={snap.today} />
        <Label>{`TIME · ${part === 'lab' ? '2 hours' : '1 hour'}`}</Label>
        <T c={p.muted} size={12}>Grey = already has a class</T>
        <HourGrid busy={busy} value={hour} len={len} onChange={setHour} />
        {hour === 13 ? <Note tone="muted">Outside usual hours (lunch). That's fine.</Note> : null}
        {clash ? <Note tone="danger">{`Clashes with ${clash.label} ${clock(clash.start, false)}. Both will show; mark the one you attend.`}</Note> : null}
        <Label>ROOM</Label>
        <NoteInput value={room} onChange={setRoom} placeholder="e.g. JCB-213" />
        <Label>WHY</Label>
        <Chips items={[['Syllabus catch-up', 'Syllabus catch-up'], ['Teacher swap', 'Teacher swap'], ['Make-up class', 'Make-up class'], ['Backlog', 'Backlog'], ['Other', 'Other']]} value={reason} onChange={setReason} />
        {reason === 'Other' ? <NoteInput value={note} onChange={setNote} placeholder="What is it for? (required)" /> : null}
        <Cta label={hour === null ? 'Pick a time' : `${clash ? 'Add anyway' : 'Add'} ${course.short} ${PART[part] ?? ''} · ${dayName(date)} ${shortDate(date)}, ${clock(hh(hour), false)}`}
          disabled={hour === null || !why || !componentId} danger={!!clash} onPress={save} saving={saving} />
      </View>
    </Screen>
  );
}

// ─── c. One class moved ──────────────────────────────────────────────────────
function MoveFlow({ p, snap, saving, run, header, initialOcc, initialDate }: Common & { initialOcc?: string; initialDate?: string }) {
  const initial = initialOcc ? snap.occurrences.find((o) => o.id === initialOcc) : undefined;
  const [fromDate, setFromDate] = useState(initial?.date ?? initialDate ?? snap.today);
  const [occId, setOccId] = useState<string | null>(initial?.id ?? null);
  const occ = snap.occurrences.find((o) => o.id === occId && o.date === fromDate) ?? null;
  const [toDate, setToDate] = useState(fromDate);
  const [hour, setHour] = useState<number | null>(occ ? Math.floor(minutesOf(occ.startTime) / 60) : null);
  const [room, setRoom] = useState(occ?.venueName ?? '');
  const [reason, setReason] = useState<string | null>(null);
  useEffect(() => { if (occ) { setToDate(occ.date); setHour(Math.floor(minutesOf(occ.startTime) / 60)); setRoom(occ.venueName ?? ''); } }, [occId]);
  const list = classesOn(snap, fromDate);
  const durMin = occ ? minutesOf(occ.endTime) - minutesOf(occ.startTime) : 60;
  const len = Math.max(1, Math.round(durMin / 60));
  const busy = busyOn(snap, toDate, occ?.id);
  const clash = hour !== null && busy.find((b) => minutesOf(b.start) < hour * 60 + durMin && hour * 60 < minutesOf(b.end));
  const unchanged = occ && toDate === occ.date && hour === Math.floor(minutesOf(occ.startTime) / 60);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const endOf = (h: number) => { const m = h * 60 + durMin; return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`; };

  const save = () => run(() => {
    const ref = parseRecurringOccurrence(occ!.id)!;
    return ScheduleExceptionRepository.move(ref.recurringScheduleId, ref.date, hh(hour!), endOf(hour!), room, { targetDate: toDate, reason: reason ?? undefined });
  });

  return (
    <Screen tabs={false}>
      {header('One class moved', 'Schedule change')}
      <View style={styles.body}>
        <Label>WHICH DAY WAS IT ON?</Label>
        <DateStrip value={fromDate} onChange={(d) => { setFromDate(d); setOccId(null); }} start={addDays(snap.today, -7)} weeks={4} focus={snap.today} />
        <Label>WHICH CLASS?</Label>
        {list.length ? list.map((o) => (
          <Tap key={o.id} onPress={() => setOccId(o.id)} accessibilityRole="radio" accessibilityState={{ selected: o.id === occId }}
            style={[styles.classRow, { backgroundColor: o.id === occId ? tint(p.primary, 8) : p.elev, borderColor: o.id === occId ? p.primary : p.hair }]}>
            <T w={800} size={14} style={{ width: 70 }}>{clock(o.startTime, false)}</T>
            <T w={700} size={14} style={{ flex: 1 }} numberOfLines={1}>{`${o.workspaceName}${o.componentType === 'lab' ? ' Lab' : o.componentType === 'tutorial' ? ' Tutorial' : ''}`}</T>
          </Tap>
        )) : <Note tone="muted">No classes on this day.</Note>}
        {occ ? (
          <>
            <Label>NEW DATE</Label>
            <DateStrip value={toDate} onChange={setToDate} start={addDays(snap.today, -7)} weeks={4} focus={snap.today} />
            <Label>NEW TIME</Label>
            <HourGrid busy={busy} value={hour} len={len} onChange={setHour} />
            {clash ? <Note tone="danger">{`Clashes with ${clash.label} ${clock(clash.start, false)}. Both will show; mark the one you attend.`}</Note> : null}
            <Label>ROOM</Label>
            <NoteInput value={room} onChange={setRoom} placeholder="Room" />
            <Chips items={[['Teacher swap', 'Teacher swap'], ['Event', 'Event'], ['Exam', 'Exam'], ['Other', 'Other']]} value={reason} onChange={setReason} />
            {hour !== null && !unchanged ? <Note tone="muted">{`${dayDate(occ.date)} ${clock(occ.startTime, false)} shows "Moved to ${dayDate(toDate)}, ${clock(hh(hour), false)}" and isn't counted. The new slot counts for ${snap.courseById.get(occ.workspaceId)?.short ?? occ.workspaceName}.`}</Note> : null}
            <Cta label={unchanged ? 'Pick a new day or time' : `Move to ${dayName(toDate)} ${shortDate(toDate)}, ${hour !== null ? clock(hh(hour), false) : ''}`} disabled={!!unchanged || hour === null} danger={!!clash} onPress={save} saving={saving} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

// ─── d. Class or day cancelled ───────────────────────────────────────────────
function CancelFlow({ p, snap, saving, run, header, initialOcc, initialDate }: Common & { initialOcc?: string; initialDate?: string }) {
  const initial = initialOcc ? snap.occurrences.find((o) => o.id === initialOcc) : undefined;
  const [scope, setScope] = useState<'one' | 'day'>('one');
  const [date, setDate] = useState(initial?.date ?? initialDate ?? snap.today);
  const [occId, setOccId] = useState<string | null>(initial?.id ?? null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const list = scope === 'day' ? snap.occurrences.filter((o) => o.date === date && !o.cancelled) : classesOn(snap, date);
  const targets = scope === 'day' ? list : list.filter((o) => o.id === occId);
  const marked = targets.filter((o) => o.status === 'present' || o.status === 'absent' || o.status === 'exempt');
  const why = reasonText(reason, note);
  const label = (o: Occ) => `${snap.courseById.get(o.workspaceId)?.short ?? o.workspaceName}${o.componentType === 'lab' ? ' Lab' : ''}`;
  const markWord = (s: string | null) => (s === 'present' ? 'Present' : s === 'absent' ? 'Absent' : s === 'exempt' ? 'On leave' : '');

  const save = () => run(async () => {
    if (scope === 'day') return DayRuleRepository.dayOff(date, { reason: reason === 'Other' ? note.trim() : reason!, note: reason === 'Other' ? undefined : note });
    const ref = parseRecurringOccurrence(targets[0].id)!;
    return ScheduleExceptionRepository.cancel(ref.recurringScheduleId, ref.date, why);
  });

  return (
    <Screen tabs={false}>
      {header('Class or day cancelled', 'Schedule change')}
      <View style={styles.body}>
        <Segmented<'one' | 'day'> items={[['one', 'One class'], ['day', 'Whole day']]} value={scope} onChange={setScope} />
        <Label>DATE</Label>
        <DateStrip value={date} onChange={(d) => { setDate(d); setOccId(null); }} start={addDays(snap.today, -7)} weeks={4} focus={snap.today} dots={snap.dayRules.map((r) => r.date)} />
        {list.length ? list.map((o) => {
          const on = scope === 'day' || o.id === occId;
          return (
            <Tap key={o.id} disabled={scope === 'day'} onPress={() => setOccId(o.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={[styles.classRow, { backgroundColor: on ? tint(p.danger, 6) : p.elev, borderColor: on ? tint(p.danger, 40) : p.hair }]}>
              <T w={800} size={14} style={{ width: 70, textDecorationLine: on ? 'line-through' : 'none' }}>{clock(o.startTime, false)}</T>
              <T w={700} size={14} style={{ flex: 1, textDecorationLine: on ? 'line-through' : 'none' }} numberOfLines={1}>{label(o)}</T>
              {o.status ? <T w={700} size={12} c={p.muted}>{markWord(o.status)}</T> : null}
            </Tap>
          );
        }) : <Note tone="muted">No classes on this day.</Note>}
        {marked.length ? <Note tone="warn">{`${marked.map((o) => `${label(o)} was marked ${markWord(o.status)}`).join(', ')}. It will become Off; undo brings it back.`}</Note> : null}
        <Label>WHY</Label>
        <Chips items={[['Teacher absent', 'Teacher absent'], ['Holiday', 'Holiday'], ['Event / fest', 'Event / fest'], ['Strike', 'Strike'], ['Other', 'Other']]} value={reason} onChange={setReason} />
        <NoteInput value={note} onChange={setNote} placeholder={reason === 'Other' ? 'What happened? (required)' : 'Note (optional), e.g. Diwali'} />
        <Cta label={scope === 'day' ? `Cancel all ${list.length} classes on ${dayName(date)} ${shortDate(date)}` : targets.length ? `Cancel ${label(targets[0])} ${clock(targets[0].startTime, false)}` : 'Pick a class'}
          disabled={!why || !targets.length} danger onPress={save} saving={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  body: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },
  bigRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: 1.5 },
  well: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18 },
  cta: { height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 6 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 12 },
  radio: { width: 20, height: 20, borderRadius: 10 },
  wk: { flex: 1, paddingVertical: 9, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 1 },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5 },
});
