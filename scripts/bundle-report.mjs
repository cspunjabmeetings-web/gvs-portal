// spec: 9.1 (Build report: JS/CSS gzip budgets), Qadam 1 "bundle report maujood"
// Usage: npm run build && npm run report:bundle
// Har HTML page ke <script src> aur <link rel=stylesheet> + inline <script>/<style> ka gzip wazan.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

// Cloudflare adapter static files dist/client mein rakhta hai
const DIST = existsSync(join(process.cwd(), 'dist', 'client'))
  ? join(process.cwd(), 'dist', 'client')
  : join(process.cwd(), 'dist');
const KB = 1024;
// spec 9.1 ki hadein (gzip)
const BUDGET = {
  homeJs: 100 * KB,
  islandJs: 60 * KB, // quiz/mock pages (Qadam 10-11 se)
  adminJs: 150 * KB,
  css: 30 * KB,
};

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const fmt = (b) => `${(b / KB).toFixed(1)} KB`;

function assetSize(url) {
  const p = join(DIST, url.replace(/^\//, '').split('?')[0]);
  return existsSync(p) ? gz(readFileSync(p)) : 0;
}

/**
 * JS module aur us ki saari static imports (chunks), har file ek dafa.
 * Islands (<astro-island component-url/renderer-url>) bhi isi se gine jate hain.
 */
function jsGraph(entryUrls) {
  const seen = new Set();
  const stack = [...entryUrls].map((u) => u.split('?')[0]);
  let total = 0;
  while (stack.length) {
    const url = stack.pop();
    if (seen.has(url)) continue;
    seen.add(url);
    const p = join(DIST, url.replace(/^\//, ''));
    if (!existsSync(p)) continue;
    const src = readFileSync(p);
    total += gz(src);
    const dir = url.slice(0, url.lastIndexOf('/') + 1);
    for (const m of src.toString('utf8').matchAll(/(?:import|from)\s*["'](\.{1,2}\/[^"']+\.js)["']/g)) {
      const resolved = new URL(m[1], 'http://x' + dir).pathname;
      stack.push(resolved);
    }
  }
  return total;
}

const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html'));
if (!htmlFiles.length) {
  console.error('dist/ mein koi HTML nahin. Pehle `npm run build` chalayein.');
  process.exit(1);
}

let failed = false;
const rows = [];
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const route = '/' + relative(DIST, file).split(sep).join('/').replace(/index\.html$/, '').replace(/\.html$/, '');
  let js = 0;
  let css = 0;
  const entries = [
    ...[...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/\b(?:component-url|renderer-url|before-hydration-url)="([^"]+)"/g)].map((m) => m[1]),
  ].filter((u) => u.startsWith('/'));
  js += jsGraph(entries);
  for (const m of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"|<link[^>]*href="([^"]+)"[^>]*rel="stylesheet"/g))
    css += assetSize(m[1] ?? m[2]);
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) if (m[1].trim()) js += gz(Buffer.from(m[1]));
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) css += gz(Buffer.from(m[1]));

  const jsBudget = route.startsWith('/admin')
    ? BUDGET.adminJs
    : /^\/(daily-test|mcqs\/|mock-tests\/)/.test(route)
      ? BUDGET.islandJs
      : BUDGET.homeJs;
  const ok = js <= jsBudget && css <= BUDGET.css;
  if (!ok) failed = true;
  rows.push({ route: route || '/', js: fmt(js), jsBudget: fmt(jsBudget), css: fmt(css), cssBudget: fmt(BUDGET.css), ok: ok ? 'OK' : 'FAIL' });
}

console.log('Bundle report (gzip), spec 9.1');
console.table(rows);
if (failed) {
  console.error('Budget se zyada! spec 9.1 dekhein.');
  process.exit(1);
}
console.log('Sab pages budget ke andar.');
