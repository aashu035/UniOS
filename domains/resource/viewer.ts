import { kindOf, type FileKind } from '../../core/fs/fileType';

/**
 * Which viewer opens a file and the small rules the viewers share (design
 * UniFile, handoff §2). Pure, so the rules are tested without a phone.
 */
export type ViewerKind = 'pdf' | 'photo' | 'video' | 'audio' | 'word' | 'sheet' | 'csv' | 'slides' | 'code' | 'markdown' | 'text' | 'external';

const BY_KIND: Partial<Record<FileKind, ViewerKind>> = {
  pdf: 'pdf', image: 'photo', video: 'video', audio: 'audio', excel: 'sheet', csv: 'csv', code: 'code', markdown: 'markdown', text: 'text', json: 'code',
};

/** Legacy binary Office formats (.doc, .xls, .ppt) are not zip files; they open in another app. */
const OOXML: Record<string, ViewerKind> = { docx: 'word', xlsx: 'sheet', pptx: 'slides' };

export function viewerFor(ext: string): ViewerKind {
  const e = ext.toLowerCase();
  if (OOXML[e]) return OOXML[e];
  const k = kindOf(`x.${e}`);
  if (k === 'excel' || k === 'word' || k === 'ppt') return 'external'; // doc, xls, ods, odt, odp, rtf, ppt …
  return BY_KIND[k] ?? 'external';
}

/** The app to suggest when nothing on the phone opens a file. Searched by name in the store, so no package id is assumed. */
export function suggestedApp(ext: string): string | null {
  const e = ext.toLowerCase();
  if (['doc', 'docx', 'odt', 'rtf'].includes(e)) return 'Google Docs';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(e)) return 'Google Sheets';
  if (['ppt', 'pptx', 'odp'].includes(e)) return 'Google Slides';
  if (e === 'epub') return 'Google Play Books';
  if (['wmv', 'avi', 'mkv', 'flac'].includes(e)) return 'VLC';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'Files by Google';
  return null;
}
export const storeSearchUrl = (app: string) => `market://search?q=${encodeURIComponent(app)}&c=apps`;
export const storeWebUrl = (app: string) => `https://play.google.com/store/search?q=${encodeURIComponent(app)}&c=apps`;

/** "Open in Docs", "Open in Sheets", "Open in Slides" for the simplified-view banner. */
export const openInLabel = (kind: ViewerKind) => (kind === 'word' ? 'Docs' : kind === 'sheet' || kind === 'csv' ? 'Sheets' : kind === 'slides' ? 'Slides' : 'another app');

// ─── Video and audio ─────────────────────────────────────────────────────────

export const SPEEDS = [0.5, 1, 1.25, 1.5, 2] as const;

/** Offer to resume when the saved position is more than 30 s in and under 95% of the length. */
export function resumeOffer(position: number | null | undefined, duration: number | null | undefined): boolean {
  if (!position || !duration || !Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return false;
  return position > 30 && position / duration < 0.95;
}

export type Bookmark = { t: number; label: string };
export const clampSeek = (t: number, duration: number) => Math.max(0, Math.min(Number.isFinite(duration) && duration > 0 ? duration : t, t));
export function addBookmark(list: Bookmark[], t: number, label: string): Bookmark[] {
  const clean = label.trim().slice(0, 60);
  const next = [...list.filter((b) => Math.abs(b.t - t) >= 1), { t: Math.round(t), label: clean }];
  return next.sort((a, b) => a.t - b.t).slice(0, 100);
}

/** The box a video fits in: landscape fills the width, a portrait video is limited by height. */
export function fitBox(aspect: number, maxW: number, maxH: number): { w: number; h: number } {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const w = Math.min(maxW, maxH * a);
  return { w: Math.round(w), h: Math.round(w / a) };
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export type PageCheck = { ok: true; page: number } | { ok: false; error: string };
export function checkPage(input: string, total: number): PageCheck {
  const t = input.trim();
  const n = /^\d{1,6}$/.test(t) ? Number(t) : NaN;
  return n >= 1 && n <= total ? { ok: true, page: n } : { ok: false, error: `Pick a page from 1 to ${total}.` };
}

// ─── Code and text ───────────────────────────────────────────────────────────

export const MAX_TEXT_BYTES = 2 * 1024 * 1024;
export const MAX_LINES = 20000;

/** Split into lines for the code view; very large files are cut and say so. */
export function toLines(text: string): { lines: string[]; cut: boolean } {
  const all = text.replace(/\r\n?/g, '\n').split('\n');
  return all.length > MAX_LINES ? { lines: all.slice(0, MAX_LINES), cut: true } : { lines: all, cut: false };
}
/** A whole-line comment in common languages, shown muted. */
export const isCommentLine = (line: string) => /^\s*(\/\/|#(?!include|define|pragma|if|endif|else|!)|--|\/\*|\*\s|\*\/|<!--)/.test(line);
/** Pretty-print JSON when it parses, so a minified file is readable. Else the text as it is. */
export function prettyJson(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}
