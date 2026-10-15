import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { T, Tap } from './primitives';
import { sans, shadow, useUni } from './theme';

/**
 * Form pieces shared by the full-screen pages of the redesign (task, profile,
 * semester, onboarding, AI scan): 44 dp touch targets, 54 dp primary button.
 */

/** Page with a top bar (close/back + title), a scrolling body and an optional sticky footer. */
export function FormPage({ title, onBack, backIcon = 'x', right, children, footer, gap = 20 }: {
  title: string; onBack: () => void; backIcon?: IconName; right?: React.ReactNode;
  children: React.ReactNode; footer?: React.ReactNode; gap?: number;
}) {
  const p = useUni();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <IconButton icon={backIcon} label={backIcon === 'x' ? 'Close' : 'Back'} onPress={onBack} />
        <T w={800} size={22} numberOfLines={2} style={{ flex: 1, letterSpacing: -0.6 }}>{title}</T>
        {right}
      </View>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: footer ? 24 : insets.bottom + 32, gap }}>
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { borderTopColor: p.hair, backgroundColor: p.bg, paddingBottom: insets.bottom + 14 }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** 44 dp round icon button on the elevated surface. */
export function IconButton({ icon, label, onPress, size = 44, color }: { icon: IconName; label: string; onPress?: () => void; size?: number; color?: string }) {
  const p = useUni();
  return (
    <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={color ?? p.text} />
    </Tap>
  );
}

/** "TASK NAME": the small caps label above a field. */
export function FieldLabel({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  const p = useUni();
  return <T w={800} c={p.muted} size={11.5} style={[{ letterSpacing: 0.8 }, style as any]}>{children.toUpperCase()}</T>;
}

export function Field({ label, children, error, hint, right }: { label?: string; children: React.ReactNode; error?: string | null; hint?: string; right?: React.ReactNode }) {
  const p = useUni();
  return (
    <View style={{ gap: 6 }}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      {children}
      {error || hint || right ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, minHeight: 16 }}>
          {error ? <ErrorText>{error}</ErrorText> : hint ? <T w={600} c={p.muted} size={12} style={{ flex: 1, lineHeight: 16 }}>{hint}</T> : <View style={{ flex: 1 }} />}
          {right}
        </View>
      ) : null}
    </View>
  );
}

export function ErrorText({ children }: { children: string }) {
  const p = useUni();
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'flex-start' }} accessibilityLiveRegion="polite">
      <View style={{ marginTop: 1 }}><Icon name="circle-alert" size={13} color={p.danger} /></View>
      <T w={700} c={p.danger} size={12} style={{ flex: 1, lineHeight: 16 }}>{children}</T>
    </View>
  );
}

/** A text box in the design style. `big` is the 16 px bold title field. */
export function Input({ invalid, big, multiline, style, ...rest }: TextInputProps & { invalid?: boolean; big?: boolean }) {
  const p = useUni();
  const [focus, setFocus] = useState(false);
  return (
    <TextInput placeholderTextColor={p.muted} multiline={multiline}
      onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }} onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
      {...rest}
      style={[
        big ? sans(700) : sans(500),
        {
          minHeight: big ? 56 : 48, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: big ? 14 : 12,
          fontSize: big ? 16 : 14.5, lineHeight: big ? 22 : 21, color: p.text, backgroundColor: p.elev,
          borderColor: invalid ? p.danger : focus ? p.primary : p.border, textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]} />
  );
}

/** A choice chip (44 dp). Selected chips are inverted, as in the design. */
export function Choice({ label, icon, dot, selected, onPress, sub, disabled, minWidth }: {
  label: string; icon?: IconName; dot?: string; selected?: boolean; onPress?: () => void; sub?: string; disabled?: boolean; minWidth?: number;
}) {
  const p = useUni();
  const fg = selected ? p.bg : p.text;
  return (
    <Tap onPress={disabled ? undefined : onPress} disabled={disabled} accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }} accessibilityLabel={sub ? `${label}, ${sub}` : label}
      style={[styles.choice, { minWidth, backgroundColor: selected ? p.text : p.elev, borderColor: p.hair, opacity: disabled ? 0.5 : 1, paddingVertical: sub ? 6 : 0 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        {dot ? <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: dot }} /> : null}
        {icon ? <Icon name={icon} size={15} color={fg} /> : null}
        <T w={800} c={fg} size={13.5}>{label}</T>
      </View>
      {sub ? <T w={700} c={fg} size={11} style={{ opacity: 0.75 }}>{sub}</T> : null}
    </Tap>
  );
}

export function ChoiceRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>;
}

/** Three-way switch on the surface colour (Priority, Odd/Even). */
export function Switch3<K extends string>({ items, value, onChange }: { items: ReadonlyArray<[K, string, string?]>; value: K; onChange: (k: K) => void }) {
  const p = useUni();
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 15, backgroundColor: p.surface }} accessibilityRole="radiogroup">
      {items.map(([k, l, dot]) => {
        const on = k === value;
        return (
          <Tap key={k} onPress={() => onChange(k)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={[{ flex: 1, height: 44, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, on && { backgroundColor: p.elev, ...shadow(p) }]}>
            {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} /> : null}
            <T w={800} c={on ? p.text : p.muted} size={13.5}>{l}</T>
          </Tap>
        );
      })}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, busy, tone = 'primary', icon }: {
  label: string; onPress?: () => void; disabled?: boolean; busy?: boolean; tone?: 'primary' | 'danger' | 'plain'; icon?: IconName;
}) {
  const p = useUni();
  const bg = tone === 'danger' ? p.danger : tone === 'plain' ? p.surface : p.primary;
  const fg = tone === 'plain' ? p.text : '#fff';
  return (
    <Tap onPress={disabled || busy ? undefined : onPress} disabled={disabled || busy} accessibilityRole="button" accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={[styles.primary, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }]}>
      {busy ? <ActivityIndicator color={fg} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <T w={700} c={fg} size={15}>{label}</T>
        </View>
      )}
    </Tap>
  );
}

/**
 * A destructive row that needs two taps: the first arms it ("Tap again to …"),
 * which resets after 3 s, the second runs `onConfirm`.
 */
export function TwoTapDelete({ label, armedLabel, onConfirm, icon = 'trash-2' }: { label: string; armedLabel: string; onConfirm: () => void; icon?: IconName }) {
  const p = useUni();
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const press = () => {
    if (armed) { if (timer.current) clearTimeout(timer.current); setArmed(false); onConfirm(); return; }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 3000);
  };
  return (
    <Tap onPress={press} accessibilityRole="button" accessibilityLabel={armed ? armedLabel : label}
      style={[styles.danger, { backgroundColor: armed ? p.danger : 'transparent', borderColor: p.dark ? 'rgba(239,68,68,0.3)' : 'rgba(220,38,38,0.3)' }]}>
      <Icon name={icon} size={18} color={armed ? '#fff' : p.danger} />
      <T w={800} c={armed ? '#fff' : p.danger} size={14.5}>{armed ? armedLabel : label}</T>
    </Tap>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1 },
  choice: { minHeight: 44, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, justifyContent: 'center' },
  primary: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  danger: { minHeight: 56, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
