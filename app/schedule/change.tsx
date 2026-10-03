import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, courseIcon } from '../../components/uni/Icon';
import { Card, Chip, Empty, ListCard, Pill, RoundButton, Segmented, T, Tap, Well } from '../../components/uni/primitives';
import { sans, tint, useUni } from '../../components/uni/theme';
import { ScheduleExceptionRepository, parseRecurringOccurrence } from '../../domains/calendar/exceptions';
import { NotificationService } from '../../domains/notification/service';
import { addDays, clock, dayDate, minutesOf } from '../../domains/academic/logic';
import { loadSnapshot, type Occ } from '../../domains/academic/snapshot';

type Action = 'cancel' | 'move';
const pad = (n: number) => String(n).padStart(2, '0');
const toHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const STARTS = Array.from({ length: 23 }, (_, i) => 7 * 60 + i * 30); // 7:00 AM to 6:00 PM

export default function TemporaryChange() {
  const p = useUni();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ occ?: string }>();
  const [list, setList] = useState<Occ[] | null>(null);
  const [today, setToday] = useState('');
  const [selId, setSelId] = useState<string | null>(params.occ ?? null);
  const [action, setAction] = useState<Action>('cancel');
  const [start, setStart] = useState<number | null>(null);
  const [venue, setVenue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSnapshot().then((s) => {
      setToday(s.today);
      setList(s.occurrences.filter((o) => o.date >= s.today && o.date <= addDays(s.today, 13) && parseRecurringOccurrence(o.id)));
    }).catch((e) => Alert.alert('Could not load the timetable', e?.message ?? String(e)));
  }, []);

  const sel = useMemo(() => list?.find((o) => o.id === selId) ?? null, [list, selId]);
  useEffect(() => {
    if (!sel) return;
    setAction(sel.exceptionAction === 'move' ? 'move' : 'cancel');
    setStart(minutesOf(sel.startTime));
    setVenue(sel.venueName ?? '');
  }, [sel?.id]);

  const save = async () => {
    if (!sel) return;
    const ref = parseRecurringOccurrence(sel.id)!;
    setSaving(true);
    try {
      if (action === 'cancel') {
        await ScheduleExceptionRepository.cancel(ref.recurringScheduleId, ref.date);
      } else {
        const len = minutesOf((sel.original ?? sel).endTime) - minutesOf((sel.original ?? sel).startTime);
        await ScheduleExceptionRepository.move(ref.recurringScheduleId, ref.date, toHHMM(start!), toHHMM(start! + len), venue);
      }
      NotificationService.scheduleException(sel.workspaceId, sel.componentType, sel.date, action === 'cancel' ? 'cancel' : 'reschedule').catch(() => {});
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save the change', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    if (!sel) return;
    const ref = parseRecurringOccurrence(sel.id)!;
    try {
      await ScheduleExceptionRepository.restore(ref.recurringScheduleId, ref.date);
      router.back();
    } catch (e: any) {
      Alert.alert('Could not restore the class', e?.message ?? 'Please try again.');
    }
  };

  const changed = sel && (sel.cancelled || sel.exceptionAction === 'move');
  const days = list ? [...new Set(list.map((o) => o.date))] : [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 14 }}>
      <View style={styles.top}>
        <RoundButton icon={sel && !params.occ ? 'chevron-left' : 'x'} label={sel && !params.occ ? 'Pick another class' : 'Close'}
          onPress={() => (sel && !params.occ ? setSelId(null) : router.back())} />
        <View style={{ flex: 1 }}>
          <T w={800} size={24} style={{ letterSpacing: -0.6 }}>Temporary change</T>
          <T c={p.muted} size={13}>{sel ? 'Only this day changes. The usual slot stays.' : 'Which class is changing?'}</T>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 12 }} keyboardShouldPersistTaps="handled">
        {list && !list.length ? <Empty icon="calendar-days" title="No classes in the next two weeks" body="Add weekly slots to a course first." /> : null}

        {!sel && days.map((d) => (
          <View key={d} style={{ gap: 8 }}>
            <T w={800} c={p.muted} size={12} style={{ letterSpacing: 0.8, marginHorizontal: 4 }}>{(d === today ? 'TODAY' : d === addDays(today, 1) ? 'TOMORROW' : dayDate(d)).toUpperCase()}</T>
            <ListCard>
              {list!.filter((o) => o.date === d).map((o) => (
                <Tap key={o.id} onPress={() => setSelId(o.id)} style={styles.row}>
                  <Well icon={courseIcon(o.workspaceIcon, o.workspaceName)} color={o.workspaceColor} bg={tint(o.workspaceColor)} size={34} radius={10} iconSize={16} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T w={700} size={14} numberOfLines={1} style={o.cancelled ? { textDecorationLine: 'line-through' } : undefined}>{o.workspaceName}{o.componentType === 'lab' ? ' Lab' : ''}</T>
                    <T c={p.muted} size={12}>{clock(o.startTime)} – {clock(o.endTime)}{o.venueName ? ` · ${o.venueName}` : ''}</T>
                  </View>
                  {o.cancelled ? <Chip label="OFF" color={p.off} bg={p.surface} /> : o.exceptionAction === 'move' ? <Chip label="MOVED" color={p.warn} bg={tint(p.warn, 18)} /> : null}
                </Tap>
              ))}
            </ListCard>
          </View>
        ))}

        {sel ? (
          <>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Well icon={courseIcon(sel.workspaceIcon, sel.workspaceName)} color={sel.workspaceColor} bg={tint(sel.workspaceColor)} size={40} radius={12} iconSize={19} />
              <View style={{ flex: 1 }}>
                <T w={800} size={16} numberOfLines={1}>{sel.workspaceName}</T>
                <T c={p.muted} size={12.5}>{dayDate(sel.date)} · usually {clock((sel.original ?? sel).startTime)}{sel.cancelled ? ' · cancelled' : sel.original ? ` · now ${clock(sel.startTime)}` : ''}</T>
              </View>
            </Card>

            <Segmented<Action> items={[['cancel', 'Cancel this day'], ['move', 'Move it']]} value={action} onChange={setAction} />

            {action === 'cancel' ? (
              <Card flat style={{ flexDirection: 'row', gap: 10, backgroundColor: p.surface }}>
                <Icon name="info" size={16} color={p.muted} />
                <T c={p.muted} size={13} style={{ flex: 1, lineHeight: 18 }}>A cancelled class disappears from that day and doesn't count toward attendance.</T>
              </Card>
            ) : (
              <>
                <T w={700} size={13} style={{ marginTop: 4 }}>New start time</T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {STARTS.map((m) => (
                    <Pill key={m} label={clock(toHHMM(m), true)} onPress={() => setStart(m)} bg={start === m ? p.primary : p.elev} fg={start === m ? '#fff' : p.text} border={start === m ? undefined : p.hair} />
                  ))}
                </ScrollView>
                <T w={700} size={13} style={{ marginTop: 4 }}>Room</T>
                <TextInput value={venue} onChangeText={setVenue} placeholder="Same room" placeholderTextColor={p.muted}
                  style={[styles.input, sans(600), { backgroundColor: p.elev, borderColor: p.hair, color: p.text }]} accessibilityLabel="Room for this day" />
              </>
            )}

            <Tap onPress={save} disabled={saving || (action === 'move' && start === null)} accessibilityRole="button"
              style={[styles.cta, { backgroundColor: p.primary, opacity: saving ? 0.6 : 1 }]}>
              <T w={700} c="#fff" size={16}>{saving ? 'Saving…' : action === 'cancel' ? 'Cancel for this day' : 'Move for this day'}</T>
            </Tap>
            {changed ? (
              <Tap onPress={restore} style={[styles.cta, { backgroundColor: p.surface, marginTop: 0 }]}>
                <T w={700} size={15}>Restore the usual slot</T>
              </Tap>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  input: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 14.5 },
  cta: { height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
