import { extensionFor, kindOf, type FileKind } from '../../core/fs/fileType';
import { isWebLink } from '../../core/fs/names';
import { formatBytes, formatDuration } from '../../core/utils/format';

/**
 * The + Add flow and the file actions (design UniAdd / UniFile, handoff §1–2),
 * as pure functions: names, row text, what gets added, link checks, note titles.
 */

export type CopyState = 'wait' | 'copy' | 'done' | 'skip' | 'bad' | 'cancel';
export type Picked = {
  id: string; uri: string; base: string; ext: string; mime: string | null; size: number | null; durationMs: number | null;
  source: 'camera' | 'photos' | 'files';
  /** null while the hash is being worked out. */
  hash: string | null; checked: boolean;
  dup: { title: string; course: string } | null; dupOk: boolean;
  bad: string | null;
};

/** "Unit 3 notes.pdf" → base "Unit 3 notes", ext "pdf". The extension follows the real type (see extensionFor). */
export function splitName(name: string, mime?: string | null): { base: string; ext: string } {
  const clean = (name || '').replace(/[\u0000-\u001f]/g, '').trim();
  const ext = extensionFor(clean, mime);
  const m = /^(.*)\.([A-Za-z0-9]{1,8})$/.exec(clean);
  const base = (m && m[2].toLowerCase() === ext ? m[1] : clean).trim();
  return { base: base || 'Untitled', ext };
}

/** A rename keeps the extension. An empty name reverts to the old one. */
export const renamed = (input: string, old: string) => input.replace(/[\u0000-\u001f/\\]/g, '').trim().slice(0, 120) || old;
export const fullName = (p: Pick<Picked, 'base' | 'ext'>) => `${p.base}.${p.ext}`;

const LABEL: Partial<Record<FileKind, string>> = {
  pdf: 'PDF', word: 'Word', excel: 'Excel', csv: 'CSV', ppt: 'PowerPoint', image: 'Photo', video: 'Video', audio: 'Audio',
  code: 'Code', text: 'Text', markdown: 'Markdown', json: 'JSON', epub: 'EPUB', archive: 'Archive',
};
export const kindLabel = (ext: string) => LABEL[kindOf(`x.${ext}`)] ?? 'File';

/** "2.4 MB · PDF", "1.2 GB · Video · MP4 · 58:12". */
export function pickedMeta(p: Pick<Picked, 'ext' | 'size' | 'durationMs'>): string {
  const k = kindOf(`x.${p.ext}`);
  const media = k === 'image' || k === 'video' || k === 'audio';
  return [p.size != null ? formatBytes(p.size) : '', kindLabel(p.ext), media ? p.ext.toUpperCase() : '', p.durationMs ? formatDuration(p.durationMs / 1000) : '']
    .filter(Boolean).join(' · ');
}

export const LARGE_BYTES = 500e6;
export const included = (p: Picked) => !p.bad && (!p.dup || p.dupOk);
/** Space the add needs: a duplicate added anyway shares the stored file, so it needs none. */
export const needBytes = (items: Picked[]) => items.filter(included).reduce((t, p) => t + (p.dup ? 0 : p.size ?? 0), 0);
export const biggest = (items: Picked[]) => items.filter((p) => included(p) && !p.dup).sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0] ?? null;
export const nounOf = (ext: string) => ({ image: 'photo', video: 'video', audio: 'recording' } as Partial<Record<FileKind, string>>)[kindOf(`x.${ext}`)] ?? 'file';

export const dupText = (d: { title: string; course: string }) => `Already saved in UniOS as ‘${d.title}’ in ${d.course}.`;
export const largeText = (p: Picked) => `This ${nounOf(p.ext)} is ${formatBytes(p.size ?? 0)}. It will be copied into UniOS and use that much space.`;

/** Why a picked file can't be added, or null when it can. */
export function unreadableReason(info: { exists: boolean; size?: number | null } | null): string | null {
  if (!info || !info.exists) return 'Can’t read this file. It may be in Drive but not downloaded to the phone. Open it in Drive once, then add it again. The other files will still be added.';
  if (!info.size) return 'This file is empty (0 bytes), so there’s nothing to add. The other files will still be added.';
  return null;
}

export type Dest = { id: number | null; short: string; name: string } | null;

/** The review button, in the order the design checks things. */
export function reviewCta(items: Picked[], dest: Dest, free: number | null): { label: string; ok: boolean } {
  const n = items.filter(included).length;
  if (items.some((p) => !p.checked)) return { label: 'Checking files…', ok: false };
  if (!n) return { label: 'Nothing to add', ok: false };
  if (!dest) return { label: 'Pick a course to save into', ok: false };
  if (free != null && needBytes(items) > free) return { label: 'Not enough space', ok: false };
  return { label: `Add ${n} item${n === 1 ? '' : 's'} to ${dest.short}`, ok: true };
}

/** "1 duplicate will be skipped unless you choose Add anyway. 1 file can't be read and won't be added." */
export function skipNote(items: Picked[]): string {
  const d = items.filter((p) => p.dup && !p.dupOk).length;
  const b = items.filter((p) => p.bad).length;
  return [
    d ? `${d} duplicate${d === 1 ? '' : 's'} will be skipped unless you choose Add anyway.` : '',
    b ? `${b} file${b === 1 ? '' : 's'} can’t be read and won’t be added.` : '',
  ].filter(Boolean).join(' ');
}

/** Row text while copying and when done. */
export function copyMeta(p: Pick<Picked, 'size'>, st: CopyState): string {
  const size = formatBytes(p.size ?? 0);
  return { wait: `Waiting · ${size}`, copy: `Copying · ${size}`, done: `${size} · added`, skip: 'Skipped · already saved', bad: 'Not added · can’t be read', cancel: 'Cancelled · not added' }[st];
}

/** "Added 4 items to Soft Computing Techniques" and "1 not added · 1 skipped as duplicate". */
export function doneText(states: CopyState[], course: string): { title: string; sub: string } {
  const added = states.filter((s) => s === 'done').length;
  const not = states.filter((s) => s === 'bad' || s === 'cancel').length;
  const skipped = states.filter((s) => s === 'skip').length;
  return {
    title: added ? `Added ${added} item${added === 1 ? '' : 's'} to ${course}` : 'Nothing was added',
    sub: [not ? `${not} not added` : '', skipped ? `${skipped} skipped as duplicate` : ''].filter(Boolean).join(' · ') || `Find ${added === 1 ? 'it' : 'them'} in ${course} → Files`,
  };
}

/** "Notes 14 Oct (5 pages)" for photos saved as one PDF. */
export function scanPdfName(date: Date, pages: number): string {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Notes ${date.getDate()} ${MON[date.getMonth()]} (${pages} page${pages === 1 ? '' : 's'})`;
}

// ─── Links ───────────────────────────────────────────────────────────────────

/** A link the app will save: http(s), a host with a dot, no spaces. */
export function checkLink(input: string): string | null {
  const u = input.trim();
  if (!isWebLink(u)) return null;
  const host = /^https?:\/\/([^/?#]+)/i.exec(u)?.[1] ?? '';
  return /^[^\s.@]+(\.[^\s.@]+)+(:\d+)?$/.test(host) ? u : null;
}

const SITES: Record<string, [string, 'hard-drive' | 'file-text' | 'play' | 'globe']> = {
  'drive.google.com': ['Google Drive', 'hard-drive'], 'docs.google.com': ['Google Docs', 'file-text'],
  'youtube.com': ['YouTube', 'play'], 'm.youtube.com': ['YouTube', 'play'], 'youtu.be': ['YouTube', 'play'],
};
export function siteOf(url: string): { host: string; name: string; icon: 'hard-drive' | 'file-text' | 'play' | 'globe' } {
  const host = (/^https?:\/\/([^/?#:]+)/i.exec(url)?.[1] ?? '').toLowerCase().replace(/^www\./, '');
  const s = SITES[host];
  return { host, name: s?.[0] ?? host, icon: s?.[1] ?? 'globe' };
}
export const linkTitle = (title: string, url: string) => title.trim().slice(0, 120) || `${siteOf(url).name} link`;

// ─── Notes ───────────────────────────────────────────────────────────────────

export const noteTitle = (t: string | null | undefined) => (t ?? '').trim() || 'Untitled note';

/** Toolbar chips that insert Markdown at the cursor. */
export const NOTE_TOOLS: Array<[string, string]> = [['# Heading', '\n# '], ['- List', '\n- '], ['1. List', '\n1. '], ['**Bold**', '**bold**'], ['> Quote', '\n> '], ['- [ ] Task', '\n- [ ] '], ['``` Code', '\n```\n\n```']];

/** Insert `text` at the selection, dropping the leading newline at the very start or after one. */
export function insertAt(body: string, sel: { start: number; end: number }, text: string): { body: string; cursor: number } {
  const start = Math.max(0, Math.min(sel.start, body.length));
  const end = Math.max(start, Math.min(sel.end, body.length));
  const before = body.slice(0, start);
  const t = text.startsWith('\n') && (before === '' || before.endsWith('\n')) ? text.slice(1) : text;
  return { body: before + t + body.slice(end), cursor: start + t.length };
}

/** "Enter a name." for an empty rename; null when fine. */
export const renameError = (v: string) => (v.trim() ? null : 'Enter a name.');
