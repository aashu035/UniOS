import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  withRepeat, withSequence, withTiming, withDelay, withSpring,
  Easing, FadeInDown, LinearTransition, FadeOut,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect, G } from 'react-native-svg';
import {
  Bell, Search, CloudRain, Sun, Cloud, AlertCircle, BookOpen, Clock3,
  MapPin, CalendarDays, CheckCircle2, FlaskConical, GraduationCap, Plus,
} from 'lucide-react-native';

import { colors, radius, spacing, typography } from '../../tokens';
import { onPrimary } from '../../tokens/surface';
import { CalendarService, EffectiveOccurrence } from '../../domains/calendar/service';
import { TaskService } from '../../domains/task/service';
import { NotificationRepository } from '../../domains/notification/repository';
import { NotificationService } from '../../domains/notification/service';
import { WorkspaceRepository } from '../../domains/workspace/repository';
import { getLocalDateString, formatTime12Hour } from '../../core/utils/date';
import { AppCard } from '../../components/cards/AppCard';
import { TimelineCard } from '../../components/cards/TimelineCard';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { PageHeader } from '../../components/layout/PageHeader';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { EmptyState } from '../../components/layout/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { FrostedChip } from '../../components/ui/FrostedChip';
import { CourseIcon } from '../../components/ui/CourseIcon';

// ─────────────────────────────────────────────────────────────────────────────
// Icon map for the Academic Pulse (matches Fable's preview).
// ASSET_NEEDED: pulse-glyph-set — lucide Sun/Cloud/AlertCircle/CloudRain stay
// as the fallback until custom metallic monoline glyphs land.
// ─────────────────────────────────────────────────────────────────────────────
const PULSE_ICON: Record<string, any> = {
  'Light week': Sun,
  'Balanced week': Cloud,
  'Busy week': AlertCircle,
  'Heavy week': CloudRain,
};

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDateLong = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const weekdayOf = (iso: string) => WEEKDAY[new Date(iso + 'T00:00:00').getDay()];

// ─────────────────────────────────────────────────────────────────────────────
//  Motion budget: ≤3 steady shared values, 1 free for transient press/refresh
//  #1 scrollY — Pulse parallax + sheen shift
//  #2 sheenSweep — diagonal light band on Busy/Heavy
//  #3 free
// ─────────────────────────────────────────────────────────────────────────────
const MAX_STAGGER = 5;
const STAGGER_STEP_MS = 60;
const ENTER_DURATION = 320;
const PRESS_SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

// ─────────────────────────────────────────────────────────────────────────────
//  PulseCard — glassPrimary hero with parallax + sheen
// ─────────────────────────────────────────────────────────────────────────────
interface PulseCardProps {
  data: HomeData;
  scrollY: SharedValue<number>;
  onPress: () => void;
}

function PulseCard({ data, scrollY, onPress }: PulseCardProps) {
  const facts = useMemo(() => {
    const labs = data.effectiveSchedule.filter((o) => o.componentType === 'lab').length;
    return {
      upcomingClasses: data.effectiveSchedule.length,
      labs,
      deadlines: data.pendingTasks.length,
      exams: data.pendingTasks.filter((t) => t.type === 'exam').length,
      attendanceRisks: 0,
    };
  }, [data]);

  const weather = CalendarService.calculateAcademicWeather(facts);
  const Icon = PULSE_ICON[weather.state] ?? Cloud;
  const heavyMotion = weather.state === 'Heavy week' || weather.state === 'Busy week';

  // Scroll-linked (shared value #1): parallax + settle + sheen shift
  const wrapStyle = useAnimatedStyle(() => {
    const p = Math.min(Math.max(scrollY.value / 200, 0), 1);
    return {
      transform: [
        { translateY: scrollY.value * 0.15 },
        { scale: 1 - 0.04 * p },
      ],
      opacity: 1 - 0.15 * p,
    };
  });

  // Sheen shift (still part of #1, derived in the same animated style)
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -40 + scrollY.value * 0.6 }],
  }));

  // Sheen sweep (shared value #2) — only active on Busy/Heavy
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (heavyMotion) {
      sweep.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) }),
          withDelay(3200, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      );
    } else {
      sweep.value = 0;
    }
  }, [heavyMotion, sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: sweep.value * 0.5,
    transform: [
      { translateX: -200 + sweep.value * 400 },
    ],
  }));

  return (
    <Animated.View style={[styles.pulseWrap, wrapStyle]}>
      <AppCard variant="glassPrimary" padding="lg" style={styles.pulseCard}>
        {/* Static hairline sheen (always) */}
        <View style={styles.sheenHairline} pointerEvents="none" />
        {/* Sweep sheen (only Busy/Heavy) */}
        {heavyMotion ? (
          <Animated.View style={[styles.sheenSweep, sweepStyle]} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="pulseSheen" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                  <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.18" />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <G transform="skewX(-20)">
                <Rect x="-20%" y="-40%" width="45%" height="200%" fill="url(#pulseSheen)" />
              </G>
            </Svg>
          </Animated.View>
        ) : null}
        <Animated.View style={[styles.sheenScrollShift, sheenStyle]} pointerEvents="none" />

        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.pulseRow}>
          <View style={styles.pulseIconWell}>
            <Icon size={24} color={colors.light.primary} />
          </View>
          <View style={styles.pulseText}>
            <Text style={styles.pulseEyebrow}>Academic pulse · next 7 days</Text>
            <Text style={styles.pulseTitle}>{weather.state}</Text>
            <Text style={styles.pulseDesc}>{weather.description}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.chipsRow}>
          <FrostedChip value={facts.upcomingClasses} label="classes" icon={<BookOpen size={12} color={onPrimary.accent} />} />
          <FrostedChip value={facts.labs} label="labs" icon={<FlaskConical size={12} color={onPrimary.accent} />} />
          <FrostedChip value={facts.deadlines} label="due" icon={<Clock3 size={12} color={onPrimary.accent} />} />
          <FrostedChip value={facts.exams} label="exams" icon={<GraduationCap size={12} color={onPrimary.accent} />} />
        </View>
      </AppCard>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  IconButton with optional numeric badge (for the header bell + search)
// ─────────────────────────────────────────────────────────────────────────────────────
function HeaderIconButton({ onPress, badge, children }: { onPress: () => void; badge?: number; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handleIn = () => { scale.value = withSpring(0.93, PRESS_SPRING); };
  const handleOut = () => { scale.value = withSpring(1, PRESS_SPRING); };
  return (
    <Animated.View style={pressStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handleIn}
        onPressOut={handleOut}
        activeOpacity={0.85}
        accessibilityRole="button"
        style={styles.headerIconBtn}
      >
        {children}
        {badge !== undefined && badge > 0 ? (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  HomeSkeleton — initial load only (matches Fable's spec: deterministic layout
//  so skeleton→content doesn't jump; header renders immediately, no badge yet)
// ─────────────────────────────────────────────────────────────────────────────
function HomeSkeleton() {
  return (
    <View>
      <Skeleton height={148} borderRadius={20} style={styles.skelHero} />
      <View style={styles.skelSectionRow}>
        <Skeleton height={20} width={88} borderRadius={radius.md} />
        <Skeleton height={16} width={56} borderRadius={radius.md} />
      </View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skelRow}>
          <View style={styles.skelTimeCol}>
            <Skeleton height={12} width={44} borderRadius={radius.sm} />
            <Skeleton height={12} width={12} borderRadius={radius.full} style={{ marginTop: spacing.sm }} />
          </View>
          <Skeleton height={84} borderRadius={16} style={{ flex: 1 }} />
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  HomeData — same shape as Fable's HomeData fixture
// ─────────────────────────────────────────────────────────────────────────────
interface HomeData {
  todayStr: string;
  now: string; // HH:MM device clock
  workspaceCount: number;
  effectiveSchedule: EffectiveOccurrence[]; // today .. today+6
  pendingTasks: Array<{
    id: number;
    workspaceId: number;
    title: string;
    type: string;
    dueDate: string; // YYYY-MM-DD
    priority: string;
    status: string;
  }>;
  unreadCount: number;
}

const EMPTY: HomeData = {
  todayStr: '',
  now: '',
  workspaceCount: 0,
  effectiveSchedule: [],
  pendingTasks: [],
  unreadCount: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 6);
      const todayStr = getLocalDateString(today);
      const nextWeekStr = getLocalDateString(nextWeek);
      const now = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

      // Kick off the slow background work without awaiting the read path.
      // Bell badge can lag a beat; skeleton → content stays fast.
      void NotificationService.onLaunchScan().catch(() => {});
      void NotificationService.cleanup(30).catch(() => {});

      const [workspaceCount, effectiveSchedule, pendingTasks, unread] = await Promise.all([
        WorkspaceRepository.count(),
        CalendarService.getEffectiveSchedule(todayStr, nextWeekStr),
        TaskService.getTasksDueSoon(),
        NotificationRepository.countUnread(),
      ]);

      setData({
        todayStr,
        now,
        workspaceCount,
        effectiveSchedule,
        pendingTasks: pendingTasks.map((t) => ({
          id: t.id,
          workspaceId: t.workspaceId ?? 0,
          title: t.title,
          type: (t as any).type ?? 'assignment',
          dueDate: t.dueDate ?? '',
          priority: t.priority,
          status: t.status,
        })),
        unreadCount: unread,
      });
    } catch (e) {
      console.error('Home load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Scroll-linked (shared value #1) — defined here so it can be passed to PulseCard
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  // Derived view data
  const todaysClasses = useMemo(
    () => (data ? data.effectiveSchedule.filter((o) => o.date === data.todayStr) : []),
    [data],
  );
  const nextUpcoming = useMemo(
    () => (data ? data.effectiveSchedule.find((o) => o.date > data.todayStr) : undefined),
    [data],
  );
  const isActive = (o: EffectiveOccurrence) =>
    !!data && o.startTime <= data.now && data.now < o.endTime;
  const subtitleFor = (o: EffectiveOccurrence) =>
    [o.componentType.toUpperCase(), o.facultyName].filter(Boolean).join(' · ');

  const header = (
    <PageHeader
      title="Today"
      subtitle={fmtDateLong(data?.todayStr || getLocalDateString(new Date()))}
      rightAction={
        <View style={styles.headerActions}>
          <HeaderIconButton onPress={() => router.push('/search')}>
            <Search size={22} color={colors.light.text} />
          </HeaderIconButton>
          <HeaderIconButton
            onPress={() => router.push('/notifications')}
            badge={loading ? undefined : data?.unreadCount}
          >
            <Bell size={22} color={colors.light.text} />
          </HeaderIconButton>
        </View>
      }
    />
  );

  // ── A. New user: workspaces.length === 0 ──
  if (!loading && data && data.workspaceCount === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {header}
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={
              <View style={styles.illustrationPlaceholder}>
                <Text style={styles.illustrationText}>
                  ASSET_NEEDED{'\n'}home-empty-first-course{'\n'}200×160 dp
                </Text>
              </View>
            }
            title="Add your first course"
            description="Your timetable, attendance and deadlines will show up here once you add a course."
            action={<PrimaryButton label="Add a course" onPress={() => router.push('/course/add')} />}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {header}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.light.primary}
            colors={[colors.light.primary]}
          />
        }
      >
        {loading || !data ? (
          <HomeSkeleton />
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(ENTER_DURATION).springify().damping(18)}>
              <PulseCard data={data} scrollY={scrollY} onPress={() => router.push('/(main)/tasks')} />
            </Animated.View>

            <SectionHeader title="Classes" actionLabel="Planner" onActionPress={() => router.push('/(main)/planner')} />

            {todaysClasses.length > 0 ? (
              todaysClasses.map((o, i) => (
                <Animated.View
                  key={o.id}
                  entering={FadeInDown.duration(ENTER_DURATION).delay(Math.min(i, MAX_STAGGER) * STAGGER_STEP_MS + 60)}
                  layout={LinearTransition}
                  exiting={FadeOut}
                >
                  <TimelineCard
                    time={formatTime12Hour(o.startTime)}
                    endTime={formatTime12Hour(o.endTime)}
                    title={o.workspaceName}
                    subtitle={subtitleFor(o)}
                    venue={o.venueName}
                    isActive={isActive(o)}
                    accentColor={o.workspaceColor}
                    icon={<CourseIcon name={o.workspaceIcon} size={18} color={o.workspaceColor} />}
                    badge={o.isException ? o.exceptionAction : undefined}
                    onPress={() => router.push(`/workspace/${o.workspaceId}`)}
                  />
                </Animated.View>
              ))
            ) : (
              <Animated.View entering={FadeInDown.duration(ENTER_DURATION).delay(60)}>
                <AppCard variant="flat" padding="sm" style={styles.glassInset}>
                  {data.effectiveSchedule.length === 0 ? (
                    <EmptyState
                      icon={<CalendarDays size={28} color={colors.light.textMuted} />}
                      title="No timetable yet"
                      description="Nothing is scheduled in the next 7 days. Add class timings to your courses to see them here."
                      action={
                        <TouchableOpacity onPress={() => router.push('/(main)/planner')}>
                          <Text style={styles.linkBtn}>Open planner</Text>
                        </TouchableOpacity>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={<Sun size={28} color={colors.light.textMuted} />}
                      title="No classes today"
                      description={
                        nextUpcoming
                          ? `Next up: ${nextUpcoming.workspaceName} · ${weekdayOf(nextUpcoming.date)} ${formatTime12Hour(nextUpcoming.startTime)}`
                          : 'Nothing scheduled this week.'
                      }
                      action={
                        <TouchableOpacity onPress={() => router.push('/(main)/planner')}>
                          <Text style={styles.linkBtn}>Open planner</Text>
                        </TouchableOpacity>
                      }
                    />
                  )}
                </AppCard>
              </Animated.View>
            )}

            <SectionHeader title="Due & overdue" actionLabel="All tasks" onActionPress={() => router.push('/(main)/tasks')} />

            {data.pendingTasks.length > 0 ? (
              data.pendingTasks.slice(0, 3).map((t, i) => {
                const overdue = t.dueDate < data.todayStr;
                const daysLate = overdue
                  ? Math.round((new Date(data.todayStr).getTime() - new Date(t.dueDate).getTime()) / 86400000)
                  : 0;
                return (
                  <Animated.View
                    key={t.id}
                    entering={FadeInDown.duration(ENTER_DURATION).delay(Math.min(i, MAX_STAGGER) * STAGGER_STEP_MS + 120)}
                    layout={LinearTransition}
                    exiting={FadeOut}
                    style={styles.taskRow}
                  >
                    <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/(main)/tasks')}>
                      <AppCard variant="glass" padding="md">
                        <View style={styles.taskRowInner}>
                          <View style={[styles.taskAccent, { backgroundColor: overdue ? colors.light.danger : colors.light.warning }]} />
                          <View style={styles.taskText}>
                            <Text style={styles.taskTitle} numberOfLines={1}>{t.title}</Text>
                            <Text style={[styles.taskMeta, overdue && styles.taskMetaOverdue]}>
                              {overdue ? `Overdue · ${daysLate}d` : 'Due today'} · {t.type} · {t.priority}
                            </Text>
                          </View>
                          {t.type === 'exam' ? <GraduationCap size={18} color={colors.light.textMuted} /> : null}
                        </View>
                      </AppCard>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })
            ) : (
              <Animated.View entering={FadeInDown.duration(ENTER_DURATION).delay(120)}>
                <AppCard variant="flat" padding="md" style={styles.glassInset}>
                  <View style={styles.taskEmpty}>
                    <CheckCircle2 size={20} color={colors.light.success} />
                    <Text style={styles.taskEmptyText}>Nothing due or overdue.</Text>
                  </View>
                </AppCard>
              </Animated.View>
            )}

            {data.pendingTasks.length > 3 ? (
              <Text style={styles.moreLabel}>+{data.pendingTasks.length - 3} more in Tasks</Text>
            ) : null}
          </>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    backgroundColor: colors.light.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.light.background,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },

  // Pulse
  pulseWrap: { transformOrigin: 'top center' as any },
  pulseCard: { borderRadius: 20, marginBottom: spacing.xs },
  sheenHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheenSweep: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 20,
  },
  sheenScrollShift: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  pulseIconWell: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: onPrimary.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#0B1B3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  pulseText: { flex: 1, minWidth: 0 },
  pulseEyebrow: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: onPrimary.subtitle,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  pulseTitle: {
    fontSize: typography.fontSize.xl,
    lineHeight: typography.lineHeight.xl,
    fontWeight: typography.fontWeight.bold,
    color: onPrimary.title,
    marginTop: 2,
  },
  pulseDesc: {
    fontSize: typography.fontSize.sm,
    color: onPrimary.subtitle,
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },

  // Empty / illustration
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  illustrationPlaceholder: {
    width: 200,
    height: 160,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  illustrationText: {
    color: colors.light.textMuted,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    lineHeight: typography.lineHeight.xs,
  },
  linkBtn: {
    color: colors.light.accent,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    paddingVertical: spacing.sm,
  },

  // Inset (empty state cards)
  glassInset: {
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.05)',
  },

  // Tasks
  taskRow: { marginBottom: spacing.md },
  taskRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  taskAccent: {
    width: 8,
    height: 36,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
  taskText: { flex: 1, minWidth: 0 },
  taskTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.text,
  },
  taskMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    marginTop: 2,
    fontWeight: typography.fontWeight.medium,
  },
  taskMetaOverdue: { color: colors.light.danger },
  taskEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  taskEmptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.light.textMuted,
  },
  moreLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Skeleton
  skelHero: { marginBottom: spacing.xl },
  skelSectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  skelRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  skelTimeCol: {
    width: 60,
    alignItems: 'center',
    gap: spacing.sm,
  },
});
