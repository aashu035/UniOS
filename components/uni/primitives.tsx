import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PressableProps, StyleProp, TextProps, TextStyle, ViewStyle } from 'react-native';
import Animated, { FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { sans, shadow, TAB_CLEARANCE, useUni, type UniPalette } from './theme';

const EASE = Easing.bezier(0.2, 0.9, 0.25, 1);

/** Text in the design font. `w` is the weight, `c` the colour (defaults to text). */
export function T({ w = 400, c, size, style, ...rest }: TextProps & { w?: 400 | 500 | 600 | 700 | 800; c?: string; size?: number }) {
  const p = useUni();
  return <Text {...rest} style={[sans(w), { color: c ?? p.text }, size ? { fontSize: size } : null, style]} />;
}

/** Entrance motion from uni.js `[data-rise]`: fade up, staggered by index. Honours the system reduce-motion setting. */
export function Rise({ i = 0, style, children }: { i?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(120 + i * 70).duration(560).easing(EASE)} style={style}>
      {children}
    </Animated.View>
  );
}

export function Card({ style, children, onPress, flat }: { style?: StyleProp<ViewStyle>; children: React.ReactNode; onPress?: () => void; flat?: boolean }) {
  const p = useUni();
  const base = [styles.card, { backgroundColor: p.elev, borderColor: p.hair }, !flat && shadow(p), style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export function Tap({ style, ...rest }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  return <Pressable {...rest} style={({ pressed }) => [style, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]} />;
}

export function RoundButton({ icon, onPress, size = 42, label, badge }: { icon: IconName; onPress?: () => void; size?: number; label: string; badge?: number }) {
  const p = useUni();
  return (
    <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size > 40 ? 19 : 18} color={p.text} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: p.danger, borderColor: p.bg }]}>
          <T w={700} c="#fff" size={10}>{badge > 9 ? '9+' : badge}</T>
        </View>
      ) : null}
    </Tap>
  );
}

/** A square icon tile, tinted with the given colour (`.well` in the design). */
export function Well({ icon, color, bg, size = 36, radius = 11, iconSize = 17, fg }: { icon: IconName; color: string; bg: string; size?: number; radius?: number; iconSize?: number; fg?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={iconSize} color={fg ?? color} />
    </View>
  );
}

/** Scroll container for a tab screen: clears the status bar and the floating tab bar. */
export function Screen({ children, tabs = true, refreshControl, scrollRef }: { children: React.ReactNode; tabs?: boolean; refreshControl?: React.ReactElement<any>; scrollRef?: React.Ref<ScrollView> }) {
  const p = useUni();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: p.bg }} refreshControl={refreshControl as any}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: tabs ? TAB_CLEARANCE : insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export function LargeTitle({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  const p = useUni();
  return (
    <Rise i={0} style={styles.titleRow}>
      <View style={{ flex: 1 }}>
        <T w={600} c={p.muted} size={13}>{eyebrow}</T>
        <T w={800} size={32} style={{ letterSpacing: -1, marginTop: 2, lineHeight: 38 }}>{title}</T>
      </View>
      {right ? <View style={{ flexDirection: 'row', gap: 8 }}>{right}</View> : null}
    </Rise>
  );
}

export function SectionTitle({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  const p = useUni();
  return (
    <View style={[styles.sectionRow, style]}>
      <T w={800} size={17} style={{ letterSpacing: -0.3 }}>{title}</T>
      {action ? (
        <Tap onPress={onAction} hitSlop={8}><T w={600} c={onAction ? p.primary : p.muted} size={12.5}>{action}</T></Tap>
      ) : null}
    </View>
  );
}

export function Eyebrow({ children, color, style }: { children: React.ReactNode; color: string; style?: StyleProp<TextStyle> }) {
  return <T w={800} c={color} size={11.5} style={[{ letterSpacing: 0.8, textTransform: 'uppercase' }, style]}>{children}</T>;
}

export function Pill({ label, bg, fg, onPress, border }: { label: string; bg: string; fg: string; onPress?: () => void; border?: string }) {
  const body = (
    <View style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, backgroundColor: bg, borderWidth: border ? 1 : 0, borderColor: border }}>
      <T w={700} c={fg} size={13}>{label}</T>
    </View>
  );
  return onPress ? <Tap onPress={onPress}>{body}</Tap> : body;
}

export function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, backgroundColor: bg, alignSelf: 'flex-start' }}>
      <T w={800} c={color} size={10.5} style={{ letterSpacing: 0.3 }}>{label}</T>
    </View>
  );
}

export function Legend({ items }: { items: Array<[string, string]> }) {
  const p = useUni();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {items.map(([label, color]) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
          <T w={600} c={p.muted} size={12}>{label}</T>
        </View>
      ))}
    </View>
  );
}

/** Bar that grows from its start edge on mount (`[data-grow]`). `pct` is 0–100 of the track. */
export function GrowBar({ pct, color, height = 6, track, d = 0, radius }: { pct: number; color: string; height?: number; track: string; d?: number; radius?: number }) {
  const s = useSharedValue(0);
  useEffect(() => { s.value = withDelay(250 + d * 60, withTiming(1, { duration: 900, easing: EASE })); }, [pct]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleX: s.value }] }));
  const r = radius ?? height / 2;
  return (
    <View style={{ height, borderRadius: r, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%' }}>
        <Animated.View style={[{ flex: 1, borderRadius: r, backgroundColor: color, transformOrigin: 'left' }, a]} />
      </View>
    </View>
  );
}

/** Column that grows upward on mount. */
export function GrowColumn({ height, color, d = 0, radius = 5, style }: { height: number; color: string; d?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(0);
  useEffect(() => { s.value = withDelay(250 + d * 60, withTiming(1, { duration: 900, easing: EASE })); }, [height]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleY: s.value }] }));
  return <Animated.View style={[{ height, borderRadius: radius, backgroundColor: color, transformOrigin: 'bottom' }, a, style]} />;
}

const ACircle = Animated.createAnimatedComponent(Circle);

/**
 * Progress ring (`[data-ring]`). Draws clockwise from 12 o'clock and animates in.
 * `marker` puts a tick at a target percentage (the design's 75% line).
 */
export function Ring({ size, stroke, pct, color, track, marker, markerColor, children }: {
  size: number; stroke: number; pct: number; color: string; track: string; marker?: number; markerColor?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2 - 1;
  const C = 2 * Math.PI * r;
  const v = useSharedValue(0);
  useEffect(() => { v.value = withDelay(300, withTiming(Math.max(0, Math.min(100, pct)), { duration: 1300, easing: EASE })); }, [pct]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - v.value / 100) }));
  const c = size / 2;
  let tick: React.ReactNode = null;
  if (marker !== undefined) {
    const a = (marker / 100) * Math.PI * 2 - Math.PI / 2;
    const r1 = r - stroke / 2 - 2, r2 = r + stroke / 2 + 2;
    tick = <Line x1={c + Math.cos(a) * r1} y1={c + Math.sin(a) * r1} x2={c + Math.cos(a) * r2} y2={c + Math.sin(a) * r2} stroke={markerColor} strokeWidth={3} strokeLinecap="round" />;
  }
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <ACircle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${C} ${C}`} animatedProps={props} transform={`rotate(-90 ${c} ${c})`} />
        {tick}
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  );
}

export function Segmented<K extends string>({ items, value, onChange }: { items: Array<[K, string]>; value: K; onChange: (k: K) => void }) {
  const p = useUni();
  return (
    <View style={{ flexDirection: 'row', gap: 2, padding: 4, borderRadius: 14, backgroundColor: p.surface }}>
      {items.map(([k, l]) => {
        const on = k === value;
        return (
          <Pressable key={k} onPress={() => onChange(k)} style={[{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' }, on && { backgroundColor: p.elev, ...shadow(p), shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }]}>
            <T w={700} c={on ? p.text : p.muted} size={12.5}>{l}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const p = useUni();
  const x = useSharedValue(on ? 21 : 3);
  useEffect(() => { x.value = withTiming(on ? 21 : 3, { duration: 200 }); }, [on]);
  const knob = useAnimatedStyle(() => ({ left: x.value }));
  return (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label}
      style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: on ? p.success : p.border }}>
      <Animated.View style={[{ position: 'absolute', top: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', ...shadow(p) }, knob]} />
    </Pressable>
  );
}

/** Rows inside one card, separated by hairlines. */
export function ListCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = useUni();
  const kids = React.Children.toArray(children).filter(Boolean);
  return (
    <Card style={[{ padding: 0, overflow: 'hidden' }, style]}>
      {kids.map((k, i) => (
        <View key={i} style={i < kids.length - 1 ? { borderBottomWidth: 1, borderBottomColor: p.hair } : undefined}>{k}</View>
      ))}
    </Card>
  );
}

export function Empty({ icon, title, body, action, onAction }: { icon: IconName; title: string; body: string; action?: string; onAction?: () => void }) {
  const p = useUni();
  return (
    <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 22 }}>
      <Well icon={icon} color={p.muted} bg={p.surface} size={44} radius={14} iconSize={20} />
      <T w={700} size={15}>{title}</T>
      <T c={p.muted} size={13} style={{ textAlign: 'center', lineHeight: 18 }}>{body}</T>
      {action ? <Pill label={action} bg={p.primarySoft} fg={p.primary} onPress={onAction} /> : null}
    </Card>
  );
}

export function usePalette(): UniPalette { return useUni(); }

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 14 },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },
});
