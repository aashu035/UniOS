/**
 * The name and link gates (core/fs/names.ts) and the extension chooser
 * (core/fs/fileType.ts). These cases target the gaps that mutation testing found
 * (audit 2026-10-14, TEST-01, mutants 207, 221, 246): hostile text BEFORE a valid
 * name, and a valid URL hidden at the END of a hostile one.
 */
import fc from 'fast-check';
import { isAppRoute, isOwnAvatar, isStoredUpload, isWebLink } from '../core/fs/names';
import { extensionFor } from '../core/fs/fileType';

const UUID = '3f2b8c1e-9d4a-4e7b-8c2d-1a2b3c4d5e6f';

describe('hostile prefixes before a valid name', () => {
  it.each([`../SQLite/${UUID}.pdf`, `/data/user/0/x/${UUID}.pdf`, `%2E%2E%2F${UUID}.pdf`, `x${UUID}.pdf`, ` ${UUID}.pdf`])('upload gate rejects %p', (n) => {
    expect(isStoredUpload(n)).toBe(false);
  });
  it.each(['../SQLite/avatar_1.jpg', 'SQLite/avatar_1.jpg', '%2E%2E/avatar_1.jpg', 'xavatar_1.jpg'])('avatar gate rejects %p', (n) => {
    expect(isOwnAvatar(n)).toBe(false);
  });
});

describe('a valid URL hidden inside a hostile one', () => {
  it.each(['intent://x#https://a.example', 'javascript:alert(1)//https://a.example', 'file:///sdcard/https://a.example', 'content://x/https://a.example'])('link gate rejects %p', (l) => {
    expect(isWebLink(l)).toBe(false);
  });
  it('accepts plain http too (old notes use http)', () => {
    expect(isWebLink('http://example.com/notes')).toBe(true);
  });
  it.each(['/course/1\nhttps://evil', '/course/1 https://evil', '///evil.example'])('route gate rejects %p', (r) => {
    expect(isAppRoute(r)).toBe(false);
  });
});

describe('every saved upload name passes the upload gate', () => {
  it('extensionFor never produces a name that the viewer then refuses', () => {
    fc.assert(fc.property(fc.string({ maxLength: 80 }), fc.option(fc.string({ maxLength: 40 })), (name: string, mime: string | null) => {
      const ext = extensionFor(name, mime);
      expect(isStoredUpload(`${UUID}.${ext}`)).toBe(true);
    }), { numRuns: 3000 });
  });
});
