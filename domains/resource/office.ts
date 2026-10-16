import { unzipSync, strFromU8 } from 'fflate';
import { attr, kid, kids, parseXml, walk, type XNode } from '../../core/fs/xml';

/**
 * The simplified in-app views of Word, Excel and PowerPoint files (design
 * UniFile, handoff §2). Each reader takes the file's bytes and returns plain
 * data. The files are untrusted (a classmate can share one), so:
 *  - a part is only unzipped if its declared size is under MAX_PART, and the
 *    whole archive is refused above MAX_TOTAL (zip bombs);
 *  - nothing is fetched, run or expanded (see core/fs/xml.ts);
 *  - rows, columns, slides and blocks are capped.
 * Anything it cannot read throws `OfficeError`, which the viewer shows as
 * "Can't open this file" with Open in another app.
 */
export class OfficeError extends Error { constructor(m: string) { super(m); this.name = 'OfficeError'; } }

export const MAX_FILE = 25 * 1024 * 1024;
const MAX_PART = 20 * 1024 * 1024;
const MAX_TOTAL = 60 * 1024 * 1024;
export const MAX_ROWS = 1000;
const MAX_COLS = 60;
const MAX_BLOCKS = 5000;
const MAX_SLIDES = 300;

type Parts = Record<string, Uint8Array>;

/** Unzip only the parts the viewer needs, refusing archives that expand too far. */
function open(bytes: Uint8Array, want: (name: string) => boolean): Parts {
  if (bytes.length > MAX_FILE) throw new OfficeError('File is too large for the simplified view');
  let total = 0;
  try {
    return unzipSync(bytes, {
      filter: (f) => {
        if (!want(f.name)) return false;
        if (f.originalSize > MAX_PART) throw new OfficeError('A part of the file is too large');
        total += f.originalSize;
        if (total > MAX_TOTAL) throw new OfficeError('The file expands too far');
        return true;
      },
    });
  } catch (e) {
    if (e instanceof OfficeError) throw e;
    throw new OfficeError('Not a valid Office file');
  }
}

const text = (p: Parts, name: string): string | null => (p[name] ? strFromU8(p[name]) : null);
const xml = (p: Parts, name: string): XNode | null => {
  const s = text(p, name);
  if (s == null) return null;
  try { return parseXml(s); } catch { throw new OfficeError(`Can't read ${name}`); }
};

/** Resolve a relationship target against the part that owns it ("../notesSlides/n.xml", "/xl/worksheets/s.xml"). */
function resolve(owner: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = owner.split('/').slice(0, -1);
  for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg && seg !== '.') parts.push(seg); }
  return parts.join('/');
}
const relsOf = (p: Parts, owner: string): Map<string, { type: string; target: string }> => {
  const dir = owner.slice(0, owner.lastIndexOf('/') + 1);
  const r = xml(p, `${dir}_rels/${owner.slice(owner.lastIndexOf('/') + 1)}.rels`);
  const m = new Map<string, { type: string; target: string }>();
  for (const x of kids(r ?? undefined, 'Relationship')) {
    if (x.a.TargetMode === 'External') continue;
    m.set(x.a.Id, { type: x.a.Type ?? '', target: resolve(owner, x.a.Target ?? '') });
  }
  return m;
};
const relType = (t: string) => t.slice(t.lastIndexOf('/') + 1);

// ─── Word ────────────────────────────────────────────────────────────────────

export type Run = { text: string; b?: boolean; i?: boolean };
export type DocBlock =
  | { t: 'h'; level: 1 | 2 | 3; runs: Run[] }
  | { t: 'p'; runs: Run[] }
  | { t: 'li'; marker: string; runs: Run[]; depth: number }
  | { t: 'table'; rows: string[][] }
  | { t: 'img' };
export type WordDoc = { blocks: DocBlock[]; truncated: boolean; images: number };

const flag = (rPr: XNode | undefined, name: string) => {
  const f = kid(rPr, name);
  if (!f) return false;
  const v = attr(f, 'w:val');
  return !(v === '0' || v === 'false' || v === 'off');
};

function runsOf(p: XNode): Run[] {
  const out: Run[] = [];
  for (const r of walk(p)) {
    if (r.n !== 'r') continue;
    const rPr = kid(r, 'rPr');
    let s = '';
    for (const x of r.c) {
      if (x.n === 't') s += x.t;
      else if (x.n === 'tab') s += '\t';
      else if (x.n === 'br' || x.n === 'cr') s += '\n';
    }
    if (!s) continue;
    const b = flag(rPr, 'b'), i = flag(rPr, 'i');
    const last = out[out.length - 1];
    if (last && !!last.b === b && !!last.i === i) last.text += s;
    else out.push({ text: s, ...(b ? { b } : {}), ...(i ? { i } : {}) });
  }
  return out;
}
const plain = (runs: Run[]) => runs.map((r) => r.text).join('');

/** numId + level → "decimal" | "bullet" etc., from word/numbering.xml. */
function numberingFormats(num: XNode | null): Map<string, string> {
  const m = new Map<string, string>();
  if (!num) return m;
  const abstract = new Map<string, XNode>();
  for (const a of kids(num, 'abstractNum')) abstract.set(attr(a, 'w:abstractNumId') ?? '', a);
  for (const n of kids(num, 'num')) {
    const a = abstract.get(attr(kid(n, 'abstractNumId') ?? n, 'w:val') ?? '');
    for (const lvl of kids(a, 'lvl')) m.set(`${attr(n, 'w:numId')}:${attr(lvl, 'w:ilvl')}`, attr(kid(lvl, 'numFmt') ?? lvl, 'w:val') ?? 'decimal');
  }
  return m;
}

export function readDocx(bytes: Uint8Array): WordDoc {
  const parts = open(bytes, (n) => /^word\/(document|numbering)\.xml$/.test(n));
  const doc = xml(parts, 'word/document.xml');
  if (!doc) throw new OfficeError('No document in this file');
  const body = kid(doc, 'body');
  if (!body) throw new OfficeError('No document body');
  const fmts = numberingFormats(xml(parts, 'word/numbering.xml'));

  const blocks: DocBlock[] = [];
  let images = 0;
  const counters = new Map<string, number>();
  let truncated = false;
  const push = (b: DocBlock) => { if (blocks.length >= MAX_BLOCKS) truncated = true; else blocks.push(b); };

  for (const node of body.c) {
    if (node.n === 'tbl') {
      const rows = kids(node, 'tr').slice(0, MAX_ROWS).map((tr) => kids(tr, 'tc').slice(0, MAX_COLS).map((tc) => kids(tc, 'p').map((p) => plain(runsOf(p))).join('\n')));
      if (rows.length) push({ t: 'table', rows });
      continue;
    }
    if (node.n !== 'p') continue;
    let hasImg = false;
    for (const x of walk(node)) if (x.n === 'drawing' || x.n === 'pict') { hasImg = true; images++; }
    const runs = runsOf(node);
    const pPr = kid(node, 'pPr');
    const style = attr(kid(pPr, 'pStyle') ?? { n: '', a: {}, c: [], t: '' }, 'w:val') ?? '';
    const heading = /^(Heading|Title)(\d)?$/i.exec(style);
    const numPr = kid(pPr, 'numPr');
    const listStyle = /^List(Bullet|Number|Paragraph)/i.exec(style);
    if (heading && runs.length) {
      const lvl = heading[1].toLowerCase() === 'title' ? 1 : Math.min(3, Math.max(1, Number(heading[2] ?? 1)));
      push({ t: 'h', level: lvl as 1 | 2 | 3, runs });
    } else if ((numPr || listStyle) && runs.length) {
      const numId = attr(kid(numPr, 'numId') ?? { n: '', a: {}, c: [], t: '' }, 'w:val') ?? style;
      const ilvl = attr(kid(numPr, 'ilvl') ?? { n: '', a: {}, c: [], t: '' }, 'w:val') ?? '0';
      const f = numPr ? fmts.get(`${numId}:${ilvl}`) ?? 'decimal' : /bullet/i.test(style) ? 'bullet' : /number/i.test(style) ? 'decimal' : 'bullet';
      const key = `${numId}:${ilvl}`;
      const n = (counters.get(key) ?? 0) + 1;
      counters.set(key, n);
      push({ t: 'li', marker: f === 'bullet' || f === 'none' ? '•' : `${n}.`, runs, depth: Math.min(3, Number(ilvl) || 0) });
    } else if (runs.length) {
      push({ t: 'p', runs });
    } else if (hasImg) {
      push({ t: 'img' });
    }
  }
  return { blocks, truncated, images };
}

// ─── Excel ───────────────────────────────────────────────────────────────────

export type Sheet = { name: string; rows: string[][]; totalRows: number; cols: number };
export type Workbook = { sheets: Sheet[] };

/** "AB12" → column index 27 (0-based) and row 11. */
export function cellRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Za-z]{1,3})(\d{1,7})$/.exec(ref);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: Number(m[2]) - 1 };
}

const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
const isDateFormat = (code: string) => /[dmyhs]/i.test(code.replace(/"[^"]*"|\\.|\[[^\]]*\]|_.|\*./g, ''));

/** Excel serial number → "2026-10-14" (or with time). 1900 system keeps Excel's fake 29 Feb 1900. */
export function excelDate(serial: number, date1904 = false): string {
  const days = Math.floor(serial);
  const secs = Math.round((serial - days) * 86400);
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, days < 61 ? 31 : 30);
  const d = new Date(epoch + days * 86400000 + secs * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return secs ? `${ymd} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : ymd;
}

/** 18.5 → "18.5", 0.1+0.2 → "0.3": no binary noise. */
export function numberText(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return String(Number(n.toPrecision(15)));
}

/** The text of a shared-string item or an inline string. Phonetic runs (rPh) hold furigana, not the cell text. */
const siText = (si: XNode): string => {
  const ph = new Set<XNode>();
  for (const x of kids(si, 'rPh')) for (const t of walk(x)) ph.add(t);
  let s = '';
  for (const t of walk(si)) if (t.n === 't' && !ph.has(t)) s += t.t;
  return s;
};

const sharedStrings = (root: XNode | null): string[] => (root ? kids(root, 'si').map(siText) : []);

function dateStyles(styles: XNode | null): Set<number> {
  const out = new Set<number>();
  if (!styles) return out;
  const custom = new Map<number, string>();
  for (const f of kids(kid(styles, 'numFmts'), 'numFmt')) custom.set(Number(f.a.numFmtId), f.a.formatCode ?? '');
  kids(kid(styles, 'cellXfs'), 'xf').forEach((xf, i) => {
    const id = Number(xf.a.numFmtId ?? 0);
    if (custom.has(id) ? isDateFormat(custom.get(id)!) : BUILTIN_DATE.has(id)) out.add(i);
  });
  return out;
}

export function readXlsx(bytes: Uint8Array): Workbook {
  const parts = open(bytes, (n) => /^xl\/(workbook\.xml|styles\.xml|sharedStrings\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/.test(n));
  const wb = xml(parts, 'xl/workbook.xml');
  if (!wb) throw new OfficeError('No workbook in this file');
  const rels = relsOf(parts, 'xl/workbook.xml');
  const shared = sharedStrings(xml(parts, 'xl/sharedStrings.xml'));
  const dates = dateStyles(xml(parts, 'xl/styles.xml'));
  const date1904 = attr(kid(wb, 'workbookPr') ?? wb, 'date1904') === '1';

  const sheets: Sheet[] = [];
  for (const s of kids(kid(wb, 'sheets'), 'sheet')) {
    if (s.a.state === 'hidden' || s.a.state === 'veryHidden') continue;
    const rel = rels.get(attr(s, 'r:id') ?? '');
    const sheetXml = rel && relType(rel.type) === 'worksheet' ? xml(parts, rel.target) : null;
    const data = kid(sheetXml ?? undefined, 'sheetData');
    const rows: string[][] = [];
    let total = 0, cols = 0, maxRowIndex = -1;
    for (const row of kids(data, 'row')) {
      total++;
      const r = row.a.r ? Number(row.a.r) - 1 : maxRowIndex + 1;
      maxRowIndex = Math.max(maxRowIndex, r);
      if (r >= MAX_ROWS) continue;
      const out: string[] = [];
      let next = 0;
      for (const c of kids(row, 'c')) {
        const ref = c.a.r ? cellRef(c.a.r) : null;
        const col = ref ? ref.col : next;
        next = col + 1;
        if (col >= MAX_COLS) continue;
        const v = kid(c, 'v')?.t ?? '';
        const t = c.a.t ?? 'n';
        let val = '';
        if (t === 's') val = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') val = siText(kid(c, 'is') ?? c);
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'str' || t === 'e') val = v;
        else if (v !== '') val = dates.has(Number(c.a.s ?? 0)) && Number.isFinite(Number(v)) ? excelDate(Number(v), date1904) : numberText(v);
        while (out.length < col) out.push('');
        out[col] = val;
        cols = Math.max(cols, col + 1);
      }
      while (rows.length < r) rows.push([]);
      rows[r] = out;
    }
    sheets.push({ name: s.a.name ?? `Sheet ${sheets.length + 1}`, rows, totalRows: Math.max(total, maxRowIndex + 1), cols });
  }
  if (!sheets.length) throw new OfficeError('No sheets in this workbook');
  return { sheets };
}

/** Comma- or semicolon-separated text (RFC 4180 quotes) as one sheet. */
export function readCsv(textIn: string, name = 'Sheet'): Workbook {
  const src = textIn.charCodeAt(0) === 0xfeff ? textIn.slice(1) : textIn;
  const head = src.slice(0, 2000).split('\n')[0] ?? '';
  const delim = (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ';' : (head.match(/\t/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, total = 0, cols = 0;
  const endRow = () => {
    row.push(cell); cell = '';
    total++;
    if (rows.length < MAX_ROWS) { rows.push(row.slice(0, MAX_COLS)); cols = Math.max(cols, Math.min(row.length, MAX_COLS)); }
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; endRow(); }
    else cell += ch;
  }
  if (cell !== '' || row.length) endRow();
  return { sheets: [{ name, rows, totalRows: total, cols }] };
}

// ─── PowerPoint ──────────────────────────────────────────────────────────────

export type Slide = { title: string; bullets: Array<{ text: string; level: number }>; notes: string; pictures: number };
export type Deck = { slides: Slide[]; truncated: boolean };

const paraText = (p: XNode) => {
  let s = '';
  for (const x of walk(p)) if (x.n === 't') s += x.t; else if (x.n === 'br') s += '\n';
  return s;
};

export function readPptx(bytes: Uint8Array): Deck {
  const parts = open(bytes, (n) => /^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|slides\/[^/]+\.xml|slides\/_rels\/[^/]+\.rels|notesSlides\/[^/]+\.xml)$/.test(n));
  const pres = xml(parts, 'ppt/presentation.xml');
  if (!pres) throw new OfficeError('No presentation in this file');
  const rels = relsOf(parts, 'ppt/presentation.xml');
  // Slide order is the order in presentation.xml, not the file names.
  const order = kids(kid(pres, 'sldIdLst'), 'sldId').map((s) => rels.get(attr(s, 'r:id') ?? '')?.target).filter((t): t is string => !!t && /^ppt\/slides\/[^/]+\.xml$/.test(t));
  const slides: Slide[] = [];
  for (const path of order.slice(0, MAX_SLIDES)) {
    const s = xml(parts, path);
    if (!s) continue;
    let title = '', pictures = 0;
    const bullets: Slide['bullets'] = [];
    for (const x of walk(s)) {
      if (x.n === 'pic') pictures++;
      if (x.n !== 'sp' && x.n !== 'graphicFrame') continue;
      const ph = [...walk(x)].find((y) => y.n === 'ph');
      const type = ph ? ph.a.type ?? 'body' : 'shape';
      if (x.n === 'graphicFrame') {
        for (const tr of [...walk(x)].filter((y) => y.n === 'tr')) bullets.push({ text: kids(tr, 'tc').map((tc) => [...walk(tc)].filter((y) => y.n === 'p').map(paraText).join(' ')).join(' | '), level: 0 });
        continue;
      }
      if (type === 'sldNum' || type === 'dt' || type === 'ftr') continue;
      const tx = kid(x, 'txBody');
      for (const p of kids(tx, 'p')) {
        const t = paraText(p).trim();
        if (!t) continue;
        if ((type === 'title' || type === 'ctrTitle') && !title) title = t;
        else if (type === 'title' || type === 'ctrTitle') title += ` ${t}`;
        else bullets.push({ text: t, level: Math.min(4, Number(attr(kid(p, 'pPr') ?? p, 'lvl') ?? 0) || 0) });
      }
    }
    const rel = [...relsOf(parts, path).values()].find((r) => relType(r.type) === 'notesSlide');
    let notes = '';
    const nx = rel ? xml(parts, rel.target) : null;
    if (nx) for (const x of walk(nx)) {
      if (x.n !== 'sp') continue;
      const ph = [...walk(x)].find((y) => y.n === 'ph');
      if (ph?.a.type === 'body') notes += kids(kid(x, 'txBody'), 'p').map(paraText).join('\n');
    }
    slides.push({ title, bullets, notes: notes.trim(), pictures });
  }
  if (!slides.length) throw new OfficeError('No slides in this presentation');
  return { slides, truncated: order.length > MAX_SLIDES };
}
