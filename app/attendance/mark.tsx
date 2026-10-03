import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, PanResponder, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon, courseIcon } from '../../components/uni/Icon';
import { Card, Empty, Rise, RoundButton, T, Tap, Well } from '../../components/uni/primitives';
import { tint, useUni } from '../../components/uni/theme';
import { markOccurrence, statusToMark, type Mark } from '../../domains/academic/actions';
import { overall } from '../../domains/academic/derive';
import { clock, deckNote, pctOf, projectMark } from '../../domains/academic/logic';
import { loadSnapshot, type Occ, type Snapshot } from '../../domains/academic/snapshot';

type Counts = { attended: number; total: number };

export default function MarkToday() {
  const p = useUni();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [queue, setQueue] = useState<Occ[]>([]); // frozen at open so marking doesn't reshuffle
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    loadSnapshot().then((s) => {
      setSnap(s);
      const today = s.occurrences.filter((o) => o.date === s.today && !o.cancelled && o.componentId);
      setQueue(today.filter((o) => !o.status));
      const already: Record<string, Mark> = {};
      for (const o of today) { const m = statusToMark(o.status); if (m) already[o.id] = m; }
      setMarks(already);
    }).catch((e) => Alert.alert('Could not load today', e?.message ?? String(e)));
  }, []);

  // Live counts per course: snapshot counts plus marks made on this screen.
  const counts = (o: Occ): Counts => {
    const c = snap?.courseById.get(o.workspaceId)?.att ?? { attended: 0, total: 0 };
    let { attended, total } = c;
    for (const q of queue) {
      const m = marks[q.id];
      if (q.workspaceId !== o.workspaceId || !m || q.id === o.id) continue;
      ({ attended, total } = projectMark({ attended, total }, m));
    }
    return { attended, total };
  };

  const commit = async (m: Mark) => {
    const o = queue[idx];
    if (!o) return;
    Haptics.notificationAsync(m === 'present' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setMarks((x) => ({ ...x, [o.id]: m }));
    setHistory((h) => [...h, o.id]);
    setIdx((i) => i + 1);
    try {
      await markOccurrence(o, m);
    } catch (e: any) {
      Alert.alert('Could not save that mark', e?.message ?? 'Please try again.');
      setMarks((x) => { const n = { ...x }; delete n[o.id]; return n; });
      setHistory((h) => h.slice(0, -1));
      setIdx((i) => Math.max(0, i - 1));
    }
  };

  const undo = async () => {
    const last = history[history.length - 1];
    const o = queue.find((q) => q.id === last);
    if (!o) return;
    try {
      await markOccurrence(o, null);
      setMarks((x) => { const n = { ...x }; delete n[o.id]; return n; });
      setHistory((h) => h.slice(0, -1));
      setIdx((i) => Math.max(0, i - 1));
    } catch (e: any) {
      Alert.alert('Could not undo', e?.message ?? 'Please try again.');
    }
  };

  const n = queue.length;
  const done = idx >= n;
  const ahead = queue.slice(idx + 1).map((o) => snap?.courseById.get(o.workspaceId)?.short ?? o.workspaceName);
  const sub = !snap ? '' : !n ? 'Nothing left to mark today' : done ? 'Done for today' : `${n - idx} of ${n} left${ahead.length ? ` · ${ahead.slice(0, 2).join(' and ')} ahead` : ''}`;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20, paddingHorizontal: 20 }}>
      <View style={styles.top}>
        <RoundButton icon="x" label="Close" onPress={() => router.back()} />
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {queue.map((o, i) => (
            <View key={o.id} style={{ height: 6, width: i === idx ? 20 : 6, borderRadius: 3, backgroundColor: i < idx ? p.success : i === idx ? p.primary : p.border }} />
          ))}
        </View>
        <RoundButton icon="rotate-ccw" label="Undo last mark" onPress={history.length ? undo : undefined} />
      </View>
      <View style={{ paddingTop: 14, paddingHorizontal: 4 }}>
        <T w={800} size={28} style={{ letterSpacing: -0.8 }}>Mark today</T>
        <T c={p.muted} size={14} style={{ marginTop: 2 }}>{sub}</T>
      </View>

      {snap && !n && !history.length ? (
        <View style={{ marginTop: 22 }}>
          <Empty icon="circle-check-big" title={snap.occurrences.some((o) => o.date === snap.today && !o.cancelled) ? 'All of today’s classes are marked' : 'No classes today'}
            body="Classes you haven't marked show up here, one card at a time." action="Open timetable" onAction={() => router.replace('/(main)/schedule')} />
        </View>
      ) : null}

      {snap && n > 0 && !done ? (
        <>
          <View style={{ flex: 1, marginTop: 18 }}>
            {[1, 0].map((k) => {
              const o = queue[idx + k];
              if (!o) return null;
              return <SwipeCard key={o.id} o={o} top={k === 0} s={snap} counts={counts(o)} onCommit={commit} />;
            })}
          </View>
          <View style={styles.buttons}>
            <Tap onPress={() => commit('absent')} accessibilityLabel="Absent" style={[styles.round, { width: 64, height: 64, borderRadius: 32, backgroundColor: p.elev }]}>
              <Icon name="x" size={28} width={2.6} color={p.danger} />
            </Tap>
            <Tap onPress={() => commit('off')} accessibilityLabel="Off, class not held" style={[styles.round, { width: 52, height: 52, borderRadius: 26, backgroundColor: p.elev }]}>
              <Icon name="circle-slash" size={22} width={2.4} color={p.off} />
            </Tap>
            <Tap onPress={() => commit('present')} accessibilityLabel="Present" style={[styles.round, { width: 64, height: 64, borderRadius: 32, backgroundColor: p.success, shadowColor: p.success, shadowOpacity: 0.35 }]}>
              <Icon name="check" size={28} width={2.8} color="#fff" />
            </Tap>
          </View>
          <View style={styles.hints}>
            <T w={600} c={p.muted} size={11.5}>← Absent</T><T w={600} c={p.muted} size={11.5}>↑ Off</T><T w={600} c={p.muted} size={11.5}>Present →</T>
          </View>
        </>
      ) : null}

      {snap && n > 0 && done ? <Summary s={snap} queue={queue} marks={marks} onDone={() => router.back()} /> : null}
    </View>
  );
}

function SwipeCard({ o, top, s, counts, onCommit }: { o: Occ; top: boolean; s: Snapshot; counts: Counts; onCommit: (m: Mark) => void }) {
  const p = useUni();
  const pos = useRef(new Animated.ValueXY()).current;
  const course = s.courseById.get(o.workspaceId);
  const target = course?.target ?? 75;
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  const fly = (m: Mark) => {
    const to = m === 'present' ? { x: 520, y: 40 } : m === 'absent' ? { x: -520, y: 40 } : { x: 0, y: -700 };
    Animated.timing(pos, { toValue: to, duration: 260, useNativeDriver: false }).start(() => commitRef.current(m));
  };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (g.dy < -110 && Math.abs(g.dx) < 90) fly('off');
      else if (g.dx > 90) fly('present');
      else if (g.dx < -90) fly('absent');
      else Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 6 }).start();
    },
  }), []);

  const pr = projectMark(counts, 'present'), ab = projectMark(counts, 'absent');
  const fmt = (c: Counts) => { const v = pctOf(c.attended, c.total); return v === null ? '—' : `${v}%`; };
  const meta = [`${clock(o.startTime, false)} – ${clock(o.endTime, false)}`, o.venueName, o.facultyName].filter(Boolean).join(' · ');
  const color = o.workspaceColor;

  const style = top
    ? { transform: [...pos.getTranslateTransform(), { rotate: pos.x.interpolate({ inputRange: [-200, 200], outputRange: ['-10deg', '10deg'] }) }], zIndex: 2 }
    : { transform: [{ translateY: 14 }, { scale: 0.95 }], zIndex: 1 };
  const presentOp = { opacity: pos.x.interpolate({ inputRange: [0, 110], outputRange: [0, 1], extrapolate: 'clamp' }) };
  const absentOp = { opacity: pos.x.interpolate({ inputRange: [-110, 0], outputRange: [1, 0], extrapolate: 'clamp' }) };
  const offOp = { opacity: pos.y.interpolate({ inputRange: [-120, 0], outputRange: [1, 0], extrapolate: 'clamp' }) };

  return (
    <Animated.View {...(top ? pan.panHandlers : {})} style={[styles.card, { backgroundColor: p.elev, borderColor: p.hair }, style]}
      accessibilityLabel={`${o.workspaceName}, ${meta}. Swipe right for present, left for absent, up for off.`}>
      <View style={[styles.band, { backgroundColor: tint(color, 14) }]}>
        <View style={{ position: 'absolute', right: -18, top: -18, opacity: 0.22 }}><Icon name={courseIcon(o.workspaceIcon, o.workspaceName)} size={150} width={1.4} color={color} /></View>
        <View style={[styles.bandIcon, { backgroundColor: color }]}><Icon name={courseIcon(o.workspaceIcon, o.workspaceName)} size={26} color="#fff" /></View>
        {top ? (
          <>
            <Animated.View style={[styles.stamp, { left: 18, top: 18, borderColor: p.success, transform: [{ rotate: '-12deg' }] }, presentOp]}>
              <T w={800} c={p.success} size={18} style={{ letterSpacing: 1 }}>PRESENT</T>
            </Animated.View>
            <Animated.View style={[styles.stamp, { right: 18, top: 18, borderColor: p.danger, transform: [{ rotate: '12deg' }] }, absentOp]}>
              <T w={800} c={p.danger} size={18} style={{ letterSpacing: 1 }}>ABSENT</T>
            </Animated.View>
            <Animated.View style={[styles.stamp, { alignSelf: 'center', left: '50%', marginLeft: -34, top: 22, borderColor: p.off }, offOp]}>
              <T w={800} c={p.off} size={18} style={{ letterSpacing: 1 }}>OFF</T>
            </Animated.View>
          </>
        ) : null}
      </View>
      <View style={{ padding: 18, gap: 14, flex: 1 }}>
        <View>
          <T w={800} size={23} style={{ letterSpacing: -0.6 }} numberOfLines={1}>{o.workspaceName}{o.componentType === 'lab' ? ' Lab' : ''}</T>
          <T c={p.muted} size={13.5} style={{ marginTop: 3 }} numberOfLines={1}>{meta}</T>
        </View>
        <View style={{ gap: 8 }}>
          <T w={700} c={p.muted} size={11.5} style={{ letterSpacing: 0.4, textTransform: 'uppercase' }}>Your attendance after this</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([['Present', fmt(pr), p.success, tint(p.success, 12)], ['Absent', fmt(ab), p.danger, tint(p.danger, 12)], ['Off', fmt(counts), p.off, p.surface]] as const).map(([l, v, c, bg]) => (
              <View key={l} style={{ flex: 1, padding: 10, borderRadius: 14, backgroundColor: bg }}>
                <T w={700} c={c} size={11}>{l}</T>
                <T w={800} size={20} style={{ marginTop: 2 }}>{v}</T>
              </View>
            ))}
          </View>
          <T c={p.muted} size={12.5} style={{ lineHeight: 17 }}>{counts.total ? deckNote(course?.short ?? o.workspaceName, counts, target) : 'First class marked for this course.'}</T>
        </View>
      </View>
    </Animated.View>
  );
}

function Summary({ s, queue, marks, onDone }: { s: Snapshot; queue: Occ[]; marks: Record<string, Mark>; onDone: () => void }) {
  const p = useUni();
  const SM: Record<Mark, [string, string]> = { present: ['Present', p.success], absent: ['Absent', p.danger], off: ['Off', p.off] };
  // Overall after today's marks.
  const after = s.courses.map((c) => {
    let cur = { attended: c.att.attended, total: c.att.total };
    for (const o of queue) if (o.workspaceId === c.id && marks[o.id]) cur = projectMark(cur, marks[o.id]);
    return { ...c, att: { ...c.att, ...cur } };
  });
  const o = overall(after);
  const pctFor = (id: number) => { const c = after.find((x) => x.id === id)!; return pctOf(c.att.attended, c.att.total); };
  return (
    <View style={{ marginTop: 22, gap: 10 }}>
      {queue.map((q, i) => {
        const m = marks[q.id];
        if (!m) return null;
        return (
          <Rise key={q.id} i={i}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20 }}>
              <Well icon={courseIcon(q.workspaceIcon, q.workspaceName)} color={q.workspaceColor} bg={tint(q.workspaceColor)} size={38} radius={12} iconSize={18} />
              <View style={{ flex: 1 }}>
                <T w={700} size={15} numberOfLines={1}>{q.workspaceName}</T>
                <T c={p.muted} size={12} style={{ marginTop: 1 }}>Now {pctFor(q.workspaceId) ?? '—'}%{m === 'off' ? ' · not counted' : ''}</T>
              </View>
              <View style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, backgroundColor: tint(SM[m][1], 14) }}>
                <T w={800} c={SM[m][1]} size={12}>{SM[m][0]}</T>
              </View>
            </Card>
          </Rise>
        );
      })}
      <View style={{ marginTop: 8, padding: 16, borderRadius: 20, backgroundColor: p.primary }}>
        <T w={500} c="#fff" size={14} style={{ lineHeight: 20 }}>
          All {queue.length} class{queue.length === 1 ? '' : 'es'} marked. Overall attendance is <T w={800} c="#fff" size={14}>{o.pct ?? '—'}%</T>.
        </T>
      </View>
      <Tap onPress={onDone} accessibilityRole="button" style={{ height: 52, borderRadius: 16, backgroundColor: p.text, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
        <T w={700} c={p.bg} size={15}>Done</T>
      </Tap>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 4 },
  card: {
    position: 'absolute', left: 0, right: 0, top: 0, height: 420, borderRadius: 30, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#0B1B3B', shadowOpacity: 0.16, shadowRadius: 25, shadowOffset: { width: 0, height: 24 }, elevation: 8,
  },
  band: { height: 150, justifyContent: 'flex-end', padding: 18, overflow: 'hidden' },
  bandIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stamp: { position: 'absolute', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 3 },
  buttons: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 22, paddingBottom: 6 },
  round: { alignItems: 'center', justifyContent: 'center', shadowColor: '#0B1B3B', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  hints: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, paddingHorizontal: 18 },
});
