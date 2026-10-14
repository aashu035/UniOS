import { extensionFor } from '../core/fs/fileType';

describe('the extension a picked file is saved under', () => {
  it('uses the real type when the name has no extension (downloaded reels, WhatsApp files)', () => {
    expect(extensionFor('Video by nandan.sharma23 [DZdbo1x]', 'video/mp4')).toBe('mp4');
    expect(extensionFor('Lecture 5', 'audio/mpeg')).toBe('mp3');
    expect(extensionFor('Unit 3 notes', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('docx');
  });
  it('keeps a known extension from the name', () => {
    expect(extensionFor('IMG_20261013_204508.jpg', 'image/jpeg')).toBe('jpg');
    expect(extensionFor('Marks.XLSX', null)).toBe('xlsx');
    expect(extensionFor('slides.pptx', 'application/octet-stream')).toBe('pptx');
  });
  it('prefers the real type over a misleading name ending', () => {
    expect(extensionFor('notes.final', 'application/pdf')).toBe('pdf');
    expect(extensionFor('v2.0 lecture', 'video/x-matroska')).toBe('mkv');
  });
  it('falls back sensibly when nothing is known', () => {
    expect(extensionFor('backup.final', null)).toBe('final');
    expect(extensionFor('README', undefined)).toBe('bin');
    expect(extensionFor('clip', 'video/mp4; codecs="avc1"')).toBe('mp4');
  });
});
