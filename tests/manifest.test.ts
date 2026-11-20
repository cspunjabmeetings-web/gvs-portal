// spec: F26-AC1 (manifest.webmanifest aur icons; "Home screen par rakhein"), F26-AC2 (service worker NAHIN — FU-02), intent 11.5
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import seo from '../src/data/seo.json';

const ROOT = process.cwd();
const PUB = join(ROOT, 'public');
const manifest = JSON.parse(readFileSync(join(PUB, 'manifest.webmanifest'), 'utf8')) as {
  id: string;
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  lang: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
};
const png = (src: string) => {
  const b = readFileSync(join(PUB, src));
  return { sig: b.subarray(1, 4).toString('ascii'), w: b.readUInt32BE(16), h: b.readUInt32BE(20), kb: b.length / 1024 };
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('manifest.webmanifest (F26-AC1)', () => {
  it('zaroori fields: naam, start_url /, standalone, design.md ke rang, lang en', () => {
    expect(manifest).toMatchObject({ id: '/', name: 'GVS Academy', short_name: 'GVS', start_url: '/', scope: '/', display: 'standalone', theme_color: '#0F5132', background_color: '#F7F8F4', lang: 'en' });
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it('icons: 192 + 512 (any) aur 512 maskable; har file asal PNG, sahih naap, ≤ 50 KB', () => {
    const want = [
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ];
    for (const [sizes, purpose] of want) {
      const i = manifest.icons.find((x) => x.sizes === sizes && x.purpose === purpose);
      expect(i, `${sizes} ${purpose}`).toBeTruthy();
      expect(i!.type).toBe('image/png');
      const f = png(i!.src);
      expect(f.sig).toBe('PNG');
      expect(`${f.w}x${f.h}`).toBe(sizes);
      expect(f.kb).toBeLessThanOrEqual(50);
    }
    const a = png('/images/apple-touch-icon.png');
    expect([a.sig, a.w, a.h]).toEqual(['PNG', 180, 180]);
  });
});

const DIST = join(ROOT, 'dist', 'client');
const file = (r: string) => join(DIST, r === '/' ? 'index.html' : r === '/404' ? '404.html' : `${r.slice(1)}/index.html`);
const built = Object.keys(seo.pages).filter((r) => existsSync(file(r)));

describe.skipIf(built.length === 0)('har page par manifest (F26-AC1)', () => {
  it.each(built)('%s: manifest + apple-touch-icon link', (r) => {
    const h = readFileSync(file(r), 'utf8');
    expect(h).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    expect(h).toContain('<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">');
  });

  it.runIf(built.includes('/'))('Footer mein "Home screen par rakhein" (bina JS bhi <details>)', () => {
    const h = readFileSync(file('/'), 'utf8');
    expect(h).toMatch(/component-url="[^"]*InstallHint/);
    expect(h).toContain('Home screen par kaise rakhein?');
  });
});

describe('service worker nahin (F26-AC2, FU-02)', () => {
  it('src aur public mein koi service worker register/file nahin', () => {
    const files = [...walk(join(ROOT, 'src')), ...walk(PUB)];
    expect(files.filter((f) => /(^|[\\/])(sw|service-worker)\.(js|ts)$/.test(f))).toEqual([]);
    for (const f of files.filter((x) => /\.(ts|tsx|astro|js|mjs)$/.test(x))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/serviceWorker\.register|navigator\.serviceWorker/);
    }
  });
});
