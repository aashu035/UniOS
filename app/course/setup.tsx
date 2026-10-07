import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../components/uni/Icon';
import { Card, Pill, RoundButton, Segmented, T, Tap } from '../../components/uni/primitives';
import { mono, sans, useUni } from '../../components/uni/theme';
import { colors } from '../../tokens';
import { db } from '../../core/db/client';
import { workspaces } from '../../domains/workspace/model';
import { WorkspaceRepository } from '../../domains/workspace/repository';
import { DURATION, paint, prune, sessionsFor, slotSummary, type Part, type Slots } from '../../domains/academic/setup';
import { creditsFromHours, minutesOf } from '../../domains/academic/logic';
import { checkCourseCode, checkCourseName } from '../../core/utils/validate';

const QUESTIONS = ['What’s the course called?', 'What does it include?', 'When does it meet? Tap the slots.', 'What attendance do you want to stay above?'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Start hours shown in the grid: 8 AM to 6 PM, so classes can run until 7 PM. */
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const LAST_HOUR = 18; // the last hour a class may occupy (18:00–19:00)
const h12 = (h: number) => h % 12 || 12;
const CREDIT_OPTIONS = [1, 2, 3, 4, 5, 6];
const PART: Record<Part, { label: string; detail: string; icon: IconName; tag: string }> = {
  theory: { label: 'Theory', detail: 'Lectures, 1 hour', icon: 'book-open', tag: 'T' },
  lab: { label: 'Lab', detail: 'Practicals and lab files, 2 hours', icon: 'flask-conical', tag: 'L' },
  tutorial: { label: 'Tutorial', detail: 'Problem-solving sessions, 1 hour', icon: 'users', tag: 'U' },
};

export default function CourseSetup() {
  const p = useUni();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [faculty, setFaculty] = useState('');
  const [creditsPick, setCredits] = useState<number | null>(null); // null = follow the timetable
  const [extra, setExtra] = useState<'lab' | 'tutorial' | null>(null);
  const [brush, setBrush] = useState<Part>('theory');
  const [slots, setSlots] = useState<Slots>({});
  const [target, setTarget] = useState(75);
  const [saving, setSaving] = useState(false);

  const parts: Part[] = ['theory', ...(extra ? [extra] : [])];
  const partSummary = parts.map((x) => PART[x].label).join(' + ');
  const answers = [[name.trim(), code.trim()].filter(Boolean).join(' · '), partSummary, slotSummary(slots), `${target}%`];
  // Weekly hours per part from the painted grid; credits = L + T + P/2 (ordinance clause 7.11).
  const hours = (type: Part) => sessionsFor(slots, type).reduce((m, x) => m + (minutesOf(x.endTime) - minutesOf(x.startTime)) / 60, 0);
  const weekly = { theory: hours('theory'), tutorial: hours('tutorial'), lab: hours('lab') };
  const suggested = creditsFromHours(weekly);
  const credits = creditsPick ?? suggested;
  const nameCheck = checkCourseName(name);
  const codeCheck = checkCourseCode(code);
  const step1Error = name.trim() && !nameCheck.ok ? nameCheck.error : code.trim() && !codeCheck.ok ? codeCheck.error : null;
  const canContinue = step !== 1 || (nameCheck.ok && codeCheck.ok);

  const [daysAsRows, setDaysAsRows] = useState(true); // most printed timetables list days down the side
  const cell = (di: number, h: number, small: boolean) => {
    const key = `${di + 1}-${h}`;
    const cover = Object.entries(slots).find(([k, part]) => { const [d, st] = k.split('-').map(Number); return d === di + 1 && h >= st && h < st + DURATION[part] / 60; });
    const part = cover?.[1];
    const isStart = cover?.[0] === key;
    const bg = part ? (part === 'theory' ? p.primary : part === 'lab' ? '#10B981' : '#F59E0B') : p.surface;
    return (
      <Tap key={key} onPress={() => setSlots((s) => paint(s, key, parts.includes(brush) ? brush : 'theory', LAST_HOUR))}
        accessibilityLabel={`${DAYS[di]} ${h12(h)} ${h < 12 ? 'AM' : 'PM'}${part ? `, ${PART[part].label}` : ''}`}
        style={[styles.cell, small && { height: 34, borderRadius: 6 }, { backgroundColor: bg }]}>
        {part && isStart ? <T w={800} c="#fff" size={small ? 9 : 10}>{PART[part].tag}</T> : null}
      </Tap>
    );
  };

  const create = async () => {
    setSaving(true);
    try {
      const used = new Set((await db.select({ color: workspaces.color }).from(workspaces).all()).map((w) => w.color));
      const color = colors.subjects.map((s) => s.base).find((c) => !used.has(c)) ?? colors.subjects[0].base;
      const ws = await WorkspaceRepository.buildCompleteWorkspace({
        name: nameCheck.ok ? nameCheck.value : name.trim(), code: (codeCheck.ok && codeCheck.value) || undefined, credits, color,
        components: parts.map((type) => ({ type, durationMinutes: DURATION[type], facultyName: faculty.trim() || undefined, sessions: sessionsFor(slots, type) })),
      });
      if (target !== 75) await WorkspaceRepository.updateCourseIdentity(ws.id, { targetAttendance: target });
      router.replace(`/course/${ws.id}` as any);
    } catch (e: any) {
      if (e?.message === 'NO_ACTIVE_SEMESTER') {
        Alert.alert('No active semester', 'Create or activate a semester first, then add the course.', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Semesters', onPress: () => router.push('/semester') },
        ]);
      } else {
        Alert.alert('Could not create the course', e?.message ?? 'Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!canContinue || saving) return;
    if (step < 4) setStep(step + 1);
    else create();
  };
  const back = () => (step > 1 ? setStep(step - 1) : router.back());

  const inputStyle = [styles.input, sans(700), { backgroundColor: p.elev, color: p.text, borderColor: p.primary, shadowColor: p.primary }];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 14, paddingHorizontal: 20 }}>
      <View style={styles.top}>
        <RoundButton icon="chevron-left" label={step > 1 ? 'Previous question' : 'Close'} onPress={back} />
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3, 4].map((i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? p.primary : p.border }} />)}
        </View>
        <T style={[mono(700), { fontSize: 12, color: p.muted }]}>{step}/4</T>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingTop: 6, paddingBottom: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {QUESTIONS.slice(0, step - 1).map((q, i) => (
          <Tap key={q} onPress={() => setStep(i + 1)} style={{ gap: 6, opacity: 0.7 }}>
            <T w={600} c={p.muted} size={13}>{q}</T>
            <View style={[styles.answer, { backgroundColor: p.primary }]}><T w={600} c="#fff" size={14}>{answers[i] || '—'}</T></View>
          </Tap>
        ))}

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 6 }}>
          <View style={[styles.avatar, { backgroundColor: p.primarySoft }]}><Icon name="sparkles" size={20} color={p.primary} /></View>
          <T w={800} size={21} style={{ flex: 1, letterSpacing: -0.5, lineHeight: 27 }}>{QUESTIONS[step - 1]}</T>
        </View>

        {step === 1 && (
          <View style={{ gap: 10, marginTop: 6 }}>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Operating Systems" placeholderTextColor={p.muted} autoFocus
              style={[inputStyle, { fontSize: 17 }]} returnKeyType="next" onSubmitEditing={next} accessibilityLabel="Course name" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={code} onChangeText={setCode} placeholder="Code (optional)" placeholderTextColor={p.muted} autoCapitalize="characters"
                style={[styles.small, sans(600), { backgroundColor: p.elev, borderColor: p.hair, color: p.text }]} accessibilityLabel="Course code" />
              <TextInput value={faculty} onChangeText={setFaculty} placeholder="Faculty (optional)" placeholderTextColor={p.muted}
                style={[styles.small, sans(600), { backgroundColor: p.elev, borderColor: p.hair, color: p.text }]} accessibilityLabel="Faculty name" />
            </View>
            {step1Error ? <T w={600} c={p.danger} size={12.5}>{step1Error}</T> : null}
            <Tap onPress={() => router.push('/course/ai-setup')} style={styles.hint}>
              <Icon name="scan-line" size={15} color={p.muted} />
              <T w={600} c={p.muted} size={12.5}>Or scan your timetable photo to add every course at once</T>
            </Tap>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 8, marginTop: 6 }}>
            {(['theory', 'lab', 'tutorial'] as Part[]).map((k) => {
              const on = parts.includes(k);
              const locked = k === 'theory';
              return (
                <Tap key={k} disabled={locked} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: locked }}
                  onPress={() => { const nx = extra === k ? null : (k as 'lab' | 'tutorial'); setExtra(nx); setSlots((s) => prune(s, ['theory', ...(nx ? [nx] : [])])); }}
                  style={[styles.part, { backgroundColor: p.elev, borderColor: on ? p.primary : p.hair }]}>
                  <View style={[styles.partIcon, { backgroundColor: on ? p.primary : p.surface }]}><Icon name={PART[k].icon} size={19} color={on ? '#fff' : p.muted} /></View>
                  <View style={{ flex: 1 }}>
                    <T w={700} size={15}>{PART[k].label}</T>
                    <T c={p.muted} size={12}>{locked ? 'Every course has theory' : PART[k].detail}</T>
                  </View>
                  <View style={[styles.tick, { backgroundColor: on ? p.primary : p.border }]}><Icon name="check" size={13} width={3} color="#fff" /></View>
                </Tap>
              );
            })}
            <T c={p.muted} size={12} style={{ marginTop: 2 }}>A course can have a lab or a tutorial, not both.</T>
          </View>
        )}

        {step === 3 && (
          <>
            {parts.length > 1 ? <Segmented<Part> items={parts.map((x) => [x, `Paint ${PART[x].label}`])} value={brush} onChange={setBrush} /> : null}
            <Segmented<'cols' | 'rows'>
              items={[['rows', 'Days down the side'], ['cols', 'Days across the top']]}
              value={daysAsRows ? 'rows' : 'cols'}
              onChange={(v) => setDaysAsRows(v === 'rows')}
            />
            <Card flat style={{ padding: 10, borderRadius: 20 }}>
              {daysAsRows ? (
                <>
                  <View style={styles.gridRow}>
                    <View style={{ width: 30 }} />
                    {HOURS.map((h) => <T key={h} style={[mono(500), { flex: 1, textAlign: 'center', fontSize: 9.5, color: p.muted }]}>{h12(h)}{h === HOURS[0] ? (h < 12 ? 'a' : 'p') : h === 12 ? 'p' : ''}</T>)}
                  </View>
                  {DAYS.map((d, di) => (
                    <View key={d} style={[styles.gridRow, { marginTop: 4 }]}>
                      <T w={700} c={p.muted} size={10.5} style={{ width: 30 }}>{d}</T>
                      {HOURS.map((h) => cell(di, h, true))}
                    </View>
                  ))}
                </>
              ) : (
                <>
                  <View style={styles.gridRow}>
                    <View style={{ width: 44 }} />
                    {DAYS.map((d) => <T key={d} w={700} c={p.muted} size={11} style={{ flex: 1, textAlign: 'center' }}>{d}</T>)}
                  </View>
                  {HOURS.map((h) => (
                    <View key={h} style={[styles.gridRow, { marginTop: 4 }]}>
                      <T style={[mono(500), { width: 44, fontSize: 9.5, color: p.muted }]}>{`${h12(h)}–${h12(h + 1)}${h + 1 < 12 ? 'a' : 'p'}`}</T>
                      {DAYS.map((_, di) => cell(di, h, false))}
                    </View>
                  ))}
                </>
              )}
            </Card>
            <T c={p.muted} size={12.5} style={{ lineHeight: 18 }}>Tap the hour a class starts. Labs fill two hours. Tap a slot's first cell again to clear it. Pick the layout that matches your printed timetable.</T>
          </>
        )}

        {step === 4 && (
          <View style={{ gap: 12, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[65, 75, 85].map((v) => (
                <Tap key={v} onPress={() => setTarget(v)} accessibilityRole="radio" accessibilityState={{ selected: target === v }}
                  style={[styles.target, { backgroundColor: target === v ? p.primary : p.elev, borderColor: p.hair }]}>
                  <T w={800} c={target === v ? '#fff' : p.text} size={20}>{v}%</T>
                </Tap>
              ))}
            </View>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T w={700} c={p.muted} size={13} style={{ marginRight: 4 }}>Credits</T>
                {CREDIT_OPTIONS.map((n) => (
                  <Tap key={n} onPress={() => setCredits(n)} accessibilityRole="button" accessibilityLabel={`${n} credits`} accessibilityState={{ selected: credits === n }}
                    style={[styles.credit, { backgroundColor: credits === n ? p.primary : p.elev, borderColor: credits === n ? p.primary : p.hair }]}>
                    <T w={800} c={credits === n ? '#fff' : p.text} size={14}>{n}</T>
                  </Tap>
                ))}
              </View>
              <T c={p.muted} size={12}>
                {weekly.theory + weekly.tutorial + weekly.lab > 0
                  ? `From your timetable: ${[weekly.theory && `${weekly.theory}h lecture`, weekly.tutorial && `${weekly.tutorial}h tutorial`, weekly.lab && `${weekly.lab}h lab`].filter(Boolean).join(' + ')} a week = ${suggested} credits (lab hours count half).${creditsPick !== null && creditsPick !== suggested ? ' You changed it.' : ''}`
                  : 'Check your scheme of studies if unsure.'}
              </T>
            </View>
            <Card flat style={{ gap: 8 }}>
              {[['Course', name.trim()], ['Code', code.trim() || '—'], ['Credits', String(credits)], ['Parts', partSummary], ['Weekly', slotSummary(slots)], ['Faculty', faculty.trim() || '—']].map(([k, val]) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <T c={p.muted} size={13.5}>{k}</T>
                  <T w={700} size={13.5} style={{ flexShrink: 1, textAlign: 'right' }}>{val}</T>
                </View>
              ))}
            </Card>
            {!Object.keys(slots).length ? <Pill label="No slots yet. You can add them later from the course." bg={p.primarySoft} fg={p.primary} /> : null}
          </View>
        )}
      </ScrollView>

      <Tap onPress={next} disabled={!canContinue || saving} accessibilityRole="button"
        style={[styles.cta, { backgroundColor: p.primary, shadowColor: p.primary, opacity: canContinue && !saving ? 1 : 0.5 }]}>
        <T w={700} c="#fff" size={16}>{saving ? 'Creating…' : step === 4 ? 'Create course' : 'Continue'}</T>
        <Icon name="arrow-right" size={18} color="#fff" />
      </Tap>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 12 },
  answer: { alignSelf: 'flex-end', paddingVertical: 9, paddingHorizontal: 14, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  avatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  input: { height: 56, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  credit: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  small: { flex: 1, minWidth: 0, height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 13.5 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  part: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5 },
  partIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gridRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  cell: { flex: 1, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  target: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16, borderWidth: 1 },
  cta: { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
});
