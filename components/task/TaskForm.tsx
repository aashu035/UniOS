import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Icon } from '../uni/Icon';
import { Empty, T, Tap } from '../uni/primitives';
import { Choice, ChoiceRow, Field, FieldLabel, FormPage, Input, PrimaryButton, Switch3, TwoTapDelete } from '../uni/form';
import { useToast } from '../uni/Toast';
import { tint, useUni } from '../uni/theme';
import { getLocalDateString, parseLocalDate } from '../../core/utils/date';
import { setTaskDone } from '../../domains/academic/actions';
import { useAcademic } from '../../domains/academic/hooks';
import { addDays, clock, isDone } from '../../domains/academic/logic';
import { shortLabel } from '../../domains/academic/snapshot';
import { CalendarService } from '../../domains/calendar/service';
import {
  dueLabel, joinDue, NAME_COUNTER_FROM, NAME_MAX, nameError, nextClassOf, nextClassSub, PRIORITIES, priorityKey, savedToast, splitDue,
  TASK_TYPES, typeKey, type PriorityKey, type TaskTypeKey,
} from '../../domains/task/form';
import { TaskRepository } from '../../domains/task/repository';
import { TaskService } from '../../domains/task/service';
import { WorkspaceRepository } from '../../domains/workspace/repository';

type DueKind = 'today' | 'tomorrow' | 'next' | 'pick' | '';
const GENERAL = { id: null as number | null, short: 'General', name: 'General', color: '#64748B' };

/**
 * Add task / Edit task (design UniTask, handoff §3). One screen, two modes.
 * Opened from a course, the course is a locked row that only changes after "Change".
 */
export function TaskForm({ mode, taskId, presetCourseId, presetType }: { mode: 'add' | 'edit'; taskId?: number; presetCourseId?: number | null; presetType?: string }) {
  const p = useUni();
  const router = useRouter();
  const toast = useToast();
  const { data } = useAcademic();
  const edit = mode === 'edit';
  const today = getLocalDateString(new Date());
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const [loaded, setLoaded] = useState(!edit);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<TaskTypeKey>(typeKey(presetType ?? null));
  const [course, setCourse] = useState<number | null>(presetCourseId ?? null);
  const [locked, setLocked] = useState(presetCourseId != null);
  const [due, setDue] = useState<string | null>(null);
  const [kind, setKind] = useState<DueKind>('');
  const [time, setTime] = useState<string | null>(null);
  const [pri, setPri] = useState<PriorityKey>('medium');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [extraCourse, setExtraCourse] = useState<{ id: number; short: string; name: string; color: string } | null>(null);
  const [next, setNext] = useState<{ date: string; time: string } | null>(null);

  // Edit: load the task. A course outside the active semester still shows by name.
  useEffect(() => {
    if (!edit || taskId == null) return;
    (async () => {
      const t = await TaskRepository.getTaskById(taskId);
      if (!t) { setMissing(true); setLoaded(true); return; }
      const d = splitDue(t.dueDate);
      setName(t.title); setType(typeKey(t.type)); setCourse(t.workspaceId ?? null); setLocked(t.workspaceId != null);
      setDue(d.date); setKind(d.date ? 'pick' : ''); setTime(d.time); setPri(priorityKey(t.priority));
      setNotes(t.description ?? ''); setDone(isDone(t.status));
      setLoaded(true);
    })().catch((e) => { console.error('Could not load task', e); setMissing(true); setLoaded(true); });
  }, [edit, taskId]);

  const courses = useMemo(() => [...(data?.courses ?? []).map((c) => ({ id: c.id as number | null, short: c.short, name: c.name, color: c.color }))], [data]);
  useEffect(() => {
    if (course == null || !data || courses.some((c) => c.id === course)) { setExtraCourse(null); return; }
    WorkspaceRepository.getAllWorkspaces().then((all) => {
      const w = all.find((x) => x.id === course);
      setExtraCourse(w ? { id: w.id, short: shortLabel(w.name), name: w.name, color: w.color || '#6C5CE7' } : null);
    }).catch(() => setExtraCourse(null));
  }, [course, data, courses]);
  const options = [...courses, ...(extraCourse ? [extraCourse] : []), GENERAL];
  const cur = options.find((c) => c.id === course) ?? GENERAL;

  // "Next SC class" from the effective schedule (schedule changes included).
  useEffect(() => {
    if (course == null) { setNext(null); return; }
    let alive = true;
    CalendarService.getEffectiveSchedule(today, addDays(today, 14))
      .then((occ) => { if (alive) setNext(nextClassOf(occ, course, today, nowMin)); })
      .catch(() => { if (alive) setNext(null); });
    return () => { alive = false; };
  }, [course, today]);

  if (!loaded) return <FormPage title={edit ? 'Edit task' : 'New task'} onBack={() => router.back()}><View /></FormPage>;
  if (missing) {
    return (
      <FormPage title="Edit task" onBack={() => router.back()}>
        <Empty icon="list-plus" title="This task isn't here any more" body="It was deleted, or removed with its course." action="Go back" onAction={() => router.back()} />
      </FormPage>
    );
  }

  const err = tried ? nameError(name) : null;
  const label = due ? dueLabel(due, time, today) : null;
  const pickQuick = (k: DueKind) => {
    if (k === 'today') { setKind(k); setDue(today); }
    else if (k === 'tomorrow') { setKind(k); setDue(addDays(today, 1)); }
    else if (k === 'next' && next) { setKind(k); setDue(next.date); setTime(next.time); }
    else if (k === 'pick') setPicker('date');
  };
  const chooseCourse = (id: number | null) => {
    setCourse(id);
    if (kind === 'next') { setKind(''); setDue(null); setTime(null); } // the next class was the old course's
  };

  const toggleDone = async () => {
    if (!edit || taskId == null) return;
    const nextDone = !done;
    setDone(nextDone);
    try {
      await setTaskDone({ id: taskId, title: name, workspaceId: course }, nextDone);
      toast.show(nextDone ? 'Marked done.' : 'Marked not done.');
    } catch (e: any) {
      setDone(!nextDone);
      toast.show(`Could not save: ${e?.message ?? 'try again'}`);
    }
  };

  const save = async () => {
    setTried(true);
    if (nameError(name)) return;
    setSaving(true);
    const fields = {
      title: name.trim(), description: notes.trim() || null, type, dueDate: joinDue(due, time), priority: pri, workspaceId: course,
    };
    try {
      if (edit && taskId != null) await TaskRepository.updateTask(taskId, fields);
      else await TaskService.createTask({ ...fields, description: fields.description ?? undefined, dueDate: fields.dueDate ?? undefined, status: 'pending' });
      toast.show(savedToast(edit ? 'Saved' : 'Added', name, !!label?.late));
      router.back();
    } catch (e: any) {
      console.error('Could not save task', e);
      toast.show(`Could not save the task. ${e?.message ?? ''}`.trim());
      setSaving(false);
    }
  };

  const remove = async () => {
    if (taskId == null) return;
    try {
      const row = await TaskRepository.deleteTask(taskId);
      router.back();
      toast.show(savedToast('Deleted', name), row ? {
        undo: async () => {
          try { await TaskRepository.restoreTask(row); toast.show('Task restored.'); } catch (e: any) { toast.show(e?.message ?? 'Could not restore the task.'); }
        },
      } : undefined);
    } catch (e: any) {
      toast.show(`Could not delete the task. ${e?.message ?? ''}`.trim());
    }
  };

  const quick: Array<[DueKind, string, string | undefined, boolean]> = [
    ['today', 'Today', undefined, false],
    ['tomorrow', 'Tomorrow', undefined, false],
    ['next', course == null ? 'Next class' : `Next ${cur.short} class`, course == null ? 'Pick a course first' : next ? nextClassSub(next) : 'No class in 2 weeks', course == null || !next],
    ['pick', 'Pick date', undefined, false],
  ];

  return (
    <FormPage title={edit ? 'Edit task' : 'New task'} onBack={() => router.back()}
      footer={<PrimaryButton label={edit ? 'Save changes' : 'Add task'} onPress={save} busy={saving} />}>
      {edit ? (
        <Tap onPress={toggleDone} accessibilityRole="checkbox" accessibilityState={{ checked: done }}
          style={{ minHeight: 60, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: p.hair, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: done ? tint(p.success, 10) : p.elev }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: done ? p.success : p.border, backgroundColor: done ? p.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {done ? <Icon name="check" size={16} color="#fff" width={3} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <T w={800} size={15}>{done ? 'Done' : 'Mark done'}</T>
            <T w={600} c={p.muted} size={12} style={{ marginTop: 1 }}>{done ? 'Tap to mark not done' : 'Moves it to Done on the Tasks tab'}</T>
          </View>
        </Tap>
      ) : null}

      <Field label="Task name" error={err}
        right={name.length > NAME_COUNTER_FROM ? <T w={700} c={name.length >= NAME_MAX ? p.danger : p.muted} size={11.5} style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{name.length} / {NAME_MAX}</T> : undefined}>
        <Input big multiline value={name} onChangeText={(v) => setName(v.replace(/\n/g, ' ').slice(0, NAME_MAX))} maxLength={NAME_MAX}
          placeholder="e.g. FLA Assignment 2" invalid={!!err} accessibilityLabel="Task name"
          style={{ textDecorationLine: done ? 'line-through' : 'none' }} returnKeyType="done" blurOnSubmit />
      </Field>

      <View style={{ gap: 8 }}>
        <FieldLabel>Type</FieldLabel>
        <ChoiceRow>
          {TASK_TYPES.map(([k, l, icon]) => <Choice key={k} label={l} icon={icon} selected={type === k} onPress={() => setType(k)} />)}
        </ChoiceRow>
      </View>

      <View style={{ gap: 8 }}>
        <FieldLabel>Course</FieldLabel>
        {locked ? (
          <Tap onPress={() => setLocked(false)} accessibilityRole="button" accessibilityLabel={`${cur.name}. Change course`}
            style={{ minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: p.hair, backgroundColor: p.elev, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 4, backgroundColor: cur.color }} />
            <T w={800} size={14.5} numberOfLines={1} style={{ flex: 1 }}>{cur.name}</T>
            <T w={800} c={p.primary} size={13}>Change</T>
          </Tap>
        ) : (
          <>
            <ChoiceRow>
              {options.map((c) => <Choice key={c.id ?? 'general'} label={c.short} dot={c.color} minWidth={44} selected={course === c.id} onPress={() => chooseCourse(c.id)} />)}
            </ChoiceRow>
            <T w={600} c={p.muted} size={12}>{cur.name}</T>
          </>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <FieldLabel>Due</FieldLabel>
        <ChoiceRow>
          {quick.map(([k, l, sub, disabled]) => <Choice key={k} label={l} sub={sub} disabled={disabled} selected={kind === k && !!due} onPress={() => pickQuick(k)} />)}
        </ChoiceRow>
        {due && label ? (
          <>
            <View style={{ minHeight: 52, paddingLeft: 14, paddingRight: 6, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: label.late ? tint(p.danger, 9) : p.surface }}>
              <Icon name={label.late ? 'clock-alert' : 'calendar'} size={17} color={label.late ? p.danger : p.muted} />
              <Tap onPress={() => setPicker('date')} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Due ${label.text}${label.late ? ', already late' : ''}. Change date`}>
                <T w={800} size={14.5}>{label.text}</T>
                {label.late ? <T w={700} c={p.danger} size={12}>Already late</T> : null}
              </Tap>
              <Tap onPress={() => { setDue(null); setKind(''); setTime(null); }} accessibilityRole="button" accessibilityLabel="Clear due date"
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="x" size={17} color={p.muted} />
              </Tap>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Choice label="No time" selected={!time} onPress={() => setTime(null)} />
              <Tap onPress={() => setPicker('time')} accessibilityRole="button" accessibilityLabel={time ? `Time ${time}. Change` : 'Add a time'}
                style={{ height: 44, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1.5, borderColor: time ? p.primary : p.border, backgroundColor: p.elev, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="clock-3" size={15} color={time ? p.primary : p.muted} />
                {time ? <T w={700} size={14} style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{clock(time)}</T> : <T w={800} c={p.muted} size={13.5}>Add time</T>}
              </Tap>
            </View>
          </>
        ) : null}
        {picker ? (
          <DateTimePicker mode={picker} is24Hour={false}
            value={picker === 'date' ? parseLocalDate(due ?? addDays(today, 7)) : (() => { const d = new Date(); const [h, m] = (time ?? '23:59').split(':').map(Number); d.setHours(h, m, 0, 0); return d; })()}
            onChange={(e, v) => {
              setPicker(null);
              if (e.type !== 'set' || !v) return;
              if (picker === 'date') { setDue(getLocalDateString(v)); setKind('pick'); }
              else setTime(`${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`);
            }} />
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <FieldLabel>Priority</FieldLabel>
        <Switch3 items={PRIORITIES.map(([k, l]) => [k, l, k === 'low' ? '#64748B' : k === 'medium' ? p.warn : p.danger] as [PriorityKey, string, string])} value={pri} onChange={setPri} />
      </View>

      <Field label="Notes">
        <Input multiline value={notes} onChangeText={setNotes} placeholder="Pages, question numbers, where to submit…" style={{ minHeight: 96 }} accessibilityLabel="Notes" />
      </Field>

      {edit ? <TwoTapDelete label="Delete task" armedLabel="Tap again to delete" onConfirm={remove} /> : null}
    </FormPage>
  );
}
