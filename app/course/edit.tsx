import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/uni/Icon';
import { RoundButton, T, Tap } from '../../components/uni/primitives';
import { sans, tint, useUni } from '../../components/uni/theme';
import { getLocalDateString } from '../../core/utils/date';
import { useAcademic } from '../../domains/academic/hooks';
import { verdict } from '../../domains/academic/logic';
import { CourseOverviewService, type CourseOverview } from '../../domains/workspace/CourseOverviewService';
import { WorkspaceRepository } from '../../domains/workspace/repository';

const CREDITS = [1, 2, 3, 4, 5, 6];
const TARGETS = [60, 65, 70, 75, 80, 85];
const TYPE_LABEL: Record<string, string> = { theory: 'Theory', lab: 'Lab', tutorial: 'Tutorial' };

type Draft = { name: string; code: string; credits: number | null; target: number; faculty: string; room: string; notes: string };

/** Edit course (Claude Design "Edit course"): credits and target up front, no hidden defaults. */
export default function EditCourse() {
  const p = useUni();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const courseId = Number(id);
  const { data } = useAcademic();
  const [detail, setDetail] = useState<CourseOverview | null | undefined>(undefined);
  const [orig, setOrig] = useState<Draft | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [delArmed, setDelArmed] = useState(false);

  useEffect(() => {
    CourseOverviewService.getCourseDetail(courseId).then((x) => {
      setDetail(x);
      if (!x) return;
      const main = x.components.find((c) => c.type === 'theory') ?? x.components[0];
      const draft: Draft = {
        name: x.course.name, code: x.course.code ?? '', credits: x.course.credits ?? null, target: x.course.targetAttendance ?? 75,
        faculty: main?.activeFaculty?.name ?? '', room: main?.activeVenue?.name ?? '', notes: x.course.notes ?? '',
      };
      setOrig(draft);
      setD(draft);
    }).catch(() => setDetail(null));
  }, [courseId]);

  const header = (right?: React.ReactNode) => (
    <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
      <RoundButton icon="chevron-left" label="Back" onPress={() => router.back()} />
      <T w={800} size={20} style={{ flex: 1, letterSpacing: -0.4 }}>Edit course</T>
      {right}
    </View>
  );
  if (detail === undefined || (detail && !d)) return <View style={{ flex: 1, backgroundColor: p.bg }}>{header()}</View>;
  if (!detail || !d || !orig) {
    return <View style={{ flex: 1, backgroundColor: p.bg }}>{header()}<T c={p.muted} style={{ padding: 20 }}>Course not found.</T></View>;
  }

  const dirty = JSON.stringify(d) !== JSON.stringify(orig);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => (x ? { ...x, [k]: v } : x));
  const course = data?.courseById.get(courseId);
  const v = course ? verdict(course.att.attended, course.att.total, d.target) : null;
  const vText = !course || course.att.pct === null ? 'Mark a few classes to see where you stand.'
    : v!.need > 0 ? `You're at ${course.att.pct}%. ${v!.text} to reach ${d.target}%.`
    : v!.skip > 0 ? `You're at ${course.att.pct}%. You can skip ${v!.skip} and stay above ${d.target}%.`
    : `You're at ${course.att.pct}%, right on the line for ${d.target}%.`;
  const vColor = !v ? p.muted : v.tone === 'danger' ? p.danger : v.tone === 'warn' ? p.warn : p.success;

  const save = async () => {
    if (!dirty || saving) { if (!dirty) router.back(); return; }
    const name = d.name.trim();
    if (!name || name.length > 100) { Alert.alert('Course name', 'Give the course a name (up to 100 characters).'); return; }
    if (!d.credits) { Alert.alert('Credits', 'Pick how many credits this course has.'); return; }
    setSaving(true);
    try {
      await WorkspaceRepository.updateCourseIdentity(courseId, { name, code: d.code, credits: d.credits, targetAttendance: d.target, notes: d.notes });
      // Faculty and room changes apply from today, so older classes keep who taught them and where.
      const today = getLocalDateString(new Date());
      for (const comp of detail.components) {
        if (d.faculty.trim() && d.faculty.trim() !== orig.faculty) await WorkspaceRepository.changeHistoricalFaculty(comp.id, d.faculty.trim(), today);
        if (d.room.trim() && d.room.trim() !== orig.room) await WorkspaceRepository.changeHistoricalVenue(comp.id, d.room.trim(), today);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!delArmed) { setDelArmed(true); return; }
    try {
      await WorkspaceRepository.deleteWorkspace(courseId);
      router.replace('/(main)/today');
    } catch (e: any) {
      Alert.alert('Could not delete', e?.message ?? 'Please try again.');
    }
  };

  const chips = (values: number[], on: number | null, pick: (n: number) => void, label: string) => (
    <View style={styles.chips}>
      {values.map((n) => (
        <Tap key={n} onPress={() => pick(n)} accessibilityRole="radio" accessibilityState={{ selected: on === n }} accessibilityLabel={`${n} ${label}`}
          style={[styles.chip, { backgroundColor: on === n ? p.primary : p.surface }]}>
          <T w={800} size={15} c={on === n ? '#fff' : p.text}>{n}</T>
        </Tap>
      ))}
    </View>
  );
  const field = (label: string, value: string, onChange: (t: string) => void, extra?: object) => (
    <View style={{ gap: 6 }}>
      <T w={700} c={p.muted} size={12}>{label}</T>
      <TextInput value={value} onChangeText={onChange} placeholderTextColor={p.muted} accessibilityLabel={label}
        style={[styles.input, sans(600), { backgroundColor: p.surface, borderColor: p.border, color: p.text }, extra]} />
    </View>
  );
  const section = (title: string) => <T w={800} c={p.muted} size={11.5} style={{ letterSpacing: 0.8, marginTop: 8, marginHorizontal: 4 }}>{title}</T>;
  const card = { backgroundColor: p.elev, borderColor: p.hair };
  const parts = detail.components.map((c) => TYPE_LABEL[c.type] ?? c.type).join(' + ');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header(
        <Tap onPress={save} accessibilityRole="button" style={[styles.save, { backgroundColor: dirty ? p.primary : p.surface }]}>
          <T w={800} size={14} c={dirty ? '#fff' : p.muted}>{saving ? 'Saving…' : 'Save'}</T>
        </Tap>,
      )}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 48 + insets.bottom, gap: 10 }} keyboardShouldPersistTaps="handled">
        {section('COURSE')}
        <View style={[styles.card, card]}>
          {field('Name', d.name, (t) => set('name', t))}
          {field('Course code', d.code, (t) => set('code', t.toUpperCase()))}
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T w={700} c={p.muted} size={12}>Credits</T>
              {!d.credits ? <T w={700} c={p.warn} size={12}>Required</T> : null}
            </View>
            {chips(CREDITS, d.credits, (n) => set('credits', n), 'credits')}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <T w={700} c={p.muted} size={12}>Parts</T>
            <T w={700} size={13}>{parts || 'Theory'}</T>
          </View>
        </View>

        {section('ATTENDANCE TARGET (%)')}
        <View style={[styles.card, card]}>
          {chips(TARGETS, d.target, (n) => set('target', n), 'percent')}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="target" size={15} color={vColor} />
            <T w={700} size={13} c={vColor} style={{ flex: 1 }}>{vText}</T>
          </View>
          <T c={p.muted} size={12} style={{ lineHeight: 17 }}>DCRUST requires 75% of all classes held in a subject. Pick a higher target if you want a safety margin.</T>
        </View>

        {section('CLASS DETAILS')}
        <View style={[styles.card, card]}>
          {field('Faculty', d.faculty, (t) => set('faculty', t))}
          {field('Room', d.room, (t) => set('room', t))}
          <View style={{ gap: 6 }}>
            <T w={700} c={p.muted} size={12}>Notes</T>
            <TextInput value={d.notes} onChangeText={(t) => set('notes', t)} multiline textAlignVertical="top" placeholder="Anything to remember about this course"
              placeholderTextColor={p.muted} accessibilityLabel="Notes"
              style={[styles.input, sans(500), { height: 84, paddingTop: 10, backgroundColor: p.surface, borderColor: p.border, color: p.text }]} />
          </View>
          <T c={p.muted} size={12} style={{ lineHeight: 17 }}>Faculty and room changes apply from today; older classes keep their details.</T>
        </View>

        <View style={[styles.card, { marginTop: 10, backgroundColor: tint(p.danger, 6), borderColor: tint(p.danger, 25) }]}>
          <T w={800} size={14} c={p.danger}>Delete course</T>
          <T c={p.muted} size={12.5} style={{ lineHeight: 17 }}>Removes its timetable, attendance records, tasks and files from this phone. This can't be undone.</T>
          <Tap onPress={del} accessibilityRole="button" style={[styles.del, { borderColor: p.danger, backgroundColor: delArmed ? p.danger : 'transparent' }]}>
            <T w={700} size={14} c={delArmed ? '#fff' : p.danger}>{delArmed ? 'Tap again to delete for good' : 'Delete course'}</T>
          </Tap>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 10 },
  save: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 },
  card: { padding: 14, borderRadius: 20, borderWidth: 1, gap: 14 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  input: { height: 46, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, fontSize: 15 },
  del: { height: 46, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
