import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '../uni/Icon';
import { LEAVE_COLOR, MarkSheet } from '../uni/MarkSheet';
import { Card, T, Tap } from '../uni/primitives';
import { tint, useUni } from '../uni/theme';
import { setOccurrenceStatus } from '../../domains/academic/actions';
import { addDays, clock, countAttendance, dayName, leaveNote, minutesOf, mondayOf, shortDate, verdict, type AttCounts, type AttStatus } from '../../domains/academic/logic';
import type { Course, Occ, Snapshot } from '../../domains/academic/snapshot';

/** One class in the log: scheduled (maybe unmarked) or a stored mark. */
export type Session = {
  id: string; workspaceId: number; date: string; componentId?: number | null; componentType?: string | null;
  startTime?: string; endTime?: string; status: AttStatus | null; note: string | null; cancelled?: boolean;
};

type StatusFilter = 'all' | 'absent' | 'exempt' | 'off' | 'unmarked';
const TYPE_LABEL: Record<string, string> = { theory: 'Theory', lab: 'Lab', tutorial: 'Tutorial' };
const CANCEL_NOTE = /^was:/;

/**
 * The course page's Attend tab (Claude Design "Attend."): summary with what the
 * next class would do, a quick-mark card for today's class, filters by part and
 * status, and every class this semester grouped by week. Tapping a class opens
 * the mark sheet. Leave is held but not attended (ordinance 9.2, Samarth).
 */
export function AttendLog({ data, course: c, history, nowMin, onChanged, toast }: {
  data: Snapshot; course: Course; history: Occ[] | null; nowMin: number;
  onChanged: () => void;
  toast: (msg: string, undo?: () => Promise<void>) => void;
}) {
  const p = useUni();
  const [part, setPart] = useState<string>('all');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showEarlier, setShowEarlier] = useState(false);
  const [marking, setMarking] = useState<Session | null>(null);

  // ---- sessions: every class up to today, plus marks outside the window ----
  const typeOfComp = new Map(c.parts.flatMap((x) => x.componentIds.map((id) => [id, x.type] as const)));
  const map = new Map<string, Session>();
  for (const r of data.records) {
    if (r.workspaceId === c.id) map.set(r.occurrenceId, { id: r.occurrenceId, workspaceId: c.id, date: r.date, componentId: r.componentId, componentType: typeOfComp.get(r.componentId), status: r.status as AttStatus, note: r.note });
  }
  for (const o of [...(history ?? []), ...data.occurrences]) {
    if (o.workspaceId !== c.id || o.date > data.today) continue;
    if (o.cancelled && !o.status) continue; // cancelled by a timetable change and never marked
    const prev = map.get(o.id);
    map.set(o.id, { id: o.id, workspaceId: c.id, date: o.date, componentId: o.componentId, componentType: o.componentType, startTime: o.startTime, endTime: o.endTime, status: o.status ?? prev?.status ?? null, note: prev?.note ?? null, cancelled: o.cancelled });
  }
  const ended = (x: Session) => x.date < data.today || (x.date === data.today && !!x.endTime && minutesOf(x.endTime) <= nowMin);
  const all = [...map.values()].sort((a, b) => b.date.localeCompare(a.date) || (b.startTime ?? '').localeCompare(a.startTime ?? ''));
  const inPart = all.filter((x) => part === 'all' || x.componentType === part);
  const off = (s: AttStatus | null) => s === 'cancelled' || s === 'holiday';
  const pass = (x: Session) => filter === 'all' ? true : filter === 'unmarked' ? !x.status && ended(x) : filter === 'off' ? off(x.status) : x.status === filter;

  // ---- summary for the selected part; the 75% rule is on the combined count ----
  const att: AttCounts = part === 'all' ? c.att : (c.parts.find((x) => x.type === part)?.att ?? countAttendance([]));
  const v = verdict(c.att.attended, c.att.total, c.target);
  const vc = v.tone === 'danger' ? p.danger : v.tone === 'warn' ? p.warn : v.tone === 'success' ? p.success : p.muted;
  const W = (n: number) => `${att.total ? (n / att.total) * 100 : 0}%` as const;
  const pctOf = (a: number, t: number) => (t ? Math.round((a / t) * 100) : null);
  const unmarkedCount = inPart.filter((x) => !x.status && ended(x)).length;
  const offCount = inPart.filter((x) => off(x.status)).length;
  const note = part === 'all' ? leaveNote(c.att, c.target) : null;

  // ---- today's class for the quick card ----
  const today = all.find((x) => x.date === data.today && !x.status && x.startTime && minutesOf(x.startTime) <= nowMin + 10);
  // The quick card handles today's unmarked class, so the list leaves it out (as in the design).
  const shown = inPart.filter((x) => pass(x) && !(filter === 'all' && today && x.id === today.id));
  const todayLabel = today ? (today.endTime && minutesOf(today.endTime) <= nowMin ? 'JUST ENDED · NOT MARKED' : 'NOW · NOT MARKED') : '';

  // What the course would be at if this class had `status` (combined count, as the sheet shows).
  const project = (x: Session) => (status: AttStatus) => {
    let a = c.att.attended, t = c.att.total;
    if (x.status === 'present') { a--; t--; } else if (x.status === 'absent' || x.status === 'exempt') t--;
    if (status === 'present') { a++; t++; } else if (status === 'absent' || status === 'exempt') t++;
    return pctOf(a, t);
  };

  const LABEL = (s: AttStatus | null) => (s === 'present' ? 'Present' : s === 'exempt' ? 'On leave' : s === 'absent' ? 'Absent' : off(s) ? 'Off' : 'Not marked');
  const save = async (x: Session, status: AttStatus | null, n: string | null) => {
    setMarking(null);
    const before = { status: x.status, note: x.note };
    try {
      await setOccurrenceStatus(x, status, n);
      onChanged();
      const when = `${dayName(x.date)} ${shortDate(x.date)}`;
      toast(status ? `${when} marked ${LABEL(status)}.` : `Mark removed. ${when} is unmarked again.`, async () => {
        await setOccurrenceStatus(x, before.status, before.note && !CANCEL_NOTE.test(before.note) ? before.note : null);
        onChanged();
      });
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    }
  };

  // ---- grouping by week ----
  const mon = mondayOf(data.today);
  const groups: Array<[string, Session[]]> = [
    ['This week', shown.filter((x) => x.date >= mon)],
    ['Last week', shown.filter((x) => x.date < mon && x.date >= addDays(mon, -7))],
  ];
  const earlier = shown.filter((x) => x.date < addDays(mon, -7));
  if (showEarlier) groups.push(['Earlier', earlier]);

  const chip = (x: Session): [string, string, IconName] => {
    if (!x.status) return ended(x) ? ['Not marked', p.warn, 'circle-dashed'] : ['Upcoming', p.muted, 'clock-3'];
    if (x.status === 'present') return ['Present', p.success, 'check'];
    if (x.status === 'exempt') return ['On leave', LEAVE_COLOR, 'briefcase-medical'];
    if (x.status === 'absent') return ['Absent', p.danger, 'x'];
    return ['Off', p.off, 'circle-slash'];
  };
  const sub = (x: Session) => {
    const reason = x.note && !CANCEL_NOTE.test(x.note) ? x.note : x.status === 'holiday' ? 'Holiday' : x.cancelled ? 'Cancelled on the timetable' : null;
    return [x.status === 'exempt' ? (reason ? `${reason} leave, pending approval` : 'Pending approval') : reason].filter(Boolean).join('');
  };

  const pill = (on: boolean, label: string, onPress: () => void) => (
    <Tap key={label} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[styles.pill, { backgroundColor: on ? p.text : p.elev, borderColor: p.hair }]}>
      <T w={700} size={12.5} c={on ? p.bg : p.text}>{label}</T>
    </Tap>
  );

  const portal = data.portal.find((x) => x.workspaceId === c.id);

  return (
    <View style={{ gap: 12 }}>
      {/* Summary */}
      <Card style={{ gap: 12, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flexShrink: 1 }}>
            <T w={800} size={30} style={{ letterSpacing: -1, lineHeight: 32 }}>{att.pct === null ? '—' : `${att.pct}%`}</T>
            <T w={600} c={p.muted} size={12}>
              {`${att.attended} of ${att.total} classes${part === 'all' ? '' : ` · ${TYPE_LABEL[part] ?? part} only`} · target ${c.target}%`}
            </T>
          </View>
          <View style={[styles.verdict, { backgroundColor: tint(vc, 12) }]}><T w={800} size={12.5} c={vc} numberOfLines={1}>{v.short}</T></View>
        </View>
        <View style={{ paddingTop: 4 }}>
          <View style={[styles.bar, { backgroundColor: p.surface }]}>
            <View style={{ width: W(att.attended), backgroundColor: p.success }} />
            <View style={{ width: W(att.leave), backgroundColor: LEAVE_COLOR }} />
            <View style={{ width: W(att.absent), backgroundColor: p.danger }} />
          </View>
          <View style={[styles.tick, { left: `${c.target}%`, backgroundColor: p.text }]} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {([['Present', att.attended, p.success, ''], ['On leave', att.leave, LEAVE_COLOR, 'not attended'], ['Absent', att.absent, p.danger, ''], ['Off', offCount, p.off, 'not counted']] as const).map(([l, n, col, s]) => (
            <View key={l} style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: col }} />
                <T w={700} c={p.muted} size={11.5} numberOfLines={1}>{l}</T>
              </View>
              <T w={800} size={17}>{n}</T>
              {s ? <T w={600} c={p.muted} size={10.5} numberOfLines={1}>{s}</T> : null}
            </View>
          ))}
        </View>
        <T c={p.muted} size={12} style={{ lineHeight: 17 }}>
          {`Only Present counts as attended, like on the portal. Leave counts as held until the department approves it. Off means the class wasn't held.${part !== 'all' ? ` The ${c.target}% rule is on all parts combined: ${c.att.pct ?? '—'}%.` : ''}${unmarkedCount ? ` ${unmarkedCount} class${unmarkedCount === 1 ? '' : 'es'} still to mark.` : ''}`}
        </T>
        {note ? (
          <View style={[styles.note, { backgroundColor: tint(note.tone === 'danger' ? p.danger : note.tone === 'warn' ? p.warn : p.muted, 10) }]}>
            <Icon name={note.tone === 'muted' ? 'info' : 'triangle-alert'} size={15} color={note.tone === 'danger' ? p.danger : note.tone === 'warn' ? p.warn : p.muted} />
            <T w={600} size={12.5} style={{ flex: 1, lineHeight: 17 }}>{note.text}</T>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={[styles.next, { backgroundColor: p.surface }]}>
            <T w={700} c={p.muted} size={11}>If you attend the next</T>
            <T w={800} c={p.success} size={16} style={{ marginTop: 2 }}>{pctOf(att.attended + 1, att.total + 1)}%</T>
          </View>
          <View style={[styles.next, { backgroundColor: p.surface }]}>
            <T w={700} c={p.muted} size={11}>If you miss the next</T>
            <T w={800} c={p.danger} size={16} style={{ marginTop: 2 }}>{pctOf(att.attended, att.total + 1)}%</T>
          </View>
        </View>
      </Card>

      {/* Today's class, unmarked */}
      {today ? (
        <View style={[styles.today, { backgroundColor: p.elev, borderColor: p.warn }]}>
          <View>
            <T w={800} c={p.warn} size={11.5} style={{ letterSpacing: 0.4 }}>{todayLabel}</T>
            <T w={800} size={15} style={{ marginTop: 2 }}>{`Today, ${clock(today.startTime!)}${today.endTime ? `–${clock(today.endTime)}` : ''} · ${TYPE_LABEL[today.componentType ?? ''] ?? 'Class'}`}</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([['present', 'Present', 'check', p.success], ['absent', 'Absent', 'x', p.danger], ['exempt', 'On leave', 'briefcase-medical', LEAVE_COLOR], ['cancelled', 'Off', 'circle-slash', p.off]] as const).map(([s, l, icon, col]) => (
              <Tap key={s} onPress={() => save(today, s, null)} accessibilityRole="button" accessibilityLabel={`Mark ${l}`}
                style={[styles.quick, { backgroundColor: tint(col, 12) }]}>
                <Icon name={icon} size={18} color={col} width={2.4} />
                <T w={700} size={12} c={col}>{l}</T>
              </Tap>
            ))}
          </View>
        </View>
      ) : null}

      {/* Filters: part, then status */}
      {c.parts.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 20 }}>
          {pill(part === 'all', 'All parts', () => setPart('all'))}
          {c.parts.map((x) => pill(part === x.type, `${TYPE_LABEL[x.type] ?? x.type} ${x.att.pct === null ? '' : `${x.att.pct}%`}`.trim(), () => setPart(x.type)))}
        </ScrollView>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 20 }}>
        {([['all', 'All'], ['absent', 'Absent'], ['exempt', 'On leave'], ['off', 'Off'], ['unmarked', `Not marked${unmarkedCount ? ` · ${unmarkedCount}` : ''}`]] as const).map(([k, l]) => pill(filter === k, l, () => setFilter(k)))}
      </ScrollView>

      {/* Classes by week */}
      {groups.filter(([, rows]) => rows.length).map(([title, rows]) => (
        <View key={title} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4 }}>
            <T w={800} c={p.muted} size={12} style={{ letterSpacing: 0.8 }}>{title.toUpperCase()}</T>
            <T w={600} c={p.muted} size={11.5}>Tap a class to change it</T>
          </View>
          <View style={[styles.list, { backgroundColor: p.elev, borderColor: p.hair }]}>
            {rows.map((x, i) => {
              const [label, col, icon] = chip(x);
              const s = sub(x);
              return (
                <Tap key={x.id} onPress={() => setMarking(x)} accessibilityRole="button" accessibilityLabel={`${dayName(x.date)} ${shortDate(x.date)}, ${label}. Change`}
                  pressedStyle={{ backgroundColor: p.surface }}
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.hair }]}>
                  <View style={{ width: 36, alignItems: 'center' }}>
                    <T w={700} c={p.muted} size={10.5}>{dayName(x.date)}</T>
                    <T w={800} size={17} style={{ lineHeight: 20 }}>{Number(x.date.slice(8, 10))}</T>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T w={700} size={13.5} numberOfLines={1}>{[x.startTime ? clock(x.startTime) : null, TYPE_LABEL[x.componentType ?? ''] ?? null].filter(Boolean).join(' · ') || 'Class'}</T>
                    {s ? <T c={p.muted} size={11.5} numberOfLines={1} style={{ marginTop: 1 }}>{s}</T> : null}
                  </View>
                  <View style={[styles.status, { backgroundColor: tint(col, 14) }]}>
                    <Icon name={icon} size={13} color={col} width={2.6} />
                    <T w={800} size={12} c={col}>{label}</T>
                  </View>
                </Tap>
              );
            })}
          </View>
        </View>
      ))}
      {!shown.length ? <T c={p.muted} size={13} style={{ textAlign: 'center', padding: 20 }}>{all.length ? 'No classes match this filter.' : 'No classes yet this semester. Once a class has happened you can mark it here.'}</T> : null}

      {earlier.length ? (
        <Tap onPress={() => setShowEarlier((v) => !v)} style={[styles.more, { backgroundColor: p.surface }]}>
          <Icon name="history" size={17} color={p.muted} />
          <T w={700} size={13.5} style={{ flex: 1 }}>{showEarlier ? 'Hide earlier classes' : `${earlier.length} earlier class${earlier.length === 1 ? '' : 'es'}`}</T>
          <T w={700} size={12.5} c={p.primary}>{showEarlier ? 'Hide' : 'Show'}</T>
        </Tap>
      ) : null}

      {portal && part === 'all' ? (
        <View style={[styles.more, { backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair }]}>
          <Icon name="arrow-left-right" size={17} color={p.primary} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T w={700} size={13.5}>Portal shows {portal.percent !== null ? Math.round(portal.percent) : '—'}%</T>
            <T c={p.muted} size={11.5}>{`Snapshot ${shortDate(portal.checkedDate.slice(0, 10))} · your log ${c.att.pct ?? '—'}%`}</T>
          </View>
        </View>
      ) : null}

      <MarkSheet
        visible={!!marking}
        title={marking ? `${dayName(marking.date)}, ${shortDate(marking.date)}${marking.startTime ? ` · ${clock(marking.startTime)}` : ''}` : ''}
        subtitle={marking ? `${c.name}${marking.componentType ? ` · ${TYPE_LABEL[marking.componentType] ?? marking.componentType}` : ''}` : undefined}
        current={marking?.status}
        currentNote={marking?.note}
        project={marking ? project(marking) : undefined}
        onSave={(s, n) => marking && save(marking, s, n)}
        onClose={() => setMarking(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  verdict: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, flexShrink: 0 },
  bar: { flexDirection: 'row', gap: 2, height: 10, borderRadius: 5, overflow: 'hidden' },
  tick: { position: 'absolute', top: 0, width: 2, height: 18, marginLeft: -1, borderRadius: 1 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 12 },
  next: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  today: { padding: 14, borderRadius: 22, borderWidth: 1.5, gap: 12 },
  quick: { flex: 1, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4 },
  pill: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  list: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, flexShrink: 0 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 18 },
});
