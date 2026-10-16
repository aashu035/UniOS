import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarPill, chipFor, courseChips, FileActions, ViewerBar, type FileRow } from '../../components/files/FileFrame';
import { MarkdownBody } from '../../components/files/MarkdownBody';
import { Icon } from '../../components/uni/Icon';
import { T, Tap } from '../../components/uni/primitives';
import { mono, sans, useUni } from '../../components/uni/theme';
import { insertAt, NOTE_TOOLS, noteTitle } from '../../domains/resource/files';
import { ResourceRepository } from '../../domains/resource/repository';

type Status = 'empty' | 'saving' | 'saved';
const AUTOSAVE_MS = 700;
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/**
 * A note (design UniFile, handoff §2 Note). Opens in reading mode; Edit switches
 * to title, Markdown toolbar and body, saved 700 ms after typing stops. A new
 * note (+ → Note) opens straight into editing and is only saved once it has text.
 */
export default function NoteScreen() {
  const p = useUni();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; workspaceId?: string }>();
  const isNew = params.id === 'new';
  const chips = useMemo(() => { try { return courseChips(); } catch { return []; } }, []);

  const [row, setRow] = useState<FileRow | null>(() => {
    if (isNew || !/^\d+$/.test(params.id ?? '')) return null;
    const r = ResourceRepository.get(Number(params.id));
    return r?.type === 'note' ? r : null;
  });
  const missing = !isNew && !row;
  const [title, setTitle] = useState(row?.title === 'Untitled note' ? '' : row?.title ?? '');
  const [body, setBody] = useState(row?.textContent ?? '');
  const [editing, setEditing] = useState(isNew);
  const [status, setStatus] = useState<Status>(isNew ? 'empty' : 'saved');
  const [sheet, setSheet] = useState<'menu' | 'rename' | 'move' | null>(null);
  const sel = useRef({ start: 0, end: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef<number | null>(row?.id ?? null);
  const latest = useRef({ title, body });
  latest.current = { title, body };
  const wsId = row ? row.workspaceId : params.workspaceId && /^\d+$/.test(params.workspaceId) ? Number(params.workspaceId) : null;

  /** Write now: create the note on its first text, update it after that. */
  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const { title: t, body: b } = latest.current;
    try {
      if (idRef.current == null) {
        if (!t.trim() && !b.trim()) { setStatus('empty'); return; }
        idRef.current = ResourceRepository.createNote({ workspaceId: wsId, title: t, text: b });
      } else {
        ResourceRepository.updateNote(idRef.current, { title: t, text: b });
      }
      setRow(ResourceRepository.get(idRef.current) ?? null);
      setStatus('saved');
    } catch (e) {
      console.error('Could not save the note', e instanceof Error ? e.message : e);
      setStatus('saving');
    }
  }, [wsId]);

  const changed = (next: Partial<{ title: string; body: string }>) => {
    if (next.title !== undefined) setTitle(next.title);
    if (next.body !== undefined) setBody(next.body);
    latest.current = { ...latest.current, ...next };
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_MS);
  };
  useEffect(() => () => { if (timer.current) flush(); }, [flush]);

  const leave = () => { flush(); router.back(); };
  const done = () => { flush(); setEditing(false); };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (editing && !isNew && row) { done(); return true; } flush(); return false; });
    return () => sub.remove();
  });

  const tool = (text: string) => {
    const r = insertAt(latest.current.body, sel.current, text);
    sel.current = { start: r.cursor, end: r.cursor };
    changed({ body: r.body });
  };

  const chip = chipFor(chips, wsId);
  const shownTitle = editing ? (title.trim() || (isNew && !row ? 'New note' : 'Untitled note')) : noteTitle(row?.title);

  if (missing) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <ViewerBar title="Note" chip={chip} meta="Not found" onBack={() => router.back()} topInset={insets.top} />
        <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
          <T w={800} size={16}>This note isn’t here any more</T>
          <T c={p.muted} size={13.5} style={{ textAlign: 'center' }}>It may have been deleted.</T>
        </View>
      </View>
    );
  }

  const statusLine = status === 'saving' ? { icon: 'loader' as const, c: p.warn, t: 'Saving…' }
    : status === 'empty' ? { icon: 'circle-dashed' as const, c: p.muted, t: 'Not saved yet. Start typing.' }
      : { icon: 'cloud-check' as const, c: p.muted, t: 'Saved on this phone' };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: p.bg }}>
      <ViewerBar title={shownTitle} chip={chip} meta={`Note · ${words(editing ? body : row?.textContent ?? '')} words`} topInset={insets.top}
        onBack={leave} onChip={row ? () => setSheet('move') : undefined}
        right={editing ? <BarPill label="Done" onPress={done} /> : <BarPill label="Edit" icon="pencil" onPress={() => { setTitle(row?.title === 'Untitled note' ? '' : row?.title ?? ''); setBody(row?.textContent ?? ''); setEditing(true); }} />}
        onMenu={row ? () => { flush(); setSheet('menu'); } : undefined} />

      {editing ? (
        <View style={{ flex: 1, paddingTop: 14, paddingHorizontal: 20, gap: 8 }}>
          <TextInput value={title} onChangeText={(v) => changed({ title: v.slice(0, 200) })} placeholder="Title" placeholderTextColor={p.muted} accessibilityLabel="Title"
            style={[sans(800), { fontSize: 23, letterSpacing: -0.5, color: p.text, paddingVertical: 4 }]} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
            {NOTE_TOOLS.map(([label, text]) => (
              <Tap key={label} onPress={() => tool(text)} accessibilityRole="button" accessibilityLabel={`Insert ${label}`}
                style={{ height: 36, paddingHorizontal: 12, borderRadius: 10, backgroundColor: p.surface, justifyContent: 'center' }}>
                <T w={700} size={12.5} style={mono(700)}>{label}</T>
              </Tap>
            ))}
          </ScrollView>
          <TextInput value={body} onChangeText={(v) => changed({ body: v })} multiline autoFocus={isNew} textAlignVertical="top" accessibilityLabel="Note"
            onSelectionChange={(e) => { sel.current = e.nativeEvent.selection; }}
            placeholder="Write here. Markdown works: # heading, - list, **bold**." placeholderTextColor={p.muted}
            style={[sans(500), { flex: 1, fontSize: 15, lineHeight: 23, color: p.text, paddingVertical: 4 }]} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: insets.bottom + 14 }} accessibilityLiveRegion="polite">
            <Icon name={statusLine.icon} size={14} color={statusLine.c} />
            <T w={700} size={12} c={statusLine.c}>{statusLine.t}</T>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 18, paddingHorizontal: 22, paddingBottom: insets.bottom + 60, gap: 10 }}>
          <T w={800} size={24} style={{ letterSpacing: -0.6, lineHeight: 30 }}>{noteTitle(row?.title)}</T>
          <T w={600} c={p.muted} size={12} style={{ marginTop: -4 }}>Saved on this phone</T>
          {row?.textContent?.trim() ? <MarkdownBody text={row.textContent} /> : (
            <Tap onPress={() => setEditing(true)} accessibilityRole="button" style={{ paddingVertical: 20 }}>
              <T c={p.muted} size={14.5}>This note is empty. Tap Edit to write.</T>
            </Tap>
          )}
        </ScrollView>
      )}

      {row ? (
        <FileActions row={row} sheet={sheet} setSheet={setSheet} chips={chips} canOpen={false}
          onChanged={(r) => { setRow(r); if (editing) setTitle(r.title); }}
          onDeleted={() => { if (timer.current) clearTimeout(timer.current); timer.current = null; router.back(); }} />
      ) : null}
    </KeyboardAvoidingView>
  );
}
