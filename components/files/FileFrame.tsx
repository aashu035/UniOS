import React, { useState } from 'react';
import { Platform, Share, TextInput, View } from 'react-native';
import { eq } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import { Icon, type IconName } from '../uni/Icon';
import { T, Tap } from '../uni/primitives';
import { ErrorText } from '../uni/form';
import { Sheet } from '../uni/Sheet';
import { useToast } from '../uni/Toast';
import { mono, sans, useUni } from '../uni/theme';
import { db } from '../../core/db/client';
import { FileManager } from '../../core/fs/FileManager';
import { extOf, mimeFor } from '../../core/fs/fileType';
import { isStoredUpload, isWebLink } from '../../core/fs/names';
import { shortLabel } from '../../domains/academic/snapshot';
import { renameError } from '../../domains/resource/files';
import type { resources } from '../../domains/resource/model';
import { ResourceRepository } from '../../domains/resource/repository';
import { semesters } from '../../domains/semester/model';
import { workspaces } from '../../domains/workspace/model';

export type FileRow = typeof resources.$inferSelect;
export type CourseChip = { id: number | null; short: string; name: string; color: string };
export const GENERAL: CourseChip = { id: null, short: 'General', name: 'General', color: '#64748B' };

/** The active semester's courses, then General: the "Save to" and "Move to course" chips. */
export function courseChips(): CourseChip[] {
  const active = db.select().from(semesters).where(eq(semesters.isActive, true)).get();
  const ws = db.select().from(workspaces).all().filter((w) => !active || w.semesterId === active.id);
  return [...ws.map((w) => ({ id: w.id, short: shortLabel(w.name, w.shortName), name: w.name, color: w.color || '#6C5CE7' })), GENERAL];
}
export const chipFor = (chips: CourseChip[], id: number | null | undefined): CourseChip => chips.find((c) => c.id === (id ?? null)) ?? GENERAL;

export function CourseChips({ chips, value, onChange, height = 40 }: { chips: CourseChip[]; value: number | null | undefined; onChange: (c: CourseChip) => void; height?: number }) {
  const p = useUni();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup">
      {chips.map((c) => {
        const on = value !== undefined && c.id === value;
        return (
          <Tap key={c.id ?? 'general'} onPress={() => onChange(c)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={c.name}
            style={{ minWidth: 44, height: Math.max(44, height), paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: p.hair, backgroundColor: on ? p.text : p.elev, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3, backgroundColor: c.color }} />
            <T w={800} size={13.5} c={on ? p.bg : p.text}>{c.short}</T>
          </Tap>
        );
      })}
    </View>
  );
}

/** The viewer's top bar (design UniFile): back, title (2 lines), course chip · meta, an optional pill and ⋯. */
export function ViewerBar({ title, chip, meta, onBack, onChip, right, onMenu, dark, topInset }: {
  title: string; chip: CourseChip; meta: string; onBack: () => void; onChip?: () => void; right?: React.ReactNode; onMenu?: () => void; dark?: boolean; topInset: number;
}) {
  const p = useUni();
  const ink = dark ? '#fff' : p.text;
  const btn = dark ? 'rgba(255,255,255,0.14)' : p.elev;
  return (
    <View style={{ paddingTop: topInset + 6, paddingHorizontal: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: dark ? 'transparent' : p.bg, borderBottomWidth: dark ? 0 : 1, borderBottomColor: p.hair }}>
      <Tap onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: btn, borderWidth: dark ? 0 : 1, borderColor: p.hair, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="chevron-left" size={21} color={ink} />
      </Tap>
      <View style={{ flex: 1, minWidth: 0, paddingTop: 1, gap: 5 }}>
        <T w={800} size={15} c={ink} numberOfLines={2} style={{ lineHeight: 19 }} accessibilityRole="header">{title}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Tap onPress={onChip} disabled={!onChip} accessibilityRole="button" accessibilityLabel={`Course: ${chip.name}${onChip ? '. Move to another course' : ''}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingLeft: 7, paddingRight: 9, borderRadius: 8, backgroundColor: dark ? 'rgba(255,255,255,0.16)' : p.surface }}>
            <View style={{ width: 7, height: 7, borderRadius: 3, backgroundColor: chip.color }} />
            <T w={800} size={11.5} c={ink}>{chip.short}</T>
          </Tap>
          <T w={600} size={11.5} c={ink} numberOfLines={1} style={{ flex: 1, opacity: 0.65 }}>{meta}</T>
        </View>
      </View>
      {right}
      {onMenu ? (
        <Tap onPress={onMenu} accessibilityRole="button" accessibilityLabel="More actions" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: btn, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="ellipsis-vertical" size={19} color={ink} />
        </Tap>
      ) : null}
    </View>
  );
}

/** "Edit" / "Done" pill for the bar. */
export function BarPill({ label, icon, onPress }: { label: string; icon?: IconName; onPress: () => void }) {
  const p = useUni();
  return (
    <Tap onPress={onPress} accessibilityRole="button" style={{ height: 44, paddingHorizontal: icon ? 14 : 16, borderRadius: 22, backgroundColor: p.primary, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon ? <Icon name={icon} size={15} color="#fff" /> : null}
      <T w={800} size={13.5} c="#fff">{label}</T>
    </Tap>
  );
}

export type OpenResult = 'opened' | 'noapp' | 'missing' | 'failed';

/** Hand a stored file to another app (Android ACTION_VIEW), or open a link in the browser. */
export async function openElsewhere(row: Pick<FileRow, 'uri' | 'title'>): Promise<OpenResult> {
  if (isWebLink(row.uri)) return Linking.openURL(row.uri).then(() => 'opened' as const, () => 'noapp' as const);
  if (!isStoredUpload(row.uri)) return 'failed';
  const path = FileManager.getAbsolutePath(row.uri);
  const info = await FileSystem.getInfoAsync(path).catch(() => null);
  if (!info?.exists) return 'missing';
  if (Platform.OS !== 'android') return 'failed';
  try {
    const data = await FileSystem.getContentUriAsync(path);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data, type: mimeFor(extOf(row.uri)), flags: 1 });
    return 'opened';
  } catch (e: any) {
    return /No Activity|ActivityNotFound|no activity/i.test(e?.message ?? '') ? 'noapp' : 'failed';
  }
}

/** Share a file through the Android share sheet; links and notes as text. */
export async function shareRow(row: Pick<FileRow, 'uri' | 'title' | 'type' | 'textContent'>): Promise<boolean> {
  try {
    if (isStoredUpload(row.uri)) {
      const Sharing = require('expo-sharing');
      if (!(await Sharing.isAvailableAsync())) return false;
      await Sharing.shareAsync(FileManager.getAbsolutePath(row.uri), { mimeType: mimeFor(extOf(row.uri)), dialogTitle: row.title });
      return true;
    }
    const message = isWebLink(row.uri) ? `${row.title}\n${row.uri}` : `${row.title}\n\n${row.textContent ?? ''}`;
    await Share.share({ message, title: row.title });
    return true;
  } catch {
    return false;
  }
}

/**
 * The ⋯ sheet and its Rename / Move sheets. Delete goes back first, then shows
 * "Deleted '…'" with Undo; the stored file is kept until the Undo window ends.
 */
export function FileActions({ row, sheet, setSheet, chips, onChanged, onDeleted, onOpenResult, canOpen = true }: {
  row: FileRow; sheet: 'menu' | 'rename' | 'move' | null; setSheet: (s: 'menu' | 'rename' | 'move' | null) => void;
  chips: CourseChip[]; onChanged: (row: FileRow) => void; onDeleted: () => void; onOpenResult?: (r: OpenResult) => void; canOpen?: boolean;
}) {
  const p = useUni();
  const toast = useToast();
  const ext = isStoredUpload(row.uri) ? extOf(row.title) || extOf(row.uri) : '';
  const base = ext && row.title.toLowerCase().endsWith(`.${ext}`) ? row.title.slice(0, -(ext.length + 1)) : row.title;
  const [name, setName] = useState(base);
  const err = renameError(name);
  const close = () => setSheet(null);

  const rename = () => {
    if (err) return;
    try {
      const title = ext && isStoredUpload(row.uri) ? `${name.trim()}.${ext}` : name.trim();
      ResourceRepository.rename(row.id, title);
      onChanged({ ...row, title });
      close();
      toast.show('Renamed.');
    } catch (e) { toast.show(e instanceof Error ? e.message : 'Could not rename.'); }
  };
  const move = (c: CourseChip) => {
    ResourceRepository.move(row.id, c.id);
    onChanged({ ...row, workspaceId: c.id });
    close();
    toast.show(`Moved to ${c.name}.`);
  };
  const del = () => {
    close();
    const gone = ResourceRepository.remove(row.id);
    onDeleted();
    if (!gone) return;
    ResourceRepository.purgeLater(gone.uri);
    toast.show(`Deleted “${gone.title}”.`, { undo: () => { ResourceRepository.restore(gone); toast.show(`Restored “${gone.title}”.`); } });
  };

  const rows = [
    ...(canOpen && (isStoredUpload(row.uri) || isWebLink(row.uri)) ? [{ icon: 'square-arrow-out-up-right' as const, label: isWebLink(row.uri) ? 'Open in browser' : 'Open in another app', onPress: async () => { close(); const r = await openElsewhere(row); onOpenResult?.(r); } }] : []),
    { icon: 'share-2' as const, label: 'Share', onPress: async () => { close(); if (!(await shareRow(row))) toast.show('Sharing isn’t available right now.'); } },
    { icon: 'pencil' as const, label: 'Rename', onPress: () => { setName(base); setSheet('rename'); } },
    { icon: 'folder-input' as const, label: 'Move to course', onPress: () => setSheet('move') },
    { icon: 'trash-2' as const, label: 'Delete', danger: true, onPress: del },
  ];

  return (
    <>
      <Sheet visible={sheet === 'menu'} onClose={close} rows={rows} />
      <Sheet visible={sheet === 'rename'} onClose={close} title="Rename"
        buttons={[{ label: 'Cancel', onPress: close }, { label: 'Save', tone: 'primary', onPress: rename }]}>
        <View style={{ gap: 6, paddingTop: 12, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TextInput value={name} onChangeText={(v) => setName(v.slice(0, 120))} autoFocus onSubmitEditing={rename} returnKeyType="done" accessibilityLabel="Name"
              style={[sans(600), { flex: 1, minWidth: 0, height: 50, borderRadius: 13, borderWidth: 1.5, borderColor: err ? p.danger : p.border, backgroundColor: p.elev, paddingHorizontal: 13, fontSize: 15, color: p.text }]} />
            {ext ? <T w={700} c={p.muted} size={13} style={mono(700)}>{`.${ext}`}</T> : null}
          </View>
          {err ? <ErrorText>{err}</ErrorText> : null}
        </View>
      </Sheet>
      <Sheet visible={sheet === 'move'} onClose={close} title="Move to course">
        <View style={{ paddingTop: 12 }}>
          <CourseChips chips={chips} value={row.workspaceId ?? null} onChange={move} height={44} />
        </View>
      </Sheet>
    </>
  );
}
