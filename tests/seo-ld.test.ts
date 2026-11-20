// spec: F21-AC4 (robots: /admin, /api band + sitemap link), F21-AC5 (JSON-LD intent 13 ki table ke mutabiq), F21-AC6 (OG/Twitter, 1200x630),
//       9.4 (share image ≤ 100 KB). Build ke baad chalta hai (dist/client); dist na ho to skip.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import seo from '../src/data/seo.json';
import { getProduct } from '../src/lib/catalog';

const DIST = join(process.cwd(), 'dist', 'client');
const pages = seo.pages as Record<string, { title: string; description: string }>;
const file = (r: string) => join(DIST, r === '/' ? 'index.html' : r === '/404' ? '404.html' : `${r.slice(1)}/index.html`);
const built = Object.keys(pages).filter((r) => existsSync(file(r)));
const html = (r: string) => readFileSync(file(r), 'utf8');
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const meta = (h: string, attr: 'property' | 'name', key: string) => decode(h.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1] ?? '');

type Node = { '@type': string; [k: string]: unknown };
function ld(h: string): Node[] {
  return [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const d = JSON.parse(m[1]) as Node | Node[];
    return Array.isArray(d) ? d : [d];
  });
}

// intent 13 ki table (static/prerendered pages). Jo page yahan nahin us par JSON-LD nahin.
const EXPECTED: Record<string, string[]> = {
  '/': ['EducationalOrganization', 'WebSite'],
  '/apply-service': ['Service', 'FAQPage'],
  '/vu': ['Product', 'FAQPage'],
  '/past-papers': ['Product'],
  '/current-affairs': ['Product'],
  '/mock-series': ['Product'],
  '/board/9th': ['Product'],
  '/board/10th': ['Product'],
  '/board/11th': ['Product'],
  '/board/12th': ['Product'],
  '/career': ['Service'],
  '/career/cv': ['Service'],
  '/how-to-order': ['HowTo'],
};

describe.skipIf(built.length === 0)('JSON-LD (F21-AC5, intent 13)', () => {
  it.each(built)('%s: types intent 13 ki table ke mutabiq, har ek mein @context', (r) => {
    const nodes = ld(html(r));
    expect(nodes.map((n) => n['@type']).sort(), r).toEqual([...(EXPECTED[r] ?? [])].sort());
    for (const n of nodes) expect(n['@context']).toBe('https://schema.org');
  });

  it.each(built.filter((r) => (EXPECTED[r] ?? []).includes('FAQPage')))('%s: FAQPage ke sawal wohi jo page par dikhte hain', (r) => {
    const h = html(r);
    const faq = ld(h).find((n) => n['@type'] === 'FAQPage') as unknown as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    const visible = [...h.matchAll(/<summary[^>]*>\s*<span>([\s\S]*?)<\/span>/g)].map((m) => decode(m[1]).trim());
    expect(faq.mainEntity.map((q) => q.name)).toEqual(visible);
    for (const q of faq.mainEntity) expect(q.acceptedAnswer.text.length).toBeGreaterThan(10);
  });

  it.each(built.filter((r) => (EXPECTED[r] ?? []).some((t) => t === 'Product' || t === 'Service')))('%s: Offer ki qeemat catalog se (PKR), koi rating nahin', (r) => {
    const nodes = ld(html(r)).filter((n) => n['@type'] === 'Product' || n['@type'] === 'Service');
    const s = JSON.stringify(nodes);
    expect(s).not.toMatch(/aggregateRating|"review"/);
    const offers = nodes.flatMap((n) => (n.offers ? ([] as { name: string; price: string; priceCurrency: string }[]).concat(n.offers as never) : []));
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      expect(o.priceCurrency).toBe('PKR');
      const p = getProductByName(o.name);
      expect(p?.price, o.name).toBe(Number(o.price));
    }
  });

  it.runIf(built.includes('/vu'))('/vu: 4 packs ke 4 offers', () => {
    const p = ld(html('/vu')).find((n) => n['@type'] === 'Product') as unknown as { offers: unknown[] };
    expect(p.offers).toHaveLength(4);
  });
});

function getProductByName(name: string) {
  for (const id of ['mcq-pack', 'past-papers', 'current-affairs', 'mock-series', 'vu-quick', 'vu-smart', 'vu-complete', 'vu-topper', 'board-paper', 'cv-cover', 'job-apply', 'scheme-help', 'interview-prep']) {
    const p = getProduct(id);
    if (p?.name === name) return p;
  }
  return undefined;
}

describe.skipIf(built.length === 0)('Open Graph / Twitter (F21-AC6)', () => {
  it.each(built)('%s: og + twitter tags, title/description page jaise, tasveer poora URL', (r) => {
    const h = html(r);
    expect(meta(h, 'property', 'og:title')).toBe(pages[r].title);
    expect(meta(h, 'property', 'og:description')).toBe(pages[r].description);
    expect(meta(h, 'property', 'og:url')).toBe(decode(h.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? 'x'));
    expect(meta(h, 'property', 'og:image')).toMatch(/^https?:\/\/[^/]+\/images\/og\.png$/);
    expect(meta(h, 'property', 'og:image:width')).toBe('1200');
    expect(meta(h, 'property', 'og:image:height')).toBe('630');
    expect(meta(h, 'name', 'twitter:card')).toBe('summary_large_image');
    expect(meta(h, 'name', 'twitter:image')).toBe(meta(h, 'property', 'og:image'));
  });

  it('og.png: PNG, 1200x630, ≤ 100 KB (9.4)', () => {
    const p = join(process.cwd(), 'public', 'images', 'og.png');
    const b = readFileSync(p);
    expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(b.readUInt32BE(16)).toBe(1200);
    expect(b.readUInt32BE(20)).toBe(630);
    expect(statSync(p).size).toBeLessThanOrEqual(100 * 1024);
  });
});

describe.skipIf(!existsSync(join(DIST, 'robots.txt')))('robots.txt (F21-AC4)', () => {
  it('/admin aur /api band, sitemap ka poora link ek dafa', () => {
    const t = readFileSync(join(DIST, 'robots.txt'), 'utf8');
    expect(t).toMatch(/^Disallow: \/admin$/m);
    expect(t).toMatch(/^Disallow: \/api\/$/m);
    expect(t.match(/^Sitemap: https?:\/\/[^\s]+\/sitemap\.xml$/gm)).toHaveLength(1);
  });
});
