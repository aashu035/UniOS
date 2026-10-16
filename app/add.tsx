import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, BackHandler, Image, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import { courseChips, CourseChips, GENERAL, type CourseChip } from '../components/files/FileFrame';
import { fileVisual } from '../components/uni/fileKinds';
import { Icon, type IconName } from '../components/uni/Icon';
import { T, Tap } from '../components/uni/primitives';
import { ErrorText, FieldLabel, PrimaryButton } from '../components/uni/form';
import { useToast } from '../components/uni/Toast';
import { mono, sans, tint, useUni } from '../components/uni/theme';
import { FileManager } from '../core/fs/FileManager';
import { kindOf } from '../core/fs/fileType';
import { jpegsToPdf } from '../core/fs/pdf';
import { Clipboard } from '../core/utils/clipboard';
import { formatBytes, formatDuration } from '../core/utils/format';
import { AddJob, type JobRow } from '../domains/resource/addJob';
import {
  biggest, checkLink, copyMeta, doneText, dupText, fullName, largeText, needBytes, nounOf, pickedMeta, renamed, reviewCta,
  scanPdfName, siteOf, skipNote, splitName, unreadableReason, LARGE_BYTES, type Picked,
} from '../domains/resource/files';
import { ResourceRepository } from '../domains/resource/repository';

type Mode = 'menu' | 'link' | 'denied' | 'camera' | 'review' | 'job';
type Shot = { uri: string; size: number | null };
const MAX_PAGES = 30;
let nextId = 1;

/**
 * + Add (design UniAdd, handoff §1): Camera, Photos, Files, Link, Note; then a
 * review of what was picked (rename, duplicates by SHA-256, large and unreadable
 * files, free space), copying one file at a time, and the result.
 */
export default function AddScreen() {
  const p = useUni();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ workspaceId?: string; mode?: string }>();
  const chips = useMemo(() => { try { return courseChips(); } catch { return [GENERAL]; } }, []);
  const preset = params.workspaceId && /^\d+$/.test(params.workspaceId) ? chips.find((c) => c.id === Number(params.workspaceId)) ?? null : null;

  const job = useSyncExternalStore(AddJob.subscribe, AddJob.get);
  const [mode, setMode] = useState<Mode>(() => (AddJob.get() ? 'job' : params.mode === 'link' ? 'link' : params.mode === 'camera' ? 'camera' : 'menu'));
  const [items, setItems] = useState<Picked[]>([]);
  const [dest, setDest] = useState<CourseChip | null>(preset);
  const [free, setFree] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [shots, setShots] = useState<Shot[]>([]);
  const [asPdf, setAsPdf] = useState(true);
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => { if (!AddJob.get()?.running) AddJob.clear(); router.back(); }, [router]);

  // Free space, checked again whenever the app comes back (after "Free up space").
  const checkFree = useCallback(() => { FileSystem.getFreeDiskStorageAsync().then(setFree).catch(() => setFree(null)); }, []);
  useEffect(() => { checkFree(); const s = AppState.addEventListener('change', (st) => { if (st === 'active') checkFree(); }); return () => s.remove(); }, [checkFree]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode === 'link' || mode === 'denied' || (mode === 'camera' && !shots.length)) { setMode('menu'); return true; }
      if (mode === 'camera') { setShots([]); setMode('menu'); return true; }
      close();
      return true;
    });
    return () => sub.remove();
  });

  // ── Picking ──
  const toReview = (picked: Picked[]) => {
    if (!picked.length) return;
    setItems(picked);
    setMode('review');
    checkAll(picked);
  };

  /** Size, readability and duplicate check by SHA-256, one file at a time. */
  const checkAll = async (picked: Picked[]) => {
    for (const it of picked) {
      let patch: Partial<Picked> = { checked: true };
      try {
        const info = await FileSystem.getInfoAsync(it.uri).catch(() => null);
        const size = info?.exists ? (info as any).size ?? it.size : it.size;
        const bad = unreadableReason(info ? { exists: info.exists, size } : null);
        if (bad) patch = { ...patch, bad, size: size ?? null };
        else {
          const hash = await FileManager.generateFileHash(it.uri);
          const hit = ResourceRepository.findByHash(hash);
          patch = { ...patch, size: size ?? null, hash, dup: hit ? { title: hit.title, course: hit.course } : null };
        }
      } catch (e) {
        console.error('Could not check a picked file', e instanceof Error ? e.message : e);
      }
      setItems((cur) => cur.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
    }
  };

  const fromAsset = (a: { uri: string; name: string; mime?: string | null; size?: number | null; durationMs?: number | null }, source: Picked['source']): Picked => {
    const { base, ext } = splitName(a.name, a.mime);
    return { id: `p${nextId++}`, uri: a.uri, base, ext, mime: a.mime ?? null, size: a.size ?? null, durationMs: a.durationMs ?? null, source, hash: null, checked: false, dup: null, dupOk: false, bad: null };
  };

  const pickPhotos = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 30, quality: 1, exif: false });
      if (r.canceled) return;
      toReview(r.assets.map((a) => fromAsset({ uri: a.uri, name: a.fileName || (a.type === 'video' ? 'Video' : 'Photo'), mime: a.mimeType, size: a.fileSize, durationMs: a.type === 'video' ? a.duration : null }, 'photos')));
    } catch (e) { toast.show('Couldn’t open your photos. Try again.'); }
  };
  const pickFiles = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
      if (r.canceled) return;
      toReview(r.assets.map((a) => fromAsset({ uri: a.uri, name: a.name, mime: a.mimeType, size: a.size }, 'files')));
    } catch (e) { toast.show('Couldn’t open your files. Try again.'); }
  };

  // ── Camera (system camera, one page per shot) ──
  const snap = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setMode('denied'); return; }
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, exif: false });
      const a = r.canceled ? null : r.assets?.[0];
      if (a?.uri) setShots((s) => [...s, { uri: a.uri, size: a.fileSize ?? null }].slice(0, MAX_PAGES));
    } catch (e) { toast.show('Couldn’t open the camera.'); }
  };
  const cameraDone = async () => {
    if (!shots.length) return;
    const now = new Date();
    if (asPdf) {
      setBusy(true);
      try {
        const pages = [];
        for (const s of shots) pages.push(await FileSystem.readAsStringAsync(s.uri, { encoding: FileSystem.EncodingType.Base64 }));
        const out = `${FileSystem.cacheDirectory}scan-${now.getTime()}.pdf`;
        await FileSystem.writeAsStringAsync(out, jpegsToPdf(pages), { encoding: FileSystem.EncodingType.Base64 });
        const info = await FileSystem.getInfoAsync(out);
        shots.forEach((s) => FileSystem.deleteAsync(s.uri, { idempotent: true }).catch(() => {}));
        setShots([]);
        toReview([fromAsset({ uri: out, name: `${scanPdfName(now, shots.length)}.pdf`, mime: 'application/pdf', size: info.exists ? (info as any).size : null }, 'camera')]);
        return;
      } catch (e) {
        console.error('Could not make the PDF', e instanceof Error ? e.message : e);
        toast.show('Couldn’t make one PDF, so the photos are added one by one.');
      } finally { setBusy(false); }
    }
    const stamp = (i: number) => `IMG_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${i + 1}`;
    const list = shots.map((s, i) => fromAsset({ uri: s.uri, name: `${stamp(i)}.jpg`, mime: 'image/jpeg', size: s.size }, 'camera'));
    setShots([]);
    toReview(list);
  };

  // ── Review → copy ──
  const cta = reviewCta(items, dest, free);
  const need = needBytes(items);
  const full = free != null && need > free && items.every((x) => x.checked);
  const big = biggest(items);
  const start = () => {
    if (!cta.ok || !dest) return;
    const rows: JobRow[] = items.map((x) => ({ id: x.id, title: fullName(x), uri: x.uri, ext: x.ext, size: x.size, hash: x.hash, mime: x.mime, st: x.bad ? 'bad' : x.dup && !x.dupOk ? 'skip' : 'wait' }));
    AddJob.start(rows, { id: dest.id, short: dest.short, name: dest.name }).catch((e) => toast.show(e instanceof Error ? e.message : 'Couldn’t start copying.'));
    setEditing(null);
    setMode('job');
  };
  const commitRename = (id: string) => {
    setItems((cur) => cur.map((x) => (x.id === id ? { ...x, base: renamed(editValue, x.base) } : x)));
    setEditing(null);
  };

  // ── Link ──
  const [url, setUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkDest, setLinkDest] = useState<CourseChip | null>(preset);
  const [clip, setClip] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== 'link' || !Clipboard.available()) return;
    Clipboard.getString().then((s) => setClip(checkLink(s.trim().slice(0, 2000)))).catch(() => {});
  }, [mode]);
  const link = checkLink(url);
  const saveLink = () => {
    if (!link || !linkDest) return;
    try {
      ResourceRepository.addLink({ workspaceId: linkDest.id, title: linkName, url: link });
      toast.show(`Link saved to ${linkDest.name}.`);
      router.back();
    } catch (e) { toast.show(e instanceof Error ? e.message : 'Couldn’t save the link.'); }
  };

  const MENU: Array<{ icon: IconName; l: string; d: string; c: string; on: () => void }> = [
    { icon: 'camera', l: 'Camera', d: 'Photograph notes or the board, several pages at once', c: '#0891B2', on: () => setMode('camera') },
    { icon: 'images', l: 'Photos', d: 'Your gallery and Google Photos', c: '#F59E0B', on: pickPhotos },
    { icon: 'folder-open', l: 'Files', d: 'Phone storage, Downloads, Drive', c: '#3B82F6', on: pickFiles },
    { icon: 'link', l: 'Link', d: 'A website, Drive or YouTube link', c: '#8B5CF6', on: () => setMode('link') },
    { icon: 'sticky-note', l: 'Note', d: 'Write it here. Markdown works.', c: '#10B981', on: () => router.replace({ pathname: '/note/[id]', params: { id: 'new', ...(preset?.id ? { workspaceId: String(preset.id) } : {}) } }) },
  ];

  const sheetBase = [styles.sheet, { backgroundColor: p.elev, paddingBottom: insets.bottom + 22 }];
  const dim = mode === 'menu' || mode === 'link' || mode === 'denied';

  // ── Camera screen ──
  if (mode === 'camera') {
    const last = shots[shots.length - 1];
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Tap onPress={() => { setShots([]); setMode('menu'); }} accessibilityRole="button" accessibilityLabel="Close camera" style={styles.camBtn}>
            <Icon name="x" size={20} color="#fff" />
          </Tap>
          <View style={{ flex: 1 }} />
          <Tap onPress={() => setAsPdf(!asPdf)} accessibilityRole="switch" accessibilityState={{ checked: asPdf }} accessibilityLabel="Save as one PDF"
            style={{ height: 44, paddingLeft: 14, paddingRight: 8, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T w={800} size={13} c="#fff">Save as one PDF</T>
            <View style={{ width: 38, height: 22, borderRadius: 11, backgroundColor: asPdf ? p.primary : 'rgba(255,255,255,0.3)', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', left: asPdf ? 19 : 3, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' }} />
            </View>
          </Tap>
        </View>
        <View style={{ flex: 1, marginHorizontal: 14, marginVertical: 6, borderRadius: 24, backgroundColor: '#1C1C1F', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {last ? <Image source={{ uri: last.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityLabel={`Page ${shots.length}`} /> : (
            <>
              <View style={{ position: 'absolute', left: '12%', right: '12%', top: '9%', bottom: '9%', borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)', borderRadius: 10 }} />
              <View style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <T w={700} size={12.5} c="#fff">Fill the frame with one page</T>
              </View>
            </>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, minHeight: 66 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}>
          {shots.map((s, i) => (
            <Tap key={s.uri} onPress={() => setShots((cur) => cur.filter((x) => x.uri !== s.uri))} accessibilityRole="button" accessibilityLabel={`Remove page ${i + 1}`}
              style={{ width: 44, height: 58, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', overflow: 'hidden', backgroundColor: '#3A3B40' }}>
              <Image source={{ uri: s.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={{ position: 'absolute', top: 1, right: 1, width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="x" size={10} color="#fff" />
              </View>
            </Tap>
          ))}
        </ScrollView>
        <View style={{ paddingTop: 8, paddingHorizontal: 22, paddingBottom: insets.bottom + 26, flexDirection: 'row', alignItems: 'center' }}>
          <T w={700} size={13} c="rgba(255,255,255,0.75)" style={{ flex: 1 }}>
            {shots.length ? `${shots.length} page${shots.length === 1 ? '' : 's'}${asPdf ? ' · 1 PDF' : ''}` : 'Tap to take a photo'}
          </T>
          <Tap onPress={snap} disabled={shots.length >= MAX_PAGES} accessibilityRole="button" accessibilityLabel="Take a photo" pressedStyle={{ transform: [{ scale: 0.92 }] }}
            style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' }} />
          </Tap>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Tap onPress={cameraDone} disabled={!shots.length || busy} accessibilityRole="button" accessibilityLabel={`Done, ${shots.length} pages`}
              style={{ height: 46, paddingHorizontal: 18, borderRadius: 23, backgroundColor: shots.length ? p.primary : 'rgba(255,255,255,0.18)', justifyContent: 'center', opacity: shots.length ? 1 : 0.5 }}>
              <T w={800} size={14} c="#fff">{busy ? 'Making PDF…' : `Done (${shots.length})`}</T>
            </Tap>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {dim ? <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }]}><Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close" /></Animated.View> : null}

      {mode === 'menu' ? (
        <Animated.View entering={SlideInDown.duration(260)} style={[sheetBase, { paddingHorizontal: 14, gap: 2 }]}>
          <View style={[styles.grip, { backgroundColor: p.border }]} />
          <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
            <T w={800} size={19} style={{ letterSpacing: -0.3 }} accessibilityRole="header">Add</T>
            <T w={600} c={p.muted} size={12.5} style={{ marginTop: 2 }}>{preset ? `Saving to ${preset.name}` : 'You’ll pick the course after choosing'}</T>
          </View>
          {MENU.map((m) => (
            <Tap key={m.l} onPress={m.on} accessibilityRole="button" accessibilityLabel={`${m.l}. ${m.d}`} pressedStyle={{ backgroundColor: p.surface }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 8, minHeight: 62, borderRadius: 16 }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: tint(m.c, 14), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={m.icon} size={21} color={m.c} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T w={800} size={15.5}>{m.l}</T>
                <T w={600} c={p.muted} size={12.5} style={{ marginTop: 1 }}>{m.d}</T>
              </View>
              <Icon name="chevron-right" size={17} color={p.muted} />
            </Tap>
          ))}
        </Animated.View>
      ) : null}

      {mode === 'denied' ? (
        <Animated.View entering={SlideInDown.duration(260)} style={[sheetBase, { paddingHorizontal: 20, gap: 14 }]}>
          <View style={[styles.grip, { backgroundColor: p.border }]} />
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: tint(p.warn, 14), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="camera-off" size={26} color={p.warn} />
          </View>
          <View style={{ gap: 6 }}>
            <T w={800} size={19} style={{ letterSpacing: -0.3 }}>Camera access is off</T>
            <T c={p.muted} size={13.5} style={{ lineHeight: 20 }}>UniOS uses the camera to photograph notes, the board and timetables. Photos stay on this phone.</T>
          </View>
          <View style={{ paddingVertical: 11, paddingHorizontal: 13, borderRadius: 14, backgroundColor: p.surface }}>
            <T w={600} size={12.5} style={{ lineHeight: 18 }}>In Settings: Apps → UniOS → Permissions → Camera → Allow</T>
          </View>
          <PrimaryButton label="Open settings" onPress={() => Linking.openSettings().catch(() => toast.show('Couldn’t open Settings.'))} />
          <PrimaryButton label="Use Photos instead" tone="plain" onPress={pickPhotos} />
        </Animated.View>
      ) : null}

      {mode === 'link' ? (
        <Animated.View entering={SlideInDown.duration(260)} style={[sheetBase, { paddingHorizontal: 18, gap: 14 }]}>
          <View style={[styles.grip, { backgroundColor: p.border }]} />
          <T w={800} size={19} style={{ letterSpacing: -0.3 }}>Add a link</T>
          {clip && !url ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: p.primarySoft }}>
              <Icon name="clipboard" size={17} color={p.primary} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T w={800} size={11.5} c={p.primary}>ON YOUR CLIPBOARD</T>
                <T w={600} size={12} numberOfLines={1} style={[mono(500), { marginTop: 2 }]}>{clip.replace(/^https?:\/\//, '')}</T>
              </View>
              <Tap onPress={() => setUrl(clip)} accessibilityRole="button" style={{ height: 40, paddingHorizontal: 14, borderRadius: 11, backgroundColor: p.primary, justifyContent: 'center' }}>
                <T w={800} size={13} c="#fff">Use</T>
              </Tap>
            </View>
          ) : null}
          <View style={{ gap: 6 }}>
            <FieldLabel>Link</FieldLabel>
            <TextInput value={url} onChangeText={(v) => setUrl(v.slice(0, 2000))} placeholder="https://" placeholderTextColor={p.muted} keyboardType="url" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Link"
              style={[mono(500), { height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: url.trim() && !link ? p.danger : p.border, backgroundColor: p.elev, paddingHorizontal: 13, fontSize: 14, color: p.text }]} />
            {url.trim() && !link ? <ErrorText>Check the link. It should start with https://</ErrorText> : null}
          </View>
          {link ? (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: p.hair }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={siteOf(link).icon} size={19} color={p.text} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T w={700} c={p.muted} size={12}>{siteOf(link).name}</T>
                <TextInput value={linkName} onChangeText={(v) => setLinkName(v.slice(0, 120))} placeholder="Name this link" placeholderTextColor={p.muted} accessibilityLabel="Link name"
                  style={[sans(800), { fontSize: 15, color: p.text, paddingVertical: 2 }]} />
              </View>
              <Icon name="pencil" size={14} color={p.muted} />
            </View>
          ) : null}
          <View style={{ gap: 8 }}>
            <FieldLabel>Save to</FieldLabel>
            <CourseChips chips={chips} value={linkDest?.id ?? (linkDest ? null : undefined)} onChange={setLinkDest} height={38} />
          </View>
          <PrimaryButton label={!link ? 'Paste or type a link' : !linkDest ? 'Pick a course' : `Save link to ${linkDest.short}`} onPress={saveLink} disabled={!link || !linkDest} />
        </Animated.View>
      ) : null}

      {mode === 'review' || mode === 'job' ? (
        <Animated.View entering={SlideInDown.duration(280)} style={[styles.tall, { top: insets.top + 12, backgroundColor: p.bg }]}>
          {mode === 'review' ? (
            <Review p={p} items={items} setItems={setItems} dest={dest} setDest={setDest} chips={chips} preset={preset} free={free} need={need} full={full} big={big}
              cta={cta} onStart={start} onClose={close} onPickAgain={() => setMode('menu')} editing={editing} setEditing={setEditing}
              editValue={editValue} setEditValue={setEditValue} commitRename={commitRename} bottom={insets.bottom} />
          ) : job ? (
            <JobView p={p} job={job} bottom={insets.bottom} onClose={close}
              onOpen={() => { AddJob.clear(); router.replace(job.dest.id ? `/course/${job.dest.id}?tab=files` as any : '/hub'); }}
              onDone={() => { const n = job.rows.filter((r) => r.st === 'done').length; AddJob.clear(); router.back(); if (n) toast.show(`${n} item${n === 1 ? '' : 's'} added to ${job.dest.name}.`); }} />
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

type P = ReturnType<typeof useUni>;

function Thumb({ p, item }: { p: P; item: Pick<Picked, 'uri' | 'ext' | 'durationMs'> }) {
  const k = kindOf(`x.${item.ext}`);
  if (k === 'image') return <Image source={{ uri: item.uri }} style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: p.surface }} resizeMode="cover" />;
  if (k === 'video') {
    return (
      <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Icon name="play" size={18} color="#fff" />
        {item.durationMs ? <View style={{ position: 'absolute', right: 3, bottom: 3, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.65)' }}><T w={700} size={9} c="#fff" style={mono(700)}>{formatDuration(item.durationMs / 1000)}</T></View> : null}
      </View>
    );
  }
  const v = fileVisual({ type: 'file', uri: `x.${item.ext}` });
  return (
    <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: tint(v.color, 13), alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <Icon name={v.icon} size={17} color={v.color} />
      <T w={800} size={9} c={v.color} style={mono(700)}>{item.ext.toUpperCase().slice(0, 4)}</T>
    </View>
  );
}

function Review(props: {
  p: P; items: Picked[]; setItems: React.Dispatch<React.SetStateAction<Picked[]>>; dest: CourseChip | null; setDest: (c: CourseChip) => void; chips: CourseChip[]; preset: CourseChip | null;
  free: number | null; need: number; full: boolean; big: Picked | null; cta: { label: string; ok: boolean }; onStart: () => void; onClose: () => void; onPickAgain: () => void;
  editing: string | null; setEditing: (id: string | null) => void; editValue: string; setEditValue: (v: string) => void; commitRename: (id: string) => void; bottom: number;
}) {
  const { p, items, setItems } = props;
  const readable = items.filter((x) => !x.bad).reduce((t, x) => t + (x.size ?? 0), 0);
  const note = skipNote(items);
  const update = (id: string, patch: Partial<Picked>) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <>
      <View style={{ paddingTop: 10, paddingHorizontal: 18, paddingBottom: 12, gap: 10 }}>
        <View style={[styles.grip, { backgroundColor: p.border }]} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T w={800} size={20} style={{ letterSpacing: -0.4, lineHeight: 25 }} accessibilityRole="header">Add to UniOS</T>
            <T w={600} c={p.muted} size={12.5} style={{ marginTop: 3 }}>{[`${items.length} item${items.length === 1 ? '' : 's'} picked`, formatBytes(readable), props.preset ? `from ${props.preset.short} Files` : ''].filter(Boolean).join(' · ')}</T>
          </View>
          <Tap onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={19} color={p.text} />
          </Tap>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 14 }}>
        {items.length ? (
          <View style={{ borderRadius: 20, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, overflow: 'hidden' }}>
            {items.map((x, i) => (
              <View key={x.id} style={{ gap: 9, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: p.hair, backgroundColor: x.bad ? tint(p.danger, 6) : 'transparent' }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Thumb p={p} item={x} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {props.editing === x.id ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <TextInput value={props.editValue} onChangeText={props.setEditValue} autoFocus onSubmitEditing={() => props.commitRename(x.id)} onBlur={() => props.commitRename(x.id)} accessibilityLabel="File name"
                          style={[sans(700), { flex: 1, minWidth: 0, height: 38, borderRadius: 10, borderWidth: 1.5, borderColor: p.primary, backgroundColor: p.elev, paddingHorizontal: 10, fontSize: 14, color: p.text }]} />
                        <T w={700} size={12} c={p.muted} style={mono(700)}>{`.${x.ext}`}</T>
                      </View>
                    ) : (
                      <Tap onPress={() => { if (!x.bad) { props.setEditing(x.id); props.setEditValue(x.base); } }} disabled={!!x.bad} accessibilityRole="button" accessibilityLabel={`${fullName(x)}${x.bad ? '' : '. Rename'}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22 }}>
                        <T w={700} size={14} numberOfLines={1} style={{ flexShrink: 1 }}>{fullName(x)}</T>
                        {!x.bad ? <Icon name="pencil" size={12} color={p.muted} /> : null}
                      </Tap>
                    )}
                    <T w={600} size={12} c={x.bad ? p.danger : p.muted} style={{ marginTop: 2 }}>{x.checked ? pickedMeta(x) : `${pickedMeta(x)} · checking…`}</T>
                  </View>
                  {x.bad ? <Icon name="circle-alert" size={20} color={p.danger} /> : null}
                  <Tap onPress={() => setItems((cur) => cur.filter((y) => y.id !== x.id))} accessibilityRole="button" accessibilityLabel={`Remove ${fullName(x)}`}
                    style={{ width: 44, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="x" size={18} color={p.muted} />
                  </Tap>
                </View>
                {!x.bad && (x.size ?? 0) > LARGE_BYTES ? (
                  <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 12, backgroundColor: tint(p.warn, 11) }}>
                    <Icon name="hard-drive" size={15} color={p.warn} />
                    <T w={600} size={12.5} style={{ flex: 1, lineHeight: 18 }}>{largeText(x)}</T>
                  </View>
                ) : null}
                {x.dup && !x.dupOk ? (
                  <View style={{ gap: 9, paddingVertical: 10, paddingHorizontal: 11, borderRadius: 12, backgroundColor: tint(p.warn, 11) }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Icon name="copy" size={15} color={p.warn} />
                      <T w={600} size={12.5} style={{ flex: 1, lineHeight: 18 }}>{dupText(x.dup)}</T>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[['Add anyway', () => update(x.id, { dupOk: true })], ['Skip', () => setItems((cur) => cur.filter((y) => y.id !== x.id))]].map(([l, on]) => (
                        <Tap key={l as string} onPress={on as () => void} accessibilityRole="button" style={{ flex: 1, height: 44, borderRadius: 11, backgroundColor: p.elev, alignItems: 'center', justifyContent: 'center' }}>
                          <T w={800} size={13}>{l as string}</T>
                        </Tap>
                      ))}
                    </View>
                  </View>
                ) : null}
                {x.dup && x.dupOk ? <T w={600} size={12} c={p.muted}>A second copy will be added.</T> : null}
                {x.bad ? <T w={600} size={12.5} c={p.danger} style={{ lineHeight: 18 }}>{x.bad}</T> : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={{ paddingVertical: 26, paddingHorizontal: 18, borderRadius: 20, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, alignItems: 'center', gap: 10 }}>
            <T w={800} size={15}>Nothing left to add</T>
            <Tap onPress={props.onPickAgain} accessibilityRole="button" style={{ height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: p.surface, justifyContent: 'center' }}>
              <T w={800} size={13.5}>Pick again</T>
            </Tap>
          </View>
        )}
        <View style={{ gap: 8 }}>
          <FieldLabel>Save to</FieldLabel>
          <CourseChips chips={props.chips} value={props.dest ? props.dest.id : undefined} onChange={props.setDest} />
        </View>
        {note ? <T w={600} c={p.muted} size={12.5} style={{ lineHeight: 18 }}>{note}</T> : null}
      </ScrollView>
      <View style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: props.bottom + 16, borderTopWidth: 1, borderTopColor: p.hair, backgroundColor: p.bg, gap: 10 }}>
        {props.full ? (
          <View style={{ gap: 10, padding: 12, borderRadius: 16, backgroundColor: tint(p.danger, 9) }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Icon name="hard-drive" size={16} color={p.danger} />
              <T w={600} size={13} style={{ flex: 1, lineHeight: 19 }}>{`Not enough space. These need ${formatBytes(props.need)} and this phone has ${formatBytes(props.free)} free.`}</T>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {props.big ? (
                <Tap onPress={() => setItems((cur) => cur.filter((y) => y.id !== props.big!.id))} accessibilityRole="button" style={styles.fullBtn(p)}>
                  <T w={800} size={13} numberOfLines={1}>{`Remove the ${formatBytes(props.big.size)} ${nounOf(props.big.ext)}`}</T>
                </Tap>
              ) : null}
              <Tap onPress={() => IntentLauncher.startActivityAsync('android.settings.INTERNAL_STORAGE_SETTINGS').catch(() => Linking.openSettings())} accessibilityRole="button" style={styles.fullBtn(p)}>
                <T w={800} size={13}>Free up space</T>
              </Tap>
            </View>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T w={700} size={12} c={p.muted}>{`Needs ${formatBytes(props.need) || '0 B'}`}</T>
          <T w={700} size={12} c={p.muted} style={mono(700)}>{props.free != null ? `${formatBytes(props.free)} free` : ''}</T>
        </View>
        <PrimaryButton label={props.cta.label} onPress={props.onStart} disabled={!props.cta.ok} />
      </View>
    </>
  );
}

function JobView({ p, job, bottom, onClose, onOpen, onDone }: { p: P; job: NonNullable<ReturnType<typeof AddJob.get>>; bottom: number; onClose: () => void; onOpen: () => void; onDone: () => void }) {
  const q = job.rows.filter((r) => r.st === 'wait' || r.st === 'copy' || r.st === 'done');
  const total = q.reduce((t, r) => t + (r.size ?? 0), 0);
  const got = q.filter((r) => r.st === 'done').reduce((t, r) => t + (r.size ?? 0), 0);
  const pct = total ? Math.round((got / total) * 100) : 0;
  const done = doneText(job.rows.map((r) => r.st), job.dest.name);
  return (
    <>
      <View style={{ paddingTop: 10, paddingHorizontal: 18, paddingBottom: 12, gap: 10 }}>
        <View style={[styles.grip, { backgroundColor: p.border }]} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {!job.running ? (
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tint(p.success, 14), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check-check" size={21} color={p.success} />
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }} accessibilityLiveRegion="polite">
            <T w={800} size={20} style={{ letterSpacing: -0.4, lineHeight: 25 }} accessibilityRole="header">{job.running ? 'Copying into UniOS' : done.title}</T>
            <T w={600} c={p.muted} size={12.5} style={{ marginTop: 3 }}>{job.running ? `Saving to ${job.dest.name}` : done.sub}</T>
          </View>
          {job.running ? (
            <Tap onPress={onClose} accessibilityRole="button" accessibilityLabel="Leave this screen" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chevron-down" size={19} color={p.text} />
            </Tap>
          ) : null}
        </View>
        {job.running ? (
          <View style={{ gap: 6 }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: p.surface, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: p.primary }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T w={700} size={12} c={p.muted} style={mono(700)}>{`Copied ${formatBytes(got) || '0 B'} of ${formatBytes(total)}`}</T>
              <T w={700} size={12} c={p.muted} style={mono(700)}>{`${pct}%`}</T>
            </View>
          </View>
        ) : null}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 14 }}>
        <View style={{ borderRadius: 20, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, overflow: 'hidden' }}>
          {job.rows.map((r, i) => {
            const { base, ext } = splitName(r.title, r.mime);
            return (
              <View key={r.id} style={{ gap: 9, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i < job.rows.length - 1 ? 1 : 0, borderBottomColor: p.hair, backgroundColor: r.st === 'bad' ? tint(p.danger, 6) : 'transparent' }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Thumb p={p} item={{ uri: r.uri, ext, durationMs: null }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T w={700} size={14} numberOfLines={1}>{`${base}.${ext}`}</T>
                    <T w={600} size={12} c={r.st === 'done' ? p.success : r.st === 'bad' ? p.danger : p.muted} style={{ marginTop: 2 }}>{copyMeta(r, r.st)}</T>
                  </View>
                  {r.st === 'done' ? <Icon name="circle-check" size={20} color={p.success} /> : r.st === 'bad' ? <Icon name="circle-alert" size={20} color={p.danger} /> : null}
                </View>
                {r.st === 'copy' ? <Shimmer p={p} /> : null}
              </View>
            );
          })}
        </View>
        {job.running ? <T w={600} c={p.muted} size={12.5} style={{ lineHeight: 18 }}>You can leave this screen. Copying continues while UniOS is open.</T> : null}
      </ScrollView>
      <View style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: bottom + 16, borderTopWidth: 1, borderTopColor: p.hair, backgroundColor: p.bg }}>
        {job.running ? <PrimaryButton label="Cancel the rest" tone="plain" onPress={() => AddJob.cancelRest()} /> : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><PrimaryButton label={`Open ${job.dest.short} files`} tone="plain" onPress={onOpen} /></View>
            <View style={{ flex: 1 }}><PrimaryButton label="Done" onPress={onDone} /></View>
          </View>
        )}
      </View>
    </>
  );
}

/** An honest busy bar: copying reports no bytes until the file is done. */
function Shimmer({ p }: { p: P }) {
  const [x, setX] = useState(0);
  const t = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { t.current = setInterval(() => setX((v) => (v + 7) % 100), 60); return () => { if (t.current) clearInterval(t.current); }; }, []);
  return (
    <View style={{ height: 5, borderRadius: 3, backgroundColor: p.surface, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: `${x - 30}%`, width: '30%', height: '100%', borderRadius: 3, backgroundColor: p.primary }} />
    </View>
  );
}

const styles = {
  ...StyleSheet.create({
    sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 25, shadowOffset: { width: 0, height: -20 }, elevation: 24 },
    tall: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 25, elevation: 24 },
    grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 10 },
    camBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  }),
  fullBtn: (p: P) => ({ flex: 1, height: 44, borderRadius: 12, backgroundColor: p.elev, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 8 }),
};
