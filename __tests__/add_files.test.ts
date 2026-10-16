import {
  biggest, checkLink, copyMeta, doneText, dupText, fullName, included, insertAt, kindLabel, largeText, linkTitle, needBytes, noteTitle,
  pickedMeta, renamed, renameError, reviewCta, scanPdfName, siteOf, skipNote, splitName, unreadableReason, type Picked,
} from '../domains/resource/files';

const item = (o: Partial<Picked>): Picked => ({
  id: Math.random().toString(36), uri: 'file:///x', base: 'x', ext: 'pdf', mime: null, size: 1_000_000, durationMs: null, source: 'files',
  hash: 'h', checked: true, dup: null, dupOk: false, bad: null, ...o,
});

describe('names', () => {
  it('splits off the real extension, and keeps dots inside the name', () => {
    expect(splitName('Unit 3 notes.pdf', 'application/pdf')).toEqual({ base: 'Unit 3 notes', ext: 'pdf' });
    expect(splitName('Lab manual – Exp 7.docx')).toEqual({ base: 'Lab manual – Exp 7', ext: 'docx' });
    expect(splitName('v1.2 final', 'application/pdf')).toEqual({ base: 'v1.2 final', ext: 'pdf' });
    expect(splitName('Video by nandan [DZdbo]', 'video/mp4')).toEqual({ base: 'Video by nandan [DZdbo]', ext: 'mp4' });
    expect(splitName('', null)).toEqual({ base: 'Untitled', ext: 'bin' });
    expect(splitName('a\u0000b.txt').base).toBe('ab');
  });

  it('renames only the base, refuses path characters, and reverts when empty', () => {
    expect(renamed('  Unit 3 ', 'old')).toBe('Unit 3');
    expect(renamed('   ', 'old')).toBe('old');
    expect(renamed('../../etc/passwd', 'old')).toBe('....etcpasswd');
    expect(fullName({ base: 'Unit 3', ext: 'pdf' })).toBe('Unit 3.pdf');
    expect(renameError(' ')).toBe('Enter a name.');
    expect(renameError('a')).toBeNull();
  });

  it('describes rows the way the design does', () => {
    expect(kindLabel('pptx')).toBe('PowerPoint');
    expect(kindLabel('xyz')).toBe('File');
    expect(pickedMeta({ ext: 'pdf', size: 2_400_000, durationMs: null })).toBe('2.4 MB · PDF');
    expect(pickedMeta({ ext: 'mp4', size: 1_228_800_000, durationMs: 3_492_000 })).toBe('1.2 GB · Video · MP4 · 58:12');
    expect(largeText(item({ ext: 'mp4', size: 1_228_800_000 }))).toBe('This video is 1.2 GB. It will be copied into UniOS and use that much space.');
    expect(dupText({ title: 'Unit 3 notes', course: 'Soft Computing' })).toBe('Already saved in UniOS as ‘Unit 3 notes’ in Soft Computing.');
    expect(scanPdfName(new Date(2026, 9, 14), 5)).toBe('Notes 14 Oct (5 pages)');
    expect(scanPdfName(new Date(2026, 9, 14), 1)).toBe('Notes 14 Oct (1 page)');
  });
});

describe('what gets added', () => {
  const video = item({ ext: 'mp4', size: 1_200_000_000 });
  const dup = item({ dup: { title: 'Unit 3', course: 'SC' } });
  const bad = item({ bad: 'empty', size: 0 });
  const pdf = item({ size: 2_000_000 });
  const sc = { id: 6, short: 'SC', name: 'Soft Computing' };

  it('skips unreadable files and unconfirmed duplicates; a confirmed duplicate needs no new space', () => {
    expect([video, dup, bad, pdf].map(included)).toEqual([true, false, false, true]);
    expect(needBytes([video, dup, bad, pdf])).toBe(1_202_000_000);
    expect(needBytes([{ ...dup, dupOk: true }])).toBe(0);
    expect(biggest([video, dup, pdf])).toBe(video);
    expect(skipNote([video, dup, bad])).toBe('1 duplicate will be skipped unless you choose Add anyway. 1 file can’t be read and won’t be added.');
    expect(skipNote([video])).toBe('');
  });

  it('labels the button in the design\'s order of checks', () => {
    expect(reviewCta([{ ...pdf, checked: false }], sc, null)).toEqual({ label: 'Checking files…', ok: false });
    expect(reviewCta([bad, dup], sc, null)).toEqual({ label: 'Nothing to add', ok: false });
    expect(reviewCta([pdf], null, null)).toEqual({ label: 'Pick a course to save into', ok: false });
    expect(reviewCta([video], sc, 640_000_000)).toEqual({ label: 'Not enough space', ok: false });
    expect(reviewCta([video, pdf, dup], sc, 18e9)).toEqual({ label: 'Add 2 items to SC', ok: true });
    expect(reviewCta([pdf], { id: null, short: 'General', name: 'General' }, null)).toEqual({ label: 'Add 1 item to General', ok: true });
  });

  it('explains unreadable files', () => {
    expect(unreadableReason(null)).toMatch(/^Can’t read this file/);
    expect(unreadableReason({ exists: false })).toMatch(/^Can’t read this file/);
    expect(unreadableReason({ exists: true, size: 0 })).toMatch(/empty/);
    expect(unreadableReason({ exists: true, size: 10 })).toBeNull();
  });

  it('reports copying and the result', () => {
    expect(copyMeta({ size: 2_400_000 }, 'wait')).toBe('Waiting · 2.4 MB');
    expect(copyMeta({ size: 2_400_000 }, 'skip')).toBe('Skipped · already saved');
    expect(doneText(['done', 'done', 'bad', 'skip', 'done', 'done'], 'Soft Computing Techniques')).toEqual({ title: 'Added 4 items to Soft Computing Techniques', sub: '1 not added · 1 skipped as duplicate' });
    expect(doneText(['done'], 'General')).toEqual({ title: 'Added 1 item to General', sub: 'Find it in General → Files' });
    expect(doneText(['cancel'], 'SC').title).toBe('Nothing was added');
  });
});

describe('links and notes', () => {
  it('accepts http(s) links with a real host only', () => {
    expect(checkLink(' https://drive.google.com/file/d/1Xr8kQ/view ')).toBe('https://drive.google.com/file/d/1Xr8kQ/view');
    expect(checkLink('http://example.com:8080/a')).toBe('http://example.com:8080/a');
    for (const bad of ['drive.google.com/x', 'https://localhost', 'javascript:alert(1)', 'https://exa mple.com', 'https://.com', 'file:///etc/passwd', 'https://user@evil.com'])
      expect(checkLink(bad)).toBeNull();
  });

  it('names known sites and gives untitled links a title', () => {
    expect(siteOf('https://www.youtube.com/watch?v=1')).toEqual({ host: 'youtube.com', name: 'YouTube', icon: 'play' });
    expect(siteOf('https://drive.google.com/x').name).toBe('Google Drive');
    expect(siteOf('https://nptel.ac.in/courses')).toEqual({ host: 'nptel.ac.in', name: 'nptel.ac.in', icon: 'globe' });
    expect(linkTitle('  ', 'https://youtu.be/x')).toBe('YouTube link');
    expect(linkTitle(' CN slides ', 'https://youtu.be/x')).toBe('CN slides');
  });

  it('inserts Markdown at the cursor, without a blank first line', () => {
    expect(insertAt('', { start: 0, end: 0 }, '\n# ')).toEqual({ body: '# ', cursor: 2 });
    expect(insertAt('Intro', { start: 5, end: 5 }, '\n- ')).toEqual({ body: 'Intro\n- ', cursor: 8 });
    expect(insertAt('a b', { start: 2, end: 3 }, '**bold**')).toEqual({ body: 'a **bold**', cursor: 10 });
    expect(insertAt('abc', { start: 99, end: 120 }, 'x')).toEqual({ body: 'abcx', cursor: 4 });
    expect(noteTitle('  ')).toBe('Untitled note');
  });
});
