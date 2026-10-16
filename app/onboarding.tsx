import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Icon } from '../components/uni/Icon';
import { T, Tap } from '../components/uni/primitives';
import { Choice, ChoiceRow, ErrorText, FieldLabel, Input, PrimaryButton } from '../components/uni/form';
import { useToast } from '../components/uni/Toast';
import { sans, tint, useUni } from '../components/uni/theme';
import { getLocalDateString, parseLocalDate } from '../core/utils/date';
import { shortDate } from '../domains/academic/logic';
import { BRANCHES, branchValue, guessTermDates, termLabel, validateOnboarding, type OnboardDraft } from '../domains/profile/form';
import { ProfileRepository } from '../domains/profile/repository';

const NEXT = ['Get started', 'Continue', 'Create semester', 'Add your first course'];
const fullDate = (iso: string) => `${shortDate(iso)} ${iso.slice(0, 4)}`;

/**
 * First run (design UniOnboard, handoff §7): welcome, name and branch, semester
 * and dates, done. The profile and the active semester are saved together when
 * the student taps "Create Semester N"; the layout's guard then lets them into the app.
 */
export default function Onboarding() {
  const p = useUni();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [today] = useState(() => getLocalDateString(new Date()));
  const [step, setStep] = useState(0);
  const [d, setD] = useState<OnboardDraft>(() => {
    // Rough dates for the term we are in; they follow the semester number until the student edits them.
    const g = guessTermDates(Number(today.slice(5, 7)) >= 7 ? 1 : 2, today);
    return { name: '', chip: '', other: '', number: 0, start: g.start, end: g.end };
  });
  const [datesTouched, setDatesTouched] = useState(false);
  const [tried, setTried] = useState<[boolean, boolean]>([false, false]);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const scroll = useRef<ScrollView>(null);

  const v = validateOnboarding(d);
  const back = () => { if (step === 1 || step === 2) setStep(step - 1); };
  const enter = (path?: string) => {
    // The layout's guard finds the new profile once we leave this screen.
    router.replace('/(main)/today');
    if (path) router.push(path as any);
  };
  const later = () => { toast.show('You can add courses from More → Add course.'); enter(); };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 1 || step === 2) { setStep(step - 1); return true; }
      if (step === 3) { later(); return true; }
      return false;
    });
    return () => sub.remove();
  });
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);

  const next = async () => {
    if (step === 0) return setStep(1);
    if (step === 1) {
      if (v.step1.name || v.step1.branch) return setTried([true, tried[1]]);
      return setStep(2);
    }
    if (step === 2) {
      if (!v.values) return setTried([tried[0], true]);
      setSaving(true);
      try {
        await ProfileRepository.completeOnboarding(v.values);
        setStep(3);
      } catch (e) {
        console.error('Could not finish onboarding', e);
        toast.show('Could not save. Try again.');
      } finally {
        setSaving(false);
      }
      return;
    }
    enter('/course/setup');
  };

  const pickNumber = (n: number) => setD((x) => ({ ...x, number: n, ...(datesTouched ? {} : guessTermDates(n, today)) }));
  const first = d.name.trim().split(/\s+/)[0] ?? '';
  const dateErr = tried[1] || (d.start && d.end && d.end <= d.start) ? v.step2.dates : null;
  const label = step === 2 && d.number ? `Create Semester ${d.number}` : NEXT[step];

  const dateBox = (k: 'start' | 'end', name: string) => {
    const val = d[k];
    const bad = k === 'end' ? !!dateErr && !!d.end : tried[1] && !val;
    return (
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <FieldLabel>{name}</FieldLabel>
        <Tap onPress={() => setPicker(k)} accessibilityRole="button" accessibilityLabel={`${name}: ${val ? fullDate(val) : 'not set'}`}
          style={{ height: 50, borderRadius: 13, borderWidth: 1.5, borderColor: bad ? p.danger : p.border, backgroundColor: p.elev, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="calendar" size={16} color={p.muted} />
          <T w={600} c={val ? p.text : p.muted} size={14} numberOfLines={1}>{val ? fullDate(val) : 'Pick date'}</T>
        </Tap>
      </View>
    );
  };

  const numChip = (n: number) => {
    const on = d.number === n;
    return (
      <Tap key={n} onPress={() => pickNumber(n)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Semester ${n}, ${termLabel(null, n)}`}
        style={{ flex: 1, height: 54, borderRadius: 15, borderWidth: 1, borderColor: p.hair, backgroundColor: on ? p.text : p.elev, alignItems: 'center', justifyContent: 'center' }}>
        <T w={800} c={on ? p.bg : p.text} size={18} style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{n}</T>
        <T w={700} c={on ? p.bg : p.text} size={10} style={{ opacity: 0.7 }}>{termLabel(null, n)}</T>
      </Tap>
    );
  };

  const branchFull = d.chip && d.chip !== 'Other' ? branchValue(d.chip, '') : '';
  const showBack = step === 1 || step === 2;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Tap onPress={back} disabled={!showBack} accessibilityRole="button" accessibilityLabel="Back" accessibilityElementsHidden={!showBack} importantForAccessibility={showBack ? 'auto' : 'no-hide-descendants'}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, alignItems: 'center', justifyContent: 'center', opacity: showBack ? 1 : 0 }}>
          <Icon name="chevron-left" size={20} color={p.text} />
        </Tap>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }} accessible accessibilityLabel={`Step ${Math.min(step, 2) + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 7, width: i === Math.min(step, 2) ? 22 : 7, borderRadius: 4, backgroundColor: i <= step ? p.primary : p.border }} />
          ))}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 24, gap: 20 }}>
        {step === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: 22 }}>
            <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center', shadowColor: p.primary, shadowOpacity: 0.32, shadowRadius: 17, shadowOffset: { width: 0, height: 16 }, elevation: 10 }}>
              <Icon name="graduation-cap" size={36} color="#fff" />
            </View>
            <View style={{ gap: 10 }}>
              <T w={800} size={34} style={{ letterSpacing: -1.2, lineHeight: 40 }} accessibilityRole="header">{'Your semester,\non your phone'}</T>
              <T w={500} c={p.muted} size={15.5} style={{ lineHeight: 23 }}>Timetable, attendance, tasks and files for every course, in one place. Works without internet.</T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tint(p.success, 13), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="shield-check" size={20} color={p.success} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T w={800} size={15}>Everything stays on this phone.</T>
                <T w={600} c={p.muted} size={12.5}>No account. Back up to a file whenever you like.</T>
              </View>
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <>
            <View style={{ gap: 6 }}>
              <T w={800} size={28} style={{ letterSpacing: -0.9, lineHeight: 34 }} accessibilityRole="header">What should we call you?</T>
              <T w={500} c={p.muted} size={14.5} style={{ lineHeight: 21 }}>Shown on Today. You can change it in Profile.</T>
            </View>
            <View style={{ gap: 6 }}>
              <FieldLabel>Name</FieldLabel>
              <Input value={d.name} onChangeText={(t) => setD((x) => ({ ...x, name: t.slice(0, 60) }))} autoFocus placeholder="Your name" autoCapitalize="words"
                autoComplete="name" textContentType="name" returnKeyType="done" invalid={tried[0] && !!v.step1.name} accessibilityLabel="Name"
                style={[sans(700), { minHeight: 54, fontSize: 17 }]} />
              {tried[0] && v.step1.name ? <ErrorText>{v.step1.name}</ErrorText> : null}
            </View>
            <View style={{ gap: 8 }}>
              <FieldLabel>Branch</FieldLabel>
              <ChoiceRow>
                {BRANCHES.map(([k]) => <Choice key={k} label={k} selected={d.chip === k} onPress={() => setD((x) => ({ ...x, chip: k }))} />)}
              </ChoiceRow>
              {d.chip === 'Other' ? (
                <Input value={d.other} onChangeText={(t) => setD((x) => ({ ...x, other: t.slice(0, 60) }))} placeholder="e.g. B.Tech Biomedical Engineering" autoFocus
                  autoCapitalize="words" invalid={tried[0] && !!v.step1.branch} accessibilityLabel="Your branch" style={[sans(600), { minHeight: 50, borderRadius: 13, fontSize: 15 }]} />
              ) : null}
              {tried[0] && v.step1.branch ? <ErrorText>{v.step1.branch}</ErrorText> : null}
              {branchFull ? <T w={600} c={p.muted} size={12.5}>{branchFull}</T> : null}
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <View style={{ gap: 6 }}>
              <T w={800} size={28} style={{ letterSpacing: -0.9, lineHeight: 34 }} accessibilityRole="header">Which semester are you in?</T>
              <T w={500} c={p.muted} size={14.5} style={{ lineHeight: 21 }}>Courses belong to a semester. Attendance and SGPA are kept per semester.</T>
            </View>
            <View style={{ gap: 8 }} accessibilityRole="radiogroup">
              <View style={{ flexDirection: 'row', gap: 8 }}>{[1, 2, 3, 4].map(numChip)}</View>
              <View style={{ flexDirection: 'row', gap: 8 }}>{[5, 6, 7, 8].map(numChip)}</View>
              {tried[1] && v.step2.number ? <ErrorText>{v.step2.number}</ErrorText> : null}
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {dateBox('start', 'Starts')}
                {dateBox('end', 'Ends')}
              </View>
              {dateErr ? <ErrorText>{dateErr}</ErrorText> : null}
              <T w={600} c={p.muted} size={12.5} style={{ lineHeight: 18 }}>Rough dates are fine. You can edit them in Semesters.</T>
            </View>
            {picker ? (
              <DateTimePicker mode="date" value={parseLocalDate(d[picker] || today)}
                onChange={(e, dt) => {
                  const k = picker;
                  setPicker(null);
                  if (e.type === 'set' && dt) { setDatesTouched(true); setD((x) => ({ ...x, [k]: getLocalDateString(dt) })); }
                }} />
            ) : null}
          </>
        ) : null}

        {step === 3 && v.values ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: 20 }}>
            <View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: tint(p.success, 14), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={32} color={p.success} width={2.6} />
            </View>
            <View style={{ gap: 8 }}>
              <T w={800} size={28} style={{ letterSpacing: -0.9, lineHeight: 34 }} accessibilityRole="header">{first ? `You’re set up, ${first}` : 'You’re set up'}</T>
              <T w={500} c={p.muted} size={14.5} style={{ lineHeight: 21 }}>Next, add your courses. Set up the week once and every course gets its classes.</T>
            </View>
            <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, gap: 4 }}>
              <T w={800} size={15}>{`Semester ${d.number} · ${termLabel(null, d.number)} · Active`}</T>
              <T w={600} c={p.muted} size={13}>{`${fullDate(d.start)} – ${fullDate(d.end)} · ${v.values.branch}`}</T>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: Math.max(insets.bottom + 14, 30), gap: 8 }}>
        <PrimaryButton label={label} onPress={next} busy={saving} />
        {step === 3 ? (
          <Tap onPress={later} accessibilityRole="button" style={{ height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}>
            <T w={700} size={15}>Do it later</T>
          </Tap>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
