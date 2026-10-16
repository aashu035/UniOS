import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Icon } from '../../components/uni/Icon';
import { T, Tap } from '../../components/uni/primitives';
import { ErrorText, Field, FieldLabel, FormPage, Input, PrimaryButton, Switch3 } from '../../components/uni/form';
import { useToast } from '../../components/uni/Toast';
import { useUni } from '../../components/uni/theme';
import { getLocalDateString, parseLocalDate } from '../../core/utils/date';
import { dayName, shortDate } from '../../domains/academic/logic';
import { termFor, validateSemester, type SemesterDraft } from '../../domains/profile/form';
import { SemesterRepository } from '../../domains/semester/repository';

type Sem = Awaited<ReturnType<typeof SemesterRepository.listWithCourseCounts>>[number];

/** Add semester / Edit semester (handoff §5). `?id=` edits. */
export default function SemesterForm() {
  const p = useUni();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id && /^\d+$/.test(id) ? Number(id) : null;

  const [all, setAll] = useState<Sem[]>([]);
  const [d, setD] = useState<SemesterDraft>({ id: editId, number: '', name: '', term: 'odd', start: '', end: '', sgpa: '' });
  const [termTouched, setTermTouched] = useState(false);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    SemesterRepository.listWithCourseCounts().then((list) => {
      setAll(list);
      const ed = editId != null ? list.find((s) => s.id === editId) : null;
      if (ed) {
        setD({ id: ed.id, number: String(ed.number), name: ed.name ?? '', term: ed.type === 'even' ? 'even' : 'odd', start: ed.startDate ?? '', end: ed.endDate ?? '', sgpa: ed.sgpa != null ? String(ed.sgpa) : '' });
        setTermTouched(true);
      } else {
        const next = Math.min(12, (list[0]?.number ?? 0) + 1);
        setD((x) => ({ ...x, number: String(next), term: termFor(next) }));
      }
    }).catch((e) => console.error('Could not load semesters', e));
  }, [editId]);

  const { errors, values } = validateSemester(d, all);
  const n = Number(d.number) || 0;
  const setNumber = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 2);
    const k = Number(clean);
    setD((x) => ({ ...x, number: clean, ...(!termTouched && k ? { term: termFor(k) } : {}) }));
  };
  const step = (delta: number) => setNumber(String(Math.max(1, Math.min(12, (n || 0) + delta))));
  const showDateErr = tried || (d.start && d.end && d.end <= d.start);

  const save = async () => {
    setTried(true);
    if (!values) return;
    setSaving(true);
    try {
      if (editId != null) await SemesterRepository.updateSemester(editId, values);
      else await SemesterRepository.addSemester(values);
      toast.show(`${editId != null ? 'Saved' : 'Added'} ${values.name || `Semester ${values.number}`}.`);
      router.back();
    } catch (e: any) {
      toast.show(e?.message ?? 'Could not save the semester.');
      setSaving(false);
    }
  };

  const dateBox = (k: 'start' | 'end', label: string) => {
    const v = d[k];
    const bad = k === 'end' && showDateErr && !!errors.dates && !!d.start && !!d.end;
    return (
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <FieldLabel>{label}</FieldLabel>
        <Tap onPress={() => setPicker(k)} accessibilityRole="button" accessibilityLabel={`${label}: ${v ? `${dayName(v)} ${shortDate(v)} ${v.slice(0, 4)}` : 'not set'}`}
          style={{ height: 50, borderRadius: 13, borderWidth: 1.5, borderColor: bad || (tried && !v) ? p.danger : p.border, backgroundColor: p.elev, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="calendar" size={16} color={p.muted} />
          <T w={600} c={v ? p.text : p.muted} size={14} numberOfLines={1}>{v ? `${shortDate(v)} ${v.slice(0, 4)}` : 'Pick date'}</T>
        </Tap>
      </View>
    );
  };

  return (
    <FormPage title={editId != null ? 'Edit semester' : 'Add semester'} onBack={() => router.back()} gap={14}
      footer={<PrimaryButton label={editId != null ? 'Save changes' : 'Add semester'} onPress={save} busy={saving} />}>
      <View style={{ gap: 6 }}>
        <FieldLabel>Semester number</FieldLabel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Tap onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="One less"
            style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="minus" size={18} color={p.text} />
          </Tap>
          <Input value={d.number} onChangeText={setNumber} keyboardType="number-pad" placeholder="1–12" invalid={tried && !!errors.number} accessibilityLabel="Semester number"
            style={{ flex: 1, minWidth: 0, minHeight: 50, textAlign: 'center', fontSize: 20, fontFamily: 'JetBrainsMono_700Bold' }} />
          <Tap onPress={() => step(1)} accessibilityRole="button" accessibilityLabel="One more"
            style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={18} color={p.text} />
          </Tap>
        </View>
        {tried && errors.number ? <ErrorText>{errors.number}</ErrorText> : null}
      </View>

      <Field label="Name (optional)">
        <Input value={d.name} onChangeText={(v) => setD((x) => ({ ...x, name: v.slice(0, 40) }))} placeholder={`e.g. Semester ${n || 6} or Summer term`} style={{ minHeight: 50, borderRadius: 13 }} />
      </Field>

      <View style={{ gap: 6 }}>
        <FieldLabel>Term</FieldLabel>
        <Switch3 items={[['odd', 'Odd'], ['even', 'Even']]} value={d.term} onChange={(t) => { setTermTouched(true); setD((x) => ({ ...x, term: t })); }} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {dateBox('start', 'Starts')}
        {dateBox('end', 'Ends')}
      </View>
      {showDateErr && errors.dates ? <View style={{ marginTop: -6 }}><ErrorText>{errors.dates}</ErrorText></View> : null}
      {picker ? (
        <DateTimePicker mode="date" value={parseLocalDate(d[picker] || d.start || getLocalDateString(new Date()))}
          onChange={(e, v) => { const k = picker; setPicker(null); if (e.type === 'set' && v) setD((x) => ({ ...x, [k]: getLocalDateString(v) })); }} />
      ) : null}

      <Field label="SGPA (optional)" error={tried ? errors.sgpa : null}>
        <Input value={d.sgpa} onChangeText={(v) => setD((x) => ({ ...x, sgpa: v }))} keyboardType="decimal-pad" placeholder="Add after results" invalid={tried && !!errors.sgpa}
          style={[{ minHeight: 50, borderRadius: 13 }, d.sgpa ? { fontFamily: 'JetBrainsMono_700Bold' } : null]} accessibilityLabel="SGPA" />
      </Field>
    </FormPage>
  );
}
