import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { AudioBody, PhotoPager, VideoBody, type Photo } from '../../components/files/media';
import { CodeBody, LinkBody, MarkdownPage, PdfBody, SheetBody, SimplifiedBanner, SlidesBody, WordBody } from '../../components/files/documents';
import { chipFor, courseChips, FileActions, openElsewhere, shareRow, ViewerBar, type FileRow, type OpenResult } from '../../components/files/FileFrame';
import { Loading, StateCard, type StateKind } from '../../components/files/states';
import { Icon } from '../../components/uni/Icon';
import { T, Tap } from '../../components/uni/primitives';
import { useToast } from '../../components/uni/Toast';
import { useUni } from '../../components/uni/theme';
import { FileManager } from '../../core/fs/FileManager';
import { extOf } from '../../core/fs/fileType';
import { fromBase64 } from '../../core/fs/pdf';
import { isStoredUpload, isWebLink } from '../../core/fs/names';
import { Clipboard } from '../../core/utils/clipboard';
import { formatBytes } from '../../core/utils/format';
import { MAX_FILE, OfficeError, readCsv, readDocx, readPptx, readXlsx, type Deck, type WordDoc, type Workbook } from '../../domains/resource/office';
import { ResourceRepository } from '../../domains/resource/repository';
import { MAX_TEXT_BYTES, prettyJson, storeSearchUrl, storeWebUrl, suggestedApp, toLines, viewerFor, type ViewerKind } from '../../domains/resource/viewer';
import { siteOf } from '../../domains/resource/files';
import { useViewState } from '../../components/files/viewState';

type Body =
  | { k: 'loading' }
  | { k: 'state'; kind: StateKind; detail?: string }
  | { k: 'word'; doc: WordDoc } | { k: 'sheets'; wb: Workbook; csv: boolean } | { k: 'slides'; deck: Deck }
  | { k: 'text'; text: string; markdown: boolean; json: boolean }
  | { k: 'ready' };

const CAN_READ: ViewerKind[] = ['word', 'sheet', 'csv', 'slides', 'code', 'markdown', 'text'];

/** The file viewer (design UniFile, handoff §2): one frame, a body per type, and the four shared states. */
export default function ResourceViewer() {
  const p = useUni();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = /^\d+$/.test(idParam ?? '') ? Number(idParam) : -1;
  const [row, setRow] = useState<FileRow | null>(() => (id > 0 ? ResourceRepository.get(id) ?? null : null));
  const chips = useMemo(() => { try { return courseChips(); } catch { return []; } }, []);
  const [body, setBody] = useState<Body>({ k: 'loading' });
  const [chrome, setChrome] = useState(true);
  const [sheet, setSheet] = useState<'menu' | 'rename' | 'move' | null>(null);
  const [copied, setCopied] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const rotate = useRef<(() => void) | null>(null);
  const store = useViewState(id);
  const [wrap, setWrap] = useState(store.get().wrap ?? true);

  const uri = row?.uri ?? null;
  const ext = isStoredUpload(uri) ? extOf(uri) : '';
  const kind: ViewerKind | 'link' = row?.type === 'link' && isWebLink(uri) ? 'link' : viewerFor(ext);
  const abs = isStoredUpload(uri) ? FileManager.getAbsolutePath(uri) : null;
  const dark = kind === 'photo' || kind === 'video';

  const photos = useMemo<Photo[]>(() => {
    if (kind !== 'photo' || !row) return [];
    const all = (row.workspaceId == null ? [] : ResourceRepository.listFilesFor(row.workspaceId));
    const list = (all.length ? all : [row]).filter((r) => isStoredUpload(r.uri) && viewerFor(extOf(r.uri)) === 'photo');
    return list.map((r) => ({ id: r.id, uri: FileManager.getAbsolutePath(r.uri!), title: r.title }));
  }, [row, kind]);
  const start = Math.max(0, photos.findIndex((x) => x.id === row?.id));

  const fail = useCallback((detail?: string) => setBody({ k: 'state', kind: 'cantopen', detail }), []);

  // Load the body for this file.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!row) return;
      if (row.type === 'note') { router.replace(`/note/${row.id}` as any); return; }
      if (kind === 'link') { setBody({ k: 'ready' }); return; }
      if (!abs) { setBody({ k: 'state', kind: 'missing' }); return; }
      const info = await FileSystem.getInfoAsync(abs).catch(() => null);
      if (!alive) return;
      if (!info?.exists) { setBody({ k: 'state', kind: 'missing' }); return; }
      const size = (info as any).size as number | undefined;
      try {
        if (kind === 'external') { setBody({ k: 'state', kind: 'cantopen' }); return; }
        if (!CAN_READ.includes(kind as ViewerKind)) { setBody({ k: 'ready' }); return; }
        if (['word', 'sheet', 'slides'].includes(kind)) {
          if ((size ?? 0) > MAX_FILE) { setBody({ k: 'state', kind: 'cantopen', detail: `This file is ${formatBytes(size)}. UniOS shows simplified views of files up to ${formatBytes(MAX_FILE)}.` }); return; }
          const bytes = fromBase64(await FileSystem.readAsStringAsync(abs, { encoding: FileSystem.EncodingType.Base64 }));
          if (!alive) return;
          if (kind === 'word') setBody({ k: 'word', doc: readDocx(bytes) });
          else if (kind === 'sheet') setBody({ k: 'sheets', wb: readXlsx(bytes), csv: false });
          else setBody({ k: 'slides', deck: readPptx(bytes) });
          return;
        }
        if ((size ?? 0) > MAX_TEXT_BYTES * (kind === 'markdown' ? 1 : 5)) { setBody({ k: 'state', kind: 'cantopen', detail: `This file is ${formatBytes(size)}, too large to show here.` }); return; }
        const text = await FileSystem.readAsStringAsync(abs);
        if (!alive) return;
        if (kind === 'csv') setBody({ k: 'sheets', wb: readCsv(text, row.title), csv: true });
        else setBody({ k: 'text', text, markdown: kind === 'markdown', json: ext === 'json' });
      } catch (e) {
        console.error('Could not read the file', e instanceof Error ? e.message : e);
        if (alive) fail(e instanceof OfficeError ? `${e.message}. Another app may open it.` : undefined);
      }
    })();
    return () => { alive = false; };
  }, [row?.id, kind, abs]); // eslint-disable-line react-hooks/exhaustive-deps

  const app = suggestedApp(ext);
  const openOther = async () => {
    if (!row) return;
    const r: OpenResult = await openElsewhere(row);
    if (r === 'noapp') setBody({ k: 'state', kind: 'noapp' });
    else if (r === 'missing') setBody({ k: 'state', kind: 'missing' });
    else if (r === 'failed') toast.show('Couldn’t open this file in another app.');
  };
  const getApp = () => { if (!app) return; Linking.openURL(storeSearchUrl(app)).catch(() => Linking.openURL(storeWebUrl(app)).catch(() => toast.show('Couldn’t open the Play Store.'))); };
  const share = async () => { if (row && !(await shareRow(row))) toast.show('Sharing isn’t available right now.'); };
  const removeFromList = () => {
    if (!row) return;
    const gone = ResourceRepository.remove(row.id);
    router.back();
    if (gone) toast.show(`Removed “${gone.title}” from the list.`, { undo: () => { ResourceRepository.restore(gone); toast.show('Restored.'); } });
  };

  if (!row) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <ViewerBar title="File" chip={chipFor(chips, null)} meta="Not found" onBack={() => router.back()} topInset={insets.top} />
        <StateCard kind="missing" name="This file was deleted" ext="" onPrimary={() => router.replace('/add' as any)} onSecondary={() => router.back()} />
      </View>
    );
  }

  const chip = chipFor(chips, row.workspaceId);
  const meta = kind === 'link' ? 'Link' : kind === 'photo' ? `Photo${photos.length > 1 ? ` · ${photoIdx + 1} of ${photos.length}` : ''}` : [ext.toUpperCase(), formatBytes(row.sizeBytes)].filter(Boolean).join(' · ');
  const title = kind === 'photo' ? photos[photoIdx]?.title ?? row.title : row.title;
  const barOn = chrome || body.k === 'state' || body.k === 'loading';
  const toggle = () => setChrome((c) => !c);

  const render = () => {
    if (body.k === 'loading') return <Loading ext={ext || 'link'} dark={dark} />;
    if (body.k === 'state') {
      return <StateCard kind={body.kind} name={row.title} ext={ext} appName={app} detail={body.detail}
        onPrimary={() => (body.kind === 'missing' ? router.replace(`/add${row.workspaceId ? `?workspaceId=${row.workspaceId}` : ''}` as any) : body.kind === 'noapp' ? (app ? getApp() : share()) : openOther())}
        onSecondary={() => (body.kind === 'missing' ? removeFromList() : share())} />;
    }
    if (body.k === 'word') return <View style={{ flex: 1 }}><SimplifiedBanner kind="word" onOpen={openOther} /><WordBody blocks={body.doc.blocks} truncated={body.doc.truncated} images={body.doc.images} /></View>;
    if (body.k === 'sheets') return <View style={{ flex: 1 }}><SimplifiedBanner kind={body.csv ? 'csv' : 'sheet'} onOpen={openOther} /><SheetBody sheets={body.wb.sheets} kind={body.csv ? 'csv' : 'sheet'} onOpenOther={openOther} /></View>;
    if (body.k === 'slides') return <View style={{ flex: 1 }}><SimplifiedBanner kind="slides" onOpen={openOther} /><SlidesBody slides={body.deck.slides} truncated={body.deck.truncated} /></View>;
    if (body.k === 'text') {
      if (body.markdown) return <MarkdownPage text={body.text} />;
      const shown = body.json ? prettyJson(body.text) : body.text;
      const { lines, cut } = toLines(shown);
      return <CodeBody lines={lines} cut={cut} wrap={wrap} onWrap={() => { setWrap(!wrap); store.set({ wrap: !wrap }); }} muteComments={kind === 'code' && !body.json} />;
    }
    if (kind === 'link') {
      const s = siteOf(row.uri!);
      return <LinkBody url={row.uri!} title={row.title} site={s.name} icon={s.icon} savedFrom={`Saved to ${chip.name}`}
        onOpen={openOther} copied={copied} onCopy={async () => { if (await Clipboard.setString(row.uri!)) { setCopied(true); setTimeout(() => setCopied(false), 1800); } }} />;
    }
    if (!abs) return null;
    if (kind === 'pdf') return <PdfBody uri={abs} id={row.id} onError={(m) => fail(/password/i.test(m) ? 'This PDF is protected with a password. Another app can open it.' : undefined)} onTap={toggle} />;
    if (kind === 'photo') return <PhotoPager photos={photos} start={start} onIndex={setPhotoIdx} onTap={toggle} onFail={() => fail('This photo is damaged or in a format the phone cannot show.')} rotateRef={rotate} />;
    if (kind === 'video') return <VideoBody uri={abs} id={row.id} chrome={chrome} onTap={toggle} onError={() => fail(`UniOS can’t play ${ext.toUpperCase()} videos here.${app === 'VLC' ? ' Another app, such as VLC, can.' : ' Another app can.'}`)} />;
    if (kind === 'audio') return <AudioBody uri={abs} id={row.id} title={row.title} onError={() => fail(`UniOS can’t play ${ext.toUpperCase()} audio here. Another app can.`)} />;
    return <ActivityIndicator style={{ flex: 1 }} color={p.primary} />;
  };

  const overlay = dark && body.k !== 'state';
  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#000' : p.bg }}>
      <StatusBar hidden={dark && !chrome && body.k === 'ready'} style={dark ? 'light' : 'auto'} />
      <View style={overlay ? [StyleSheet.absoluteFill, { zIndex: 0 }] : { flex: 1 }}>{overlay ? null : barOn ? <ViewerBar title={title} chip={chip} meta={meta} topInset={insets.top} onBack={() => router.back()} onChip={() => setSheet('move')} onMenu={() => setSheet('menu')} /> : <View style={{ height: insets.top }} />}
        <View style={{ flex: 1 }}>{render()}</View>
      </View>
      {overlay && barOn ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <ViewerBar dark title={title} chip={chip} meta={meta} topInset={insets.top} onBack={() => router.back()} onChip={() => setSheet('move')} onMenu={() => setSheet('menu')} />
        </View>
      ) : null}
      {kind === 'photo' && barOn && body.k === 'ready' ? (
        <View style={{ position: 'absolute', top: insets.top + 74, right: 12, zIndex: 5, gap: 8 }}>
          {[['rotate-cw', 'Rotate', () => rotate.current?.()], ['share-2', 'Share', share]].map(([icon, label, on]) => (
            <Tap key={label as string} onPress={on as () => void} accessibilityRole="button" accessibilityLabel={label as string}
              style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon as any} size={20} color="#fff" />
            </Tap>
          ))}
        </View>
      ) : null}
      <FileActions row={row} sheet={sheet} setSheet={setSheet} chips={chips} canOpen onChanged={setRow} onDeleted={() => router.back()}
        onOpenResult={(r) => { if (r === 'noapp') setBody({ k: 'state', kind: 'noapp' }); else if (r === 'missing') setBody({ k: 'state', kind: 'missing' }); else if (r === 'failed') toast.show('Couldn’t open this file in another app.'); }} />
    </View>
  );
}

export function ErrorBoundary({ error, retry }: import('expo-router').ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      <T w={800} size={17} style={{ textAlign: 'center' }}>The viewer hit a problem</T>
      <T size={13} style={{ textAlign: 'center', opacity: 0.7 }}>{error.message}</T>
      <Tap onPress={retry} accessibilityRole="button" style={{ height: 48, paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#1D61E7', justifyContent: 'center' }}><T w={800} c="#fff">Try again</T></Tap>
    </View>
  );
}
