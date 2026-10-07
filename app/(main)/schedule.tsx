import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon, courseIcon } from '../../components/uni/Icon';
import { Card, Chip, Empty, LargeTitle, Rise, RoundButton, Screen, T, Tap } from '../../components/uni/primitives';
import { mono, tint, useUni } from '../../components/uni/theme';
import { useAcademic, useNowMinutes } from '../../domains/academic/hooks';
import { addDays, clock, dayName, hoursOf, isoWeek, layoutLanes, minutesOf, mondayOf, shortDate } from '../../domains/academic/logic';
import { getLocalDateString } from '../../core/utils/date';
import type { Occ } from '../../domains/academic/snapshot';

const PX = 52; // points per hour on the day timeline
const MIN_BLOCK = 36; // shortest drawn block, so a brief class stays legible
const GUTTER = 46; // hour labels to the left of the blocks
const LANE_GAP = 4;
const GLANCE_HOURS = [9, 10, 11, 12, 13, 14, 15, 16];

export default function Schedule() {
  const p = useUni();
  const router = useRouter();
  const nowMin = useNowMinutes();
  const today = getLocalDateString(new Date());
  const [offset, setOffset] = useState(0);
  const monday = addDays(mondayOf(today), offset * 7);
  const { data, refresh, refreshing } = useAcademic({ from: monday, to: addDays(monday, 6) });
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [picked, setPicked] = useState<number | null>(null);
  const [timelineW, setTimelineW] = useState(0);
  const sel = picked ?? (offset === 0 ? todayIdx : 0);
  const selDate = addDays(monday, sel);

  const occ = data?.occurrences ?? [];
  const days = useMemo(() => {
    const hasSunday = occ.some((o) => o.date === addDays(monday, 6));
    return Array.from({ length: hasSunday ? 7 : 6 }, (_, i) => addDays(monday, i));
  }, [occ, monday]);

  const dayOcc = occ.filter((o) => o.date === selDate);
  const real = dayOcc.filter((o) => !o.cancelled);
  const hours = real.reduce((a, o) => a + (minutesOf(o.endTime) - minutesOf(o.startTime)) / 60, 0);
  const changes = dayOcc.filter((o) => o.cancelled || o.exceptionAction === 'move' || o.exceptionAction === 'extra');

  // Timeline bounds: 8 AM to 5 PM, stretched to fit early or late classes.
  const first = Math.min(8, ...dayOcc.map((o) => Math.floor(hoursOf(o.startTime))), ...dayOcc.filter((o) => o.original).map((o) => Math.floor(hoursOf(o.original!.startTime))));
  const last = Math.max(17, ...dayOcc.map((o) => Math.ceil(hoursOf(o.endTime))));
  const top = (h: number) => (h - first) * PX;

  // Overlapping blocks (including the faded slot of a moved class) sit side by side.
  // Lanes use the drawn extent, since short classes are drawn at least MIN_BLOCK tall.
  const drawnEnd = (start: number, end: number) => Math.max(end, start + ((MIN_BLOCK + 4) / PX) * 60);
  const lanes = layoutLanes([
    ...dayOcc.filter((o) => o.original).map((o) => ({ key: 'was' + o.id, start: minutesOf(o.original!.startTime), end: drawnEnd(minutesOf(o.original!.startTime), minutesOf(o.original!.endTime)) })),
    ...dayOcc.map((o) => ({ key: o.id, start: minutesOf(o.startTime), end: drawnEnd(minutesOf(o.startTime), minutesOf(o.endTime)) })),
  ]);
  const laneBox = (key: string) => {
    const slot = lanes.get(key) ?? { lane: 0, lanes: 1 };
    if (slot.lanes === 1 || !timelineW) return { left: GUTTER, right: 0, lanes: 1 };
    const w = (timelineW - GUTTER - LANE_GAP * (slot.lanes - 1)) / slot.lanes;
    return { left: GUTTER + slot.lane * (w + LANE_GAP), width: w, lanes: slot.lanes };
  };

  const W3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const ruleOn = (d: string) => data?.dayRules.find((x) => x.date === d);
  const selRule = ruleOn(selDate);
  const dayTag = (d: string) => { const rl = ruleOn(d); return !rl ? null : rl.kind === 'follow' ? `${W3[rl.followsWeekday ?? 0]} TT` : rl.linkedRuleId ? 'Holiday' : 'Off'; };
  const longPress = (o: Occ) => {
    if (o.id.startsWith('ex_')) {
      Alert.alert('Extra class', 'Manage it from Schedule changes.', [{ text: 'Close', style: 'cancel' }, { text: 'Open changes', onPress: () => router.push('/schedule/changes' as any) }]);
      return;
    }
    Alert.alert(`${o.workspaceName} · ${dayName(o.date)} ${shortDate(o.date)}`, 'What changed?', [
      { text: 'Other change…', onPress: () => router.push({ pathname: '/schedule/change', params: { date: o.date } } as any) },
      { text: 'Cancel it', onPress: () => router.push({ pathname: '/schedule/change', params: { mode: 'cancel', occ: o.id, date: o.date } } as any) },
      { text: 'Move it', onPress: () => router.push({ pathname: '/schedule/change', params: { mode: 'move', occ: o.id, date: o.date } } as any) },
    ]);
  };
  const title = selDate === today ? `Today, ${dayName(selDate)} ${shortDate(selDate)}` : `${dayName(selDate)}, ${shortDate(selDate)}`;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <LargeTitle
        eyebrow={`Week ${isoWeek(monday)} · ${shortDate(monday)} – ${shortDate(addDays(monday, 5))}`}
        title="Timetable"
        right={<>
          <RoundButton icon="chevron-left" label="Previous week" onPress={() => { setOffset((o) => o - 1); setPicked(0); }} />
          <RoundButton icon="chevron-right" label="Next week" onPress={() => { setOffset((o) => o + 1); setPicked(0); }} />
        </>}
      />

      {data && !data.courses.length ? (
        <View style={{ paddingHorizontal: 20 }}>
          <Empty icon="calendar-days" title="No timetable yet" body="Add a course and tap in its weekly slots. Your week fills in here." action="Add a course" onAction={() => router.push('/course/setup')} />
        </View>
      ) : (
        <>
          <Rise i={1}>
            <Card style={styles.glance}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {days.map((d, i) => {
                  const on = i === sel;
                  const list = occ.filter((o) => o.date === d);
                  const changed = !!ruleOn(d) || list.some((o) => o.cancelled || o.exceptionAction === 'move' || o.exceptionAction === 'extra');
                  return (
                    <Tap key={d} onPress={() => setPicked(i)} accessibilityLabel={`${dayName(d, true)} ${shortDate(d)}, ${list.filter((o) => !o.cancelled).length} classes`}
                      style={[styles.glanceDay, { backgroundColor: on ? p.primarySoft : 'transparent' }]}>
                      <T w={700} c={on ? p.primary : p.muted} size={11}>{d === today ? 'Today' : dayName(d)}</T>
                      <T w={800} c={on ? p.primary : p.text} size={16} style={{ marginBottom: dayTag(d) ? 0 : 4 }}>{Number(d.slice(8))}</T>
                      {dayTag(d) ? <T w={800} c={p.warn} size={8.5} numberOfLines={1} style={{ marginBottom: 3 }}>{dayTag(d)}</T> : null}
                      {GLANCE_HOURS.map((h) => {
                        const c = list.find((o) => hoursOf(o.startTime) <= h + 0.01 && hoursOf(o.endTime) > h + 0.01);
                        if (!c) return <View key={h} style={[styles.cell, { backgroundColor: p.surface }]} />;
                        if (c.cancelled) return <View key={h} style={[styles.cell, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.off }]} />;
                        return <View key={h} style={[styles.cell, { backgroundColor: c.workspaceColor }]} />;
                      })}
                      <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 4, backgroundColor: changed ? p.warn : 'transparent' }} />
                    </Tap>
                  );
                })}
              </View>
              <View style={styles.glanceFoot}>
                <T w={600} c={p.muted} size={11.5}>Rows = 9 AM to 5 PM</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: p.warn }} />
                  <T w={600} c={p.muted} size={11.5}>Schedule change</T>
                </View>
              </View>
            </Card>
          </Rise>

          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 10 }}>
            <Tap onPress={() => router.push({ pathname: '/schedule/change', params: { date: selDate } } as any)} style={[styles.chgBtn, { backgroundColor: p.elev, borderColor: p.hair }]}>
              <Icon name="calendar-clock" size={16} color={p.primary} />
              <T w={700} size={13}>Change schedule</T>
            </Tap>
            <Tap onPress={() => router.push('/schedule/changes' as any)} style={[styles.chgBtn, { backgroundColor: p.elev, borderColor: p.hair }]}>
              <Icon name="history" size={16} color={p.muted} />
              <T w={700} size={13}>Changes</T>
            </Tap>
          </View>

          {selRule ? (
            <View style={[styles.banner, { backgroundColor: tint(p.warn, 12) }]}>
              <View style={[styles.bannerIcon, { backgroundColor: p.warn }]}>
                <Icon name={selRule.kind === 'follow' ? 'calendar-days' : 'party-popper'} size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <T w={700} size={14}>{selRule.kind === 'follow' ? `Follows ${WEEKDAY[selRule.followsWeekday ?? 0]}'s timetable` : selRule.linkedRuleId ? 'Holiday · no classes' : `No classes · ${selRule.reason ?? 'day off'}`}</T>
                <T c={p.muted} size={12.5} style={{ lineHeight: 17, marginTop: 2 }}>
                  {selRule.kind === 'follow'
                    ? `${[selRule.reason, selRule.note].filter(Boolean).join(' · ')}. ${WEEKDAY[new Date(Number(selDate.slice(0, 4)), Number(selDate.slice(5, 7)) - 1, Number(selDate.slice(8, 10)), 12).getDay()]}'s own classes are Off and don't count.`
                    : selRule.note ? `${selRule.note}. Classes that day don't count.` : "Classes that day don't count."}
                </T>
              </View>
            </View>
          ) : null}

          {changes.filter((o) => !(selRule && o.cancelled && o.dropReason?.startsWith('Off ·') && !o.dropReason.includes('cancelled'))).filter((o) => !(selRule && o.cancelled)).map((o) => (
            <View key={'chg' + o.id} style={[styles.banner, { backgroundColor: tint(p.warn, 12) }]}>
              <View style={[styles.bannerIcon, { backgroundColor: p.warn }]}>
                <Icon name={o.cancelled ? 'party-popper' : 'calendar-clock'} size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <T w={700} size={14}>
                  {o.cancelled ? `${o.workspaceName} ${o.dropReason?.startsWith('Moved') ? 'moved' : 'cancelled'}` : o.exceptionAction === 'extra' ? `Extra ${o.workspaceName} class at ${clock(o.startTime)}` : o.movedFromDate ? `${o.workspaceName} moved here from ${dayName(o.movedFromDate)} ${shortDate(o.movedFromDate)}` : `${o.workspaceName} moved to ${clock(o.startTime)}${o.venueName ? `, ${o.venueName}` : ''}`}
                </T>
                <T c={p.muted} size={12.5} style={{ lineHeight: 17, marginTop: 2 }}>
                  {o.cancelled ? `${o.dropReason ?? 'Cancelled for this day'}. It doesn't count toward attendance.` : o.exceptionAction === 'extra' ? `${o.changeReason ?? 'Extra class'}. Counts like any other class.` : o.movedFromDate ? `${o.changeReason ? `${o.changeReason}. ` : ''}Counts for ${o.workspaceName} as usual.` : o.original ? `Temporary. Normally ${clock(o.original.startTime)}–${clock(o.original.endTime)}.` : 'One-off class for this day.'}
                </T>
              </View>
            </View>
          ))}

          <View style={styles.dayHead}>
            <T w={800} size={17} style={{ letterSpacing: -0.3 }}>{title}</T>
            <T w={600} c={p.muted} size={12.5}>{real.length} class{real.length === 1 ? '' : 'es'} · {Math.round(hours * 10) / 10} h</T>
          </View>

          {dayOcc.length === 0 ? (
            <View style={{ paddingHorizontal: 20 }}>
              <Empty icon="coffee" title="No classes" body={selDate === today ? 'Nothing on the timetable today.' : `Nothing on the timetable for ${dayName(selDate, true)}.`} />
            </View>
          ) : (
            <>
              <View style={{ marginHorizontal: 20, height: (last - first) * PX + 12 }} onLayout={(e) => setTimelineW(e.nativeEvent.layout.width)}>
                {Array.from({ length: last - first + 1 }, (_, i) => first + i).map((h) => (
                  <View key={h} style={[styles.hourRow, { top: top(h) - 6 }]}>
                    <T style={[mono(500), { width: 36, fontSize: 10.5, color: p.muted, textAlign: 'right' }]}>{(h % 12 || 12) + (h >= 12 ? 'p' : 'a')}</T>
                    <View style={{ flex: 1, height: 1, backgroundColor: p.border }} />
                  </View>
                ))}

                {dayOcc.filter((o) => o.original).map((o) => (
                  <Block key={'was' + o.id} o={o} ghost box={laneBox('was' + o.id)} short={data?.courseById.get(o.workspaceId)?.short} top={top(hoursOf(o.original!.startTime))} height={(hoursOf(o.original!.endTime) - hoursOf(o.original!.startTime)) * PX - 4}
                    live={false} onPress={() => router.push(`/course/${o.workspaceId}` as any)} />
                ))}
                {dayOcc.map((o) => {
                  const live = selDate === today && minutesOf(o.startTime) <= nowMin && nowMin < minutesOf(o.endTime) && !o.cancelled;
                  return (
                    <Block key={o.id} o={o} live={live} box={laneBox(o.id)} short={data?.courseById.get(o.workspaceId)?.short} top={top(hoursOf(o.startTime))} height={(hoursOf(o.endTime) - hoursOf(o.startTime)) * PX - 4}
                      onPress={() => router.push(`/course/${o.workspaceId}` as any)}
                      onLongPress={() => longPress(o)} />
                  );
                })}

                {selDate === today && nowMin / 60 >= first && nowMin / 60 <= last ? (
                  <View style={[styles.now, { top: top(nowMin / 60), backgroundColor: p.danger }]} pointerEvents="none">
                    <View style={[styles.nowDot, { backgroundColor: p.danger }]} />
                    <View style={[styles.nowTag, { backgroundColor: p.danger }]}>
                      <T style={[mono(700), { fontSize: 10, color: '#fff' }]}>{clock(`${Math.floor(nowMin / 60)}:${nowMin % 60}`, false)}</T>
                    </View>
                  </View>
                ) : null}
              </View>
              <T c={p.muted} size={12} style={{ textAlign: 'center', marginTop: 8 }}>Long-press a class to cancel or move it, or use Change schedule for a whole day.</T>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function Block({ o, live, top, height, ghost, box, short, onPress, onLongPress }: { o: Occ; live: boolean; top: number; height: number; ghost?: boolean; short?: string; box: { left: number; right?: number; width?: number; lanes: number }; onPress: () => void; onLongPress?: () => void }) {
  const p = useUni();
  const color = o.workspaceColor;
  let bg = tint(color, 14), border = 'transparent', fg = p.text, opacity = 1, wellBg = color, wellFg = '#fff', strike = false;
  let chip: [string, string, string] | null = null; // label, fg, bg
  let meta = `${clock(o.startTime, false)} – ${clock(o.endTime, false)}${o.venueName ? ` · ${o.venueName}` : ''}`;
  const st = o.status;
  if (st === 'present' || st === 'exempt') chip = ['P', p.success, tint(p.success, 16)];
  else if (st === 'absent') chip = ['A', p.danger, tint(p.danger, 16)];
  else if (st === 'cancelled' || st === 'holiday') chip = ['OFF', p.off, tint(p.off, 16)];
  if (chip) opacity = 0.82;
  if (o.exceptionAction === 'move') chip = ['MOVED', p.warn, tint(p.warn, 18)];
  if (o.exceptionAction === 'extra') chip = ['EXTRA', p.warn, tint(p.warn, 18)];
  if (live) { bg = p.primary; fg = '#fff'; wellBg = 'rgba(255,255,255,0.22)'; chip = ['NOW', '#fff', 'rgba(255,255,255,0.22)']; opacity = 1; }
  if (ghost) {
    bg = 'transparent'; border = color; opacity = 0.6; strike = true; chip = ['WAS', p.muted, p.surface];
    meta = `Moved to ${clock(o.startTime)}${o.venueName ? ` · ${o.venueName}` : ''}`;
  }
  if (o.cancelled) {
    bg = 'transparent'; border = p.off; opacity = 0.7; strike = true; wellBg = p.surface; wellFg = p.off;
    chip = ['OFF', p.off, p.surface]; meta = o.dropReason?.replace(/^Off · /, '') ?? 'Cancelled for this day';
  }
  // Narrow lanes use the short course label; short blocks fit one line only.
  const name = (box.lanes > 1 && short ? short : o.workspaceName) + (o.componentType === 'lab' ? ' Lab' : o.componentType === 'tutorial' ? ' Tut' : '');
  const compact = Math.max(MIN_BLOCK, height) < 48;
  const metaLine = box.lanes > 1 && chip ? `${chip[0]} · ${meta}` : meta;
  return (
    <Tap onPress={onPress} onLongPress={onLongPress} delayLongPress={350} accessibilityRole="button"
      accessibilityLabel={`${o.workspaceName}, ${meta}${chip ? `, ${chip[0]}` : ''}`}
      style={[styles.block, {
        top, height: Math.max(MIN_BLOCK, height), left: box.left, right: box.right, width: box.width, backgroundColor: bg, opacity, borderColor: border,
        borderWidth: border === 'transparent' ? 1 : 1.5, borderStyle: border === 'transparent' ? 'solid' : 'dashed',
      }, box.lanes > 1 && { paddingHorizontal: 8, gap: 6 }, compact && { paddingVertical: 4, alignItems: 'center' }, live && { shadowColor: p.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 12 }, elevation: 6, zIndex: 2 }]}>
      {box.lanes < 3 && !compact ? (
        <View style={[styles.blockWell, { backgroundColor: wellBg }]}>
          <Icon name={courseIcon(o.workspaceIcon, o.workspaceName)} size={15} color={wellFg} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w={700} c={fg} size={compact ? 13 : 14} numberOfLines={1} style={[{ lineHeight: 17 }, strike ? { textDecorationLine: 'line-through' } : null]}>
          {name}{compact ? <T w={500} c={fg} size={11.5} style={{ opacity: 0.78 }}>{`  ${clock(o.startTime, false)}`}</T> : null}
        </T>
        {!compact ? <T w={500} c={fg} size={11.5} style={{ opacity: 0.78, marginTop: 1, lineHeight: 14 }} numberOfLines={1}>{metaLine}</T> : null}
      </View>
      {chip && box.lanes === 1 && !compact ? <Chip label={chip[0]} color={chip[1]} bg={chip[2]} /> : null}
    </Tap>
  );
}

const styles = StyleSheet.create({
  chgBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  glance: { marginHorizontal: 20, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 12 },
  glanceDay: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 6, paddingBottom: 8, borderRadius: 14 },
  cell: { width: 30, maxWidth: '86%', height: 9, borderRadius: 3 },
  glanceFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 4 },
  banner: { marginHorizontal: 20, marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bannerIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  hourRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  block: { position: 'absolute', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', gap: 10, overflow: 'hidden' },
  blockWell: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  now: { position: 'absolute', left: 38, right: -6, height: 2, zIndex: 3 },
  nowDot: { position: 'absolute', left: -5, top: -4, width: 10, height: 10, borderRadius: 5 },
  nowTag: { position: 'absolute', right: 0, top: -10, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
});
