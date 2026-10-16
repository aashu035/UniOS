/**
 * The extension a picked file is saved under, which decides its viewer. The
 * name alone is not enough: downloads are often named without one
 * ("Video by nandan.sharma23 [DZdbo]") or with a misleading one, while the
 * picker always reports the real type ("video/mp4").
 */
const BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/x-matroska': 'mkv', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/x-msvideo': 'avi',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/amr': 'amr',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt', 'text/csv': 'csv', 'text/markdown': 'md', 'application/json': 'json', 'application/epub+zip': 'epub', 'application/zip': 'zip',
};
const KNOWN = new Set([...Object.values(BY_MIME), 'jpeg', 'm4v', 'odt', 'ods', 'odp', 'rtf']);

export function extensionFor(name: string, mimeType?: string | null): string {
  const fromName = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim())?.[1]?.toLowerCase();
  if (fromName && KNOWN.has(fromName)) return fromName;
  const fromMime = mimeType ? BY_MIME[mimeType.toLowerCase().split(';')[0].trim()] : undefined;
  return fromMime ?? fromName ?? 'bin';
}

export type FileKind = 'pdf' | 'word' | 'excel' | 'csv' | 'ppt' | 'image' | 'video' | 'audio' | 'code' | 'text' | 'markdown' | 'json' | 'epub' | 'archive' | 'other';

const KIND_BY_EXT: Record<string, FileKind> = {
  pdf: 'pdf', doc: 'word', docx: 'word', odt: 'word', rtf: 'word',
  xls: 'excel', xlsx: 'excel', ods: 'excel', csv: 'csv',
  ppt: 'ppt', pptx: 'ppt', odp: 'ppt',
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image', heic: 'image', heif: 'image',
  mp4: 'video', mov: 'video', mkv: 'video', webm: 'video', '3gp': 'video', m4v: 'video', avi: 'video', wmv: 'video',
  mp3: 'audio', m4a: 'audio', aac: 'audio', ogg: 'audio', opus: 'audio', wav: 'audio', amr: 'audio', flac: 'audio',
  txt: 'text', log: 'text', md: 'markdown', markdown: 'markdown', json: 'json',
  py: 'code', js: 'code', ts: 'code', jsx: 'code', tsx: 'code', c: 'code', h: 'code', cpp: 'code', cc: 'code', java: 'code', kt: 'code',
  cs: 'code', go: 'code', rs: 'code', rb: 'code', php: 'code', html: 'code', css: 'code', sql: 'code', sh: 'code', m: 'code', r: 'code', ipynb: 'code',
  epub: 'epub', zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
};

/** The extension of a stored name or uri ("…/3f2b….pdf" → "pdf"), lower case; "" when none. */
export const extOf = (nameOrUri: string | null | undefined) => /\.([A-Za-z0-9]{1,8})$/.exec((nameOrUri ?? '').trim())?.[1]?.toLowerCase() ?? '';

/** What kind of file this is, from its extension. Decides the viewer and the type tile. */
export const kindOf = (nameOrUri: string | null | undefined): FileKind => KIND_BY_EXT[extOf(nameOrUri)] ?? 'other';
