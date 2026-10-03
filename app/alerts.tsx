import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Icon, courseIcon, type IconName } from '../components/uni/Icon';
import { Card, Chip, ListCard, Rise, RoundButton, Screen, T, Tap, Well } from '../components/uni/primitives';
import { mono, tint, useUni, listRow } from '../components/uni/theme';
import { setTaskDone } from '../domains/academic/actions';
import { atRisk, changes, dayWord, openTasks } from '../domains/academic/derive';
import { useAcademic, useNowMinutes } from '../domains/academic/hooks';
import { addDays, clock, dayDate, dayName, inMinutes, minutesOf, relDue, shortDate } from '../domains/academic/logic';
import { NotificationRepository } from '../domains/notification/repository';

type Note = Awaited<ReturnType<typeof NotificationRepository.list>>[number];

export default function Alerts() {
  const p = useUni();
  const router = useRouter();
  const nowMin = useNowMinutes();
  const { data, reload } = useAcademic();
  const [notes, setNotes] = useState<Note[]>([]);

  const loadNotes = useCallback(() => { NotificationRepository.list(20).then(setNotes).catch(() => setNotes([])); }, []);
  useFocusEffect(loadNotes);

  const header = (
    <View style={styles.top}>
      <RoundButton icon="chevron-left" label="Back" onPress={() => router.back()} />
      <T w={800} size={26} style={{ flex: 1, letterSpacing: -0.8 }}>Alerts</T>
      {notes.some((n) => !n.isRead) ? (
        <Tap onPress={async () => { await NotificationRepository.markAllRead(); loadNotes(); reload(); }} hitSlop={8}>
          <T w={700} c={p.primary} size={13}>Mark all read</T>
        </Tap>
      ) : null}
    </View>
  );
  if (!data) return <Screen tabs={false}>{header}</Screen>;
  const s = data;

  const risks = atRisk(s.courses);
  const due = openTasks(s).filter((t) => t.days !== null && t.days <= 1);
  const upcomingByCourse = (id: number) => s.occurrences.filter((o) => o.workspaceId === id && !o.cancelled && (o.date > s.today || (o.date === s.today && minutesOf(o.startTime) > nowMin)));
  const week = changes(s, s.today, addDays(s.today, 7));

  // Coming up: next class today, a free gap, newest file, nearest exam.
  const todays = s.occurrences.filter((o) => o.date === s.today && !o.cancelled);
  const next = todays.find((o) => minutesOf(o.startTime) > nowMin);
  let gap: { from: string; mins: number } | null = null;
  for (let i = 0; i + 1 < todays.length; i++) {
    const end = minutesOf(todays[i].endTime), start = minutesOf(todays[i + 1].startTime);
    if (start - end >= 60 && start > nowMin) { gap = { from: todays[i].endTime, mins: start - end }; break; }
  }
  const fresh = s.files.find((f) => f.createdAt && f.createdAt.slice(0, 10) >= addDays(s.today, -2));
  const exam = openTasks(s).find((t) => (t.type === 'exam' || t.type === 'quiz') && t.days !== null && t.days >= 0);
  const coming: Array<{ icon: IconName; color: string; text: React.ReactNode; when: string; to?: string }> = [];
  if (next) coming.push({ icon: 'bell-ring', color: p.primary, when: clock(next.startTime, false), to: '/(main)/schedule',
    text: <><T w={800} size={13.5}>{next.workspaceName}</T> in {inMinutes(minutesOf(next.startTime) - nowMin)}{next.venueName ? ` · ${next.venueName}` : ''}</> });
  if (gap) coming.push({ icon: 'coffee', color: p.success, when: clock(gap.from, false),
    text: <><T w={800} size={13.5}>Free {inMinutes(gap.mins)}</T> between classes</> });
  if (fresh) coming.push({ icon: 'file-plus', color: '#EF4444', when: fresh.createdAt!.slice(0, 10) === s.today ? 'Today' : 'Recent', to: `/resource/${fresh.id}`,
    text: <><T w={800} size={13.5}>New material</T> · {fresh.title}</> });
  if (exam) coming.push({ icon: 'graduation-cap', color: p.primary, when: dayName(exam.dueDate!), to: '/(main)/work',
    text: <><T w={800} size={13.5}>{exam.title}</T> {exam.days === 0 ? 'today' : `in ${exam.days} day${exam.days === 1 ? '' : 's'}`}</> });

  const needCount = risks.length + due.length;

  return (
    <Screen tabs={false}>
      {header}
      <View style={{ paddingHorizontal: 20 }}>
        <T w={800} c={needCount ? p.danger : p.success} size={11.5} style={styles.eyebrow}>{needCount ? `NEEDS ACTION · ${needCount}` : 'NOTHING NEEDS ACTION'}</T>
        {risks.map(({ course: c, need }, i) => {
          const nextDays = [...new Set(upcomingByCourse(c.id).map((o) => o.date))].slice(0, Math.min(need, 4));
          return (
            <Rise key={c.id} i={i}>
              <Card onPress={() => router.push(`/course/${c.id}` as any)} style={[styles.item, { gap: 10 }]}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Well icon="triangle-alert" color={p.danger} bg={tint(p.danger)} size={36} radius={11} iconSize={17} />
                  <View style={{ flex: 1 }}>
                    <T w={800} size={14.5}>{c.short} attendance {c.att.pct}%</T>
                    <T c={p.muted} size={13} style={{ lineHeight: 18, marginTop: 2 }}>Below {c.target}%. Attend the next {need} class{need === 1 ? '' : 'es'} to recover.</T>
                  </View>
                </View>
                {nextDays.length ? (
                  <View style={{ flexDirection: 'row', gap: 6, paddingLeft: 48 }}>
                    {nextDays.map((d) => <Chip key={d} label={d === s.today ? 'Today' : `${dayName(d)} ${Number(d.slice(8))}`} color={p.primary} bg={p.primarySoft} />)}
                  </View>
                ) : null}
              </Card>
            </Rise>
          );
        })}
        {due.map((t, i) => {
          const course = t.workspaceId ? s.courseById.get(t.workspaceId) : undefined;
          return (
            <Rise key={t.id} i={risks.length + i}>
              <Card style={[styles.item, { flexDirection: 'row', gap: 12 }]}>
                <Well icon={t.type === 'lab' ? 'test-tube-diagonal' : 'file-pen-line'} color={p.warn} bg={tint(p.warn)} size={36} radius={11} iconSize={17} />
                <View style={{ flex: 1 }}>
                  <T w={800} size={14.5} numberOfLines={1}>{t.title}</T>
                  <T c={p.muted} size={13} style={{ marginTop: 2 }}>{[course?.name, t.days! < 0 ? relDue(t.days!) : `Due ${dayWord(s.today, t.dueDate!)}`].filter(Boolean).join(' · ')}</T>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Tap onPress={async () => { try { await setTaskDone(t, true); reload(); } catch (e: any) { Alert.alert('Could not update task', e?.message); } }}
                      style={[styles.btn, { backgroundColor: p.text }]}><T w={700} c={p.bg} size={12}>Mark done</T></Tap>
                    <Tap onPress={() => router.push(`/task/edit?id=${t.id}` as any)} style={[styles.btn, { backgroundColor: p.surface }]}><T w={700} size={12}>Open</T></Tap>
                  </View>
                </View>
              </Card>
            </Rise>
          );
        })}

        {week.length ? <T w={800} c={p.warn} size={11.5} style={[styles.eyebrow, { marginTop: 22 }]}>SCHEDULE CHANGES · {week.length}</T> : null}
        {week.map((o, i) => (
          <Rise key={o.id} i={i + 2}>
            <Card onPress={() => router.push('/(main)/schedule')} style={[styles.item, { gap: 12 }]}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Well icon={o.cancelled ? 'party-popper' : courseIcon(o.workspaceIcon, o.workspaceName)} color={o.cancelled ? p.off : o.workspaceColor} bg={o.cancelled ? p.surface : tint(o.workspaceColor)} size={36} radius={11} iconSize={17} />
                <View style={{ flex: 1 }}>
                  <T w={800} size={14.5} numberOfLines={2}>{o.workspaceName}{o.cancelled ? ' cancelled' : o.exceptionAction === 'extra' ? ' extra class' : ''} · {dayWord(s.today, o.date) || dayDate(o.date)}</T>
                  <T c={p.muted} size={12}>{o.cancelled ? 'Not held. It won’t count toward your attendance.' : 'Temporary change'}</T>
                </View>
              </View>
              {o.original ? (
                <View style={styles.moveGrid}>
                  <View style={[styles.slot, { backgroundColor: p.surface, opacity: 0.75 }]}>
                    <T style={[mono(700), { fontSize: 13, color: p.text, textDecorationLine: 'line-through' }]}>{clock(o.original.startTime)}</T>
                    <T c={p.muted} size={11.5} style={{ textDecorationLine: 'line-through' }}>Usual slot</T>
                  </View>
                  <Icon name="arrow-right" size={16} color={p.muted} />
                  <View style={[styles.slot, { backgroundColor: tint(p.warn) }]}>
                    <T style={[mono(700), { fontSize: 13, color: p.warn }]}>{clock(o.startTime)}</T>
                    <T w={600} size={11.5} numberOfLines={1}>{o.venueName ?? 'Same room'}</T>
                  </View>
                </View>
              ) : null}
            </Card>
          </Rise>
        ))}

        {coming.length ? (
          <>
            <T w={800} c={p.muted} size={11.5} style={[styles.eyebrow, { marginTop: 22 }]}>COMING UP</T>
            <ListCard>
              {coming.map((c, i) => (
                <Tap key={i} onPress={c.to ? () => router.push(c.to as any) : undefined} style={styles.line}>
                  <Icon name={c.icon} size={18} color={c.color} />
                  <T size={13.5} style={{ flex: 1 }} numberOfLines={1}>{c.text}</T>
                  <T c={p.muted} size={11.5}>{c.when}</T>
                </Tap>
              ))}
            </ListCard>
          </>
        ) : null}

        {notes.length ? (
          <>
            <T w={800} c={p.muted} size={11.5} style={[styles.eyebrow, { marginTop: 22 }]}>RECENT</T>
            <ListCard>
              {notes.map((n) => (
                <Tap key={n.id} style={styles.line} onPress={async () => {
                  if (!n.isRead) { await NotificationRepository.markRead(n.id).catch(() => {}); loadNotes(); }
                  if (n.actionUrl) router.push(n.actionUrl as any);
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n.isRead ? 'transparent' : p.primary }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T w={n.isRead ? 600 : 800} size={13.5} numberOfLines={1}>{n.title}</T>
                    <T c={p.muted} size={12} numberOfLines={2} style={{ marginTop: 1 }}>{n.message.replace(/\d{4}-\d{2}-\d{2}/g, (d) => dayDate(d))}</T>
                  </View>
                  <T c={p.muted} size={11.5}>{n.createdAt ? shortDate(n.createdAt.slice(0, 10)) : ''}</T>
                </Tap>
              ))}
            </ListCard>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  eyebrow: { letterSpacing: 0.8, marginTop: 6, marginBottom: 8, marginHorizontal: 4 },
  item: { marginBottom: 10, borderRadius: 22 },
  btn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10 },
  moveGrid: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slot: { flex: 1, padding: 10, borderRadius: 12 },
  line: listRow,
});
