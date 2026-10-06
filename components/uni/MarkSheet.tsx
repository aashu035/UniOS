import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AttStatus } from '../../domains/academic/logic';
import { Icon, type IconName } from './Icon';
import { T, Tap } from './primitives';
import { tint, useUni } from './theme';

/** The four choices. Holiday and cancelled are both "Off"; the reason chip tells them apart. */
type Choice = 'present' | 'exempt' | 'absent' | 'off';

const OPTIONS: Array<{ k: Choice; icon: IconName; label: string; hint: string; reasons: string[] }> = [
  { k: 'present', icon: 'check', label: 'Present', hint: 'You attended this class.', reasons: [] },
  { k: 'exempt', icon: 'briefcase-medical', label: 'On leave', hint: 'Medical or duty. Counts as absent until the department approves it.', reasons: ['Medical', 'Duty'] },
  { k: 'absent', icon: 'x', label: 'Absent', hint: 'You missed this class.', reasons: [] },
  { k: 'off', icon: 'circle-slash', label: 'Off · class not held', hint: 'Cancelled, holiday or event. Not counted either way.', reasons: ['Cancelled', 'Holiday', 'Event'] },
];

const choiceOf = (s: AttStatus | null | undefined): Choice | null =>
  s === 'cancelled' || s === 'holiday' ? 'off' : s === 'present' || s === 'exempt' || s === 'absent' ? s : null;
const LABEL: Record<Choice, string> = { present: 'Present', exempt: 'On leave', absent: 'Absent', off: 'Off' };
export const LEAVE_COLOR = '#0891B2';

/** What a choice + reason is stored as. */
export function toStatus(c: Choice, reason: string | null): AttStatus {
  if (c === 'off') return reason === 'Holiday' ? 'holiday' : 'cancelled';
  return c;
}

/**
 * Bottom sheet for marking one class (Claude Design "Attend." sheet). Pick an
 * option, see the percentage it leads to, add a reason for leave or Off, then
 * Save. Replaces Alert.alert, which Android caps at three buttons.
 */
export function MarkSheet({ visible, title, subtitle, current, currentNote, project, onSave, onClose }: {
  visible: boolean;
  title: string;
  subtitle?: string;
  current: AttStatus | null | undefined;
  currentNote?: string | null;
  /** Percentage the course would be at with this status for the class; null when unknown. */
  project?: (status: AttStatus) => number | null;
  /** `null` status removes the mark. */
  onSave: (status: AttStatus | null, note: string | null) => void;
  onClose: () => void;
}) {
  const p = useUni();
  const insets = useSafeAreaInsets();
  const cur = choiceOf(current);
  const curReason = current === 'holiday' ? 'Holiday' : cur === 'off' || cur === 'exempt' ? (currentNote && !/^was:/.test(currentNote) ? currentNote : null) : null;
  const [sel, setSel] = useState<Choice | null>(cur);
  const [reason, setReason] = useState<string | null>(curReason);
  useEffect(() => { if (visible) { setSel(cur); setReason(curReason); } }, [visible, current, currentNote]);

  const color = (k: Choice) => (k === 'present' ? p.success : k === 'exempt' ? LEAVE_COLOR : k === 'absent' ? p.danger : p.off);
  const same = sel === cur && (reason ?? null) === (curReason ?? null);
  const save = () => {
    if (!sel) return;
    if (same) { onClose(); return; }
    onSave(toStatus(sel, reason), sel === 'exempt' || sel === 'off' ? reason : null);
  };
  const reasons = OPTIONS.find((o) => o.k === sel)?.reasons ?? [];

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: p.elev, paddingBottom: 18 + insets.bottom }]}>
        <View style={[styles.grip, { backgroundColor: p.border }]} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T w={800} size={18} numberOfLines={2} style={{ letterSpacing: -0.3 }}>{title}</T>
            {subtitle ? <T w={600} c={p.muted} size={12.5} style={{ marginTop: 2 }} numberOfLines={1}>{subtitle}</T> : null}
          </View>
          <View style={[styles.cur, { backgroundColor: tint(cur ? color(cur) : p.warn, 14) }]}>
            <T w={800} size={11.5} c={cur ? color(cur) : p.warn}>{cur ? `Now: ${LABEL[cur]}` : 'Not marked'}</T>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          {OPTIONS.map((o) => {
            const c = color(o.k);
            const on = sel === o.k;
            const pct = project?.(toStatus(o.k, o.k === sel ? reason : null)) ?? null;
            return (
              <Tap key={o.k} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${o.label}${pct !== null ? `, you'd be at ${pct}%` : ''}`}
                onPress={() => { setSel(o.k); setReason(o.k === cur ? curReason : o.reasons[0] ?? null); }}
                pressedStyle={{ opacity: 0.85 }}
                style={[styles.option, { borderColor: on ? c : p.hair, backgroundColor: on ? tint(c, 7) : p.elev }]}>
                <View style={[styles.well, { backgroundColor: tint(c, 14) }]}><Icon name={o.icon} size={17} color={c} width={2.4} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T w={800} size={14.5}>{o.label}</T>
                  <T c={p.muted} size={12} style={{ lineHeight: 16, marginTop: 1 }}>{o.hint}</T>
                </View>
                {pct !== null ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <T w={700} c={p.muted} size={10.5}>You'd be at</T>
                    <T w={800} size={14}>{pct}%</T>
                  </View>
                ) : null}
                <View style={[styles.radio, { borderColor: on ? c : p.border, borderWidth: on ? 6 : 2 }]} />
              </Tap>
            );
          })}
        </View>

        {reasons.length ? (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {reasons.map((r) => (
              <Tap key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ selected: reason === r }}
                style={[styles.reason, { backgroundColor: reason === r ? p.text : p.surface }]}>
                <T w={700} size={12.5} c={reason === r ? p.bg : p.text}>{r}</T>
              </Tap>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {cur ? (
            <Tap onPress={() => onSave(null, null)} accessibilityRole="button" style={[styles.remove, { borderColor: tint(p.danger, 35) }]}>
              <Icon name="trash-2" size={16} color={p.danger} />
              <T w={700} c={p.danger} size={14}>Remove mark</T>
            </Tap>
          ) : null}
          <Tap onPress={save} disabled={!sel} accessibilityRole="button" style={[styles.save, { backgroundColor: p.primary, opacity: sel ? 1 : 0.45 }]}>
            <T w={700} c="#fff" size={15}>{!sel ? 'Pick an option' : same ? 'Done' : 'Save'}</T>
          </Tap>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, paddingTop: 10, gap: 14 },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  cur: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5 },
  well: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10 },
  reason: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10 },
  remove: { height: 52, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 6 },
  save: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
