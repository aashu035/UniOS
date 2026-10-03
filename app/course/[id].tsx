import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Icon, type IconName } from '../../components/uni/Icon';
import { Card, Chip, Empty, ListCard, Ring, Rise, RoundButton, Screen, Segmented, T, Tap } from '../../components/uni/primitives';
import { FILE_COLORS, tint, useUni, listRow } from '../../components/uni/theme';
import { fileKind } from '../../domains/academic/derive';
import { useAcademic } from '../../domains/academic/hooks';
import { clock, dayName, daysBetween, isDone, minutesOf, relDue, shortDate, taskKind, verdict } from '../../domains/academic/logic';
import { CourseOverviewService, type CourseOverview } from '../../domains/workspace/CourseOverviewService';

type Tab = 'overview' | 'files' | 'tasks' | 'att';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TYPE_LABEL: Record<string, string> = { theory: 'Theory', lab: 'Lab', tutorial: 'Tutorial' };

export default function CourseDetail() {
  const p = useUni();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const courseId = Number(id);
  const { data } = useAcademic();
  const [detail, setDetail] = useState<CourseOverview | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

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
  const records = data.records.filter((r) => r.workspaceId === c.id).sort((a, b) => b.date.localeCompare(a.date));
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
            <ListCard>
              {([
                ['check', 'Attended (present + leave)', `${c.att.attended} session${c.att.attended === 1 ? '' : 's'}`, c.att.pct === null ? '' : `${c.att.pct}%`, p.success],
                ['x', 'Absent', `${c.att.absent} session${c.att.absent === 1 ? '' : 's'}`, v.need ? `Attend ${v.need}` : '', p.danger],
                ['circle-slash', 'Off · not counted', `${c.att.off} session${c.att.off === 1 ? '' : 's'}`, '', p.off],
                ...(portal ? [['arrow-left-right', `Portal shows ${portal.percent !== null ? Math.round(portal.percent) : '—'}%`, `Snapshot ${shortDate(portal.checkedDate.slice(0, 10))}`, '', p.primary] as const] : []),
              ] as Array<readonly [IconName, string, string, string, string]>).map(([icon, t, m, r, col]) => (
                <View key={t} style={styles.row}>
                  <Icon name={icon} size={18} color={col} />
                  <View style={{ flex: 1 }}>
                    <T w={700} size={13.5}>{t}</T>
                    <T c={p.muted} size={11.5}>{m}</T>
                  </View>
                  <T w={800} c={col} size={12}>{r}</T>
                </View>
              ))}
            </ListCard>
            {records.length ? (
              <ListCard>
                {records.slice(0, 12).map((r) => {
                  const st = r.status === 'present' || r.status === 'exempt' ? ['Present', p.success] : r.status === 'absent' ? ['Absent', p.danger] : ['Off', p.off];
                  return (
                    <View key={r.occurrenceId} style={styles.row}>
                      <T w={700} size={13.5} style={{ flex: 1 }}>{dayName(r.date)}, {shortDate(r.date)}</T>
                      <Chip label={st[0]} color={st[1]} bg={tint(st[1])} />
                    </View>
                  );
                })}
              </ListCard>
            ) : null}
            <Tap onPress={() => router.push(`/workspace/${c.id}/attendance` as any)} style={[styles.linkBtn, { backgroundColor: p.surface }]}>
              <T w={700} size={13}>Open the full attendance log</T>
              <Icon name="chevron-right" size={16} color={p.muted} />
            </Tap>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16 },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  stat: { flex: 1, padding: 11, borderRadius: 16, borderWidth: 1 },
  row: listRow,
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16 },
});
