/**
 * A shared text file must not freeze the viewer (audit 2026-10-14, SEC-03).
 * With smart quotes on, markdown-it 10 took 4.2 s for 140 KB and 13.9 s for 234 KB.
 */
import { markdownParser, MAX_MARKDOWN_BYTES } from '../components/viewer/markdownParser';

it('parses the largest file the viewer will parse, full of quotes, in well under a second', () => {
  const text = 'a\' "b '.repeat(Math.ceil(MAX_MARKDOWN_BYTES / 7)); // ~200 KB of ordinary punctuation
  const t0 = Date.now();
  markdownParser.parse(text, {});
  expect(Date.now() - t0).toBeLessThan(500);
});

it('keeps the safe defaults: no smart quotes, no linkify', () => {
  expect(markdownParser.options.typographer).toBe(false);
  expect(markdownParser.options.linkify).toBe(false);
});
