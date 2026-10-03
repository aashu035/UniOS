import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Icon, type IconName } from '../../components/uni/Icon';
import { Card, Empty, LargeTitle, ListCard, Pill, Rise, RoundButton, Screen, T, Tap } from '../../components/uni/primitives';
import { mono, shadow, tint, useUni, listRow } from '../../components/uni/theme';
import { setTaskDone } from '../../domains/academic/actions';
import { useAcademic } from '../../domains/academic/hooks';
import { addDays, dayName, daysBetween, dueGroup, isDone, relDue, shortDate, taskKind, type DueGroup, type TaskKind } from '../../domains/academic/logic';
import type { TaskRow } from '../../domains/academic/snapshot';

type Filter = 'all' | TaskKind;

export default function Work() {
  const p = useUni();
  const router = useRouter();
  const { data, refresh, refreshing, reload } = useAcademic();
  const [filter, setFilter] = useState<Filter>('all');
  // Optimistic done/undone toggles while the reload is in flight.
  const [flip, setFlip] = useState<Record<number, boolean>>({});

  if (!data) return <Screen><View /></Screen>;
  const s = data;
  const KIND: Record<TaskKind, { label: string; plural: string; icon: IconName; color: string }> = {
    exam: { label: 'Exam', plural: 'Exams', icon: 'graduation-cap', color: p.danger },
    assign: { label: 'Assignment', plural: 'Assignments', icon: 'file-pen-line', color: p.warn },
    lab: { label: 'Lab file', plural: 'Lab files', icon: 'test-tube-diagonal', color: '#10B981' },
  };

  const done = (t: TaskRow) => (t.id in flip ? flip[t.id] : isDone(t.status));
  const days = (t: TaskRow) => (t.dueDate ? daysBetween(s.today, t.dueDate) : null);
  const all = s.tasks.slice().sort((a, b) => (days(a) ?? 9999) - (days(b) ?? 9999));
  const open = all.filter((t) => !done(t));
  const pass = (t: TaskRow) => filter === 'all' || taskKind(t.type) === filter;

  const toggle = async (t: TaskRow) => {
    const next = !done(t);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFlip((f) => ({ ...f, [t.id]: next }));
    try {
      await setTaskDone(t, next);
      await reload();
    } catch (e: any) {
      Alert.alert('Could not update task', e?.message ?? 'Please try again.');
    } finally {
      setFlip((f) => { const n = { ...f }; delete n[t.id]; return n; });
    }
  };

  const strip = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(s.today, i);
    const items = open.filter((t) => t.dueDate === d);
    const exam = items.some((t) => taskKind(t.type) === 'exam');
    return { d, dots: items.map((t) => KIND[taskKind(t.type)].color).slice(0, 3), exam };
  });
  const examSoon = strip.find((x) => x.exam);

  const GROUPS: Array<[DueGroup, string, string]> = [
    ['soon', 'Today & tomorrow', p.danger], ['week', 'This week', p.warn], ['next', 'Next week', p.text], ['later', 'Later', p.muted], ['undated', 'No due date', p.muted],
  ];
  const groups = GROUPS.map(([g, title, c]) => ({ g, title, c, items: open.filter((t) => pass(t) && dueGroup(days(t)) === g) })).filter((x) => x.items.length);
  const doneItems = all.filter((t) => done(t) && pass(t)).sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? '')).slice(0, 10);
  const doneThisWeek = all.filter((t) => done(t) && t.dueDate && Math.abs(daysBetween(s.today, t.dueDate)) <= 7).length;

  const Row = ({ t }: { t: TaskRow }) => {
    const d = done(t);
    const n = days(t);
    const k = KIND[taskKind(t.type)];
    const course = t.workspaceId ? s.courseById.get(t.workspaceId) : undefined;
    const dc = d ? p.success : n === null ? p.muted : n <= 1 ? p.danger : n <= 7 ? p.warn : p.muted;
    return (
      <Tap onPress={() => router.push(`/task/edit?id=${t.id}` as any)} style={[styles.row, { opacity: d ? 0.55 : 1 }]}>
        <Tap onPress={() => toggle(t)} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: d }} accessibilityLabel={`Mark ${t.title} ${d ? 'not done' : 'done'}`}
          style={[styles.check, { borderColor: d ? p.success : p.border, backgroundColor: d ? p.success : 'transparent' }]}>
          {d ? <Icon name="check" size={13} width={3.2} color="#fff" /> : null}
        </Tap>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T w={700} size={14.5} numberOfLines={1} style={d ? { textDecorationLine: 'line-through' } : undefined}>{t.title}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: course?.color ?? p.muted }} />
            <T w={500} c={p.muted} size={12} numberOfLines={1} style={{ flexShrink: 1 }}>{course?.name ?? 'General'} · <T w={500} size={12} style={{ opacity: 0.8 }}>{k.label}</T></T>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T w={800} c={dc} size={12}>{d ? 'Done' : n === null ? '—' : relDue(n)}</T>
          {t.dueDate ? <T c={p.muted} size={11} style={{ marginTop: 2 }}>{dayName(t.dueDate)}, {shortDate(t.dueDate)}</T> : null}
        </View>
      </Tap>
    );
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <LargeTitle eyebrow={`${open.length} open · ${doneThisWeek} done this week`} title="Tasks"
        right={<RoundButton icon="plus" label="Add task" onPress={() => router.push('/task/add')} />} />

      <Rise i={1} style={styles.counters}>
        {(Object.keys(KIND) as TaskKind[]).map((k) => {
          const list = open.filter((t) => taskKind(t.type) === k);
          const nd = list.find((t) => t.dueDate);
          const on = filter === k;
          return (
            <Tap key={k} onPress={() => setFilter(on ? 'all' : k)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={[styles.counter, { backgroundColor: p.elev, borderColor: on ? KIND[k].color : p.hair }, shadow(p)]}>
              <View style={styles.counterTop}>
                <Icon name={KIND[k].icon} size={18} color={KIND[k].color} />
                <T w={800} size={24} style={{ letterSpacing: -0.6 }}>{list.length}</T>
              </View>
              <T w={700} size={12.5}>{KIND[k].plural}</T>
              <T w={700} c={KIND[k].color} size={11} style={{ lineHeight: 14 }} numberOfLines={2}>
                {nd ? `Next: ${relDue(daysBetween(s.today, nd.dueDate!)).toLowerCase()}` : list.length ? 'No dates set' : 'All clear'}
              </T>
            </Tap>
          );
        })}
      </Rise>

      <Rise i={2}>
        <Card style={styles.strip}>
          <View style={styles.stripHead}>
            <T w={800} size={13.5}>Next 14 days</T>
            {examSoon ? <T w={600} c={p.danger} size={11.5}>Exam {daysBetween(s.today, examSoon.d) <= 1 ? relDue(daysBetween(s.today, examSoon.d)).toLowerCase() : `in ${daysBetween(s.today, examSoon.d)} days`}</T>
              : <T w={600} c={p.muted} size={11.5}>{strip.reduce((a, x) => a + x.dots.length, 0)} due</T>}
          </View>
          <View style={styles.stripRow}>
            {strip.map((x, i) => (
              <View key={x.d} style={[styles.stripDay, { backgroundColor: i === 0 ? p.primarySoft : x.exam ? tint(p.danger, 9) : 'transparent' }]}>
                {x.dots.map((c, j) => <View key={j} style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: c }} />)}
              </View>
            ))}
          </View>
          <View style={styles.labelRow}>
            {strip.map((x, i) => (
              <T key={x.d} style={[mono(500), { flex: 1, textAlign: 'center', fontSize: 9.5, color: i === 0 ? p.primary : p.muted }]}>{dayName(x.d)[0]}</T>
            ))}
          </View>
        </Card>
      </Rise>

      <Rise i={3}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          {([['all', 'All'], ['exam', 'Exams'], ['assign', 'Assignments'], ['lab', 'Lab files']] as Array<[Filter, string]>).map(([k, l]) => (
            <Pill key={k} label={l} onPress={() => setFilter(k)} bg={filter === k ? p.text : p.elev} fg={filter === k ? p.bg : p.text} border={p.hair} />
          ))}
        </ScrollView>
      </Rise>

      {!s.tasks.length ? (
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <Empty icon="list-plus" title="No tasks yet" body="Add assignments, lab files and exams. They're grouped by when they're due." action="Add task" onAction={() => router.push('/task/add')} />
        </View>
      ) : null}

      {groups.map((g) => (
        <View key={g.g} style={{ paddingHorizontal: 20 }}>
          <View style={styles.groupHead}>
            <T w={800} c={g.c} size={12} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>{g.title}</T>
            <T w={600} c={p.muted} size={11.5}>{g.items.length} open</T>
          </View>
          <ListCard>{g.items.map((t) => <Row key={t.id} t={t} />)}</ListCard>
        </View>
      ))}

      {doneItems.length ? (
        <View style={{ paddingHorizontal: 20 }}>
          <View style={styles.groupHead}>
            <T w={800} c={p.success} size={12} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>Done</T>
            <T w={600} c={p.muted} size={11.5}>{doneItems.length}</T>
          </View>
          <ListCard>{doneItems.map((t) => <Row key={t.id} t={t} />)}</ListCard>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  counters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  counter: { flex: 1, padding: 12, borderRadius: 20, borderWidth: 1.5, gap: 8 },
  counterTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  strip: { marginHorizontal: 20, marginTop: 14, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 12, borderRadius: 22 },
  stripHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 10 },
  stripRow: { flexDirection: 'row', gap: 3, height: 58, alignItems: 'flex-end' },
  labelRow: { flexDirection: 'row', gap: 3, marginTop: 5 },
  stripDay: { flex: 1, height: '100%', borderRadius: 7, paddingVertical: 4, alignItems: 'center', justifyContent: 'flex-start', flexDirection: 'column-reverse', gap: 3 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16, marginBottom: 8, marginHorizontal: 4 },
  row: listRow,
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
