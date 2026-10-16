/**
 * Photos of notes → one PDF, in plain JS (design UniAdd, "Save as one PDF").
 * A PDF can carry a JPEG as-is (DCTDecode), so nothing is re-encoded: each page
 * is one photo, sized to the photo's shape, turned upright from its EXIF
 * orientation. Input and output are base64, as expo-file-system reads and writes.
 */

export type JpegInfo = { width: number; height: number; components: number; orientation: number };

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = (() => { const t = new Uint8Array(256).fill(255); for (let i = 0; i < 64; i++) t[B64.charCodeAt(i)] = i; return t; })();

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)], b = LOOKUP[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? LOOKUP[clean.charCodeAt(i + 2)] : 255;
    const d = i + 3 < clean.length ? LOOKUP[clean.charCodeAt(i + 3)] : 255;
    out[o++] = (a << 2) | (b >> 4);
    if (c !== 255) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d !== 255) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let line = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    line += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)]
      + (i + 1 < bytes.length ? B64[((b & 15) << 2) | ((c ?? 0) >> 6)] : '=')
      + (i + 2 < bytes.length ? B64[c & 63] : '=');
    if (line.length >= 8192) { parts.push(line); line = ''; }
  }
  parts.push(line);
  return parts.join('');
}

const u16 = (b: Uint8Array, i: number, le = false) => (le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]);
const u32 = (b: Uint8Array, i: number, le = false) => (le ? (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 0x1000000 : b[i] * 0x1000000 + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]));

/** EXIF orientation from an APP1 segment starting at `i` (the byte after its length); 1 when absent. */
function exifOrientation(b: Uint8Array, i: number, end: number): number {
  if (end - i < 14 || String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]) !== 'Exif') return 1;
  const t = i + 6;
  const le = b[t] === 0x49; // "II" little-endian, "MM" big-endian
  const ifd = t + u32(b, t + 4, le);
  if (ifd + 2 > end) return 1;
  const n = u16(b, ifd, le);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > end) break;
    if (u16(b, e, le) === 0x0112) { const v = u16(b, e + 8, le); return v >= 1 && v <= 8 ? v : 1; }
  }
  return 1;
}

/** Size, colour channels and EXIF orientation of a JPEG, or null when it isn't one. */
export function jpegInfo(b: Uint8Array): JpegInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let orientation = 1;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; } // fill byte
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = u16(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) return null;
    if (m === 0xe1) orientation = exifOrientation(b, i + 4, i + 2 + len);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      const height = u16(b, i + 5), width = u16(b, i + 7), components = b[i + 9];
      return width && height ? { width, height, components, orientation } : null;
    }
    if (m === 0xda || m === 0xd9) return null; // image data before any frame header
    i += 2 + len;
  }
  return null;
}

/** The longer side of each page, in points (A4 is 842 tall). */
const PAGE_LONG_SIDE = 842;

/** Page size and the image matrix that shows the photo upright. */
function placement(info: JpegInfo) {
  const o = info.orientation;
  const quarter = o >= 5; // 5–8 are turned a quarter
  const [dw, dh] = quarter ? [info.height, info.width] : [info.width, info.height];
  const k = PAGE_LONG_SIDE / Math.max(dw, dh);
  const W = Math.round(dw * k * 100) / 100, H = Math.round(dh * k * 100) / 100;
  // [a b c d e f] maps the image's unit square onto the page.
  const m = o === 3 || o === 4 ? [-W, 0, 0, -H, W, H]
    : o === 6 || o === 5 ? [0, -H, W, 0, 0, H]
      : o === 8 || o === 7 ? [0, H, -W, 0, W, 0]
        : [W, 0, 0, H, 0, 0];
  return { W, H, m };
}

/** Build a PDF with one page per JPEG (base64 in, base64 out). Throws if any input isn't a JPEG. */
export function jpegsToPdf(jpegsBase64: string[]): string {
  if (!jpegsBase64.length) throw new Error('No pages');
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const enc = (s: string) => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff; return a; };
  const put = (x: string | Uint8Array) => { const a = typeof x === 'string' ? enc(x) : x; chunks.push(a); pos += a.length; };
  const obj = (n: number, body: string | Array<string | Uint8Array>) => {
    offsets[n] = pos;
    put(`${n} 0 obj\n`);
    for (const part of Array.isArray(body) ? body : [body]) put(part);
    put('\nendobj\n');
  };

  const n = jpegsBase64.length;
  const pageIds = Array.from({ length: n }, (_, i) => 3 + i * 3);
  put('%PDF-1.4\n%âãÏÓ\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${n} >>`);
  jpegsBase64.forEach((b64, idx) => {
    const bytes = fromBase64(b64);
    const info = jpegInfo(bytes);
    if (!info) throw new Error(`Page ${idx + 1} is not a JPEG photo`);
    const { W, H, m } = placement(info);
    const [page, image, content] = [pageIds[idx], pageIds[idx] + 1, pageIds[idx] + 2];
    const cs = info.components === 1 ? '/DeviceGray' : info.components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
    const draw = `q ${m.join(' ')} cm /Im0 Do Q`;
    obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`);
    obj(image, [`<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`, bytes, '\nendstream']);
    obj(content, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  });

  const size = 3 + n * 3;
  const xref = pos;
  let table = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i++) table += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  put(`${table}trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(pos);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return toBase64(out);
}
