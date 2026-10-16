import { kindOf, type FileKind } from '../../core/fs/fileType';
import type { IconName } from './Icon';

export type FileVisual = { kind: FileKind | 'link' | 'note'; label: string; icon: IconName; color: string };

/** Type tiles from the design: PDF red, Word blue, Excel green, PowerPoint orange, audio purple, other grey. */
const V: Record<FileVisual['kind'], Omit<FileVisual, 'kind'>> = {
  pdf: { label: 'PDF', icon: 'file-text', color: '#DC2626' },
  word: { label: 'Word', icon: 'file-text', color: '#2563EB' },
  excel: { label: 'Excel', icon: 'sheet', color: '#16A34A' },
  csv: { label: 'CSV', icon: 'sheet', color: '#16A34A' },
  ppt: { label: 'PowerPoint', icon: 'presentation', color: '#EA580C' },
  image: { label: 'Photo', icon: 'image', color: '#F59E0B' },
  video: { label: 'Video', icon: 'file-video', color: '#0891B2' },
  audio: { label: 'Audio', icon: 'headphones', color: '#7C3AED' },
  code: { label: 'Code', icon: 'file-code', color: '#6B7280' },
  text: { label: 'Text', icon: 'file-text', color: '#6B7280' },
  markdown: { label: 'Markdown', icon: 'file-text', color: '#6B7280' },
  json: { label: 'JSON', icon: 'file-code', color: '#6B7280' },
  epub: { label: 'EPUB', icon: 'book-open', color: '#6B7280' },
  archive: { label: 'ZIP', icon: 'file-archive', color: '#6B7280' },
  other: { label: 'File', icon: 'file-question', color: '#6B7280' },
  link: { label: 'Link', icon: 'link', color: '#8B5CF6' },
  note: { label: 'Note', icon: 'sticky-note', color: '#10B981' },
};

/** How a saved item looks: from its type (link, note) or its file extension. */
export function fileVisual(f: { type?: string | null; uri?: string | null; name?: string | null }): FileVisual {
  const uri = (f.uri ?? '').trim();
  if (f.type === 'link' || /^https?:\/\//i.test(uri)) return { kind: 'link', ...V.link };
  if (f.type === 'note' || (!uri && !f.name)) return { kind: 'note', ...V.note };
  const kind = kindOf(uri || f.name);
  return { kind, ...V[kind] };
}
