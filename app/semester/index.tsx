import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Icon } from '../../components/uni/Icon';
import { T, Tap } from '../../components/uni/primitives';
import { FormPage, PrimaryButton } from '../../components/uni/form';
import { Sheet } from '../../components/uni/Sheet';
import { useToast } from '../../components/uni/Toast';
import { shadow, useUni } from '../../components/uni/theme';
import { semesterRange, semesterTitle, termLabel } from '../../domains/profile/form';
import { SemesterRepository } from '../../domains/semester/repository';

type Sem = Awaited<ReturnType<typeof SemesterRepository.listWithCourseCounts>>[number];
type SheetKind = 'actions' | 'blocked' | 'delete' | null;

const courses = (n: number) => `${n} course${n === 1 ? '' : 's'}`;

/**
 * Semesters (handoff §5): newest first, the active one outlined. Tap a card for
 * Set active / Edit / Delete; a semester with courses cannot be deleted.
 */
export default function Semesters() {
  const p = useUni();
  const router = useRouter();
  const toast = useToast();
  const [sems, setSems] = useState<Sem[] | null>(null);
  const [sel, setSel] = useState<Sem | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);

  const load = useCallback(async () => setSems(await SemesterRepository.listWithCourseCounts()), []);
  useFocusEffect(useCallback(() => { load().catch((e) => console.error('Could not load semesters', e)); }, [load]));

  const close = () => setSheet(null);
  const add = () => router.push('/semester/add');

  const setActive = async (s: Sem) => {
    close();
    try {
      await SemesterRepository.activateSemester(s.id);
      toast.show(`${semesterTitle(s)} is now active. Home and Timetable show its courses.`);
      load();
    } catch (e: any) { toast.show(e?.message ?? 'Could not change the active semester.'); }
  };
  const remove = async (s: Sem) => {
    close();
    try {
      const row = await SemesterRepository.deleteSemester(s.id);
      load();
      toast.show(`${semesterTitle(s)} deleted.`, row ? { undo: async () => { await SemesterRepository.restoreSemester(row); load(); } } : undefined);
    } catch (e: any) { toast.show(e?.message ?? 'Could not delete the semester.'); }
  };

  return (
    <FormPage title="Semesters" backIcon="chevron-left" onBack={() => router.back()} gap={14}
      right={(
        <Tap onPress={add} accessibilityRole="button" accessibilityLabel="Add semester"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={20} color="#fff" width={2.6} />
        </Tap>
      )}>
      {sems && !sems.length ? (
        <View style={[{ marginTop: 30, padding: 28, paddingHorizontal: 20, borderRadius: 24, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, alignItems: 'center', gap: 12 }, shadow(p)]}>
          <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="layers" size={26} color={p.primary} />
          </View>
          <T w={800} size={18}>Add your first semester</T>
          <T c={p.muted} size={13.5} style={{ lineHeight: 20, textAlign: 'center' }}>
            Courses belong to a semester. Add the one you're in now, then add its courses. Old semesters keep their attendance and SGPA.
          </T>
          <View style={{ alignSelf: 'stretch' }}><PrimaryButton label="Add semester" onPress={add} /></View>
        </View>
      ) : null}

      {(sems ?? []).map((m) => {
        const on = !!m.isActive;
        const range = semesterRange(m.startDate, m.endDate);
        return (
          <Tap key={m.id} onPress={() => { setSel(m); setSheet('actions'); }} accessibilityRole="button"
            accessibilityLabel={`${semesterTitle(m)}${on ? ', active' : ''}, ${courses(m.courses)}${m.sgpa != null ? `, SGPA ${m.sgpa}` : ''}`}
            style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, backgroundColor: p.elev, borderWidth: on ? 1.5 : 1, borderColor: on ? p.primary : p.hair }, shadow(p)]}>
            <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: on ? p.primary : p.surface, alignItems: 'center', justifyContent: 'center' }}>
              <T w={800} c={on ? '#fff' : p.text} size={18} style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{m.number}</T>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <T w={800} size={15} style={{ lineHeight: 20 }}>{semesterTitle(m)}</T>
                {on ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 7, backgroundColor: p.primary }}><T w={800} c="#fff" size={11}>Active</T></View> : null}
              </View>
              <T w={600} c={p.muted} size={12.5}>{[termLabel(m.type, m.number), range].filter(Boolean).join(' · ')}</T>
              <T w={600} c={p.muted} size={12.5}>{courses(m.courses)}</T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T w={800} c={m.sgpa != null ? p.text : p.muted} size={17} style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{m.sgpa != null ? m.sgpa.toFixed(2) : '—'}</T>
              <T w={700} c={p.muted} size={11}>{m.sgpa != null ? 'SGPA' : on ? 'In progress' : 'Add SGPA'}</T>
            </View>
          </Tap>
        );
      })}

      {sel ? (
        <>
          <Sheet visible={sheet === 'actions'} onClose={close} title={semesterTitle(sel)}
            text={[semesterRange(sel.startDate, sel.endDate), courses(sel.courses)].filter(Boolean).join(' · ')}
            rows={[
              ...(sel.isActive ? [] : [{ icon: 'circle-check' as const, label: 'Set active', onPress: () => setActive(sel) }]),
              { icon: 'pencil', label: 'Edit', onPress: () => { close(); router.push({ pathname: '/semester/add', params: { id: String(sel.id) } }); } },
              { icon: 'trash-2', label: 'Delete', danger: true, onPress: () => setSheet(sel.courses ? 'blocked' : 'delete') },
            ]} />
          <Sheet visible={sheet === 'blocked'} onClose={close} title={`Can't delete ${semesterTitle(sel)} yet`}
            text={`Move or delete its ${courses(sel.courses)} first. Their attendance and files go with them.`}
            buttons={[{ label: 'Close', onPress: close }, { label: 'Open courses', tone: 'primary', onPress: () => { close(); router.push('/(main)/menu'); } }]} />
          <Sheet visible={sheet === 'delete'} onClose={close} title={`Delete ${semesterTitle(sel)}?`}
            text="It has no courses. You can undo for a few seconds."
            buttons={[{ label: 'Cancel', onPress: close }, { label: 'Delete', tone: 'danger', onPress: () => remove(sel) }]} />
        </>
      ) : null}
    </FormPage>
  );
}
