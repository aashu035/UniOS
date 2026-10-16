import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/uni/Icon';
import { T, Tap } from '../components/uni/primitives';
import { IconButton } from '../components/uni/form';
import { fileVisual } from '../components/uni/fileKinds';
import { sans, tint, useUni } from '../components/uni/theme';
import { db } from '../core/db/client';
import { Prefs } from '../core/settings/prefs';
import { formatBytes } from '../core/utils/format';
import { dayName, normalizeDate, shortDate } from '../domains/academic/logic';
import { shortLabel } from '../domains/academic/snapshot';
import { rememberQuery, searchAll, type ResultRow, type SearchData, type Seg } from '../domains/search/search';
import { TASK_TYPES, typeKey } from '../domains/task/form';
import { workspaces } from '../domains/workspace/model';
import { tasks } from '../domains/task/model';
import { resources } from '../domains/resource/model';

const RECENTS = 'recentSearches';

/** Everything searchable, read once when the screen opens (it is all on the phone, so no loading state). */
function loadData(): SearchData & { courseById: Map<number, { short: string; color: string }> } {
  const ws = db.select().from(workspaces).all();
  const courseById = new Map(ws.map((w) => [w.id, { short: shortLabel(w.name, w.shortName), color: w.color || '#6C5CE7' }]));
  const taskRows = db.select().from(tasks).all();
  const res = db.select().from(resources).all();
  const typeName = (t: string | null) => TASK_TYPES.find(([k]) => k === typeKey(t))?.[1] ?? 'Task';
  return {
    courseById,
    courses: ws.map((w) => ({ id: w.id, name: w.name, code: w.code, short: shortLabel(w.name, w.shortName), color: w.color || '#6C5CE7' })),
    tasks: taskRows.map((t) => {
      const due = normalizeDate(t.dueDate);
      return { id: t.id, title: t.title, workspaceId: t.workspaceId, sub: `${due ? `Due ${dayName(due)} ${shortDate(due)}` : 'No due date'} · ${typeName(t.type)}` };
    }),
    files: res.filter((r) => r.type !== 'note').map((r) => {
      const v = fileVisual(r);
      const host = v.kind === 'link' ? /^https?:\/\/([^/]+)/i.exec(r.uri ?? '')?.[1] : null;
      return { id: r.id, title: r.title, workspaceId: r.workspaceId, type: r.type, uri: r.uri, sub: [v.label, host ?? formatBytes(r.sizeBytes)].filter(Boolean).join(' · ') };
    }),
    notes: res.filter((r) => r.type === 'note').map((r) => ({ id: r.id, title: r.title, workspaceId: r.workspaceId, text: r.textContent ?? '' })),
  };
}

/** Search (design UniSearch, handoff §6): grouped, highlighted, with recent searches. */
export default function Search() {
  const p = useUni();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  const [q, setQ] = useState('');
  const [recents, setRecents] = useState<string[]>(() => Prefs.getJSON<string[]>(RECENTS, []));
  const data = useMemo(() => { try { return loadData(); } catch (e) { console.error('Search failed to load', e); return null; } }, []);
  useEffect(() => { const t = setTimeout(() => input.current?.focus(), 80); return () => clearTimeout(t); }, []);

  const groups = useMemo(() => (data ? searchAll(data, q) : []), [data, q]);
  const saveRecents = (next: string[]) => { setRecents(next); Prefs.setJSON(RECENTS, next); };
  const remember = () => { if (q.trim()) saveRecents(rememberQuery(recents, q)); };

  const open = (r: ResultRow) => {
    remember();
    if (r.kind === 'course') router.push(`/course/${r.id}` as any);
    else if (r.kind === 'task') router.push(`/task/edit?id=${r.id}` as any);
    else if (r.kind === 'note') router.push(`/note/${r.id}` as any);
    else router.push(`/resource/${r.id}` as any);
  };

  const HL = tint(p.warn, 32);
  const segs = (s: Seg[], base: object) => s.map((x, i) => (
    <T key={i} {...base} style={x.hit ? { backgroundColor: HL, color: p.text } : undefined}>{x.t}</T>
  ));
  const iconFor = (r: ResultRow) => {
    if (r.kind === 'course') { const c = data?.courseById.get(r.id); return { icon: 'book-open' as const, c: c?.color ?? p.primary, bg: tint(c?.color ?? p.primary, 14) }; }
    if (r.kind === 'task') return { icon: 'circle-check-big' as const, c: p.text, bg: p.surface };
    if (r.kind === 'note') return { icon: 'sticky-note' as const, c: '#10B981', bg: tint('#10B981', 14) };
    const v = fileVisual({ type: r.type, uri: r.uri });
    return { icon: v.icon, c: v.color, bg: tint(v.color, 14) };
  };
  const query = q.trim();

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} />
        <View style={[styles.field, { backgroundColor: p.elev, borderColor: p.primary }]}>
          <Icon name="search" size={18} color={p.muted} />
          <TextInput ref={input} value={q} onChangeText={setQ} onSubmitEditing={remember} returnKeyType="search" placeholder="Courses, tasks, files, notes"
            placeholderTextColor={p.muted} accessibilityLabel="Search" autoCorrect={false}
            style={[sans(600), { flex: 1, minWidth: 0, fontSize: 15.5, color: p.text, paddingVertical: 0 }]} />
          {q ? (
            <Tap onPress={() => { setQ(''); input.current?.focus(); }} accessibilityRole="button" accessibilityLabel="Clear search"
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={15} color={p.text} />
            </Tap>
          ) : null}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: insets.bottom + 30, gap: 18 }}>
        {!query && recents.length ? (
          <View style={{ gap: 6 }}>
            <View style={styles.groupHead}>
              <T w={800} c={p.muted} size={11.5} style={{ letterSpacing: 0.8 }}>RECENT</T>
              <Tap onPress={() => saveRecents([])} accessibilityRole="button" style={{ height: 36, paddingHorizontal: 6, justifyContent: 'center' }}>
                <T w={800} c={p.primary} size={13}>Clear</T>
              </Tap>
            </View>
            <View style={[styles.box, { backgroundColor: p.elev, borderColor: p.hair }]}>
              {recents.map((r, i) => (
                <View key={r} style={[styles.recent, i < recents.length - 1 && { borderBottomWidth: 1, borderBottomColor: p.hair }]}>
                  <Tap onPress={() => setQ(r)} accessibilityRole="button" accessibilityLabel={`Search ${r}`} style={{ flex: 1, minWidth: 0, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Icon name="history" size={17} color={p.muted} />
                    <T w={700} size={14.5} numberOfLines={1} style={{ flex: 1 }}>{r}</T>
                  </Tap>
                  <Tap onPress={() => saveRecents(recents.filter((x) => x !== r))} accessibilityRole="button" accessibilityLabel={`Remove ${r}`}
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="x" size={16} color={p.muted} />
                  </Tap>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {!query && !recents.length ? (
          <Hint icon="search" title="Search everything in UniOS" body="Course names and codes, task names, file names and the text of your notes." />
        ) : null}

        {groups.map((g) => (
          <View key={g.key} style={{ gap: 6 }}>
            <View style={[styles.groupHead, { justifyContent: 'flex-start', gap: 6 }]}>
              <T w={800} c={p.muted} size={11.5} style={{ letterSpacing: 0.8 }}>{g.title.toUpperCase()}</T>
              <T w={700} c={p.muted} size={11.5} style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{g.rows.length}</T>
            </View>
            <View style={[styles.box, { backgroundColor: p.elev, borderColor: p.hair }]}>
              {g.rows.map((r, i) => {
                const ic = iconFor(r);
                const c = r.workspaceId != null ? data?.courseById.get(r.workspaceId) : null;
                return (
                  <Tap key={`${r.kind}${r.id}`} onPress={() => open(r)} accessibilityRole="button" pressedStyle={{ backgroundColor: p.surface }}
                    style={[styles.row, i < g.rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: p.hair }]}>
                    <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: ic.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={ic.icon} size={17} color={ic.c} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <T w={700} size={14.5} numberOfLines={2} style={{ lineHeight: 19 }}>{segs(r.title, { w: 700, size: 14.5 })}</T>
                      <T w={600} c={p.muted} size={12} numberOfLines={2} style={{ lineHeight: 16 }}>{segs(r.sub, { w: 600, size: 12, c: p.muted })}</T>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingLeft: 6, paddingRight: 8, borderRadius: 8, backgroundColor: p.surface }}>
                      <View style={{ width: 7, height: 7, borderRadius: 3, backgroundColor: c?.color ?? '#64748B' }} />
                      <T w={800} size={11.5}>{c?.short ?? 'General'}</T>
                    </View>
                  </Tap>
                );
              })}
            </View>
          </View>
        ))}

        {query && !groups.length ? <Hint icon="search-x" title={`No matches for ‘${query}’`} body="Try a course code like CSE-301" /> : null}
      </ScrollView>
    </View>
  );
}

function Hint({ icon, title, body }: { icon: 'search' | 'search-x'; title: string; body: string }) {
  const p = useUni();
  return (
    <View style={{ marginTop: 40, alignItems: 'center', gap: 10, paddingHorizontal: 20 }}>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={24} color={p.muted} />
      </View>
      <T w={800} size={16} style={{ textAlign: 'center' }}>{title}</T>
      <T c={p.muted} size={13.5} style={{ lineHeight: 20, textAlign: 'center' }}>{body}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  field: { flex: 1, minWidth: 0, height: 48, borderRadius: 16, borderWidth: 1.5, paddingLeft: 14, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  box: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingLeft: 14, paddingRight: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10, paddingHorizontal: 14 },
});
