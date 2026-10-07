import React, { useRef } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { T, Tap } from '../uni/primitives';
import { sans, tint, useUni } from '../uni/theme';
import { addDays, dayName, minutesOf, mondayOf, shortDate } from '../../domains/academic/logic';

/** Hours a class can start, 8 AM to 6 PM. */
export const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const pad = (n: number) => String(n).padStart(2, '0');
export const hh = (h: number) => `${pad(h)}:00`;
export const h12 = (h: number) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;

/**
 * Dates from `start`'s Monday for `weeks` weeks, Sundays left out. Opens scrolled
 * to the chosen date, else to `focus` (usually today), so it is never off-screen.
 */
export function DateStrip({ value, onChange, start, weeks = 3, dots = [], disabled, focus }: {
  value: string | null; onChange: (d: string) => void; start: string; weeks?: number; dots?: string[]; disabled?: (d: string) => boolean; focus?: string;
}) {
  const ref = useRef<ScrollView>(null);
  const p = useUni();
  const mon = mondayOf(start);
  const dates = Array.from({ length: weeks * 7 }, (_, i) => addDays(mon, i)).filter((d) => dayName(d) !== 'Sun');
  const target = dates.indexOf(value ?? focus ?? '');
  const toTarget = () => { if (target > 1) ref.current?.scrollTo({ x: (target - 1) * 58, animated: false }); };
  return (
    <ScrollView ref={ref} onContentSizeChange={toTarget} horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 20 }}>
      {dates.map((d) => {
        const on = d === value;
        const off = disabled?.(d);
        return (
          <Tap key={d} disabled={off} onPress={() => onChange(d)} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: off }} accessibilityLabel={`${dayName(d)} ${shortDate(d)}`}
            style={[styles.date, { backgroundColor: on ? p.primary : p.elev, borderColor: on ? p.primary : p.hair, opacity: off ? 0.35 : 1 }]}>
            <T w={700} size={11} c={on ? '#fff' : p.muted}>{dayName(d)}</T>
            <T w={800} size={17} c={on ? '#fff' : p.text}>{Number(d.slice(8, 10))}</T>
            <View style={[styles.dot, { backgroundColor: dots.includes(d) ? (on ? '#fff' : p.warn) : 'transparent' }]} />
          </Tap>
        );
      })}
    </ScrollView>
  );
}

export type Busy = { label: string; start: string; end: string; color?: string };

/**
 * Hour cells for one day. Hours that already have a class are grey with its name;
 * the chosen hours are blue, or red where they clash. A lab selects `len` hours.
 */
export function HourGrid({ busy, value, len, onChange, lunch = 13 }: {
  busy: Busy[]; value: number | null; len: number; onChange: (h: number) => void; lunch?: number;
}) {
  const p = useUni();
  const busyAt = (h: number) => busy.find((b) => minutesOf(b.start) < (h + 1) * 60 && h * 60 < minutesOf(b.end));
  return (
    <View style={styles.grid}>
      {HOURS.map((h) => {
        const b = busyAt(h);
        const sel = value !== null && h >= value && h < value + len;
        const clash = sel && !!b;
        const bg = clash ? p.danger : sel ? p.primary : b ? p.surface : h === lunch ? tint(p.warn, 8) : p.elev;
        return (
          <Tap key={h} onPress={() => onChange(h)} disabled={h + len - 1 > HOURS[HOURS.length - 1]} accessibilityRole="radio" accessibilityState={{ selected: sel }}
            accessibilityLabel={`${h12(h)}${b ? `, ${b.label}` : ''}`}
            style={[styles.hour, { backgroundColor: bg, borderColor: sel ? 'transparent' : p.hair }]}>
            <T w={700} size={11} c={sel ? '#fff' : p.muted}>{h12(h)}</T>
            <T w={700} size={10.5} c={sel ? '#fff' : b ? p.text : p.muted} numberOfLines={1}>{b ? b.label : h === lunch ? 'Lunch' : ''}</T>
          </Tap>
        );
      })}
    </View>
  );
}

export function Chips<K extends string>({ items, value, onChange }: { items: Array<[K, string]>; value: K | null; onChange: (k: K) => void }) {
  const p = useUni();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {items.map(([k, l]) => (
        <Tap key={k} onPress={() => onChange(k)} accessibilityRole="radio" accessibilityState={{ selected: value === k }}
          style={[styles.chip, { backgroundColor: value === k ? p.text : p.surface }]}>
          <T w={700} size={13} c={value === k ? p.bg : p.text}>{l}</T>
        </Tap>
      ))}
    </View>
  );
}

export function NoteInput({ value, onChange, placeholder }: { value: string; onChange: (t: string) => void; placeholder: string }) {
  const p = useUni();
  return (
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={p.muted} maxLength={80}
      style={[styles.input, sans(500), { backgroundColor: p.elev, borderColor: p.hair, color: p.text }]} />
  );
}

export function Label({ children }: { children: string }) {
  const p = useUni();
  return <T w={800} c={p.muted} size={11.5} style={{ letterSpacing: 0.8, marginTop: 4 }}>{children}</T>;
}

const styles = StyleSheet.create({
  date: { width: 52, paddingVertical: 8, borderRadius: 14, borderWidth: 1, alignItems: 'center', gap: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hour: { width: '23%', flexGrow: 1, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, gap: 2 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 10 },
  input: { height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 14.5 },
});
