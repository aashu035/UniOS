import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AttStatus } from '../../domains/academic/logic';
import { Icon, type IconName } from './Icon';
import { T, Tap } from './primitives';
import { tint, useUni } from './theme';

type Option = { status: AttStatus; icon: IconName; label: string; hint: string; tone: 'success' | 'danger' | 'primary' | 'off' };

/** Holiday and cancelled are both "the class didn't happen"; one option covers them. */
const OPTIONS: Option[] = [
  { status: 'present', icon: 'check', label: 'Present', hint: 'Counts as attended', tone: 'success' },
  { status: 'absent', icon: 'x', label: 'Absent', hint: 'Counts against your percentage', tone: 'danger' },
  { status: 'exempt', icon: 'plane', label: 'On leave', hint: 'Duty or medical leave. Counts as attended', tone: 'primary' },
  { status: 'cancelled', icon: 'ban', label: "Class didn't happen", hint: 'Cancelled, holiday or no teacher. Not counted', tone: 'off' },
];

const same = (a: AttStatus | null | undefined, b: AttStatus) => a === b || (b === 'cancelled' && a === 'holiday');

/**
 * Bottom sheet for marking one class. Replaces Alert.alert, which Android
 * caps at three buttons (it silently dropped Off and Remove).
 * `onPick(null)` means remove the mark.
 */
export function MarkSheet({ visible, title, subtitle, current, onPick, onClose }: {
  visible: boolean;
  title: string;
  subtitle?: string;
  current: AttStatus | null | undefined;
  onPick: (status: AttStatus | null) => void;
  onClose: () => void;
}) {
  const p = useUni();
  const insets = useSafeAreaInsets();
  const color = (t: Option['tone']) => (t === 'success' ? p.success : t === 'danger' ? p.danger : t === 'primary' ? p.primary : p.off);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: p.elev, paddingBottom: 16 + insets.bottom }]}>
        <View style={[styles.grip, { backgroundColor: p.border }]} />
        <T w={800} size={17} numberOfLines={2}>{title}</T>
        <T c={p.muted} size={12.5} style={{ marginTop: 2, marginBottom: 12 }} numberOfLines={2}>
          {subtitle ? `${subtitle} · ` : ''}{current ? `Marked ${OPTIONS.find((o) => same(current, o.status))?.label.toLowerCase() ?? current}` : 'Not marked yet'}
        </T>
        {OPTIONS.map((o) => {
          const c = color(o.tone);
          const on = same(current, o.status);
          return (
            <Tap
              key={o.status}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onPick(o.status)}
              style={[styles.option, { backgroundColor: on ? tint(c, 14) : p.surface, borderColor: on ? c : 'transparent' }]}
            >
              <View style={[styles.well, { backgroundColor: tint(c, on ? 22 : 14) }]}><Icon name={o.icon} size={18} color={c} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T w={700} size={14.5}>{o.label}</T>
                <T c={p.muted} size={12} numberOfLines={2}>{o.hint}</T>
              </View>
              {on ? <Icon name="circle-check-big" size={18} color={c} /> : null}
            </Tap>
          );
        })}
        {current ? (
          <Tap accessibilityRole="button" onPress={() => onPick(null)} style={[styles.option, { backgroundColor: tint(p.danger, 8), borderColor: 'transparent' }]}>
            <View style={[styles.well, { backgroundColor: tint(p.danger, 14) }]}><Icon name="trash-2" size={18} color={p.danger} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w={700} c={p.danger} size={14.5}>Remove mark</T>
              <T c={p.muted} size={12} numberOfLines={2}>Back to unmarked. Not counted either way</T>
            </View>
          </Tap>
        ) : null}
        <Tap accessibilityRole="button" onPress={onClose} style={styles.cancel}>
          <T w={700} c={p.muted} size={14}>Cancel</T>
        </Tap>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  grip: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5 },
  well: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cancel: { alignItems: 'center', paddingVertical: 12 },
});
