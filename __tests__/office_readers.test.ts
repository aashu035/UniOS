import fs from 'fs';
import path from 'path';
import { zipSync, strToU8 } from 'fflate';
import { parseXml, decodeEntities } from '../core/fs/xml';
import { cellRef, excelDate, MAX_ROWS, numberText, OfficeError, readCsv, readDocx, readPptx, readXlsx } from '../domains/resource/office';

/** sample.docx / sample.xlsx / sample.pptx were written by python-docx, openpyxl and python-pptx; shared.xlsx by XlsxWriter (which, like Excel, uses shared strings). */
const fx = (n: string) => new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', n)));
const txt = (runs: Array<{ text: string }>) => runs.map((r) => r.text).join('');

describe('xml reader', () => {
  it('decodes the five entities and numeric references, and leaves unknown ones alone', () => {
    expect(decodeEntities('R&amp;D &lt;x&gt; &quot;q&quot; &apos;a&apos; &#65;&#x42; &bogus; &#0; &#xD800;')).toBe('R&D <x> "q" \'a\' AB &bogus; &#0; &#xD800;');
  });
  it('does not expand entity declarations (billion laughs) and skips the DOCTYPE', () => {
    const bomb = '<?xml version="1.0"?><!DOCTYPE l [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;"> ]><l>&b;</l>';
    const n = parseXml(bomb);
    expect(n.n).toBe('l');
    expect(n.t).toBe('&b;');
  });
  it('is linear on adversarial input and rejects unterminated tags and deep nesting', () => {
    const t0 = Date.now();
    parseXml(`<a>${'<b x="1"'.repeat(1) + '/>'}${'<c "'.repeat(0)}</a>`);
    parseXml('<a>' + '<b a="x>y"/>'.repeat(50000) + '</a>');
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(() => parseXml('<a><b attr="oops></a>')).toThrow('Unterminated tag');
    expect(() => parseXml('<a>'.repeat(500))).toThrow('nested too deeply');
  });
  it('keeps attribute prefixes and strips element prefixes', () => {
    const n = parseXml('<w:p xmlns:w="u"><w:r w:val="1" r:id="rId7" id="5"/></w:p>');
    expect(n.n).toBe('p');
    expect(n.c[0].n).toBe('r');
    expect(n.c[0].a).toEqual({ 'w:val': '1', 'r:id': 'rId7', id: '5' });
  });
});

describe('Word', () => {
  const d = readDocx(fx('sample.docx'));
  it('reads headings, formatted runs with entities decoded, lists and tables in order', () => {
    expect(d.blocks.map((b) => b.t)).toEqual(['h', 'h', 'p', 'li', 'li', 'li', 'li', 'table', 'p']);
    const [h1, h2, p] = d.blocks as any[];
    expect([h1.level, txt(h1.runs)]).toEqual([1, 'Unit 3: Backpropagation']);
    expect([h2.level, txt(h2.runs)]).toEqual([2, '3.4 The update rule']);
    expect(txt(p.runs)).toBe('The error at the output layer is passed backwards through the network, with R&D <x> & "quotes". Italic');
    expect(p.runs.find((r: any) => r.b)?.text).toBe('backwards');
    expect(p.runs.find((r: any) => r.i)?.text).toBe('Italic');
  });
  it('tells bullets from numbers and counts numbers from 1', () => {
    expect((d.blocks.filter((b) => b.t === 'li') as any[]).map((b) => `${b.marker} ${txt(b.runs)}`)).toEqual(['• First point', '• Second point', '1. Step one', '2. Step two']);
  });
  it('reads a table with empty cells', () => {
    expect((d.blocks.find((b) => b.t === 'table') as any).rows).toEqual([['Host', 'RTT', 'TTL'], ['a.edu', '12.4', '64'], ['b.edu', '', '58']]);
  });
  it('keeps line breaks inside a paragraph', () => {
    expect(txt((d.blocks[8] as any).runs)).toBe('Line one\nLine two after a break');
  });
  it('refuses things that are not Word files', () => {
    expect(() => readDocx(strToU8('not a zip'))).toThrow(OfficeError);
    expect(() => readDocx(zipSync({ 'hello.txt': strToU8('x') }))).toThrow('No document');
    expect(() => readDocx(fx('sample.xlsx'))).toThrow('No document');
  });
});

describe('Excel', () => {
  it('reads inline strings, numbers without float noise, blanks and formulas', () => {
    const w = readXlsx(fx('sample.xlsx'));
    expect(w.sheets.map((s) => [s.name, s.totalRows, s.cols])).toEqual([['Experiments', 4, 4], ['Readings', 1200, 3]]);
    expect(w.sheets[0].rows).toEqual([['No.', 'Experiment', 'Marks', 'Remarks'], ['1', 'TCP sockets', '18.5', 'Good'], ['2', 'Routing', '', 'Not submitted'], ['3', '', '7', 'formula']]);
  });
  it('shows only the first 1,000 rows of a long sheet but reports the real count', () => {
    const s = readXlsx(fx('sample.xlsx')).sheets[1];
    expect(s.rows).toHaveLength(MAX_ROWS);
    expect(s.totalRows).toBe(1200);
    expect(s.rows[999]).toEqual(['1000', 'host1000', '1500']);
  });
  it('reads shared strings, gaps by cell reference, booleans, formula results, dates and phonetic-free text', () => {
    const s = readXlsx(fx('shared.xlsx')).sheets[0];
    expect(s.rows[0]).toEqual(['Name', 'Score', 'Note']);
    expect(s.rows[1]).toEqual(['Aanya', '18.5', 'A & B <ok>']);
    expect(s.rows[2]).toEqual(['Rohan']); // trailing blanks are not invented
    expect(s.rows[3]).toEqual(['Total', '37', 'TRUE']);
    expect(s.rows[5]).toEqual(['  spaced  ']);
  });
  it('places cells by reference, so a skipped column keeps its place', () => {
    expect(cellRef('C4')).toEqual({ col: 2, row: 3 });
    expect(cellRef('AB12')).toEqual({ col: 27, row: 11 });
    expect(cellRef('1A')).toBeNull();
    const zip = zipSync({
      'xl/workbook.xml': strToU8('<workbook xmlns:r="x"><sheets><sheet name="S" sheetId="1" r:id="rId1"/><sheet name="Hidden" state="hidden" sheetId="2" r:id="rId2"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="http://x/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://x/worksheet" Target="/xl/worksheets/sheet2.xml"/></Relationships>'),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="2"><c r="C2" t="inlineStr"><is><t>c</t></is></c><c r="E2"><v>0.30000000000000004</v></c></row></sheetData></worksheet>'),
    });
    const w = readXlsx(zip);
    expect(w.sheets).toHaveLength(1);
    expect(w.sheets[0].rows).toEqual([[], ['', '', 'c', '', '0.3']]);
  });
  it('shows dates as dates, not serial numbers', () => {
    expect(excelDate(45000)).toBe('2023-03-15');
    expect(excelDate(45000.5)).toBe('2023-03-15 12:00');
    expect(excelDate(59)).toBe('1900-02-28');
    expect(excelDate(61)).toBe('1900-03-01');
    expect(excelDate(1, true)).toBe('1904-01-02');
    expect(numberText('0.30000000000000004')).toBe('0.3');
    expect(numberText('1E+30')).toBe('1e+30');
    const zip = zipSync({
      'xl/workbook.xml': strToU8('<workbook xmlns:r="x"><sheets><sheet name="D" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="http://x/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/styles.xml': strToU8('<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0.00&quot;d&quot;"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="165"/></cellXfs></styleSheet>'),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" s="0"><v>45000</v></c><c r="B1" s="1"><v>45000</v></c><c r="C1" s="2"><v>45000</v></c><c r="D1" s="3"><v>45000</v></c></row></sheetData></worksheet>'),
    });
    expect(readXlsx(zip).sheets[0].rows[0]).toEqual(['45000', '2023-03-15', '2023-03-15', '45000']);
  });
  it('refuses a zip that expands past the limit before inflating it', () => {
    const big = zipSync({ 'xl/workbook.xml': strToU8('<workbook/>'), 'xl/worksheets/sheet1.xml': new Uint8Array(21 * 1024 * 1024) });
    expect(big.length).toBeLessThan(100_000); // a bomb: tiny on disk
    expect(() => readXlsx(big)).toThrow('A part of the file is too large');
  });
  it('reads CSV with quotes, embedded commas, newlines, BOM, semicolons and CRLF', () => {
    const w = readCsv('﻿Name,Note\r\n"Smith, J","said ""hi""\nthere"\r\nplain,\r\n');
    expect(w.sheets[0].rows).toEqual([['Name', 'Note'], ['Smith, J', 'said "hi"\nthere'], ['plain', '']]);
    expect(readCsv('a;b;c\n1;2;3').sheets[0].rows).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
    expect(readCsv('').sheets[0].rows).toEqual([]);
    const long = readCsv(Array.from({ length: 2500 }, (_, i) => `${i},x`).join('\n')).sheets[0];
    expect([long.rows.length, long.totalRows]).toEqual([MAX_ROWS, 2500]);
  });
});

describe('PowerPoint', () => {
  it('reads slides in presentation order with title, bullets and speaker notes', () => {
    const d = readPptx(fx('sample.pptx'));
    expect(d.slides).toEqual([
      { title: 'Routing algorithms', bullets: [{ text: 'Distance vector', level: 0 }, { text: 'Link state', level: 0 }], notes: 'Mention Bellman-Ford.', pictures: 0 },
      { title: 'Summary & next', bullets: [], notes: '', pictures: 0 },
    ]);
  });
  it('follows the slide list, not the file names', () => {
    const slide = (t: string) => strToU8(`<sld><cSld><spTree><sp><nvSpPr><nvPr><ph type="title"/></nvPr></nvSpPr><txBody><p><r><t>${t}</t></r></p></txBody></sp></spTree></cSld></sld>`);
    const d = readPptx(zipSync({
      'ppt/presentation.xml': strToU8('<presentation xmlns:r="x"><sldIdLst><sldId id="256" r:id="rId9"/><sldId id="257" r:id="rId7"/></sldIdLst></presentation>'),
      'ppt/_rels/presentation.xml.rels': strToU8('<Relationships><Relationship Id="rId7" Type="http://x/slide" Target="slides/slide1.xml"/><Relationship Id="rId9" Type="http://x/slide" Target="slides/slide2.xml"/></Relationships>'),
      'ppt/slides/slide1.xml': slide('was first on disk'),
      'ppt/slides/slide2.xml': slide('is first in the deck'),
    }));
    expect(d.slides.map((s) => s.title)).toEqual(['is first in the deck', 'was first on disk']);
  });
  it('refuses a file with no slides', () => {
    expect(() => readPptx(zipSync({ 'ppt/presentation.xml': strToU8('<presentation/>') }))).toThrow('No slides');
    expect(() => readPptx(fx('sample.docx'))).toThrow('No presentation');
  });
});
