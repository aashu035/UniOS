/**
 * Saves the Samarth attendance pages so the UniOS portal parser can be built
 * against the real HTML. Runs on your own PC; you log in yourself in the window
 * it opens. No password is read, stored or sent anywhere by this script.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node scripts/samarth-capture.mjs
 *
 * Output: docs/samarth/capture-<time>/ (one .html per page + index.json).
 * These files contain your personal attendance: don't commit them to a public repo.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const BASE = 'https://dcrustm.samarth.edu.in';
const START = `${BASE}/index.php/student-attendance/attendance/index`;
const SCOPE = '/index.php/student-attendance/'; // only follow attendance pages
const MAX_PAGES = 300;

const out = `docs/samarth/capture-${new Date().toISOString().replace(/[:.]/g, '-')}`;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext()).newPage();
await page.goto(START);

const rl = createInterface({ input: process.stdin, output: process.stdout });
await rl.question('Log in in the browser window, open the attendance page, then press Enter here... ');
rl.close();

const seen = new Set();
const queue = [page.url().startsWith(BASE) ? page.url() : START];
const index = [];
const name = (u) => decodeURIComponent(new URL(u).pathname + new URL(u).search).replace(/[^a-zA-Z0-9]+/g, '_').slice(-150);

while (queue.length && index.length < MAX_PAGES) {
  const url = queue.shift();
  const key = url.split('#')[0];
  if (seen.has(key)) continue;
  seen.add(key);
  try {
    await page.goto(key, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.warn('skip', key, e.message);
    continue;
  }
  if (/\/site\/login/.test(page.url())) { console.error('Logged out; stopping.'); break; }
  const file = `${String(index.length).padStart(3, '0')}${name(key)}.html`;
  writeFileSync(`${out}/${file}`, await page.content());
  index.push({ file, url: key, title: await page.title() });
  console.log(`saved ${index.length}: ${key}`);
  // Follow attendance links and pagination (?page=N), never logout or forms.
  const links = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
  for (const l of links) {
    try {
      const u = new URL(l);
      if (u.origin === BASE && u.pathname.includes('/student-attendance/') && !/logout|delete|update|create/i.test(u.pathname)) queue.push(u.href);
    } catch {}
  }
}

writeFileSync(`${out}/index.json`, JSON.stringify(index, null, 2));
console.log(`\nDone: ${index.length} pages in ${out}`);
await browser.close();
