import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Icon, type IconName } from '../../components/uni/Icon';
import { MarkSheet } from '../../components/uni/MarkSheet';
import { Card, Chip, Empty, ListCard, Ring, Rise, RoundButton, Screen, Segmented, T, Tap } from '../../components/uni/primitives';
import { FILE_COLORS, tint, useUni, listRow } from '../../components/uni/theme';
import { setOccurrenceStatus } from '../../domains/academic/actions';
import { fileKind } from '../../domains/academic/derive';
import { useAcademic } from '../../domains/academic/hooks';
import { loadWindow, type Occ } from '../../domains/academic/snapshot';
import { addDays, clock, countAttendance, dayName, daysBetween, isDone, leaveNote, minutesOf, relDue, shortDate, taskKind, verdict, type AttStatus } from '../../domains/academic/logic';
import { CourseOverviewService, type CourseOverview } from '../../domains/workspace/CourseOverviewService';

type Tab = 'overview' | 'files' | 'tasks' | 'att';
/** One class in the Attend tab: scheduled (maybe unmarked) or an older stored mark. */
type Session = { id: string; workspaceId: number; date: string; componentId?: number | null; componentType?: string | null; startTime?: string; endTime?: string; status: AttStatus | null; cancelled?: boolean };
const SESSIONS_SHOWN = 20;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TYPE_LABEL: Record<string, string> = { theory: 'Theory', lab: 'Lab', tutorial: 'Tutorial' };

export default function CourseDetail() {
  const p = useUni();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const courseId = Number(id);
  const { data, reload } = useAcademic();
  const [detail, setDetail] = useState<CourseOverview | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [marking, setMarking] = useState<Session | null>(null);
  const [part, setPart] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);
  // Every class this semester up to today, so "held so far" and "not marked" are complete.
  const [history, setHistory] = useState<Occ[] | null>(null);
  useEffect(() => {
    if (!data) return;
    const firstMark = data.records.filter((r) => r.workspaceId === courseId).map((r) => r.date).sort()[0];
    const from = data.semester?.startDate ?? (firstMark && firstMark < addDays(data.today, -120) ? firstMark : addDays(data.today, -120));
    loadWindow(from, data.today, data.today)
      .then((occ) => setHistory(occ.filter((o) => o.workspaceId === courseId)))
      .catch(() => setHistory(null));
  }, [data, courseId]);

  const pick = async (status: AttStatus | null) => {
    const s = marking;
    setMarking(null);
    if (!s) return;
    try {
      await setOccurrenceStatus(s, status);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    }
    reload();
  };

  useEffect(() => { CourseOverviewService.getCourseDetail(courseId).then(setDetail).catch(() => setDetail(null)); }, [courseId, data]);

  const top = (
    <View style={styles.top}>
      <RoundButton icon="chevron-left" label="Back" onPress={() => router.back()} />
      <RoundButton icon="settings-2" label="Edit course" onPress={() => router.push({ pathname: '/course/edit', params: { id: String(courseId) } })} />
    </View>
  );
  if (!data) return <Screen tabs={false}>{top}</Screen>;
  const c = data.courseById.get(courseId);
  if (!c) {
    return (
      <Screen tabs={false}>{top}
        <View style={{ padding: 20 }}><Empty icon="info" title="Course not found" body="It may belong to another semester or have been deleted." action="Go back" onAction={() => router.back()} /></View>
      </Screen>
    );
  }

  const v = verdict(c.att.attended, c.att.total, c.target);
  const tone = v.tone === 'danger' ? p.danger : v.tone === 'warn' ? p.warn : v.tone === 'success' ? p.success : p.muted;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const next = data.occurrences.find((o) => o.workspaceId === c.id && !o.cancelled && (o.date > data.today || (o.date === data.today && minutesOf(o.startTime) > nowMin)));
  const files = data.files.filter((f) => f.workspaceId === c.id);
  const tasks = data.tasks.filter((t) => t.workspaceId === c.id)
    .map((t) => ({ ...t, days: t.dueDate ? daysBetween(data.today, t.dueDate) : null }))
    .sort((a, b) => Number(isDone(a.status)) - Number(isDone(b.status)) || (a.days ?? 9999) - (b.days ?? 9999));
  // Classes up to the end of today (so a class can be marked before it starts), plus marks outside the window.
  const typeOfComp = new Map(c.parts.flatMap((x) => x.componentIds.map((id) => [id, x.type] as const)));
  const sessionMap = new Map<string, Session>();
  for (const r of data.records) {
    if (r.workspaceId === c.id) sessionMap.set(r.occurrenceId, { id: r.occurrenceId, workspaceId: c.id, date: r.date, componentId: r.componentId, componentType: typeOfComp.get(r.componentId), status: r.status as AttStatus });
  }
  for (const o of [...(history ?? []), ...data.occurrences]) {
    if (o.workspaceId !== c.id || o.date > data.today || (part !== 'all' && o.componentType !== part)) continue;
    if (o.cancelled && !o.status) continue; // cancelled by a timetable change, never marked: counted below
    sessionMap.set(o.id, { id: o.id, workspaceId: c.id, date: o.date, componentId: o.componentId, componentType: o.componentType, startTime: o.startTime, endTime: o.endTime, status: o.status ?? sessionMap.get(o.id)?.status ?? null, cancelled: o.cancelled });
  }
  const cancelledByChange = new Set([...(history ?? []), ...data.occurrences].filter((o) => o.workspaceId === c.id && o.cancelled && !o.status && o.date <= data.today && (part === 'all' || o.componentType === part)).map((o) => o.id)).size;
  const sessions = [...sessionMap.values()]
    .filter((x) => part === 'all' || x.componentType === part)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.startTime ?? '').localeCompare(a.startTime ?? ''));
  // A class is overdue for marking once it has ended.
  const ended = (x: Session) => x.date < data.today || (x.date === data.today && !!x.endTime && minutesOf(x.endTime) <= nowMin);
  const unmarked = sessions.filter((x) => !x.status && ended(x)).length;
  const partAtt = part === 'all' ? c.att : (c.parts.find((x) => x.type === part)?.att ?? countAttendance([]));
  const note = leaveNote(c.att, c.target);
  const portal = data.portal.find((x) => x.workspaceId === c.id);
  const kinds = c.componentTypes.map((t) => TYPE_LABEL[t] ?? t).join(' + ');

  const taskRow = (t: (typeof tasks)[number]) => {
    const k = taskKind(t.type);
    const icon: IconName = k === 'exam' ? 'graduation-cap' : k === 'lab' ? 'test-tube-diagonal' : 'file-pen-line';
    const done = isDone(t.status);
    const col = done ? p.success : k === 'exam' ? p.primary : t.days !== null && t.days <= 1 ? p.danger : p.warn;
    return (
      <Tap key={t.id} onPress={() => router.push(`/task/edit?id=${t.id}` as any)} style={styles.row}>
        <Icon name={done ? 'circle-check-big' : icon} size={18} color={col} />
        <T w={700} size={13.5} style={{ flex: 1, opacity: done ? 0.6 : 1 }} numberOfLines={1}>{t.title}</T>
        <T w={800} c={col} size={12}>{done ? 'Done' : t.days === null ? '—' : relDue(t.days)}</T>
      </Tap>
    );
  };

  return (
    <Screen tabs={false}>
      {top}
      <Rise i={0} style={styles.hero}>
        <Ring size={104} stroke={10} pct={c.att.pct ?? 0} color={c.color} track={p.surface} marker={c.target} markerColor={p.warn}>
          <T w={800} size={22} style={{ letterSpacing: -0.8 }}>{c.att.pct === null ? '—' : `${c.att.pct}%`}</T>
          <T w={600} c={p.muted} size={10}>attendance</T>
        </Ring>
        <View style={{ flex: 1, gap: 4 }}>
          <T w={800} c={c.color} size={11.5} style={{ letterSpacing: 0.6 }} numberOfLines={1}>{[c.code, c.credits ? `${c.credits} CREDITS` : null].filter(Boolean).join(' · ').toUpperCase() || 'COURSE'}</T>
          <T w={800} size={24} style={{ letterSpacing: -0.7, lineHeight: 28 }} numberOfLines={2}>{c.name}</T>
          <T w={500} c={p.muted} size={12.5} numberOfLines={1}>{[c.faculty, kinds].filter(Boolean).join(' · ')}</T>
          <T w={700} c={tone} size={12.5} style={{ marginTop: 4 }}>{v.text}</T>
        </View>
      </Rise>

      <Rise i={1} style={styles.stats}>
        <View style={[styles.stat, { backgroundColor: v.tone === 'danger' ? tint(p.danger, 10) : p.elev, borderColor: p.hair }]}>
          <T w={700} c={v.tone === 'danger' ? p.danger : p.muted} size={11}>Attended</T>
          <T w={800} size={19} style={{ marginTop: 2 }}>{c.att.attended}/{c.att.total}</T>
        </View>
        <View style={[styles.stat, { backgroundColor: p.elev, borderColor: p.hair }]}>
          <T w={700} c={p.muted} size={11}>Next class</T>
          <T w={800} size={15} style={{ marginTop: 4 }} numberOfLines={1}>{next ? `${next.date === data.today ? 'Today' : dayName(next.date)} ${clock(next.startTime, false)}` : '—'}</T>
        </View>
        <View style={[styles.stat, { backgroundColor: p.elev, borderColor: p.hair }]}>
          <T w={700} c={p.muted} size={11}>Files</T>
          <T w={800} size={19} style={{ marginTop: 2 }}>{files.length}</T>
        </View>
      </Rise>

      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 }}>
        <Segmented<Tab> items={[['overview', 'Overview'], ['files', 'Files'], ['tasks', 'Tasks'], ['att', 'Attend.']]} value={tab} onChange={setTab} />
      </View>

      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {tab === 'overview' && (
          <>
            <Card style={{ gap: 12 }}>
              <T w={800} size={13}>Parts and weekly slots</T>
              {(detail?.components ?? []).map((comp) => (
                <View key={comp.id} style={{ flexDirection: 'row', gap: 10 }}>
                  <Chip label={(TYPE_LABEL[comp.type] ?? comp.type).toUpperCase()} color={c.color} bg={tint(c.color)} />
                  <View style={{ flex: 1 }}>
                    <T w={600} size={13}>{comp.schedules.length ? comp.schedules.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)).map((x) => `${DAYS[x.dayOfWeek]} ${clock(x.startTime, false)}`).join(', ') : 'No weekly slots'}</T>
                    <T c={p.muted} size={12} style={{ marginTop: 2 }}>{[comp.activeFaculty?.name, comp.activeVenue?.name, `${comp.durationMinutes} min`].filter(Boolean).join(' · ')}</T>
                  </View>
                </View>
              ))}
              {detail && !detail.components.length ? <T c={p.muted} size={13}>No parts set up yet.</T> : null}
            </Card>
            {tasks.filter((t) => !isDone(t.status)).length ? (
              <ListCard>{tasks.filter((t) => !isDone(t.status)).slice(0, 3).map(taskRow)}</ListCard>
            ) : null}
          </>
        )}

        {tab === 'files' && (files.length ? (
          <ListCard>
            {files.map((f) => {
              const k = fileKind(f);
              return (
                <Tap key={f.id} onPress={() => router.push(`/resource/${f.id}` as any)} style={styles.row}>
                  <Icon name={k === 'link' ? 'link' : k === 'note' ? 'sticky-note' : k === 'image' ? 'image' : 'file-text'} size={18} color={FILE_COLORS[k]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T w={700} size={13.5} numberOfLines={1}>{f.title}</T>
                    {f.createdAt ? <T c={p.muted} size={11.5}>Added {shortDate(f.createdAt.slice(0, 10))}</T> : null}
                  </View>
                </Tap>
              );
            })}
          </ListCard>
        ) : <Empty icon="upload" title="No files yet" body="Add PDFs, notes and links for this course." action="Add file" onAction={() => router.push({ pathname: '/resource/add', params: { workspaceId: String(c.id) } })} />)}

        {tab === 'tasks' && (tasks.length ? <ListCard>{tasks.map(taskRow)}</ListCard>
          : <Empty icon="list-plus" title="No tasks yet" body="Assignments, lab files and exams for this course show up here." action="Add task" onAction={() => router.push({ pathname: '/task/add', params: { workspaceId: String(c.id) } })} />)}

        {tab === 'att' && (
          <>
            {c.parts.length > 1 ? (
              <Segmented<string>
                items={[['all', 'All'], ...c.parts.map((x) => [x.type, TYPE_LABEL[x.type] ?? x.type] as [string, string])]}
                value={part}
                onChange={(v) => { setPart(v); setShowAll(false); }}
              />
            ) : null}
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flexShrink: 1 }}>
                  <T w={700} c={p.muted} size={12}>{part === 'all' ? 'All classes' : `${TYPE_LABEL[part] ?? part} only`}</T>
                  <T w={800} size={24} style={{ letterSpacing: -0.6 }}>{partAtt.attended} / {partAtt.total}<T w={600} c={p.muted} size={14}> attended</T></T>
                </View>
                <T w={800} size={24} c={partAtt.pct === null ? p.muted : partAtt.pct >= c.target ? p.success : p.danger}>{partAtt.pct === null ? '—' : `${partAtt.pct}%`}</T>
              </View>
              <View style={styles.countRow}>
                {([
                  ['Present', partAtt.attended, p.success],
                  ['Absent', partAtt.absent, p.danger],
                  ['Leave', partAtt.leave, p.primary],
                  ['Off', partAtt.off + cancelledByChange, p.off],
                  ['To mark', unmarked, unmarked ? p.warn : p.muted],
                ] as const).map(([l, n, col]) => (
                  <View key={l} style={[styles.count, { backgroundColor: tint(col, 10) }]}>
                    <T w={800} c={col} size={16}>{n}</T>
                    <T w={600} c={p.muted} size={10.5} numberOfLines={1}>{l}</T>
                  </View>
                ))}
              </View>
              <T c={p.muted} size={12} style={{ lineHeight: 17 }}>
                {`${partAtt.total + unmarked} held so far${unmarked ? `, ${unmarked} still to mark` : ''}. Leave counts as held but not attended, like on the portal.`}
                {part !== 'all' ? ` The ${c.target}% rule applies to all parts combined (${c.att.pct ?? '—'}%).` : ''}
              </T>
              {note && part === 'all' ? (
                <View style={[styles.note, { backgroundColor: tint(note.tone === 'danger' ? p.danger : note.tone === 'warn' ? p.warn : p.muted, 10) }]}>
                  <Icon name={note.tone === 'muted' ? 'info' : 'triangle-alert'} size={15} color={note.tone === 'danger' ? p.danger : note.tone === 'warn' ? p.warn : p.muted} />
                  <T w={600} size={12.5} style={{ flex: 1, lineHeight: 17 }}>{note.text}</T>
                </View>
              ) : null}
              {portal && part === 'all' ? (
                <T c={p.primary} w={700} size={12.5}>Portal shows {portal.percent !== null ? Math.round(portal.percent) : '—'}% · snapshot {shortDate(portal.checkedDate.slice(0, 10))}</T>
              ) : null}
            </Card>
            {sessions.length ? (
              <>
                <T w={600} c={p.muted} size={12} style={{ paddingHorizontal: 4 }}>
                  Tap a class to mark it, change it or remove the mark.
                </T>
                <ListCard>
                  {sessions.slice(0, showAll ? sessions.length : SESSIONS_SHOWN).map((x) => {
                    const st: [string, string] = !x.status ? (ended(x) ? ['Not marked', p.warn] : ['Upcoming', p.muted])
                      : x.status === 'present' ? ['Present', p.success]
                      : x.status === 'exempt' ? ['Leave', p.primary]
                      : x.status === 'absent' ? ['Absent', p.danger] : ['Off', p.off];
                    const meta = [x.startTime ? clock(x.startTime) : null, x.componentType ? (TYPE_LABEL[x.componentType] ?? x.componentType) : null].filter(Boolean).join(' · ');
                    return (
                      <Tap key={x.id} accessibilityRole="button" accessibilityLabel={`${dayName(x.date)} ${shortDate(x.date)}, ${st[0]}. Change`} onPress={() => setMarking(x)} style={styles.row}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <T w={700} size={13.5} numberOfLines={1}>{x.date === data.today ? 'Today' : dayName(x.date)}, {shortDate(x.date)}</T>
                          {meta ? <T c={p.muted} size={11.5} numberOfLines={1}>{meta}</T> : null}
                        </View>
                        <Chip label={st[0]} color={st[1]} bg={tint(st[1])} />
                        <Icon name="chevron-right" size={16} color={p.muted} />
                      </Tap>
                    );
                  })}
                </ListCard>
                {sessions.length > SESSIONS_SHOWN ? (
                  <Tap onPress={() => setShowAll((v) => !v)} style={[styles.linkBtn, { backgroundColor: p.surface, justifyContent: 'center' }]}>
                    <T w={700} size={13}>{showAll ? 'Show fewer' : `Show all ${sessions.length} classes`}</T>
                  </Tap>
                ) : null}
              </>
            ) : <T c={p.muted} size={13} style={{ paddingHorizontal: 4 }}>No classes yet this semester. Once a class has happened you can mark it here.</T>}
            <Tap onPress={() => router.push(`/workspace/${c.id}/attendance` as any)} style={[styles.linkBtn, { backgroundColor: p.surface }]}>
              <T w={700} size={13}>Open the full attendance log</T>
              <Icon name="chevron-right" size={16} color={p.muted} />
            </Tap>
          </>
        )}
      </View>
      <MarkSheet
        visible={!!marking}
        title={marking ? `${c.name}` : ''}
        subtitle={marking ? `${marking.date === data.today ? 'Today' : dayName(marking.date)}, ${shortDate(marking.date)}${marking.startTime ? ` · ${clock(marking.startTime)}` : ''}` : undefined}
        current={marking?.status}
        onPick={pick}
        onClose={() => setMarking(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16 },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  stat: { flex: 1, padding: 11, borderRadius: 16, borderWidth: 1 },
  row: listRow,
  countRow: { flexDirection: 'row', gap: 6 },
  count: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 8, borderRadius: 12 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 12 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16 },
});
