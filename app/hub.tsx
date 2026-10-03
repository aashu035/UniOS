import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Icon, courseIcon, type IconName } from '../components/uni/Icon';
import { Card, Empty, GrowColumn, ListCard, Pill, Rise, RoundButton, Screen, T, Tap, Well } from '../components/uni/primitives';
import { FILE_COLORS, mono, shadow, tint, useUni, listRow } from '../components/uni/theme';
import { fileKind, type FileKind } from '../domains/academic/derive';
import { useAcademic } from '../domains/academic/hooks';
import { addDays, shortDate } from '../domains/academic/logic';
import type { FileRow } from '../domains/academic/snapshot';

const KIND: Record<FileKind, { label: string; plural: string; icon: IconName }> = {
  pdf: { label: 'PDF', plural: 'PDFs', icon: 'file-text' },
  note: { label: 'Note', plural: 'Notes', icon: 'sticky-note' },
  image: { label: 'Image', plural: 'Images', icon: 'image' },
  link: { label: 'Link', plural: 'Links', icon: 'link' },
  other: { label: 'File', plural: 'Other files', icon: 'file-text' },
};
type Filter = 'all' | 'week' | FileKind;

const size = (b: number | null) => (!b ? null : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export default function Hub() {
  const p = useUni();
  const router = useRouter();
  const { data } = useAcademic();
  const [picked, setPicked] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const header = (
    <View style={styles.titleRow}>
      <RoundButton icon="chevron-left" label="Back" onPress={() => router.back()} />
      <View style={{ flex: 1 }}>
        <T w={600} c={p.muted} size={13}>{data ? `${data.files.length} files · ${data.courses.length} courses` : ' '}</T>
        <T w={800} size={32} style={{ letterSpacing: -1, marginTop: 2, lineHeight: 38 }}>Knowledge Hub</T>
      </View>
      <RoundButton icon="upload" label="Add file" onPress={() => router.push(picked ? `/resource/add?workspaceId=${picked}` as any : '/resource/add')} />
    </View>
  );
  if (!data) return <Screen tabs={false}>{header}</Screen>;
  const s = data;

  const pass = (f: FileRow) => filter === 'all' ? true : filter === 'week' ? !!f.createdAt && f.createdAt.slice(0, 10) >= addDays(s.today, -7) : fileKind(f) === filter;
  const counts = new Map<number, number>();
  for (const f of s.files) if (f.workspaceId) counts.set(f.workspaceId, (counts.get(f.workspaceId) ?? 0) + 1);
  const books = s.courses.slice().sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)).slice(0, 8);
  const selId = picked ?? books[0]?.id ?? null;
  const sel = selId ? s.courseById.get(selId) : undefined;
  const selFiles = s.files.filter((f) => f.workspaceId === selId && pass(f));
  const groups = (Object.keys(KIND) as FileKind[]).map((k) => ({ k, files: selFiles.filter((f) => fileKind(f) === k) })).filter((g) => g.files.length);
  const byKind = s.files.reduce((m, f) => { const k = fileKind(f); m[k] = (m[k] ?? 0) + 1; return m; }, {} as Partial<Record<FileKind, number>>);
  const latest = s.files.find((f) => f.workspaceId === selId);
  const maxCount = Math.max(1, ...books.map((b) => counts.get(b.id) ?? 0));

  return (
    <Screen tabs={false}>
      {header}
      <Rise i={1}>
        <Tap onPress={() => router.push('/search')} style={[styles.search, { backgroundColor: p.elev, borderColor: p.hair }, shadow(p)]}>
          <Icon name="search" size={18} color={p.muted} />
          <T c={p.muted} size={14.5} style={{ flex: 1 }}>Search notes and files</T>
        </Tap>
      </Rise>
      <Rise i={1}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingTop: 10 }}>
          {([['all', 'All'], ['week', 'Added this week'], ['pdf', 'PDFs'], ['note', 'Notes'], ['link', 'Links'], ['image', 'Images']] as Array<[Filter, string]>).map(([k, l]) => (
            <Pill key={k} label={l} onPress={() => setFilter(k)} bg={filter === k ? p.primarySoft : p.elev} fg={filter === k ? p.primary : p.text} border={filter === k ? undefined : p.hair} />
          ))}
        </ScrollView>
      </Rise>

      {!s.courses.length ? (
        <View style={{ padding: 20 }}><Empty icon="book-plus" title="No courses yet" body="Files live under courses. Add one to start your shelf." action="Add a course" onAction={() => router.push('/course/setup')} /></View>
      ) : (
        <>
          <Rise i={2}>
            <Card style={styles.shelf}>
              <View style={styles.books}>
                {books.map((b, i) => {
                  const n = counts.get(b.id) ?? 0;
                  return <Book key={b.id} on={b.id === selId} color={b.color} label={b.short} count={n}
                    height={64 + (n / maxCount) * 60} flex={0.6 + n / Math.max(18, maxCount)} d={i} onPress={() => setPicked(b.id)} />;
                })}
              </View>
              <View style={[styles.plank, { backgroundColor: p.surface }]} />
              {sel ? (
                <View style={styles.selRow}>
                  <Well icon={courseIcon(sel.icon, sel.name)} color={sel.color} bg={sel.color} fg="#fff" size={38} radius={12} iconSize={18} />
                  <View style={{ flex: 1 }}>
                    <T w={800} size={16} numberOfLines={1}>{sel.name}</T>
                    <T w={600} c={p.muted} size={12}>{counts.get(sel.id) ?? 0} files · {groups.length} type{groups.length === 1 ? '' : 's'}</T>
                  </View>
                  <T w={600} c={p.muted} size={12}>Tap a book</T>
                </View>
              ) : null}
            </Card>
          </Rise>

          {latest ? (
            <Rise i={3}>
              <Card style={styles.resume} onPress={() => router.push(`/resource/${latest.id}` as any)}>
                <View style={[styles.doc, { backgroundColor: tint(FILE_COLORS[fileKind(latest)]) }]}>
                  <Icon name={KIND[fileKind(latest)].icon} size={20} color={FILE_COLORS[fileKind(latest)]} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T w={600} c={p.muted} size={12}>Newest in {sel?.short}</T>
                  <T w={700} size={14} numberOfLines={1}>{latest.title}</T>
                </View>
                <View style={[styles.openBtn, { backgroundColor: p.text }]}><T w={700} c={p.bg} size={12}>Open</T></View>
              </Card>
            </Rise>
          ) : null}

          {groups.map((g) => (
            <View key={g.k} style={{ paddingHorizontal: 20 }}>
              <View style={styles.groupHead}>
                <T w={800} size={14}>{KIND[g.k].plural}</T>
                <T w={600} c={p.muted} size={11.5}>{g.files.length} file{g.files.length === 1 ? '' : 's'}</T>
              </View>
              <ListCard>
                {g.files.map((f) => (
                  <Tap key={f.id} onPress={() => router.push(`/resource/${f.id}` as any)} style={styles.file}>
                    <Well icon={KIND[g.k].icon} color={FILE_COLORS[g.k]} bg={tint(FILE_COLORS[g.k])} size={32} radius={9} iconSize={16} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T w={700} size={13.5} numberOfLines={1}>{f.title}</T>
                      <T c={p.muted} size={11.5}>{[size(f.sizeBytes), f.createdAt ? `Added ${shortDate(f.createdAt.slice(0, 10))}` : null].filter(Boolean).join(' · ') || KIND[g.k].label}</T>
                    </View>
                    <Icon name="chevron-right" size={16} color={p.muted} />
                  </Tap>
                ))}
              </ListCard>
            </View>
          ))}
          {sel && !groups.length ? (
            <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
              <Empty icon="upload" title={filter === 'all' ? `No files in ${sel.short} yet` : 'Nothing matches this filter'}
                body="Add PDFs, photos of the board, notes and links." action="Add file" onAction={() => router.push(`/resource/add?workspaceId=${sel.id}` as any)} />
            </View>
          ) : null}

          {s.files.length ? (
            <Rise i={4}>
              <View style={[styles.types, { backgroundColor: p.surface }]}>
                <T w={700} c={p.muted} size={12} style={{ marginBottom: 8 }}>All files by type</T>
                <View style={styles.typeBar}>
                  {(Object.keys(KIND) as FileKind[]).filter((k) => byKind[k]).map((k) => <View key={k} style={{ flex: byKind[k], backgroundColor: FILE_COLORS[k] }} />)}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  {(Object.keys(KIND) as FileKind[]).filter((k) => byKind[k]).map((k) => (
                    <T key={k} w={600} c={p.muted} size={11.5}>{KIND[k].plural} {byKind[k]}</T>
                  ))}
                </View>
              </View>
            </Rise>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Book({ on, color, label, count, height, flex, d, onPress }: { on: boolean; color: string; label: string; count: number; height: number; flex: number; d: number; onPress: () => void }) {
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: withTiming(on ? -8 : 0, { duration: 250 }) }], opacity: withTiming(on ? 1 : 0.55, { duration: 200 }) }));
  return (
    <Animated.View style={[{ flex }, lift]}>
      <Tap onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${label}, ${count} files`}>
        <GrowColumn height={height} color={color} d={d} radius={8} style={{ borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }} />
        <View style={styles.bookLabel} pointerEvents="none">
          <T w={800} c="#fff" size={12} numberOfLines={1}>{label}</T>
          <T style={[mono(500), { fontSize: 10, color: 'rgba(255,255,255,0.85)' }]}>{count}</T>
        </View>
      </Tap>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  titleRow: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  search: { marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  shelf: { marginHorizontal: 20, marginTop: 14, paddingTop: 10, paddingHorizontal: 6, paddingBottom: 14, borderRadius: 26 },
  books: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 136, paddingTop: 6, paddingHorizontal: 8 },
  bookLabel: { position: 'absolute', left: 0, right: 0, bottom: 8, alignItems: 'center' },
  plank: { height: 6, marginHorizontal: 8, marginBottom: 10, borderRadius: 3 },
  selRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4, paddingHorizontal: 12 },
  resume: { marginHorizontal: 20, marginTop: 14, padding: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  doc: { width: 40, height: 48, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  openBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18, marginBottom: 8, marginHorizontal: 4 },
  file: listRow,
  types: { marginHorizontal: 20, marginTop: 18, padding: 14, borderRadius: 20 },
  typeBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
});
