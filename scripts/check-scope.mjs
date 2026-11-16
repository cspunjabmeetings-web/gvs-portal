// spec: 13.6 (check:scope), FL-09
// spec.md ke ROUTES / API / DEPS / TABLES manifests ko code se milata hai.
// Usage: node scripts/check-scope.mjs [projectRoot]
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2] ?? join(fileURLToPath(new URL('.', import.meta.url)), '..');
// Manifest hamesha asal spec.md se (fixture root ho to bhi wohi spec)
const specPath = existsSync(join(root, 'spec.md'))
  ? join(root, 'spec.md')
  : join(fileURLToPath(new URL('.', import.meta.url)), '..', 'spec.md');

/** spec.md ka ek manifest block (ROUTES/API/DEPS/TABLES) lines ki shakal mein */
export function readManifest(name) {
  return block(readFileSync(specPath, 'utf8'), name);
}

function block(spec, name) {
  const m = spec.match(new RegExp(`<!-- ${name}:BEGIN -->([\\s\\S]*?)<!-- ${name}:END -->`));
  if (!m) throw new Error(`spec.md mein ${name} block nahin mila`);
  return m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('```'));
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const PAGE_EXT = /\.(astro|md|mdx|html)$/;
const ENDPOINT_EXT = /\.(ts|js|mjs)$/;

/** src/pages ki file ko route mein badalta hai: index.astro -> /, [id].ts -> /[id] */
export function fileToRoute(rel) {
  let r = '/' + rel.split(sep).join('/');
  r = r.replace(PAGE_EXT, '').replace(ENDPOINT_EXT, '');
  r = r.replace(/\/index$/, '') || '/';
  return r;
}

export function checkScope(projectRoot) {
  const spec = readFileSync(specPath, 'utf8');
  const errors = [];

  // 1. Routes
  const pages = new Set(block(spec, 'ROUTES').filter((l) => l.startsWith('PAGE ')).map((l) => l.slice(5).trim()));
  const endpoints = new Set([
    ...block(spec, 'ROUTES').filter((l) => l.startsWith('ENDPOINT ')).map((l) => l.slice(9).trim()),
    ...block(spec, 'API').map((l) => l.split(/\s+/)[2]),
  ]);
  const pagesDir = join(projectRoot, 'src', 'pages');
  for (const file of walk(pagesDir)) {
    const rel = relative(pagesDir, file);
    if (rel.split(sep).some((s) => s.startsWith('_'))) continue; // Astro: _ wali files route nahin
    const route = fileToRoute(rel);
    if (PAGE_EXT.test(file)) {
      if (!pages.has(route)) errors.push(`Route manifest se bahar page: ${route} (${rel})`);
    } else if (ENDPOINT_EXT.test(file)) {
      if (!endpoints.has(route)) errors.push(`API manifest se bahar endpoint: ${route} (${rel})`);
    }
  }

  // 2. Dependencies
  const allowed = new Set(block(spec, 'DEPS'));
  const pkgPath = join(projectRoot, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [dep, spec] of Object.entries(pkg[key] ?? {})) {
        // Alias ("rollup": "npm:@rollup/wasm-node@x") ho to asal package ka naam jaancho
        const alias = typeof spec === 'string' && spec.match(/^npm:((?:@[^/]+\/)?[^@]+)@/);
        const real = alias ? alias[1] : dep;
        if (!allowed.has(real)) errors.push(`Allowlist se bahar dependency: ${real} (${key})`);
      }
    }
  }

  // 3. Tables
  const tables = new Set(block(spec, 'TABLES'));
  for (const file of walk(join(projectRoot, 'migrations')).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(file, 'utf8');
    for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/gi)) {
      if (!tables.has(m[1])) errors.push(`Anjan table: ${m[1]} (${relative(projectRoot, file)})`);
    }
  }

  return errors;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const errors = checkScope(root);
  if (errors.length) {
    console.error('check:scope FAIL');
    for (const e of errors) console.error('  - ' + e);
    console.error('Nayi cheez ke liye CHANGE REQUEST (spec.md 13.5).');
    process.exit(1);
  }
  console.log('check:scope OK (routes, dependencies, tables sab manifest ke andar)');
}
