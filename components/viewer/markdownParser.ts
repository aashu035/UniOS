import MarkdownIt from 'markdown-it';

/**
 * The parser the file viewer uses. Smart quotes ("typographer") are off: in
 * markdown-it 10 they take quadratic time, so a shared 234 KB text file froze the
 * app for 14 s (audit SEC-03, GHSA-6v5v-wf23-fmfq). Linkify is off too.
 */
export const markdownParser = MarkdownIt({ typographer: false, linkify: false });

/** Larger files are shown as plain text instead of being parsed. */
export const MAX_MARKDOWN_BYTES = 200 * 1024;
