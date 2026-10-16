/**
 * A small XML reader for Office files (docx, xlsx, pptx), which the viewers
 * only read. It is linear time and never expands anything: DOCTYPE and
 * entity declarations are skipped, so "billion laughs" and external entities
 * do nothing. Only the five named entities and numeric references are decoded.
 * Hermes has no DOMParser, so this is plain JS.
 */
export type XNode = { n: string; a: Record<string, string>; c: XNode[]; t: string };

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const MAX_DEPTH = 200;

export function decodeEntities(s: string): string {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z]{2,4});/g, (m, e: string) => {
    if (e[0] !== '#') return Object.prototype.hasOwnProperty.call(NAMED, e) ? NAMED[e] : m;
    const cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : m;
  });
}

const local = (name: string) => name.slice(name.indexOf(':') + 1);

/** Parse into a tree. Element names lose their prefix ("w:p" → "p"); attribute names keep it ("w:val"). */
export function parseXml(src: string): XNode {
  const root: XNode = { n: '#root', a: {}, c: [], t: '' };
  const stack: XNode[] = [root];
  const len = src.length;
  let i = 0;
  while (i < len) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { stack[stack.length - 1].t += decodeEntities(src.slice(i)); break; }
    if (lt > i) stack[stack.length - 1].t += decodeEntities(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt + 4); i = e < 0 ? len : e + 3; continue; }
    if (src.startsWith('<![CDATA[', lt)) { const e = src.indexOf(']]>', lt + 9); stack[stack.length - 1].t += src.slice(lt + 9, e < 0 ? len : e); i = e < 0 ? len : e + 3; continue; }
    if (src.startsWith('<?', lt)) { const e = src.indexOf('?>', lt + 2); i = e < 0 ? len : e + 2; continue; }
    if (src.startsWith('<!', lt)) { // DOCTYPE: skip, including an internal subset in [...]
      let j = lt + 2, depth = 0;
      while (j < len) { const ch = src[j]; if (ch === '[') depth++; else if (ch === ']') depth--; else if (ch === '>' && depth <= 0) break; j++; }
      i = j + 1; continue;
    }
    // A tag: find its closing ">" outside quotes, in one pass.
    let j = lt + 1, q = '';
    while (j < len) { const ch = src[j]; if (q) { if (ch === q) q = ''; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '>') break; j++; }
    if (j >= len) throw new Error('Unterminated tag');
    let body = src.slice(lt + 1, j);
    i = j + 1;
    if (body[0] === '/') { // closing tag
      if (stack.length > 1) stack.pop();
      continue;
    }
    const selfClose = body.endsWith('/');
    if (selfClose) body = body.slice(0, -1);
    const sp = body.search(/\s/);
    const name = sp < 0 ? body : body.slice(0, sp);
    const node: XNode = { n: local(name), a: {}, c: [], t: '' };
    if (sp >= 0) {
      const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let m: RegExpExecArray | null;
      const attrs = body.slice(sp);
      while ((m = re.exec(attrs))) node.a[m[1]] = decodeEntities(m[3] ?? m[4] ?? '');
    }
    stack[stack.length - 1].c.push(node);
    if (!selfClose) {
      if (stack.length > MAX_DEPTH) throw new Error('XML is nested too deeply');
      stack.push(node);
    }
  }
  return root.c[0] ?? root;
}

/** The first attribute whose name (without prefix) is `name`; "id" also matches "r:id" only when asked as "r:id". */
export function attr(n: XNode, name: string): string | undefined {
  if (name in n.a) return n.a[name];
  if (name.includes(':')) return undefined;
  for (const k of Object.keys(n.a)) if (k.slice(k.indexOf(':') + 1) === name && k.includes(':')) return n.a[k];
  return undefined;
}

export const kids = (n: XNode | undefined, name: string): XNode[] => (n ? n.c.filter((x) => x.n === name) : []);
export const kid = (n: XNode | undefined, name: string): XNode | undefined => n?.c.find((x) => x.n === name);

/** Every descendant in document order. */
export function* walk(n: XNode): Generator<XNode> {
  const stack: XNode[] = [n];
  while (stack.length) {
    const x = stack.pop()!;
    yield x;
    for (let k = x.c.length - 1; k >= 0; k--) stack.push(x.c[k]);
  }
}
