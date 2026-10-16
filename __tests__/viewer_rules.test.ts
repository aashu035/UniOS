import { addBookmark, checkPage, clampSeek, fitBox, isCommentLine, openInLabel, prettyJson, resumeOffer, storeSearchUrl, suggestedApp, toLines, viewerFor, MAX_LINES } from '../domains/resource/viewer';

describe('which viewer opens a file', () => {
  it('maps extensions, and sends legacy Office and unknown types to another app', () => {
    const k = (e: string) => viewerFor(e);
    expect(['pdf', 'jpg', 'HEIC', 'mp4', 'mkv', 'm4a', 'mp3', 'docx', 'xlsx', 'csv', 'pptx', 'py', 'json', 'md', 'txt'].map(k))
      .toEqual(['pdf', 'photo', 'photo', 'video', 'video', 'audio', 'audio', 'word', 'sheet', 'csv', 'slides', 'code', 'code', 'markdown', 'text']);
    expect(['doc', 'xls', 'ppt', 'odt', 'ods', 'odp', 'rtf', 'epub', 'zip', 'bin', 'apk', ''].map(k)).toEqual(Array(12).fill('external'));
  });
  it('suggests an app by name, never by assumed package id', () => {
    expect(suggestedApp('docx')).toBe('Google Docs');
    expect(suggestedApp('xlsx')).toBe('Google Sheets');
    expect(suggestedApp('epub')).toBe('Google Play Books');
    expect(suggestedApp('wmv')).toBe('VLC');
    expect(suggestedApp('apk')).toBeNull();
    expect(storeSearchUrl('Google Play Books')).toBe('market://search?q=Google%20Play%20Books&c=apps');
    expect(openInLabel('word')).toBe('Docs');
    expect(openInLabel('csv')).toBe('Sheets');
    expect(openInLabel('slides')).toBe('Slides');
  });
});

describe('video and audio', () => {
  it('offers to resume only between 30 s and 95%', () => {
    expect([resumeOffer(12, 600), resumeOffer(31, 600), resumeOffer(569, 600), resumeOffer(570, 600), resumeOffer(100, 0), resumeOffer(null, 600), resumeOffer(NaN, 600)]).toEqual([false, true, true, false, false, false, false]);
  });
  it('keeps bookmarks sorted, unique per second, trimmed and capped', () => {
    let b = addBookmark([], 760, '  Proof of the theorem ');
    b = addBookmark(b, 30.4, 'Intro');
    b = addBookmark(b, 760.5, 'again');
    // The bookmark at 760 s is replaced by the newer one within the same second.
    expect(b).toEqual([{ t: 30, label: 'Intro' }, { t: 761, label: 'again' }]);
    expect(addBookmark([], 760, '  Proof of the theorem ')).toEqual([{ t: 760, label: 'Proof of the theorem' }]);
    let many = [] as ReturnType<typeof addBookmark>;
    for (let i = 0; i < 150; i++) many = addBookmark(many, i * 5, 'x');
    expect(many).toHaveLength(100);
    expect(addBookmark([], 5, 'y'.repeat(200))[0].label).toHaveLength(60);
  });
  it('clamps seeks and fits any aspect ratio into the stage', () => {
    expect([clampSeek(-5, 100), clampSeek(50, 100), clampSeek(500, 100), clampSeek(7, 0)]).toEqual([0, 50, 100, 7]);
    expect(fitBox(16 / 9, 390, 520)).toEqual({ w: 390, h: 219 });
    expect(fitBox(9 / 19.5, 390, 520)).toEqual({ w: 240, h: 520 });
    expect(fitBox(0, 390, 520)).toEqual({ w: 390, h: 219 });
  });
});

describe('PDF page jump', () => {
  it('accepts 1..total and says the range otherwise', () => {
    expect(checkPage(' 14 ', 32)).toEqual({ ok: true, page: 14 });
    for (const bad of ['0', '33', '-1', '1.5', 'abc', '', '1e2', '99999999']) expect(checkPage(bad, 32)).toEqual({ ok: false, error: 'Pick a page from 1 to 32.' });
  });
});

describe('text and code', () => {
  it('normalises line endings and cuts very long files', () => {
    expect(toLines('a\r\nb\rc\nd')).toEqual({ lines: ['a', 'b', 'c', 'd'], cut: false });
    const r = toLines('x\n'.repeat(MAX_LINES + 5));
    expect([r.lines.length, r.cut]).toEqual([MAX_LINES, true]);
  });
  it('spots whole-line comments but not preprocessor lines', () => {
    expect(['// a', '  # b', '-- c', '/* d', ' * e', '<!-- f', '#include <x>', 'x = 1  # trailing', '#!/bin/sh'].map(isCommentLine)).toEqual([true, true, true, true, true, true, false, false, false]);
  });
  it('pretty-prints valid JSON and leaves invalid JSON alone', () => {
    expect(prettyJson('{"a":[1,2]}')).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
    expect(prettyJson('{oops')).toBe('{oops');
  });
});
