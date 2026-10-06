import React, { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AlertDeck, type DeckCard } from '../../components/uni/AlertDeck';
import { Icon, courseIcon, type IconName } from '../../components/uni/Icon';
import {
  Card, Empty, GrowBar, GrowColumn, LargeTitle, Legend, Ring, Rise, RoundButton, Screen, SectionTitle, T, Tap, Well,
} from '../../components/uni/primitives';
import { hue, mono, tint, useUni } from '../../components/uni/theme';
import { markOccurrence, statusToMark, type Mark } from '../../domains/academic/actions';
import { buildAlerts, openTasks } from '../../domains/academic/derive';
import { useAcademic, useNowMinutes } from '../../domains/academic/hooks';
import {
  addDays, clock, countdownPct, dayName, daySummary, inMinutes, isoWeek, liveState, markMessage, minutesOf, mondayOf,
  shortDate, weekBlocks, type Block,
} from '../../domains/academic/logic';
import type { Occ, Snapshot } from '../../domains/academic/snapshot';
import { NotificationService } from '../../domains/notification/service';

const BLOCK: Record<Block, string> = { c: hue.blue, l: hue.green, t: hue.amber };

export default function Today() {
  const p = useUni();
  const router = useRouter();
  const { data, refresh, refreshing, reload } = useAcademic();
  const nowMin = useNowMinutes();
  const [day, setDay] = useState<number | null>(null);

  // Same launch work the previous Home did: raise overdue-task notifications, prune old ones.
  useEffect(() => {
    Promise.allSettled([NotificationService.onLaunchScan(), NotificationService.cleanup(30)]).then(() => reload());
  }, []);

  if (!data) return <Screen><View /></Screen>;
  const s = data;
  const today = s.today;
  const monday = mondayOf(today);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const sel = day ?? todayIdx;
  const todays = s.occurrences.filter((o) => o.date === today);
  const live = liveState(todays, nowMin);

  const alerts = buildAlerts(s);
  const toneColor = (t: string) => (t === 'danger' ? p.danger : t === 'warn' ? p.warn : t === 'success' ? p.success : p.primary);
  const deck: DeckCard[] = alerts.length
    ? alerts.map((a) => ({ ...a, color: toneColor(a.tone), tint: tint(toneColor(a.tone)) }))
    : [{ key: 'clear', color: p.success, tint: tint(p.success), icon: 'circle-check-big', eyebrow: 'All clear', cta: '',
        title: s.courses.length ? 'Nothing needs you right now' : 'Add your first course', body: s.courses.length ? 'Attendance is on target and nothing is due by tomorrow.' : 'Set up a course and its timetable to see classes, attendance and alerts here.' }];

  const blocks = weekBlocks(s.occurrences, s.tasks, monday);
  const selDate = addDays(monday, sel);
  const summary = daySummary(s.occurrences, s.tasks, selDate, today, (o) => s.courseById.get(o.workspaceId)?.short ?? o.workspaceName);
  const upcoming = openTasks(s).filter((t) => t.days !== null && t.days <= 30).slice(0, 8);
  const latest = s.files[0];

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <LargeTitle
        eyebrow={`${dayName(today, true)}, ${shortDate(today)} · Week ${isoWeek(today)}`}
        title="Today"
        right={<>
          <RoundButton icon="search" label="Search" onPress={() => router.push('/search')} />
          <RoundButton icon="bell" label="Alerts" badge={s.unread} onPress={() => router.push('/alerts')} />
        </>}
      />

      <Rise i={1}>
        <AlertDeck cards={deck} onOpen={(i) => {
          const a = alerts[i];
          if (a) router.push(a.route as any);
          else if (!s.courses.length) router.push('/course/setup');
        }} />
      </Rise>

      <Rise i={2}>
        <NowCard s={s} live={live} nowMin={nowMin} onChanged={reload} />
      </Rise>

      {live.now && live.next ? (
        <Rise i={3}>
          <Card style={styles.nextCard} onPress={() => router.push('/(main)/schedule')}>
            <Well icon={courseIcon(live.next.workspaceIcon, live.next.workspaceName)} color={live.next.workspaceColor} bg={tint(live.next.workspaceColor, 15)} size={40} radius={12} iconSize={19} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w={600} c={p.muted} size={12}>Up next · in {inMinutes(minutesOf(live.next.startTime) - nowMin)}</T>
              <T w={700} size={15} numberOfLines={1} style={{ marginTop: 1 }}>{label(s, live.next)} · {clock(live.next.startTime)}</T>
            </View>
            {live.next.venueName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="map-pin" size={14} color={p.muted} />
                <T w={600} c={p.muted} size={13}>{live.next.venueName}</T>
              </View>
            ) : null}
          </Card>
        </Rise>
      ) : null}

      <Rise i={4}>
        <Card style={{ marginHorizontal: 20, marginTop: 24, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14, borderRadius: 26 }}>
          <View style={styles.rowBetween}>
            <T w={800} size={17} style={{ letterSpacing: -0.3 }}>Your week</T>
            <T w={500} c={p.muted} size={12}>Tap a day</T>
          </View>
          <View style={styles.weekGrid}>
            {blocks.map((b, i) => {
              const on = i === sel;
              return (
                <Tap key={i} onPress={() => setDay(i)} accessibilityLabel={`${dayName(addDays(monday, i), true)}: ${b.length} items`}
                  style={[styles.weekDay, { backgroundColor: on ? p.primarySoft : 'transparent' }]}>
                  <View style={styles.weekStack}>
                    {b.slice(0, 5).map((k, j) => <GrowColumn key={j} height={16} color={BLOCK[k]} d={j} style={{ marginTop: 3 }} />)}
                  </View>
                  <T w={on ? 800 : 600} c={on ? p.primary : p.muted} size={11} style={{ textAlign: 'center' }} numberOfLines={1}>
                    {i === todayIdx ? 'Today' : dayName(addDays(monday, i))}
                  </T>
                </Tap>
              );
            })}
          </View>
          <View style={[styles.summary, { backgroundColor: p.surface }]}>
            <T w={700} size={14}>{summary.title}</T>
            <T c={p.muted} size={13} style={{ lineHeight: 18 }}>{summary.detail}</T>
          </View>
          <View style={{ marginTop: 12 }}>
            <Legend items={[['Class', hue.blue], ['Lab', hue.green], ['Due', hue.amber]]} />
          </View>
        </Card>
      </Rise>

      <Rise i={5}>
        <SectionTitle title="Countdowns" action="All tasks" onAction={() => router.push('/(main)/work')} />
      </Rise>
      <Rise i={5}>
        {upcoming.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 4 }} snapToInterval={142} decelerationRate="fast">
            {upcoming.map((t) => {
              const days = t.days!;
              const course = t.workspaceId ? s.courseById.get(t.workspaceId) : undefined;
              const kind = t.type === 'exam' || t.type === 'quiz';
              const c = days <= 0 ? p.danger : days <= 2 ? p.warn : kind ? p.primary : course?.color ?? p.primary;
              return (
                <Card key={t.id} style={styles.countdown} onPress={() => router.push(`/task/edit?id=${t.id}` as any)}>
                  <Ring size={46} stroke={5} pct={countdownPct(Math.max(0, days))} color={c} track={p.surface}>
                    <T style={[mono(700), { fontSize: 12, color: c }]}>{days < 0 ? 'late' : `${days}d`}</T>
                  </Ring>
                  <View>
                    <T w={700} size={14} numberOfLines={2}>{t.title}</T>
                    <T c={p.muted} size={12} style={{ marginTop: 2 }} numberOfLines={1}>
                      {days === 0 ? 'Today' : days < 0 ? `Was due ${shortDate(t.dueDate!)}` : `${dayName(t.dueDate!)}, ${shortDate(t.dueDate!)}`}
                    </T>
                  </View>
                </Card>
              );
            })}
          </ScrollView>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            <Empty icon="circle-check-big" title="Nothing due in the next 30 days" body="Add assignments, lab files and exams to count them down here." action="Add task" onAction={() => router.push('/task/add')} />
          </View>
        )}
      </Rise>

      {latest ? (
        <Rise i={6}>
          <Card style={styles.reading} onPress={() => router.push(`/resource/${latest.id}` as any)}>
            <View style={[styles.doc, { backgroundColor: tint(hue.violet, 14) }]}>
              <Icon name={latest.type === 'link' ? 'link' : latest.type === 'note' ? 'sticky-note' : 'file-text'} size={22} color={hue.violet} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <T w={600} c={p.muted} size={12}>Latest in Knowledge Hub{latest.workspaceId && s.courseById.get(latest.workspaceId) ? ` · ${s.courseById.get(latest.workspaceId)!.short}` : ''}</T>
              <T w={700} size={15} numberOfLines={1}>{latest.title}</T>
            </View>
            <Icon name="chevron-right" size={18} color={p.muted} />
          </Card>
        </Rise>
      ) : null}
    </Screen>
  );
}

type Live = ReturnType<typeof liveState<Occ>>;

function label(s: Snapshot, o: Occ) {
  const c = s.courseById.get(o.workspaceId);
  const kind = o.componentType === 'lab' ? ' Lab' : o.componentType === 'tutorial' ? ' Tutorial' : '';
  return (c?.short ?? o.workspaceName) + kind;
}

function NowCard({ s, live, nowMin, onChanged }: { s: Snapshot; live: Live; nowMin: number; onChanged: () => void }) {
  const p = useUni();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // The class to act on: the one in progress, else the last one that ended unmarked.
  const target: Occ | null = live.now ?? (live.lastEnded && !live.lastEnded.status ? live.lastEnded : null);
  const course = target ? s.courseById.get(target.workspaceId) : undefined;
  const current = statusToMark(target?.status);

  const marks: Array<[Mark, string, IconName, string]> = [
    ['present', 'Present', 'check', p.success], ['absent', 'Absent', 'x', p.danger], ['off', 'Off', 'circle-slash', p.off],
  ];

  if (!target) {
    const next = live.next;
    return (
      <Card style={[styles.nowCard, { backgroundColor: p.elev }]} onPress={() => router.push('/(main)/schedule')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Well icon={next ? 'calendar-clock' : 'coffee'} color={next ? p.primary : p.success} bg={next ? p.primarySoft : tint('#16A34A', 14)} size={44} radius={14} iconSize={20} />
          <View style={{ flex: 1 }}>
            <T w={700} c={p.muted} size={11.5} style={{ letterSpacing: 0.4 }}>{next ? `NEXT · ${clock(next.startTime)}–${clock(next.endTime)}` : 'NO MORE CLASSES TODAY'}</T>
            <T w={800} size={20} style={{ letterSpacing: -0.4, marginTop: 2 }} numberOfLines={1}>{next ? next.workspaceName : 'You’re free'}</T>
            <T c={p.muted} size={13} style={{ marginTop: 2 }} numberOfLines={1}>
              {next ? [`in ${inMinutes(minutesOf(next.startTime) - nowMin)}`, next.venueName, next.facultyName].filter(Boolean).join(' · ') : 'Open the timetable to plan tomorrow.'}
            </T>
          </View>
        </View>
      </Card>
    );
  }

  const isNow = target === live.now;
  const att = course?.att ?? { attended: 0, total: 0 };
  // Undo this class's own mark (leave counts like absent) to show the effect of changing it.
  const base = current
    ? { attended: att.attended - (target.status === 'present' ? 1 : 0), total: att.total - (current === 'off' ? 0 : 1) }
    : att;
  const onLeave = target.status === 'exempt';
  const msg = markMessage(course?.short ?? target.workspaceName, base, course?.target ?? 75, current);
  const kind = target.componentType === 'lab' ? 'Lab' : target.componentType === 'tutorial' ? 'Tutorial' : 'Theory';

  const mark = async (m: Mark) => {
    if (busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await markOccurrence(target, current === m && !onLeave ? null : m);
      onChanged();
    } catch (e: any) {
      Alert.alert('Could not mark attendance', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.nowCard, { backgroundColor: p.primary, shadowColor: p.primary }]}>
      <View style={styles.rowBetween}>
        <View style={styles.nowPill}>
          <View style={[styles.liveDot, !isNow && { backgroundColor: 'rgba(255,255,255,0.6)', borderColor: 'transparent' }]} />
          <T w={700} c="#fff" size={12} style={{ letterSpacing: 0.4 }}>{isNow ? 'NOW' : 'ENDED'} · {clock(target.startTime, false)}–{clock(target.endTime, false)}</T>
        </View>
        <T style={[mono(700), { fontSize: 13, color: 'rgba(255,255,255,0.9)' }]}>{isNow ? `${live.minutesLeft} min left` : onLeave ? 'On leave' : current ? 'Marked' : 'Not marked'}</T>
      </View>
      <View>
        <Tap onPress={() => router.push(`/course/${target.workspaceId}` as any)}>
          <T w={800} c="#fff" size={24} style={{ letterSpacing: -0.6 }} numberOfLines={1}>{target.workspaceName}</T>
        </Tap>
        <T c="rgba(255,255,255,0.82)" size={14} style={{ marginTop: 3 }} numberOfLines={1}>
          {[kind, target.venueName, target.facultyName].filter(Boolean).join(' · ')}
        </T>
      </View>
      {isNow ? <GrowBar pct={live.progress * 100} color="#fff" track="rgba(255,255,255,0.22)" height={6} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {marks.map(([k, l, icon, col]) => {
          const on = current === k && !onLeave;
          return (
            <Tap key={k} onPress={() => mark(k)} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={[styles.markBtn, { backgroundColor: on ? '#FFFFFF' : 'rgba(255,255,255,0.16)' }]}>
              <Icon name={icon} size={16} width={2.6} color={on ? col : '#fff'} />
              <T w={700} c={on ? col : '#fff'} size={14}>{l}</T>
            </Tap>
          );
        })}
      </View>
      <T c="rgba(255,255,255,0.88)" size={13} style={{ lineHeight: 18, minHeight: 18 }}>{msg}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  nowCard: {
    marginHorizontal: 20, marginTop: 20, padding: 18, borderRadius: 26, gap: 14,
    shadowOpacity: 0.32, shadowRadius: 18, shadowOffset: { width: 0, height: 18 }, elevation: 8,
  },
  nowPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80', borderWidth: 3, borderColor: 'rgba(74,222,128,0.3)' },
  markBtn: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  nextCard: { marginHorizontal: 20, marginTop: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  weekGrid: { flexDirection: 'row', gap: 6, marginTop: 14 },
  weekDay: { flex: 1, paddingTop: 6, paddingHorizontal: 3, paddingBottom: 8, borderRadius: 14, gap: 6 },
  weekStack: { height: 96, flexDirection: 'column-reverse' },
  summary: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, gap: 3 },
  countdown: { width: 132, padding: 14, borderRadius: 20, gap: 10 },
  reading: { marginHorizontal: 20, marginTop: 24, padding: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 14 },
  doc: { width: 46, height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});

