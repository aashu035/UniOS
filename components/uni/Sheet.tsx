import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { T, Tap } from './primitives';
import { useUni } from './theme';

export type SheetRow = { icon: IconName; label: string; onPress: () => void; danger?: boolean; sub?: string };
export type SheetButton = { label: string; onPress: () => void; tone?: 'plain' | 'primary' | 'danger' };

/**
 * Bottom sheet from the design: grip, optional title and text, then either a list of
 * rows (actions) or at most two buttons. Use it instead of Alert.alert, which Android
 * caps at three buttons.
 */
export function Sheet({ visible, onClose, title, text, rows, buttons, children }: {
  visible: boolean; onClose: () => void; title?: string; text?: string;
  rows?: SheetRow[]; buttons?: [SheetButton] | [SheetButton, SheetButton]; children?: React.ReactNode;
}) {
  const p = useUni();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: p.elev, paddingBottom: 18 + insets.bottom }]}>
        <View style={[styles.grip, { backgroundColor: p.border }]} />
        {title ? (
          <View style={{ paddingHorizontal: 6 }}>
            <T w={800} size={18} style={{ letterSpacing: -0.3 }}>{title}</T>
            {text ? <T c={p.muted} size={13} style={{ lineHeight: 19, marginTop: 4 }}>{text}</T> : null}
          </View>
        ) : null}
        {children ? <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">{children}</ScrollView> : null}
        {rows?.length ? (
          <View style={{ gap: 2 }}>
            {rows.map((r) => (
              <Tap key={r.label} onPress={r.onPress} accessibilityRole="button" pressedStyle={{ backgroundColor: p.surface }}
                style={{ minHeight: 54, paddingHorizontal: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Icon name={r.icon} size={19} color={r.danger ? p.danger : p.text} />
                <View style={{ flex: 1 }}>
                  <T w={700} size={15} c={r.danger ? p.danger : p.text}>{r.label}</T>
                  {r.sub ? <T w={600} c={p.muted} size={12}>{r.sub}</T> : null}
                </View>
              </Tap>
            ))}
          </View>
        ) : null}
        {buttons?.length ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {buttons.map((b) => {
              const bg = b.tone === 'danger' ? p.danger : b.tone === 'primary' ? p.primary : p.surface;
              return (
                <Tap key={b.label} onPress={b.onPress} accessibilityRole="button"
                  style={{ flex: 1, height: 50, borderRadius: 15, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                  <T w={700} size={14} c={b.tone === 'danger' || b.tone === 'primary' ? '#fff' : p.text}>{b.label}</T>
                </Tap>
              );
            })}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingHorizontal: 16, gap: 12 },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
});
