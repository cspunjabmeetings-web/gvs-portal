// spec: F21-AC1 (ek H1, seo.json ka title), F21-AC8 (300+ alfaz, 3+ andaruni links), F22-AC3 / intent 13, 15.3 (ad kahan nahin)
// Build ke baad chalta hai (npm run verify: build → test). dist na ho to skip.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import seo from '../src/data/seo.json';

const DIST = join(process.cwd(), 'dist', 'client');
const pages = seo.pages as Record<string, { title: string; description: string }>;

function file(route: string) {
  return join(DIST, route === '/' ? 'index.html' : route === '/404' ? '404.html' : `${route.slice(1)}/index.html`);
}
const built = Object.keys(pages).filter((r) => existsSync(file(r)));
const html = (r: string) => readFileSync(file(r), 'utf8');
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function mainOf(h: string) {
  return h.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
}
/** <main> ke alfaz, FAQ aur ishtihar ke baghair (intent 14.2: "FAQ ke ilawa") */
function words(h: string) {
  const m = mainOf(h)
    .replace(/<section[^>]*aria-labelledby="faq-heading"[\s\S]*?<\/section>/g, '')
    .replace(/<aside[^>]*data-ad-slot[\s\S]*?<\/aside>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ');
  return decode(m).split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
}

// Intent 13 ("Ad: Nahin") + 15.3
const NO_ADS = ['/apply-service', '/mock-series', '/career/cv', '/plans', '/track', '/how-to-order', '/about', '/contact', '/privacy', '/terms', '/my-history', '/admin', '/404'];
// Static SEO pages jin par 300+ asal alfaz (F21-AC8, F01-AC8)
const SEO_300 = ['/', '/job-prep', '/vu', '/board', '/board/9th', '/board/10th', '/board/11th', '/board/12th', '/career', '/career/cv', '/apply-service', '/sarkari-services', '/plans', '/past-papers', '/current-affairs', '/mock-series'];

describe.skipIf(built.length === 0)('bane hue pages (dist)', () => {
  it.each(built)('%s: ek H1, seo.json ka title aur description', (r) => {
    const h = html(r);
    expect((h.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    expect(decode(h.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')).toBe(pages[r].title);
    expect(decode(h.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '')).toBe(pages[r].description);
  });

  it.each(built.filter((r) => NO_ADS.includes(r)))('%s: koi ishtihar nahin', (r) => {
    expect(html(r)).not.toMatch(/data-ad-slot/);
  });

  it.each(built.filter((r) => SEO_300.includes(r)))('%s: 300+ alfaz aur 3+ andaruni links', (r) => {
    const h = html(r);
    expect(words(h)).toBeGreaterThanOrEqual(300);
    const internal = new Set([...mainOf(h).matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]).filter((u) => u !== r));
    expect(internal.size).toBeGreaterThanOrEqual(3);
  });

  it('ek screen par 2 se zyada ad nahin (page par max 3 slots, intent 15.3)', () => {
    for (const r of built) expect((html(r).match(/data-ad-slot=/g) ?? []).length, r).toBeLessThanOrEqual(3);
  });
});
