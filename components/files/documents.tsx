import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, TextInput, View, useWindowDimensions, type ViewToken } from 'react-native';
import Pdf, { type PdfRef } from 'react-native-pdf';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Icon } from '../uni/Icon';
import { T, Tap } from '../uni/primitives';
import { ErrorText, PrimaryButton } from '../uni/form';
import { Sheet } from '../uni/Sheet';
import { mono, sans, tint, useUni } from '../uni/theme';
import { Clipboard } from '../../core/utils/clipboard';
import { checkPage, isCommentLine, openInLabel, type ViewerKind } from '../../domains/resource/viewer';
import type { DocBlock, Run, Sheet as SheetData, Slide } from '../../domains/resource/office';
import { MarkdownBody } from './MarkdownBody';
import { useViewState } from './viewState';

/** "Simplified view. Open in Docs for the exact layout." */
export function SimplifiedBanner({ kind, onOpen }: { kind: ViewerKind; onOpen: () => void }) {
  const p = useUni();
  const app = openInLabel(kind);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 10, paddingVertical: 6, paddingLeft: 12, paddingRight: 6, borderRadius: 14, backgroundColor: p.primarySoft }}>
      <Icon name="info" size={16} color={p.primary} />
      <T w={600} size={12.5} style={{ flex: 1, lineHeight: 17 }}>{`Simplified view. Open in ${app} for the exact layout.`}</T>
      <Tap onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open in ${app}`} style={{ height: 44, paddingHorizontal: 14, borderRadius: 10, backgroundColor: p.primary, justifyContent: 'center' }}>
        <T w={800} size={12.5} c="#fff">Open</T>
      </Tap>
    </View>
  );
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export function PdfBody({ uri, id, onError, onTap }: { uri: string; id: number; onError: (m: string) => void; onTap: () => void }) {
  const p = useUni();
  const store = useViewState(id);
  const ref = useRef<PdfRef>(null);
  const start = store.get().page ?? 1;
  const [page, setPage] = useState(start);
  const [total, setTotal] = useState(0);
  const [night, setNight] = useState(!!store.get().night);
  const [jump, setJump] = useState(false);
  const [input, setInput] = useState('');
  const err = input && total ? (() => { const c = checkPage(input, total); return c.ok ? null : c.error; })() : null;
  const go = (n: number) => { ref.current?.setPage(n); setPage(n); store.set({ page: n }); setJump(false); setInput(''); };
  return (
    <View style={{ flex: 1, backgroundColor: p.surface }}>
      <Pdf ref={ref} source={{ uri, cache: false }} page={start} enableDoubleTapZoom minScale={1} maxScale={4} enableAntialiasing
        onLoadComplete={(n) => setTotal(n)} onPageChanged={(pg, n) => { setPage(pg); setTotal(n); store.set({ page: pg }); }}
        onError={(e) => onError(String((e as any)?.message ?? e))} onPageSingleTap={() => onTap()} style={{ flex: 1, backgroundColor: p.surface }} />
      {night ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', mixBlendMode: 'difference' }} /> : null}
      {total ? (
        <View style={{ position: 'absolute', right: 14, bottom: 26, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Tap onPress={() => { setNight(!night); store.set({ night: !night }); }} accessibilityRole="switch" accessibilityState={{ checked: night }} accessibilityLabel="Night mode"
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="moon" size={19} color={night ? p.primary : p.text} />
          </Tap>
          <Tap onPress={() => { setInput(''); setJump(true); }} accessibilityRole="button" accessibilityLabel={`Page ${page} of ${total}. Go to page`}
            style={{ height: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: p.text, justifyContent: 'center' }}>
            <T w={800} size={13.5} c={p.bg} style={mono(700)}>{`${page} / ${total}`}</T>
          </Tap>
        </View>
      ) : null}
      <Sheet visible={jump} onClose={() => setJump(false)} title="Go to page">
        <View style={{ gap: 10, paddingTop: 12, paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={input} onChangeText={(v) => setInput(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoFocus placeholder={`1–${total}`} placeholderTextColor={p.muted} accessibilityLabel="Page number"
              onSubmitEditing={() => { const c = checkPage(input, total); if (c.ok) go(c.page); }}
              style={[mono(700), { flex: 1, minWidth: 0, height: 50, borderRadius: 13, borderWidth: 1.5, borderColor: err ? p.danger : p.border, backgroundColor: p.elev, paddingHorizontal: 13, fontSize: 16, color: p.text }]} />
            <Tap onPress={() => { const c = checkPage(input, total); if (c.ok) go(c.page); }} accessibilityRole="button" style={{ height: 50, paddingHorizontal: 22, borderRadius: 15, backgroundColor: p.primary, justifyContent: 'center' }}>
              <T w={700} size={14} c="#fff">Go</T>
            </Tap>
          </View>
          {err ? <ErrorText>{err}</ErrorText> : null}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {[['First', 1], ['Where you left', start], ['Last', total]].map(([l, n]) => (
              <Tap key={l as string} onPress={() => go(n as number)} accessibilityRole="button" style={{ height: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: p.surface, justifyContent: 'center' }}>
                <T w={700} size={13}>{l as string}</T>
              </Tap>
            ))}
          </View>
        </View>
      </Sheet>
    </View>
  );
}

// ─── Word ────────────────────────────────────────────────────────────────────

function RunsText({ runs, size = 15, style }: { runs: Run[]; size?: number; style?: object }) {
  return (
    <T size={size} style={[{ lineHeight: size * 1.55 }, style]} selectable>
      {runs.map((r, i) => <T key={i} w={r.b ? 800 : 500} size={size} style={r.i ? { fontStyle: 'italic' } : undefined}>{r.text}</T>)}
    </T>
  );
}

export function WordBody({ blocks, truncated, images }: { blocks: DocBlock[]; truncated: boolean; images: number }) {
  const p = useUni();
  return (
    <FlatList data={blocks} keyExtractor={(_, i) => String(i)} initialNumToRender={20} windowSize={9}
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 60, gap: 10 }}
      ListFooterComponent={<View style={{ gap: 6 }}>
        {images ? <T w={600} c={p.muted} size={12.5}>{`${images} image${images === 1 ? '' : 's'} not shown in this view.`}</T> : null}
        {truncated ? <T w={600} c={p.muted} size={12.5}>The rest of this document is not shown. Open it in Docs for the rest.</T> : null}
      </View>}
      renderItem={({ item: b }) => {
        if (b.t === 'h') return <RunsText runs={b.runs.map((r) => ({ ...r, b: true }))} size={b.level === 1 ? 22 : b.level === 2 ? 16.5 : 15} style={{ marginTop: b.level === 1 ? 0 : 10, lineHeight: b.level === 1 ? 28 : 22 }} />;
        if (b.t === 'li') return (
          <View style={{ flexDirection: 'row', gap: 10, paddingLeft: b.depth * 18 }}>
            <T w={800} c={p.muted} size={15} style={{ minWidth: 20, lineHeight: 23 }}>{b.marker}</T>
            <View style={{ flex: 1 }}><RunsText runs={b.runs} /></View>
          </View>
        );
        if (b.t === 'table') return <TableView rows={b.rows} />;
        if (b.t === 'img') return (
          <View style={{ height: 90, borderRadius: 12, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Icon name="image" size={22} color={p.muted} />
            <T w={600} c={p.muted} size={12}>Image</T>
          </View>
        );
        return <RunsText runs={b.runs} />;
      }} />
  );
}

function TableView({ rows }: { rows: string[][] }) {
  const p = useUni();
  const cols = Math.max(1, ...rows.map((r) => r.length));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: p.border, overflow: 'hidden', minWidth: '100%' }}>
        {rows.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', backgroundColor: i === 0 ? p.surface : 'transparent', borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: p.hair }}>
            {Array.from({ length: cols }, (_, j) => (
              <View key={j} style={{ width: 120, padding: 8, paddingHorizontal: 10 }}>
                <T w={i === 0 ? 800 : 500} size={13} style={{ lineHeight: 18 }} selectable>{r[j] ?? ''}</T>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Excel / CSV ─────────────────────────────────────────────────────────────

const ROW_H = 44, HEAD_H = 40;
export const columnWidths = (rows: string[][], cols: number): number[] =>
  Array.from({ length: cols }, (_, c) => Math.max(64, Math.min(240, 24 + 8 * Math.max(1, ...rows.slice(0, 60).map((r) => (r[c] ?? '').length)))));

/** A grid with the first row and first column frozen; scrolls both ways. Rows are virtualised. */
function Grid({ sheet, onCell }: { sheet: SheetData; onCell: (row: number, col: number) => void }) {
  const p = useUni();
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { x.value = e.contentOffset.x; });
  const widths = useMemo(() => columnWidths(sheet.rows, sheet.cols), [sheet]);
  const total = widths.reduce((a, b) => a + b, 0);
  const pin = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const numeric = (v: string) => v !== '' && /^-?\d+(\.\d+)?$/.test(v);
  const head = sheet.rows[0] ?? [];
  const body = sheet.rows.slice(1);
  const cell = (r: number, c: number, v: string, bold: boolean, bg: string) => (
    <Tap key={c} onPress={() => onCell(r, c)} accessibilityRole="button" accessibilityLabel={`Row ${r + 1}, ${head[c] || `column ${c + 1}`}: ${v || 'empty'}`}
      style={{ width: widths[c], height: r === 0 ? HEAD_H : ROW_H, paddingHorizontal: 10, justifyContent: 'center', alignItems: numeric(v) && r > 0 ? 'flex-end' : 'flex-start', backgroundColor: bg, borderRightWidth: 1, borderBottomWidth: r === 0 ? 1.5 : 1, borderColor: r === 0 ? p.border : p.hair }}>
      <T w={bold ? 800 : 600} size={r === 0 ? 12 : 13} numberOfLines={1} style={numeric(v) && r > 0 ? mono(500) : undefined}>{v}</T>
    </Tap>
  );
  const row = (r: number, vals: string[], bg: string, bold: boolean) => (
    <View style={{ flexDirection: 'row', width: total }}>
      {widths.map((_, c) => (c === 0
        ? <Animated.View key={c} style={[{ zIndex: 2 }, pin]}>{cell(r, c, vals[c] ?? '', bold || true, p.elev === bg ? p.surface : bg)}</Animated.View>
        : cell(r, c, vals[c] ?? '', bold, bg)))}
    </View>
  );
  return (
    <Animated.ScrollView horizontal onScroll={onScroll} scrollEventThrottle={16} style={{ flex: 1, backgroundColor: p.elev }} contentContainerStyle={{ width: total }}>
      <FlatList data={body} keyExtractor={(_, i) => String(i)} stickyHeaderIndices={[0]} ListHeaderComponent={<View style={{ zIndex: 3 }}>{row(0, head, p.surface, true)}</View>}
        initialNumToRender={24} windowSize={9} getItemLayout={(_, i) => ({ length: ROW_H, offset: HEAD_H + ROW_H * i, index: i })}
        renderItem={({ item, index }) => row(index + 1, item, p.elev, false)} />
    </Animated.ScrollView>
  );
}

export function SheetBody({ sheets, onOpenOther, kind }: { sheets: SheetData[]; onOpenOther: () => void; kind: 'sheet' | 'csv' }) {
  const p = useUni();
  const [tab, setTab] = useState(0);
  const [cell, setCell] = useState<{ r: number; c: number } | null>(null);
  const s = sheets[Math.min(tab, sheets.length - 1)];
  const value = cell ? s.rows[cell.r]?.[cell.c] ?? '' : '';
  const label = cell ? `Row ${cell.r + 1} · ${s.rows[0]?.[cell.c] || `Column ${cell.c + 1}`}` : '';
  const cut = s.totalRows > s.rows.length;
  return (
    <View style={{ flex: 1 }}>
      {s.rows.length ? <Grid key={tab} sheet={s} onCell={(r, c) => setCell({ r, c })} /> : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><T w={700} c={p.muted} size={14}>This sheet is empty.</T></View>
      )}
      {cut ? (
        <View style={{ padding: 12, paddingHorizontal: 16, gap: 8, borderTopWidth: 1, borderTopColor: p.hair, backgroundColor: p.bg }}>
          <T w={600} c={p.muted} size={12.5}>{`Showing the first ${s.rows.length.toLocaleString('en-IN')} of ${s.totalRows.toLocaleString('en-IN')} rows.`}</T>
          <PrimaryButton label={`Open in ${openInLabel(kind)} for the rest`} tone="plain" onPress={onOpenOther} />
        </View>
      ) : null}
      {sheets.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderTopWidth: 1, borderTopColor: p.hair, backgroundColor: p.bg }} contentContainerStyle={{ gap: 6, padding: 8 }}>
          {sheets.map((sh, i) => (
            <Tap key={i} onPress={() => setTab(i)} accessibilityRole="tab" accessibilityState={{ selected: i === tab }}
              style={{ height: 44, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', backgroundColor: i === tab ? p.text : p.surface }}>
              <T w={800} size={13} c={i === tab ? p.bg : p.text}>{sh.name}</T>
            </Tap>
          ))}
        </ScrollView>
      ) : null}
      <Sheet visible={!!cell} onClose={() => setCell(null)} title={label}
        buttons={Clipboard.available() ? [{ label: 'Close', onPress: () => setCell(null) }, { label: 'Copy', tone: 'primary', onPress: async () => { await Clipboard.setString(value); setCell(null); } }] : [{ label: 'Close', onPress: () => setCell(null) }]}>
        <View style={{ paddingVertical: 12 }}><T w={600} size={16} style={{ lineHeight: 24 }} selectable>{value || 'Empty'}</T></View>
      </Sheet>
    </View>
  );
}

// ─── PowerPoint ──────────────────────────────────────────────────────────────

export function SlidesBody({ slides, truncated }: { slides: Slide[]; truncated: boolean }) {
  const p = useUni();
  const { width } = useWindowDimensions();
  const [current, setCurrent] = useState(1);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const w = width - 32, h = Math.round((w * 9) / 16);
  const onView = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => { const i = viewableItems[0]?.index; if (i != null) setCurrent(i + 1); }).current;
  return (
    <View style={{ flex: 1 }}>
      <FlatList data={slides} keyExtractor={(_, i) => String(i)} onViewableItemsChanged={onView} viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 90, gap: 14 }}
        ListFooterComponent={truncated ? <T w={600} c={p.muted} size={12.5}>More slides are not shown. Open it in Slides for the rest.</T> : null}
        renderItem={({ item, index }) => (
          <View style={{ gap: 8 }}>
            <View style={{ width: w, minHeight: h, borderRadius: 14, backgroundColor: '#fff', padding: 18, gap: 8, borderWidth: 1, borderColor: p.hair, overflow: 'hidden' }} accessibilityLabel={`Slide ${index + 1}: ${item.title || 'no title'}`}>
              {item.title ? <T w={800} size={17} c="#111827" style={{ lineHeight: 22 }}>{item.title}</T> : null}
              {item.bullets.map((b, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: b.level * 14 }}>
                  <T size={13} c="#6B7280">•</T>
                  <T size={13} c="#1F2937" style={{ flex: 1, lineHeight: 19 }} selectable>{b.text}</T>
                </View>
              ))}
              {item.pictures ? (
                <View style={{ height: 70, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <Icon name="image" size={18} color="#9CA3AF" />
                  <T w={600} size={11} c="#9CA3AF">{`${item.pictures} picture${item.pictures === 1 ? '' : 's'}`}</T>
                </View>
              ) : null}
              {!item.title && !item.bullets.length && !item.pictures ? <T w={600} size={12} c="#9CA3AF">Empty slide</T> : null}
            </View>
            {item.notes ? (
              <View style={{ borderRadius: 12, backgroundColor: p.surface }}>
                <Tap onPress={() => setOpen((s) => { const n = new Set(s); if (n.has(index)) n.delete(index); else n.add(index); return n; })} accessibilityRole="button" accessibilityState={{ expanded: open.has(index) }}
                  style={{ minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="sticky-note" size={14} color={p.muted} />
                  <T w={800} size={12.5} style={{ flex: 1 }}>Speaker notes</T>
                  <Icon name={open.has(index) ? 'chevron-down' : 'chevron-right'} size={15} color={p.muted} />
                </Tap>
                {open.has(index) ? <T size={13} style={{ lineHeight: 19, paddingHorizontal: 12, paddingBottom: 12 }} selectable>{item.notes}</T> : null}
              </View>
            ) : null}
          </View>
        )} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 26, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: p.text }}>
        <T w={800} size={12.5} c={p.bg} style={mono(700)}>{`Slide ${current} / ${slides.length}`}</T>
      </View>
    </View>
  );
}

// ─── Text, code, Markdown, JSON ──────────────────────────────────────────────

export function CodeBody({ lines, cut, wrap, onWrap, muteComments }: { lines: string[]; cut: boolean; wrap: boolean; onWrap: () => void; muteComments: boolean }) {
  const p = useUni();
  const digits = String(lines.length).length;
  const gutter = digits * 8 + 18;
  const row = (line: string, i: number) => (
    <View style={{ flexDirection: 'row', paddingRight: 14 }}>
      <T w={500} size={12} c={p.muted} style={[mono(500), { width: gutter, textAlign: 'right', paddingRight: 10, lineHeight: 19 }]}>{i + 1}</T>
      <T selectable size={12.5} c={muteComments && isCommentLine(line) ? p.muted : p.text} style={[mono(500), { lineHeight: 19 }, wrap ? { flex: 1 } : null]}>{line || ' '}</T>
    </View>
  );
  const list = (
    <FlatList data={lines} keyExtractor={(_, i) => String(i)} initialNumToRender={40} windowSize={11} renderItem={({ item, index }) => row(item, index)}
      contentContainerStyle={{ paddingVertical: 12 }}
      ListFooterComponent={cut ? <T w={600} c={p.muted} size={12.5} style={{ padding: 14 }}>The rest of this file is not shown. Open it in another app to see all of it.</T> : <View style={{ height: 40 }} />} />
  );
  return (
    <View style={{ flex: 1, backgroundColor: p.elev }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: p.hair }}>
        <Tap onPress={onWrap} accessibilityRole="switch" accessibilityState={{ checked: wrap }} accessibilityLabel="Wrap lines"
          style={{ height: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: wrap ? p.primarySoft : p.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="text-wrap" size={16} color={wrap ? p.primary : p.text} />
          <T w={800} size={13} c={wrap ? p.primary : p.text}>{wrap ? 'Wrap on' : 'Wrap off'}</T>
        </Tap>
      </View>
      {wrap ? list : <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: '100%' }}><View style={{ minWidth: '100%', flex: 1 }}>{list}</View></ScrollView>}
    </View>
  );
}

export function MarkdownPage({ text }: { text: string }) {
  return <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 60 }}><MarkdownBody text={text} /></ScrollView>;
}

// ─── Link ────────────────────────────────────────────────────────────────────

export function LinkBody({ url, title, site, icon, savedFrom, onOpen, onCopy, copied }: {
  url: string; title: string; site: string; icon: 'hard-drive' | 'file-text' | 'play' | 'globe'; savedFrom: string; onOpen: () => void; onCopy: () => void; copied: boolean;
}) {
  const p = useUni();
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <View style={{ padding: 18, borderRadius: 22, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, gap: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: tint('#8B5CF6', 14), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={24} color="#8B5CF6" />
        </View>
        <View style={{ gap: 4 }}>
          <T w={700} c={p.muted} size={12.5}>{site}</T>
          <T w={800} size={19} style={{ lineHeight: 25 }} selectable>{title}</T>
        </View>
        <T w={600} size={12.5} c={p.muted} style={[mono(500), { lineHeight: 18 }]} selectable numberOfLines={4}>{url}</T>
        <T w={600} size={12} c={p.muted}>{savedFrom}</T>
      </View>
      <PrimaryButton label="Open in browser" icon="external-link" onPress={onOpen} />
      {Clipboard.available() ? <PrimaryButton label={copied ? 'Copied' : 'Copy link'} icon={copied ? 'check' : 'copy'} tone="plain" onPress={onCopy} /> : null}
    </ScrollView>
  );
}
