import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { db } from '../../core/db/client';
import { tasks } from '../../domains/task/model';
import { getLocalDateString } from '../../core/utils/date';
import { addDays } from '../../domains/academic/logic';
import { loadSnapshot } from '../../domains/academic/snapshot';
import { suggestion } from '../../domains/academic/derive';
import { Icon, type IconName } from './Icon';
import { T, Tap } from './primitives';
import { hue, useUni } from './theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  today: { label: 'Home', icon: 'house' },
  schedule: { label: 'Timetable', icon: 'calendar-days' },
  work: { label: 'Tasks', icon: 'circle-check-big' },
  menu: { label: 'More', icon: 'layout-grid' },
};
const ORDER = ['today', 'schedule', null, 'work', 'menu'] as const;

const ACTIONS: Array<{ label: string; icon: IconName; color: string; href: string }> = [
  { label: 'Mark attendance', icon: 'check-check', color: '#16A34A', href: '/attendance/mark' },
  { label: 'Add a note', icon: 'notebook-pen', color: hue.violet, href: '/resource/add' },
  { label: 'Add task', icon: 'list-plus', color: '#D97706', href: '/task/add' },
  { label: 'Upload file', icon: 'upload', color: hue.blue, href: '/resource/add' },
  { label: 'Add exam', icon: 'graduation-cap', color: '#DC2626', href: '/task/add?type=exam' },
  { label: 'Schedule change', icon: 'calendar-clock', color: hue.cyan, href: '/schedule/change' },
];

/** Open tasks due within a week (overdue included): the badge on the Tasks tab. */
async function dueThisWeek(): Promise<number> {
  const limit = addDays(getLocalDateString(new Date()), 7);
  const rows = await db.select({ id: tasks.id }).from(tasks)
    .where(and(eq(tasks.status, 'pending'), isNotNull(tasks.dueDate), lte(tasks.dueDate, limit))).all();
  return rows.length;
}

export function UniTabBar({ state, navigation }: BottomTabBarProps) {
  const p = useUni();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [badge, setBadge] = useState(0);
  const [hint, setHint] = useState<{ text: string; route: string } | null>(null);
  const rot = useSharedValue(0);

  const active = state.routes[state.index]?.name;
  useEffect(() => { dueThisWeek().then(setBadge).catch(() => {}); }, [state.index]);
  useEffect(() => { rot.value = withTiming(open ? 45 : 0, { duration: 350, easing: Easing.bezier(0.2, 0.9, 0.25, 1) }); }, [open]);
  const fab = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  const toggle = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setOpen((o) => {
      if (!o) {
        const d = new Date();
        loadSnapshot().then((s) => setHint(suggestion(s, d.getHours() * 60 + d.getMinutes()))).catch(() => setHint(null));
      }
      return !o;
    });
  }, []);

  const go = (href: string) => { setOpen(false); router.push(href as any); };

  const barH = 64 + Math.max(insets.bottom, 12);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {open && (
        <>
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }]}>
            <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} accessibilityLabel="Close create menu" />
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOut.duration(120)}
            style={[styles.sheet, { bottom: barH + 18, backgroundColor: p.elev }]}>
            <View style={[styles.grabber, { backgroundColor: p.border }]} />
            {hint && (
              <Tap onPress={() => go(hint.route)} style={[styles.suggest, { backgroundColor: p.primarySoft }]}>
                <View style={[styles.suggestIcon, { backgroundColor: '#16A34A' }]}><Icon name="check-check" size={19} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <T w={800} c={p.primary} size={11.5} style={{ letterSpacing: 0.4 }}>SUGGESTED NOW</T>
                  <T w={700} size={14} style={{ marginTop: 2, lineHeight: 19 }}>{hint.text}</T>
                </View>
              </Tap>
            )}
            <View style={styles.grid}>
              {ACTIONS.map((a, i) => (
                <Animated.View key={a.label} entering={FadeInDown.delay(60 + i * 40).duration(380)} style={styles.cell}>
                  <Tap onPress={() => go(a.href)} accessibilityRole="button" style={[styles.action, { backgroundColor: p.surface }]}>
                    <View style={[styles.actionIcon, { backgroundColor: a.color }]}><Icon name={a.icon} size={20} color="#fff" /></View>
                    <T w={700} size={12} style={{ textAlign: 'center', lineHeight: 15 }}>{a.label}</T>
                  </Tap>
                </Animated.View>
              ))}
            </View>
            <Tap onPress={() => go('/course/setup')} style={styles.addCourse}>
              <Icon name="book-plus" size={18} color={p.text} />
              <T w={700} size={14} style={{ flex: 1 }}>Add a new course</T>
              <Icon name="chevron-right" size={18} color={p.muted} />
            </Tap>
          </Animated.View>
        </>
      )}

      <View style={[styles.wrap, { height: barH + 10 }]} pointerEvents="box-none">
        <View style={[styles.bar, { height: barH, backgroundColor: p.glass, borderTopColor: p.hair, paddingBottom: Math.max(insets.bottom, 12) }]}>
          {ORDER.map((name, i) => {
            if (!name) return <View key="gap" style={{ flex: 1 }} />;
            const route = state.routes.find((r) => r.name === name);
            if (!route) return <View key={name} style={{ flex: 1 }} />;
            const on = active === name;
            const c = on ? p.primary : p.muted;
            return (
              <Pressable key={name} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={TABS[name].label}
                onPress={() => {
                  setOpen(false);
                  const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!on && !e.defaultPrevented) navigation.navigate(route.name);
                }}>
                <View style={[styles.pill, { backgroundColor: on ? p.primarySoft : 'transparent' }]}>
                  <Icon name={TABS[name].icon} size={21} color={c} />
                </View>
                <T w={600} c={c} size={11}>{TABS[name].label}</T>
                {name === 'work' && badge > 0 ? (
                  <View style={[styles.badge, { backgroundColor: p.danger, borderColor: p.bg }]}><T w={700} c="#fff" size={10}>{badge > 9 ? '9+' : badge}</T></View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={open ? 'Close create menu' : 'Create'}
          style={[styles.fab, { backgroundColor: p.primary, borderColor: p.bg, shadowColor: p.primary }]}>
          <Animated.View style={fab}><Icon name="plus" size={26} color="#fff" width={2.4} /></Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 10,
    ...Platform.select({ android: { elevation: 12 }, default: {} }),
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  pill: { width: 58, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -3, right: 14, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  fab: {
    position: 'absolute', top: 0, left: '50%', marginLeft: -31, width: 62, height: 62, borderRadius: 31, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.42, shadowRadius: 13, shadowOffset: { width: 0, height: 12 }, elevation: 14,
  },
  sheet: {
    position: 'absolute', left: 10, right: 10, borderRadius: 32, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 18, gap: 14,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 30 }, elevation: 20,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  suggest: { padding: 14, borderRadius: 20, flexDirection: 'row', gap: 12, alignItems: 'center' },
  suggestIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  cell: { width: '33.333%', padding: 4 },
  action: { height: 108, paddingTop: 14, paddingHorizontal: 6, borderRadius: 18, alignItems: 'center', gap: 8 },
  actionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addCourse: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingTop: 4 },
});

