import { fromBase64, jpegInfo, jpegsToPdf, toBase64 } from '../core/fs/pdf';

/** A JPEG skeleton with the markers the writer reads: SOI, optional EXIF orientation, SOF0, SOS, EOI. */
function fakeJpeg(width: number, height: number, opts: { orientation?: number; le?: boolean; components?: number; payload?: number[] } = {}): Uint8Array {
  const b: number[] = [0xff, 0xd8];
  if (opts.orientation) {
    const le = opts.le ?? false;
    const w16 = (v: number) => (le ? [v & 255, v >> 8] : [v >> 8, v & 255]);
    const w32 = (v: number) => (le ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
    const tiff = [...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...w16(42), ...w32(8), ...w16(1), ...w16(0x0112), ...w16(3), ...w32(1), ...w16(opts.orientation), 0, 0, ...w32(0)];
    const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
    b.push(0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 255, ...app1);
  }
  const c = opts.components ?? 3;
  b.push(0xff, 0xc0, 0, 8 + 3 * c, 8, height >> 8, height & 255, width >> 8, width & 255, c, ...Array(3 * c).fill(1));
  b.push(0xff, 0xda, 0, 2, ...(opts.payload ?? [1, 2, 3, 250, 0, 7]), 0xff, 0xd9);
  return Uint8Array.from(b);
}

const latin1 = (b: Uint8Array) => Array.from(b, (x) => String.fromCharCode(x)).join('');

describe('base64', () => {
  it('round-trips every byte value and all padding lengths', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    for (const n of [0, 1, 2, 3, 4, 255, 256]) expect(Array.from(fromBase64(toBase64(all.subarray(0, n))))).toEqual(Array.from(all.subarray(0, n)));
    expect(toBase64(Uint8Array.from([104, 105]))).toBe(Buffer.from('hi').toString('base64'));
    expect(Array.from(fromBase64('aGk=\n'))).toEqual([104, 105]);
  });
});

describe('jpegInfo', () => {
  it('reads size, channels and EXIF orientation in both byte orders', () => {
    expect(jpegInfo(fakeJpeg(4000, 3000))).toEqual({ width: 4000, height: 3000, components: 3, orientation: 1 });
    expect(jpegInfo(fakeJpeg(4000, 3000, { orientation: 6 }))?.orientation).toBe(6);
    expect(jpegInfo(fakeJpeg(4000, 3000, { orientation: 8, le: true }))?.orientation).toBe(8);
    expect(jpegInfo(fakeJpeg(10, 20, { components: 1 }))?.components).toBe(1);
  });

  it('refuses things that are not JPEGs, or are cut short', () => {
    expect(jpegInfo(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull(); // PNG
    expect(jpegInfo(new Uint8Array(0))).toBeNull();
    expect(jpegInfo(fakeJpeg(10, 10).subarray(0, 8))).toBeNull();
    expect(jpegInfo(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 2, 0xff, 0xd9]))).toBeNull(); // no frame header
  });
});

describe('jpegsToPdf', () => {
  const pdfOf = (...j: Uint8Array[]) => latin1(fromBase64(jpegsToPdf(j.map(toBase64))));

  it('writes one page per photo, the JPEG bytes as-is, and a correct xref', () => {
    const a = fakeJpeg(4000, 3000), b = fakeJpeg(3000, 4000);
    const pdf = pdfOf(a, b);
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf).toContain('/Count 2');
    expect(pdf.split('/Filter /DCTDecode').length - 1).toBe(2);
    expect(pdf).toContain(latin1(a));
    expect(pdf).toContain(latin1(b));
    expect(pdf).toContain('/MediaBox [0 0 842 631.5]'); // landscape photo, long side 842 pt
    expect(pdf).toContain('/MediaBox [0 0 631.5 842]');

    // Every xref entry points at its "N 0 obj", and startxref at the table.
    const start = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(start, start + 4)).toBe('xref');
    const rows = pdf.slice(start).split('\n').slice(3, 3 + 8);
    rows.forEach((r, i) => expect(pdf.slice(Number(r.slice(0, 10)), Number(r.slice(0, 10)) + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
    // Stream lengths match.
    const len = Number(/\/Length (\d+) >>\nstream\n/.exec(pdf)![1]);
    expect(len).toBe(a.length);
  });

  it('turns sideways phone photos upright', () => {
    const pdf = pdfOf(fakeJpeg(4000, 3000, { orientation: 6 }));
    expect(pdf).toContain('/MediaBox [0 0 631.5 842]'); // shown portrait
    expect(pdf).toContain('q 0 -842 631.5 0 0 842 cm /Im0 Do Q');
    expect(pdfOf(fakeJpeg(4000, 3000, { orientation: 3 }))).toContain('q -842 0 0 -631.5 842 631.5 cm');
    expect(pdfOf(fakeJpeg(4000, 3000, { orientation: 8 }))).toContain('q 0 842 -631.5 0 631.5 0 cm');
  });

  it('uses the right colour space and refuses non-JPEG pages', () => {
    expect(pdfOf(fakeJpeg(10, 10, { components: 1 }))).toContain('/ColorSpace /DeviceGray');
    expect(() => jpegsToPdf([toBase64(Uint8Array.from([1, 2, 3]))])).toThrow('Page 1 is not a JPEG photo');
    expect(() => jpegsToPdf([])).toThrow('No pages');
  });
});
