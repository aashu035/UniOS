import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { Icon, type IconName } from '../../components/uni/Icon';
import { Card, Empty, RoundButton, Screen, Segmented, T, Tap } from '../../components/uni/primitives';
import { tint, useUni } from '../../components/uni/theme';
import { db } from '../../core/db/client';
import { getLocalDateString } from '../../core/utils/date';
import { clock, dayDate } from '../../domains/academic/logic';
import { recurringSchedules, scheduleExceptions } from '../../domains/calendar/model';
import { DayRuleRepository } from '../../domains/calendar/dayRules';
import { ScheduleExceptionRepository } from '../../domains/calendar/exceptions';
import { courseComponents, workspaces } from '../../domains/workspace/model';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type Card = { key: string; when: string; icon: IconName; color: string; title: string; sub: string; impact: string; undo: string[]; doUndo: () => Promise<void>; edit?: { mode: string; occ?: string; date?: string } };

/** Every schedule change, upcoming and past, with what Undo brings back (handoff §1e). */
export default function Changes() {
  const p = useUni();
  const router = useRouter();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [tab, setTab] = useState<'up' | 'past'>('up');
  const today = getLocalDateString(new Date());

  const load = useCallback(async () => {
    const rules = await DayRuleRepository.all();
    const ex = await db.select({ e: scheduleExceptions, ws: workspaces, type: courseComponents.type })
      .from(scheduleExceptions)
      .innerJoin(courseComponents, eq(scheduleExceptions.componentId, courseComponents.id))
      .innerJoin(workspaces, eq(courseComponents.workspaceId, workspaces.id)).all();
    const recs = new Map((await db.select().from(recurringSchedules).all()).map((r) => [r.id, r]));
    const out: Card[] = [];
    for (const r of rules) {
      if (r.linkedRuleId) continue; // shown inside its follow card
      if (r.kind === 'follow') {
        const holiday = r.borrowedDate && r.borrowedMode !== 'normal' ? r.borrowedDate : null;
        out.push({
          key: `r${r.id}`, when: r.date, icon: 'calendar-days', color: p.warn,
          title: `${dayDate(r.date)} follows ${WEEKDAY[r.followsWeekday ?? 0]}'s timetable`,
          sub: [r.reason, r.note].filter(Boolean).join(' · '),
          impact: `Its own classes are Off · ${WEEKDAY[r.followsWeekday ?? 0]}'s classes count${holiday ? ` · ${dayDate(holiday)} ${r.borrowedMode === 'holiday' ? 'is a holiday' : 'not sure yet'}` : ''}`,
          undo: [`${dayDate(r.date)}'s own classes come back and count again`, 'Marks made on them before the change come back', ...(holiday ? [`${dayDate(holiday)} goes back to a normal day`] : [])],
          doUndo: () => DayRuleRepository.remove(r.id), edit: { mode: 'follow', date: r.date },
        });
      } else {
        out.push({
          key: `r${r.id}`, when: r.date, icon: 'circle-slash', color: p.off,
          title: `${dayDate(r.date)} · whole day off`, sub: [r.reason, r.note].filter(Boolean).join(' · '),
          impact: 'All classes that day are Off · not counted',
          undo: ['All classes that day come back and count again', 'Marks made before come back'],
          doUndo: () => DayRuleRepository.remove(r.id), edit: { mode: 'cancel', date: r.date },
        });
      }
    }
    for (const { e, ws, type } of ex) {
      const name = `${ws.name}${type === 'lab' ? ' Lab' : type === 'tutorial' ? ' Tutorial' : ''}`;
      const rec = e.recurringScheduleId ? recs.get(e.recurringScheduleId) : undefined;
      if (e.action === 'extra') {
        out.push({
          key: `e${e.id}`, when: e.specificDate, icon: 'list-plus', color: ws.color || p.primary,
          title: `Extra ${name} · ${dayDate(e.specificDate)}, ${clock(e.startTime ?? '00:00', false)}`, sub: e.reason ?? 'Extra class',
          impact: `Counts for ${ws.name} like any other class`,
          undo: [`The extra ${ws.name} class is removed`, 'If you marked it, that mark is removed too'],
          doUndo: () => ScheduleExceptionRepository.removeExtra(e.id),
        });
      } else if (e.action === 'move' && rec) {
        const to = e.targetDate ?? e.specificDate;
        out.push({
          key: `e${e.id}`, when: to > e.specificDate ? to : e.specificDate, icon: 'arrow-left-right', color: p.primary,
          title: `${name} moved`, sub: `${dayDate(e.specificDate)} ${clock(rec.startTime, false)}  →  ${dayDate(to)} ${clock(e.startTime ?? rec.startTime, false)}${e.reason ? ` · ${e.reason}` : ''}`,
          impact: 'Old slot not counted · the new slot counts',
          undo: [`${ws.name} goes back to ${dayDate(e.specificDate)}, ${clock(rec.startTime, false)}`],
          doUndo: () => ScheduleExceptionRepository.restore(rec.id, e.specificDate),
          edit: { mode: 'move', occ: `rec_${rec.id}_${e.specificDate}`, date: e.specificDate },
        });
      } else if (e.action === 'cancel' && rec) {
        out.push({
          key: `e${e.id}`, when: e.specificDate, icon: 'circle-slash', color: p.off,
          title: `${name} cancelled · ${dayDate(e.specificDate)}, ${clock(rec.startTime, false)}`, sub: e.reason ?? 'Cancelled',
          impact: '1 class Off · not counted',
          undo: ['The class comes back and counts again', 'A mark it had before comes back'],
          doUndo: () => ScheduleExceptionRepository.restore(rec.id, e.specificDate),
        });
      }
    }
    out.sort((a, b) => a.when.localeCompare(b.when));
    setCards(out);
  }, [p]);
  useFocusEffect(useCallback(() => { load().catch((e) => Alert.alert('Could not load changes', e?.message ?? String(e))); }, [load]));

  const undo = (c: Card) => Alert.alert('Undo this change?', c.undo.map((u) => `• ${u}`).join('\n'), [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Undo change', style: 'destructive', onPress: () => c.doUndo().then(load).catch((e) => Alert.alert('Could not undo', e?.message ?? String(e))) },
  ]);

  const shown = (cards ?? []).filter((c) => (tab === 'up' ? c.when >= today : c.when < today));
  if (tab === 'past') shown.reverse();

  return (
    <Screen tabs={false}>
      <View style={styles.top}>
        <RoundButton icon="chevron-left" label="Back" onPress={() => router.back()} />
        <T w={800} size={20} style={{ flex: 1 }}>Schedule changes</T>
        <RoundButton icon="plus" label="New change" onPress={() => router.push('/schedule/change' as any)} />
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 12 }}>
        <Segmented<'up' | 'past'> items={[['up', 'Upcoming'], ['past', 'Past']]} value={tab} onChange={setTab} />
        {cards && !shown.length ? (
          <Empty icon="calendar-clock" title={tab === 'up' ? 'No upcoming changes' : 'No past changes'} body="When a class is cancelled, moved, added, or a day follows another day's timetable, it shows here." action="Add a change" onAction={() => router.push('/schedule/change' as any)} />
        ) : null}
        {shown.map((c) => (
          <Card key={c.key} style={{ padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={[styles.well, { backgroundColor: tint(c.color, 14) }]}><Icon name={c.icon} size={18} color={c.color} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T w={800} size={14.5}>{c.title}</T>
                {c.sub ? <T c={p.muted} size={12.5} style={{ marginTop: 2 }}>{c.sub}</T> : null}
              </View>
            </View>
            <T w={600} size={12.5}>{c.impact}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {c.edit ? (
                <Tap onPress={() => router.push({ pathname: '/schedule/change', params: c.edit } as any)} style={[styles.btn, { backgroundColor: p.surface }]}>
                  <T w={700} size={13}>Edit</T>
                </Tap>
              ) : null}
              <Tap onPress={() => undo(c)} style={[styles.btn, { backgroundColor: tint(p.danger, 10) }]}>
                <T w={700} size={13} c={p.danger}>Undo</T>
              </Tap>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  well: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
});
