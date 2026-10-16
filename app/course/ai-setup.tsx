import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Image, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Icon, type IconName } from '../../components/uni/Icon';
import { T, Tap } from '../../components/uni/primitives';
import { ErrorText, FieldLabel, IconButton, Input, PrimaryButton, Switch3 } from '../../components/uni/form';
import { Sheet } from '../../components/uni/Sheet';
import { useToast } from '../../components/uni/Toast';
import { mono, sans, shadow, tint, useUni } from '../../components/uni/theme';
import { friendlyGeminiError } from '../../core/ai/geminiModels';
import { scanTimetable, type ScanPhase } from '../../core/ai/timetableParser';
import { GeminiKey } from '../../core/settings/aiProviders';
import { Prefs } from '../../core/settings/prefs';
import { formatBytes } from '../../core/utils/format';
import { clock, WEEKDAY_SHORT } from '../../domains/academic/logic';
import type { TakenSlot } from '../../domains/academic/setup';
import { weeklySlots } from '../../domains/academic/weekSlots';
import {
  clashBanner, clashesWith, editClass, forGroup, normGroup, PART_TITLE, partSummary, periodMinutes, quotaResetLabel,
  reviewCourses, rowDetail, rowTime, scanErrorKind, toPlan, type Part, type ScanClass, type ScanData, type ScanErrorKind,
} from '../../domains/timetable/scan';
import { AITimetableService, previewColors, type ImportResult } from '../../domains/workspace/aiService';
import { WorkspaceRepository } from '../../domains/workspace/repository';

type Photo = { uri: string; mimeType?: string | null; name: string; size: number | null; from: 'Camera' | 'Photos' };
type Step = 'pick' | 'group' | 'reading' | 'review' | 'result' | 'error';
type Choice = { section: string; group: string };

const PREFS = 'scanChoices';
const PHASES: Array<[ScanPhase, string]> = [['preparing', 'Preparing the photo'], ['reading', 'Reading the grid with Gemini'], ['checking', 'Checking the classes']];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Scan timetable with AI (design UniScan, handoff §8): pick a photo, say your
 * section and group, let Gemini read it, check and edit what was found, import.
 * Every AI error offers a way out; setting up the week by hand needs no key.
 */
export default function ScanTimetable() {
  const p = useUni();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('pick');
  const [key, setKey] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [choice, setChoice] = useState<Choice>(() => Prefs.getJSON<Choice>(PREFS, { section: '', group: '' }));
  const [phase, setPhase] = useState<ScanPhase>('preparing');
  const [elapsed, setElapsed] = useState(0);
  const [scan, setScan] = useState<ScanData | null>(null);
  const [edits, setEdits] = useState<Record<string, ScanClass | null>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ScanClass | null>(null);
  const [existing, setExisting] = useState<{ codes: Set<string>; colors: string[]; taken: TakenSlot[] }>({ codes: new Set(), colors: [], taken: [] });
  const [error, setError] = useState<{ kind: ScanErrorKind; detail?: string } | null>(null);
  const [result, setResult] = useState<(ImportResult & { notes: string[] }) | null>(null);
  const [importing, setImporting] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useFocusEffect(useCallback(() => { GeminiKey.get().then(setKey).catch(() => setKey(null)); }, []));
  useEffect(() => {
    if (step !== 'reading') return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [step]);
  useEffect(() => () => abort.current?.abort(), []);

  // ── Review data ──
  const period = useMemo(() => (scan ? periodMinutes(scan.classes) : 60), [scan]);
  const groupOk = !scan?.groups.length || scan.groups.some((g) => normGroup(g) === normGroup(choice.group));
  const classes = useMemo(() => (scan ? forGroup(scan.classes, groupOk ? choice.group : '').map((c) => (c.id in edits ? edits[c.id] : c)).filter((c): c is ScanClass => !!c) : []), [scan, choice.group, groupOk, edits]);
  const cards = useMemo(() => (scan ? reviewCourses(classes, scan.names, existing.codes) : []), [scan, classes, existing.codes]);
  const live = cards.filter((c) => !c.exists && !removed.has(c.code));
  const liveClasses = live.flatMap((c) => c.classes);
  const clashes = useMemo(() => clashesWith(liveClasses, existing.taken), [liveClasses, existing.taken]);
  const colors = useMemo(() => previewColors(live.length, existing.colors), [live.length, existing.colors]);
  const colorOf = (code: string) => colors[live.findIndex((c) => c.code === code)] ?? p.muted;
  const starts = useMemo(() => [...new Set((scan?.classes ?? []).map((c) => c.start))].sort(), [scan]);

  // ── Actions ──
  const pick = async (from: 'camera' | 'library') => {
    if (!key) { setError({ kind: 'nokey' }); setStep('error'); return; }
    try {
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { toast.show('Camera access is off. Turn it on in Settings → Apps → UniOS → Permissions.'); return; }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, exif: false };
      const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      const a = res.canceled ? null : res.assets?.[0];
      if (!a?.uri) return;
      setPhoto({ uri: a.uri, mimeType: a.mimeType, name: a.fileName || `Timetable photo`, size: a.fileSize ?? null, from: from === 'camera' ? 'Camera' : 'Photos' });
      setStep('group');
    } catch (e) {
      console.error('Could not pick the photo', e instanceof Error ? e.message : e);
      toast.show('Couldn’t open the photo. Try again.');
    }
  };

  const read = async () => {
    if (!photo) { setStep('pick'); return; }
    const clean = { section: choice.section.trim().slice(0, 30), group: choice.group.trim().slice(0, 20) };
    Prefs.setJSON(PREFS, clean);
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPhase('preparing');
    setStep('reading');
    try {
      const [s, all, taken] = await Promise.all([
        scanTimetable(photo, { ...clean, signal: ctrl.signal, onPhase: setPhase }),
        WorkspaceRepository.getAllWorkspaces(),
        weeklySlots(),
      ]);
      if (ctrl.signal.aborted) return;
      setExisting({ codes: new Set(all.map((w) => w.code?.toUpperCase()).filter((c): c is string => !!c)), colors: all.map((w) => w.color).filter((c): c is string => !!c), taken });
      setScan(s); setEdits({}); setRemoved(new Set());
      setStep('review');
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const kind = scanErrorKind(e);
      if (kind === 'cancelled') return;
      console.error('Timetable scan failed', kind, e instanceof Error ? e.message : '');
      setError({ kind, detail: kind === 'other' ? friendlyGeminiError(e) : undefined });
      setStep('error');
    }
  };

  const cancel = () => { abort.current?.abort(); abort.current = null; setStep('group'); };

  const doImport = async () => {
    const plan = toPlan(live);
    if (!plan.courses.length) return;
    setImporting(true);
    try {
      const r = await AITimetableService.importCourses(plan.courses);
      const notes = [
        ...(r.skipped.length ? [`Already in UniOS, left unchanged: ${r.skipped.join(', ')}.`] : []),
        ...plan.warnings, ...r.warnings, ...(scan?.warnings ?? []),
      ];
      setResult({ ...r, notes });
      setStep('result');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Could not import the courses.');
    } finally {
      setImporting(false);
    }
  };

  const back = () => {
    if (step === 'reading') return cancel();
    if (step === 'group') return setStep('pick');
    if (step === 'review') return setStep('group');
    if (step === 'error' && photo && error?.kind !== 'nokey') return setStep('group');
    if (step === 'error') return setStep('pick');
    router.back();
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (step === 'pick' || step === 'result') return false; back(); return true; });
    return () => sub.remove();
  });

  const toHand = () => router.replace('/course/setup');
  const toKey = () => router.push('/settings/gemini-key' as any);

  // ── Footer ──
  let cta: { label: string; onPress: () => void; disabled?: boolean; plain?: boolean; note?: string } | null = null;
  if (step === 'group') cta = { label: 'Read timetable', onPress: read };
  else if (step === 'reading') cta = { label: 'Cancel', onPress: cancel, plain: true };
  else if (step === 'review') {
    const nK = liveClasses.length;
    const nClash = clashes.size;
    cta = !groupOk
      ? { label: 'Pick your group first', onPress: () => {}, disabled: true }
      : { label: nK ? `Import ${plural(nK, 'class', 'classes')}` : 'Nothing to import', onPress: doImport, disabled: !nK,
        note: `${plural(nK, 'class', 'classes')}, ${plural(live.length, 'course')}${nClash ? ` · ${plural(nClash, 'clash', 'clashes')}` : ''}` };
  } else if (step === 'result') cta = { label: 'Open timetable', onPress: () => router.replace('/(main)/schedule') };

  const head = step === 'review' ? 'Check what was found' : step === 'result' ? 'Imported' : 'Scan timetable';
  const sub = step === 'review' ? [choice.section.trim() || 'Your section', groupOk && choice.group.trim() ? choice.group.trim() : scan?.groups.length ? 'Pick your group' : 'All groups'].join(' · ') : '';

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton icon={step === 'reading' ? 'x' : 'chevron-left'} label={step === 'reading' ? 'Cancel' : 'Back'} onPress={back} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T w={800} size={22} style={{ letterSpacing: -0.6 }} accessibilityRole="header">{head}</T>
          {sub ? <T w={600} c={p.muted} size={12.5} numberOfLines={1}>{sub}</T> : null}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: cta ? 24 : insets.bottom + 30, gap: 14 }}>
        {step === 'pick' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {([['camera', 'Camera', '#0891B2', 'camera'], ['images', 'Photos', '#F59E0B', 'library']] as const).map(([icon, label, c, from]) => (
                <Tap key={label} onPress={() => pick(from)} accessibilityRole="button" accessibilityLabel={`${label}: take or pick the timetable photo`}
                  style={[{ flex: 1, height: 128, borderRadius: 22, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, alignItems: 'center', justifyContent: 'center', gap: 10 }, shadow(p)]}>
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: tint(c, 14), alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={icon} size={24} color={c} />
                  </View>
                  <T w={800} size={15}>{label}</T>
                </Tap>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, backgroundColor: p.primarySoft }}>
              <Icon name="scan-line" size={19} color={p.primary} />
              <View style={{ flex: 1, gap: 3 }}>
                <T w={800} size={14}>Whole timetable in frame, straight on</T>
                <T w={600} c={p.muted} size={12.5} style={{ lineHeight: 18 }}>Include the legend with course codes. Avoid glare from the notice board glass.</T>
              </View>
            </View>
            <Tap onPress={toKey} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: tint(key ? p.success : p.warn, 13), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="key-round" size={17} color={key ? p.success : p.warn} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T w={800} size={14}>{key ? 'Gemini key saved' : 'No Gemini key yet'}</T>
                <T w={600} c={p.muted} size={12} numberOfLines={1}>{key ? `${key.slice(0, 4)}••••${key.slice(-3)} · on this phone` : 'Needed for the AI scan · free'}</T>
              </View>
              <T w={800} c={p.primary} size={13}>{key ? 'Change' : 'Add'}</T>
            </Tap>
            <Tap onPress={toHand} accessibilityRole="button" style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }}>
              <T w={700} c={p.muted} size={13}>No photo? Set up the week by hand</T>
            </Tap>
          </>
        ) : null}

        {step === 'group' && photo ? (
          <>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 18, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair }}>
              <Image source={{ uri: photo.uri }} style={{ width: 64, height: 48, borderRadius: 9, backgroundColor: p.surface }} resizeMode="cover" accessibilityIgnoresInvertColors />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T w={800} size={14} numberOfLines={1}>{photo.name}</T>
                <T w={600} c={p.muted} size={12}>{[photo.size ? formatBytes(photo.size) : '', `from ${photo.from}`].filter(Boolean).join(' · ')}</T>
              </View>
              <Tap onPress={() => setStep('pick')} accessibilityRole="button" accessibilityLabel="Change photo" style={{ height: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
                <T w={800} c={p.primary} size={13}>Change</T>
              </Tap>
            </View>
            <View style={{ gap: 6 }}>
              <FieldLabel>Section</FieldLabel>
              <Input value={choice.section} onChangeText={(v) => setChoice((c) => ({ ...c, section: v.slice(0, 30) }))} placeholder="e.g. Section A" accessibilityLabel="Section"
                style={[sans(700), { minHeight: 50, borderRadius: 13, fontSize: 15 }]} />
              <T w={600} c={p.muted} size={12}>Optional · used when one photo has several sections</T>
            </View>
            <View style={{ gap: 6 }}>
              <FieldLabel>Your lab & tutorial group</FieldLabel>
              <Input value={choice.group} onChangeText={(v) => setChoice((c) => ({ ...c, group: v.slice(0, 20) }))} placeholder="e.g. CSE-2" autoCapitalize="characters" accessibilityLabel="Your lab and tutorial group"
                style={[sans(700), { minHeight: 50, borderRadius: 13, fontSize: 15 }]} />
              <T w={600} c={p.muted} size={12.5} style={{ lineHeight: 18 }}>
                {choice.group.trim() ? `Only ${choice.group.trim()}'s labs and tutorials are imported. Lectures for the whole section always are.` : 'Only your group’s labs and tutorials are imported. You can also pick the group after reading.'}
              </T>
            </View>
          </>
        ) : null}

        {step === 'reading' ? <Reading phase={phase} elapsed={elapsed} /> : null}

        {step === 'review' && scan ? (
          <>
            {scan.groups.length ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <FieldLabel>Your lab & tutorial group</FieldLabel>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: p.primarySoft }}><T w={800} c={p.primary} size={10.5}>Found in photo</T></View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
                  {scan.groups.map((g) => {
                    const on = normGroup(g) === normGroup(choice.group);
                    return (
                      <Tap key={g} onPress={() => { const next = { ...choice, group: g }; setChoice(next); Prefs.setJSON(PREFS, next); }} accessibilityRole="radio" accessibilityState={{ selected: on }}
                        style={{ minWidth: 96, flexGrow: 1, flexBasis: '28%', height: 50, borderRadius: 14, borderWidth: 1, borderColor: p.hair, backgroundColor: on ? p.text : p.elev, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }}>
                        <T w={800} size={14.5} c={on ? p.bg : p.text} numberOfLines={1}>{g}</T>
                      </Tap>
                    );
                  })}
                </View>
                {!groupOk ? <ErrorText>{choice.group.trim() ? `${choice.group.trim()} isn't in this photo. Pick your group.` : 'Pick your group to keep only its labs and tutorials.'}</ErrorText> : null}
              </View>
            ) : null}

            {clashes.size ? (
              <View style={{ flexDirection: 'row', gap: 10, padding: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: tint(p.danger, 10) }}>
                <Icon name="triangle-alert" size={16} color={p.danger} />
                <T w={600} size={13} style={{ flex: 1, lineHeight: 19 }}>{clashBanner(clashes)}</T>
              </View>
            ) : null}

            {cards.map((c) => {
              if (removed.has(c.code)) {
                return (
                  <View key={c.code} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingLeft: 14, paddingRight: 6, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.border }}>
                    <T w={700} c={p.muted} size={13.5} style={{ flex: 1, textDecorationLine: 'line-through' }} numberOfLines={1}>{c.name}</T>
                    <Tap onPress={() => setRemoved((s) => { const n = new Set(s); n.delete(c.code); return n; })} accessibilityRole="button" accessibilityLabel={`Undo removing ${c.name}`}
                      style={{ height: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
                      <T w={800} c={p.primary} size={13}>Undo</T>
                    </Tap>
                  </View>
                );
              }
              return (
                <View key={c.code} style={[{ borderRadius: 20, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, overflow: 'hidden' }, shadow(p)]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 14, paddingRight: 6, borderBottomWidth: c.exists ? 0 : 1, borderBottomColor: p.hair }}>
                    <View style={{ width: 10, height: 28, borderRadius: 4, backgroundColor: c.exists ? p.border : colorOf(c.code) }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T w={800} size={14.5} style={{ lineHeight: 19 }}>{c.name}</T>
                      <T w={600} c={p.muted} size={11.5}>{c.exists ? `${c.code} · Already in UniOS · won't be imported` : [c.name === c.code ? 'No name found' : c.code, partSummary(c.classes)].join(' · ')}</T>
                    </View>
                    {!c.exists ? (
                      <Tap onPress={() => setRemoved((s) => new Set(s).add(c.code))} accessibilityRole="button" accessibilityLabel={`Don't import ${c.name}`}
                        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="trash-2" size={17} color={p.muted} />
                      </Tap>
                    ) : null}
                  </View>
                  {!c.exists ? c.classes.map((x, i) => {
                    const clash = clashes.get(x.id);
                    return (
                      <Tap key={x.id} onPress={() => setEditing(x)} accessibilityRole="button" accessibilityLabel={`${rowTime(x)}, ${rowDetail(x, period)}${clash ? `, clashes with ${clash.name}` : ''}. Edit`}
                        pressedStyle={{ backgroundColor: p.surface }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingVertical: 6, paddingHorizontal: 14, borderBottomWidth: i < c.classes.length - 1 ? 1 : 0, borderBottomColor: p.hair, backgroundColor: clash ? tint(p.danger, 7) : 'transparent' }}>
                        <T w={700} size={12.5} style={[mono(700), { width: 84 }]}>{rowTime(x)}</T>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <T w={700} size={13}>{rowDetail(x, period)}</T>
                          {clash ? <T w={700} c={p.danger} size={11.5}>{`Clashes with ${clash.name}`}</T> : null}
                        </View>
                        <Icon name="pencil" size={13} color={p.muted} />
                      </Tap>
                    );
                  }) : null}
                </View>
              );
            })}
            {scan.warnings.length ? <T w={600} c={p.muted} size={12.5} style={{ lineHeight: 18 }}>{scan.warnings.join(' ')}</T> : null}
          </>
        ) : null}

        {step === 'result' && result ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: tint(result.created.length ? p.success : p.warn, 14), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={result.created.length ? 'check' : 'info'} size={30} color={result.created.length ? p.success : p.warn} width={2.6} />
            </View>
            <View style={{ gap: 8 }}>
              <T w={800} size={26} style={{ letterSpacing: -0.8, lineHeight: 32 }}>
                {result.created.length ? `${plural(result.created.length, 'course')}, ${plural(result.created.reduce((n, c) => n + c.classes, 0), 'class', 'classes')} added` : 'Nothing new to add'}
              </T>
              <T c={p.muted} size={14.5} style={{ lineHeight: 21 }}>Rename the courses and check their slots from each course page.</T>
            </View>
            {result.created.length ? (
              <View style={{ borderRadius: 18, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, overflow: 'hidden' }}>
                {result.created.map((c, i) => (
                  <View key={c.code} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 14, borderBottomWidth: i < result.created.length - 1 ? 1 : 0, borderBottomColor: p.hair }}>
                    <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: c.color }} />
                    <T w={700} size={13.5} style={{ flex: 1 }} numberOfLines={1}>{c.name}</T>
                    <T w={700} c={p.muted} size={12} style={mono(700)}>{c.classes}</T>
                  </View>
                ))}
              </View>
            ) : null}
            {result.notes.map((n, i) => <T key={i} w={600} c={p.muted} size={12.5} style={{ lineHeight: 18 }}>{n}</T>)}
          </View>
        ) : null}

        {step === 'error' && error ? (
          <ErrorCard kind={error.kind} detail={error.detail} actions={{
            addKey: toKey, hand: toHand, retry: read, ok: () => setStep(photo ? 'group' : 'pick'),
            camera: () => pick('camera'), library: () => pick('library'),
          }} />
        ) : null}
      </ScrollView>

      {cta ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 14, borderTopWidth: 1, borderTopColor: p.hair, backgroundColor: p.bg, gap: 8 }}>
          {cta.note ? <T w={700} c={p.muted} size={12.5} style={{ textAlign: 'center' }}>{cta.note}</T> : null}
          <PrimaryButton label={cta.label} onPress={cta.onPress} disabled={cta.disabled} busy={importing && step === 'review'} tone={cta.plain ? 'plain' : 'primary'} />
        </View>
      ) : null}

      {editing ? (
        <EditClass key={editing.id} item={editing} title={cards.find((c) => c.code === editing.code)?.name ?? editing.code} starts={starts} period={period}
          onClose={() => setEditing(null)}
          onSave={(x) => { setEdits((e) => ({ ...e, [x.id]: x })); setEditing(null); }}
          onRemove={() => { setEdits((e) => ({ ...e, [editing.id]: null })); setEditing(null); }} />
      ) : null}
    </View>
  );
}

/** Indeterminate ring with real elapsed seconds and the real phase: the request has no progress to report. */
function Reading({ phase, elapsed }: { phase: ScanPhase; elapsed: number }) {
  const p = useUni();
  const spin = useSharedValue(0);
  useEffect(() => { spin.value = withRepeat(withTiming(360, { duration: 1400, easing: Easing.linear }), -1, false); }, [spin]);
  const rot = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const at = PHASES.findIndex(([k]) => k === phase);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }} accessibilityLiveRegion="polite">
      <View style={{ width: 132, height: 132 }}>
        <Svg width={132} height={132} style={{ position: 'absolute' }}>
          <Circle cx={66} cy={66} r={58} fill="none" stroke={p.surface} strokeWidth={10} />
        </Svg>
        <Animated.View style={[{ position: 'absolute', width: 132, height: 132 }, rot]}>
          <Svg width={132} height={132}>
            <Circle cx={66} cy={66} r={58} fill="none" stroke={p.primary} strokeWidth={10} strokeLinecap="round" strokeDasharray="90 274.4" />
          </Svg>
        </Animated.View>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <T w={800} size={26} style={mono(700)}>{`${elapsed}s`}</T>
        </View>
      </View>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <T w={800} size={18}>Reading with Gemini…</T>
        <T c={p.muted} size={13.5}>This can take 10–30 s</T>
      </View>
      <View style={{ alignSelf: 'stretch', gap: 8 }}>
        {PHASES.map(([k, label], i) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name={i < at ? 'circle-check' : i === at ? 'loader' : 'circle'} size={16} color={i < at ? p.success : i === at ? p.primary : p.muted} />
            <T w={700} size={13.5} c={i <= at ? p.text : p.muted}>{label}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

type ErrorActions = { addKey: () => void; hand: () => void; retry: () => void; ok: () => void; camera: () => void; library: () => void };

function ErrorCard({ kind, detail, actions }: { kind: ScanErrorKind; detail?: string; actions: ErrorActions }) {
  const p = useUni();
  const E: Record<Exclude<ScanErrorKind, 'cancelled'>, { icon: IconName; c: string; t: string; d: string; tips?: string[]; btns: Array<[string, () => void]> }> = {
    nokey: { icon: 'key-round', c: p.warn, t: 'Add a Gemini key first', d: 'The AI scan uses your own free Gemini key. It stays on this phone. Or set up the week by hand, which needs no key.', btns: [['Add key', actions.addKey], ['Set up by hand', actions.hand]] },
    rejected: { icon: 'shield-x', c: p.danger, t: 'Gemini rejected your key', d: 'It may have been deleted in AI Studio, or copied without its last characters.', btns: [['Update key', actions.addKey], ['Try again', actions.retry]] },
    'limit-day': { icon: 'gauge', c: p.warn, t: 'Daily limit reached', d: `Your free Gemini key has used today’s requests. It resets ${quotaResetLabel(new Date())}. Your photo is kept.`, btns: [['Set up by hand', actions.hand], ['OK', actions.ok]] },
    'limit-minute': { icon: 'gauge', c: p.warn, t: 'Too many requests', d: 'The free key allows a few scans a minute. Wait a minute, then try again. Your photo is kept.', btns: [['Try again', actions.retry], ['Set up by hand', actions.hand]] },
    unreadable: { icon: 'image-off', c: p.danger, t: 'Couldn’t read this photo', d: 'Gemini couldn’t find a timetable grid. Try another photo:', tips: ['The whole grid and legend are in frame', 'Taken straight on, not at an angle', 'No glare or shadow over the text', 'Text is sharp when you zoom in'], btns: [['Retake photo', actions.camera], ['Pick another photo', actions.library]] },
    offline: { icon: 'wifi-off', c: p.muted, t: 'You’re offline', d: 'The AI scan needs internet. Your photo and choices are kept. Setting up the week by hand works offline.', btns: [['Try again', actions.retry], ['Set up by hand', actions.hand]] },
    other: { icon: 'circle-alert', c: p.danger, t: 'Gemini couldn’t finish', d: detail || 'Something went wrong while reading the photo.', btns: [['Try again', actions.retry], ['Set up by hand', actions.hand]] },
  };
  const e = E[kind === 'cancelled' ? 'other' : kind];
  return (
    <>
      <View style={[{ marginTop: 20, paddingVertical: 24, paddingHorizontal: 18, borderRadius: 24, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, alignItems: 'center', gap: 12 }, shadow(p)]} accessibilityLiveRegion="polite">
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: tint(e.c, 13), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={e.icon} size={26} color={e.c} />
        </View>
        <T w={800} size={18} style={{ lineHeight: 24, textAlign: 'center' }} accessibilityRole="header">{e.t}</T>
        <T c={p.muted} size={13.5} style={{ lineHeight: 20, textAlign: 'center' }}>{e.d}</T>
        {e.tips ? (
          <View style={{ alignSelf: 'stretch', gap: 6, padding: 12, borderRadius: 14, backgroundColor: p.surface }}>
            {e.tips.map((t) => (
              <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
                <Icon name="check" size={14} color={p.success} />
                <T w={600} size={13} style={{ flex: 1, lineHeight: 18 }}>{t}</T>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {e.btns.map(([label, on], i) => <PrimaryButton key={label} label={label} onPress={on} tone={i === 0 ? 'primary' : 'plain'} />)}
    </>
  );
}

function EditClass({ item, title, starts, period, onClose, onSave, onRemove }: {
  item: ScanClass; title: string; starts: string[]; period: number; onClose: () => void; onSave: (c: ScanClass) => void; onRemove: () => void;
}) {
  const p = useUni();
  const [c, setC] = useState(item);
  const chip = (on: boolean) => ({ backgroundColor: on ? p.text : p.elev, borderColor: p.hair });
  const change = (x: Partial<Pick<ScanClass, 'day' | 'start' | 'part' | 'room'>>) => setC((cur) => editClass(cur, x, period));
  return (
    <Sheet visible onClose={onClose} title={title} text={`${WEEKDAY_SHORT[c.day]} ${clock(c.start)}–${clock(c.end)}`}
      buttons={[{ label: 'Remove class', tone: 'plain', onPress: onRemove }, { label: 'Save', tone: 'primary', onPress: () => onSave(c) }]}>
      <View style={{ gap: 14, paddingVertical: 12 }}>
        <View style={{ gap: 6 }}>
          <FieldLabel>Day</FieldLabel>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <Tap key={d} onPress={() => change({ day: d })} accessibilityRole="radio" accessibilityState={{ selected: c.day === d }}
                style={[{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, chip(c.day === d)]}>
                <T w={800} size={13} c={c.day === d ? p.bg : p.text}>{WEEKDAY_SHORT[d]}</T>
              </Tap>
            ))}
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <FieldLabel>Starts</FieldLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5 }}>
            {(starts.includes(c.start) ? starts : [...starts, c.start].sort()).map((s) => (
              <Tap key={s} onPress={() => change({ start: s })} accessibilityRole="radio" accessibilityState={{ selected: c.start === s }}
                style={[{ height: 44, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, justifyContent: 'center' }, chip(c.start === s)]}>
                <T w={700} size={12.5} c={c.start === s ? p.bg : p.text} style={mono(700)}>{clock(s, false)}</T>
              </Tap>
            ))}
          </ScrollView>
        </View>
        <Switch3<Part> items={[['theory', PART_TITLE.theory], ['tutorial', PART_TITLE.tutorial], ['lab', PART_TITLE.lab]]} value={c.part} onChange={(part) => change({ part })} />
        <TextInput value={c.room} onChangeText={(room) => setC((cur) => ({ ...cur, room: room.slice(0, 40) }))} placeholder="Room" placeholderTextColor={p.muted} accessibilityLabel="Room"
          style={[sans(600), { height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: p.border, backgroundColor: p.elev, paddingHorizontal: 13, fontSize: 15, color: p.text }]} />
      </View>
    </Sheet>
  );
}
