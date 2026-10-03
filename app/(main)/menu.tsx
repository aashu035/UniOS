import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon, courseIcon, type IconName } from '../../components/uni/Icon';
import { Card, Empty, LargeTitle, ListCard, Ring, Rise, Screen, SectionTitle, T, Tap, Well } from '../../components/uni/primitives';
import { FILE_COLORS, tint, useUni, listRow } from '../../components/uni/theme';
import { atRisk, fileKind, overall, type FileKind } from '../../domains/academic/derive';
import { useAcademic } from '../../domains/academic/hooks';
import { shortDate, verdict } from '../../domains/academic/logic';
import { useProfile } from '../../domains/profile/hooks';

export default function Menu() {
  const p = useUni();
  const router = useRouter();
  const { data, refresh, refreshing } = useAcademic();
  const { profile } = useProfile();

  if (!data) return <Screen><View /></Screen>;
  const s = data;
  const o = overall(s.courses);
  const risk = atRisk(s.courses)[0];
  const tone = (t: string) => (t === 'danger' ? p.danger : t === 'warn' ? p.warn : t === 'success' ? p.success : p.muted);

  const byKind = s.files.reduce((m, f) => { const k = fileKind(f); m[k] = (m[k] ?? 0) + 1; return m; }, {} as Partial<Record<FileKind, number>>);
  const courseCount = new Set(s.files.map((f) => f.workspaceId).filter(Boolean)).size;
  const lastPortal = s.portal.map((x) => x.checkedDate).sort().pop();

  const eyebrow = [s.semester ? (s.semester.name || `Semester ${s.semester.number}`) : null, profile?.branch].filter(Boolean).join(' · ') || 'Your semester';

  const settings: Array<{ icon: IconName; t: string; m: string; to: string; badge?: number }> = [
    { icon: 'bell-ring', t: 'Alerts', m: s.unread ? `${s.unread} unread` : 'Attendance risks, changes and due dates', to: '/alerts', badge: s.unread },
    { icon: 'calendar-days', t: 'Semesters', m: s.semester ? `Active: ${s.semester.name || `Semester ${s.semester.number}`}` : 'No active semester', to: '/semester' },
    { icon: 'refresh-cw', t: 'Portal attendance', m: lastPortal ? `Last snapshot ${shortDate(lastPortal.slice(0, 10))}` : 'No portal snapshot yet', to: '/attendance' },
    { icon: 'hard-drive-download', t: 'Backup & export', m: 'Stored on this device', to: '/settings/data' },
    { icon: 'user', t: 'Profile', m: profile?.name ?? 'Your details', to: '/(main)/profile' },
    { icon: 'settings-2', t: 'Settings', m: 'AI tutor, pairing and data', to: '/settings' },
  ];

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <LargeTitle eyebrow={eyebrow} title="More" />

      <Rise i={1} style={styles.tiles}>
        <Card style={styles.tile} onPress={() => router.push('/attendance')}>
          <View style={styles.tileHead}><T w={800} size={13}>Attendance</T><Icon name="chevron-right" size={16} color={p.muted} /></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ring size={50} stroke={6} pct={o.pct ?? 0} color={o.pct !== null && o.pct < o.target ? p.danger : p.success} track={p.surface} />
            <View>
              <T w={800} size={22} style={{ letterSpacing: -0.6 }}>{o.pct === null ? '—' : `${o.pct}%`}</T>
              <T w={600} c={p.muted} size={11.5}>target {o.target}%</T>
            </View>
          </View>
          {risk ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="triangle-alert" size={13} color={p.danger} />
              <T w={700} c={p.danger} size={12} numberOfLines={1}>{risk.course.short} needs {risk.need} more</T>
            </View>
          ) : <T w={700} c={o.total ? p.success : p.muted} size={12}>{o.total ? 'All courses on target' : 'Nothing marked yet'}</T>}
        </Card>

        <Card style={styles.tile} onPress={() => router.push('/hub')}>
          <View style={styles.tileHead}><T w={800} size={13}>Knowledge Hub</T><Icon name="chevron-right" size={16} color={p.muted} /></View>
          <View>
            <T w={800} size={22} style={{ letterSpacing: -0.6 }}>{s.files.length} file{s.files.length === 1 ? '' : 's'}</T>
            <T w={600} c={p.muted} size={11.5}>across {courseCount} course{courseCount === 1 ? '' : 's'}</T>
          </View>
          <View style={styles.typeBar}>
            {(Object.keys(FILE_COLORS) as FileKind[]).filter((k) => byKind[k]).map((k) => (
              <View key={k} style={{ flex: byKind[k], backgroundColor: FILE_COLORS[k] }} />
            ))}
            {!s.files.length ? <View style={{ flex: 1, backgroundColor: p.surface }} /> : null}
          </View>
          <T w={600} c={p.muted} size={12} numberOfLines={1}>{s.files[0] ? `Latest: ${s.files[0].title}` : 'Add notes, PDFs and links'}</T>
        </Card>
      </Rise>

      <Rise i={2}>
        <SectionTitle title="Courses" action="+ Add course" onAction={() => router.push('/course/setup')} style={{ paddingHorizontal: 24, marginBottom: 10 }} />
        <View style={{ paddingHorizontal: 20 }}>
          {s.courses.length ? (
            <ListCard>
              {s.courses.slice().sort((a, b) => (a.att.pct ?? 101) - (b.att.pct ?? 101)).map((c) => {
                const v = verdict(c.att.attended, c.att.total, c.target);
                return (
                  <Tap key={c.id} onPress={() => router.push(`/course/${c.id}` as any)} style={styles.row}>
                    <Well icon={courseIcon(c.icon, c.name)} color={c.color} bg={tint(c.color)} size={38} radius={12} iconSize={18} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T w={700} size={14.5} numberOfLines={1}>{c.name}</T>
                      <T c={p.muted} size={12} style={{ marginTop: 1 }} numberOfLines={1}>{[c.faculty, c.code].filter(Boolean).join(' · ') || 'No faculty set'}</T>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T w={800} size={15}>{c.att.pct === null ? '—' : `${c.att.pct}%`}</T>
                      <T w={700} c={tone(v.tone)} size={11} style={{ marginTop: 1 }}>{v.short}</T>
                    </View>
                  </Tap>
                );
              })}
            </ListCard>
          ) : (
            <Empty icon="book-plus" title="No courses yet" body="Add a course to start tracking classes and attendance." action="Add a course" onAction={() => router.push('/course/setup')} />
          )}
        </View>
      </Rise>

      <Rise i={3}>
        <SectionTitle title="App" style={{ paddingHorizontal: 24, marginBottom: 10 }} />
        <View style={{ paddingHorizontal: 20 }}>
          <ListCard>
            {settings.map((x) => (
              <Tap key={x.t} onPress={() => router.push(x.to as any)} style={[styles.row, { paddingVertical: 13 }]}>
                <View style={[styles.setIcon, { backgroundColor: p.surface }]}><Icon name={x.icon} size={17} color={p.text} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T w={700} size={14.5}>{x.t}</T>
                  <T c={p.muted} size={12} style={{ marginTop: 1 }} numberOfLines={1}>{x.m}</T>
                </View>
                {x.badge ? <View style={[styles.badge, { backgroundColor: p.danger }]}><T w={800} c="#fff" size={11}>{x.badge}</T></View> : null}
                <Icon name="chevron-right" size={16} color={p.muted} />
              </Tap>
            ))}
          </ListCard>
        </View>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  tile: { flex: 1, gap: 10 },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 },
  row: listRow,
  setIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});

