import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon, courseIcon } from '../../components/uni/Icon';
import { Card, Empty, GrowBar, Legend, ListCard, Ring, Rise, RoundButton, Screen, SectionTitle, T, Tap, Well } from '../../components/uni/primitives';
import { tint, useUni, listRow } from '../../components/uni/theme';
import { atRisk, overall } from '../../domains/academic/derive';
import { useAcademic } from '../../domains/academic/hooks';
import { heatmap, shortDate, verdict, type HeatLevel } from '../../domains/academic/logic';

export default function AttendanceOverview() {
  const p = useUni();
  const router = useRouter();
  const { data } = useAcademic();

  const header = (
    <View style={styles.top}>
      <RoundButton icon="chevron-left" label="Back" onPress={() => router.back()} />
      <T w={800} size={17}>Attendance</T>
      <RoundButton icon="check-check" label="Mark today" onPress={() => router.push('/attendance/mark')} />
    </View>
  );
  if (!data) return <Screen tabs={false}>{header}</Screen>;
  const s = data;
  const o = overall(s.courses);
  const risk = atRisk(s.courses);
  const tone = (t: string) => (t === 'danger' ? p.danger : t === 'warn' ? p.warn : t === 'success' ? p.success : p.muted);

  const status = o.total === 0
    ? { text: 'Mark a few classes to see your standing', c: p.muted, icon: 'info' as const }
    : o.pct! < o.target
      ? { text: 'Below target overall', c: p.danger, icon: 'triangle-alert' as const }
      : risk.length
        ? { text: `Safe overall, but ${risk[0].course.short} needs you`, c: p.danger, icon: 'triangle-alert' as const }
        : { text: 'Every course is on target', c: p.success, icon: 'circle-check-big' as const };

  const subjects = s.courses
    .map((c) => ({ c, v: verdict(c.att.attended, c.att.total, c.target) }))
    .sort((a, b) => (b.v.need - a.v.need) || ((a.c.att.pct ?? 101) - (b.c.att.pct ?? 101)));

  // The course whose portal snapshot disagrees most with the local log.
  const gaps = s.portal
    .map((x) => {
      const c = s.courseById.get(x.workspaceId);
      const portalPct = x.percent ?? (x.total ? Math.round(((x.present ?? 0) / x.total) * 100) : null);
      return c && portalPct !== null && c.att.pct !== null ? { c, portalPct: Math.round(portalPct), local: c.att.pct, date: x.checkedDate } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b!.local - b!.portalPct) - Math.abs(a!.local - a!.portalPct));
  const gap = gaps[0];

  const heat = heatmap(s.records, s.today, 12);
  const heatColor: Record<HeatLevel, string> = {
    all: p.success, some: tint(p.success, 45), absent: p.danger, off: tint(p.off, 50), none: p.surface, future: 'transparent',
  };

  return (
    <Screen tabs={false}>
      {header}
      {!s.courses.length ? (
        <View style={{ padding: 20 }}><Empty icon="book-plus" title="No courses yet" body="Add a course to start tracking attendance." action="Add a course" onAction={() => router.push('/course/setup')} /></View>
      ) : (
        <>
          <Rise i={0} style={{ alignItems: 'center', paddingVertical: 15 }}>
            <Ring size={220} stroke={18} pct={o.pct ?? 0} color={p.primary} track={p.surface} marker={o.target} markerColor={p.warn}>
              <T w={800} size={52} style={{ letterSpacing: -2.2, lineHeight: 56 }}>{o.pct ?? '—'}<T w={800} size={26}>{o.pct === null ? '' : '%'}</T></T>
              <T w={600} c={p.muted} size={12.5}>overall · target {o.target}%</T>
            </Ring>
          </Rise>
          <Rise i={1} style={{ alignItems: 'center' }}>
            <View style={[styles.statusPill, { backgroundColor: tint(status.c, 12) }]}>
              <Icon name={status.icon} size={14} color={status.c} />
              <T w={700} c={status.c} size={13}>{status.text}</T>
            </View>
          </Rise>
          <Rise i={2} style={styles.stats}>
            {([['Present', o.attended, p.success], ['Absent', o.absent, p.danger], ['Off · not counted', o.off, p.off]] as const).map(([l, v, c]) => (
              <View key={l} style={[styles.stat, { backgroundColor: p.elev, borderColor: p.hair }]}>
                <T w={700} c={c} size={11.5} numberOfLines={2}>{l}</T>
                <T w={800} size={22} style={{ marginTop: 2 }}>{v}</T>
              </View>
            ))}
          </Rise>

          <SectionTitle title="Skip budget" action="Riskiest first" style={{ marginBottom: 10 }} />
          <View style={{ paddingHorizontal: 20 }}>
            <ListCard>
              {subjects.map(({ c, v }, i) => (
                <Tap key={c.id} onPress={() => router.push(`/course/${c.id}` as any)} style={styles.subject}>
                  <Well icon={courseIcon(c.icon, c.name)} color={c.color} bg={tint(c.color)} size={36} radius={11} iconSize={17} />
                  <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <T w={700} size={14} numberOfLines={1} style={{ flexShrink: 1 }}>{c.name}</T>
                      <T w={800} size={15}>{c.att.pct === null ? '—' : `${c.att.pct}%`}</T>
                    </View>
                    <View>
                      <GrowBar pct={c.att.pct ?? 0} color={tone(v.tone)} track={p.surface} d={i} />
                      <View style={{ position: 'absolute', left: `${c.target}%`, top: -3, width: 2, height: 12, borderRadius: 1, backgroundColor: p.text, opacity: 0.55 }} />
                    </View>
                    <T w={700} c={tone(v.tone)} size={12}>{v.text}</T>
                  </View>
                </Tap>
              ))}
            </ListCard>
          </View>

          {gap ? (
            <Rise i={3}>
              <Card style={styles.portal}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Well icon="arrow-left-right" color={p.primary} bg={p.primarySoft} size={32} radius={10} iconSize={16} />
                  <View style={{ flex: 1 }}>
                    <T w={800} size={14}>Portal vs your log</T>
                    <T c={p.muted} size={12}>Portal snapshot from {shortDate(gap.date.slice(0, 10))}</T>
                  </View>
                </View>
                {([['Your log', gap.local, gap.c.color], ['Portal', gap.portalPct, gap.portalPct < gap.c.target ? p.danger : p.success]] as const).map(([l, v, c], i) => (
                  <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <T w={600} c={p.muted} size={12} style={{ width: 70 }}>{l}</T>
                    <View style={{ flex: 1 }}><GrowBar pct={v} color={c} track={p.surface} height={8} d={i * 2} /></View>
                    <T w={800} size={12} style={{ width: 40, textAlign: 'right' }}>{v}%</T>
                  </View>
                ))}
                <T size={13} style={{ lineHeight: 18 }}>
                  {gap.local === gap.portalPct
                    ? `${gap.c.name}: your log matches the portal.`
                    : `${gap.c.name}: the portal shows ${gap.portalPct}%, your log ${gap.local}%. Check the sessions that differ before raising it.`}
                </T>
                <Tap onPress={() => router.push(`/course/${gap.c.id}` as any)} style={[styles.portalBtn, { backgroundColor: p.primary }]}>
                  <T w={700} c="#fff" size={13}>Review {gap.c.short} sessions</T>
                </Tap>
              </Card>
            </Rise>
          ) : null}

          <Rise i={4}>
            <Card style={styles.heatCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <T w={800} size={14}>Last 12 weeks</T>
                <T w={600} c={p.muted} size={11.5}>Mon to Sat</T>
              </View>
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 12 }}>
                {heat.map((week, w) => (
                  <View key={w} style={{ flex: 1, gap: 4 }}>
                    {week.map((lvl, d) => <View key={d} style={{ aspectRatio: 1, borderRadius: 5, backgroundColor: heatColor[lvl] }} />)}
                  </View>
                ))}
              </View>
              <View style={{ marginTop: 12 }}>
                <Legend items={[['All present', p.success], ['Some', tint(p.success, 45)], ['Absent', p.danger], ['Off', tint(p.off, 50)]]} />
              </View>
            </Card>
          </Rise>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 18, paddingHorizontal: 20 },
  stat: { flex: 1, padding: 12, borderRadius: 18, borderWidth: 1 },
  subject: listRow,
  portal: { marginHorizontal: 20, marginTop: 16, padding: 16, gap: 12 },
  portalBtn: { alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  heatCard: { marginHorizontal: 20, marginTop: 16, padding: 16 },
});
