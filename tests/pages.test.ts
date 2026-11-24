// spec: F21-AC1 (ek H1, seo.json ka title), F21-AC8 (300+ alfaz, 3+ andaruni links), F22-AC3 / intent 13, 15.3 (ad kahan nahin)
// Build ke baad chalta hai (npm run verify: build → test). dist na ho to skip.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

  it.each(['9th', '10th', '11th', '12th'].filter((c) => built.includes(`/board/${c}`)))('/board/%s: class pehle se chuni (preset)', (c) => {
    const h = html(`/board/${c}`);
    expect(h).toMatch(new RegExp(`<input type="hidden" name="className" value="${c}"`));
    expect(h).not.toMatch(/<select[^>]*name="className"/);
  });

  it.runIf(built.includes('/vu'))('/vu: course code ka khana sirf ek (shared), 4 packs', () => {
    const h = html('/vu');
    expect((h.match(/name="courseCode"/g) ?? []).length).toBe(1);
    expect((h.match(/data-add-to-cart="vu-/g) ?? []).length).toBe(4);
  });

  // 17b Lighthouse (A 96): scroll wala table keyboard se pohanch mein; saade span par aria-label nahin
  it('har built page: saade <span> par aria-label nahin (aria-prohibited-attr)', () => {
    for (const r of built) expect(html(r), r).not.toMatch(/<span(?![^>]*\brole=)[^>]*\baria-label=/);
  });
  it.runIf(built.includes('/vu'))('/vu: muqable ki table ka scroll dabba focus ho sakta hai', () => {
    expect(html('/vu')).toMatch(/<div class="[^"]*\boverflow-x-auto\b[^"]*"[^>]*role="region"[^>]*aria-label="[^"]+"[^>]*tabindex="0"/);
    // 18b: andar ke sr-only (absolute) alfaz dabbe mein rahen — warna page 509px chaura (phone par side scroll)
    expect(html('/vu')).toMatch(/<div class="relative [^"]*\boverflow-x-auto\b[^"]*"[^>]*role="region"/);
  });
  // 17b Lighthouse (link-in-text-block): matn ke beech saade links par lakeer (built CSS mein qaida)
  it.runIf(existsSync(join(process.cwd(), 'dist/client/_astro')))('built CSS: :where(p,li,dd,td) a:not([class]) par underline', () => {
    const dir = join(process.cwd(), 'dist/client/_astro');
    const css = readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    expect(css).toMatch(/:where\(p,\s*li,\s*dd,\s*td\)\s*a:not\(\[class\]\)\s*\{[^}]*text-decoration:\s*underline/);
  });
  // 17b Lighthouse (A 97, landmark-unique): ek hi naam ke do region nahin (section aria-labelledby bhi region hai)
  it('har built page: region/landmark ke naam dohraye nahin', () => {
    for (const r of built) {
      const h = html(r);
      const names = [
        ...[...h.matchAll(/<section[^>]*aria-labelledby="([^"]+)"/g)].map((m) => 'ref:' + m[1]),
        ...[...h.matchAll(/role="region"[^>]*aria-labelledby="([^"]+)"/g)].map((m) => 'ref:' + m[1]),
        ...[...h.matchAll(/role="region"[^>]*aria-label="([^"]+)"/g)].map((m) => 'label:' + m[1]),
      ];
      expect(names.filter((n, i) => names.indexOf(n) !== i), r).toEqual([]);
    }
  });

  it('board class pages ek jaise nahin (intent 14.4): alfaz ka mel 70% se kam', () => {
    const cls = ['/board/9th', '/board/10th', '/board/11th', '/board/12th'].filter((r) => built.includes(r));
    const bag = (r: string) => {
      const m = mainOf(html(r)).match(/<section[^>]*aria-labelledby="paper-heading"[\s\S]*?<\/section>/)?.[0] ?? '';
      return new Set(decode(m.replace(/<[^>]+>/g, ' ')).toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    };
    for (let i = 0; i < cls.length; i++)
      for (let j = i + 1; j < cls.length; j++) {
        const a = bag(cls[i]);
        const b = bag(cls[j]);
        const inter = [...a].filter((w) => b.has(w)).length;
        const jaccard = inter / (a.size + b.size - inter);
        expect(jaccard, `${cls[i]} vs ${cls[j]}`).toBeLessThan(0.7);
      }
  });

  it('ek screen par 2 se zyada ad nahin (page par max 3 slots, intent 15.3)', () => {
    for (const r of built) expect((html(r).match(/data-ad-slot=/g) ?? []).length, r).toBeLessThanOrEqual(3);
  });
});

// spec: F06-AC9 (/track noindex, ad nahin), F21-AC3 (noindex pages)
describe('/track (F06-AC9)', () => {
  it.skipIf(!built.includes('/track'))('noindex hai aur koi ishtihar nahin', () => {
    const h = html('/track');
    expect(h).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    expect(h).not.toMatch(/data-ad-slot=/);
  });
  it.skipIf(!built.includes('/'))('doosre pages index hote hain (noindex nahin)', () => {
    expect(html('/')).not.toMatch(/name="robots"/);
  });
});

// spec: S28 /my-history, F17-AC1, F17-AC3 (hadein saaf likhi hon), F21-AC3 (noindex)
describe('/my-history (F17)', () => {
  it.skipIf(!built.includes('/my-history'))('noindex, ad nahin, hadein ka dabba, history island', () => {
    const h = html('/my-history');
    expect(h).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    expect(h).not.toMatch(/data-ad-slot=/);
    const limits = decode(h.match(/<section[^>]*data-limits[\s\S]*?<\/section>/)?.[0] ?? '');
    expect(limits).toMatch(/Phone ya browser badlein/);
    expect(limits).toMatch(/data saaf karne/);
    expect(limits).toMatch(/Incognito/);
    expect(limits).toMatch(/server par nahin/);
    expect(h).toMatch(/component-url="[^"]*MyHistory/);
  });
  it.skipIf(!built.includes('/'))('Home par "Aap ke liye" island (F01-AC3, F17-AC5)', () => {
    expect(html('/')).toMatch(/component-url="[^"]*HomeForYou/);
  });
  it.skipIf(!built.includes('/'))('Home par taza jobs island (F01-AC4, E07; Qadam 13b)', () => {
    expect(html('/')).toMatch(/component-url="[^"]*LatestJobs/);
  });
});

// spec: 6.1 AnnouncementBar (har public page par, Header se pehle), F10-AC3, F10-AC7
describe.skipIf(built.length === 0)('AnnouncementBar (F10-AC3)', () => {
  it.each(built)('%s: AnnouncementBar island Header se pehle', (r) => {
    const h = html(r);
    const bar = h.search(/component-url="[^"]*AnnouncementBar/);
    expect(bar).toBeGreaterThan(-1);
    expect(bar).toBeLessThan(h.indexOf('<header'));
  });

  // 17b Lighthouse (CLS): patti ka dhancha HTML mein (chhupa) + paint se pehle cache se bharne wala inline script
  const settingsKey = readFileSync(join(process.cwd(), 'src/lib/site-settings.ts'), 'utf8').match(/const KEY = '([^']+)'/)?.[1];
  it.each(built)('%s: patti ka dhancha + inline script Header se pehle (CLS)', (r) => {
    const h = html(r);
    const div = h.search(/<div role="note" aria-label="Elaan"[^>]*data-announcement[^>]*hidden/);
    const script = h.indexOf(`sessionStorage.getItem('${settingsKey}')`);
    expect(settingsKey).toBeTruthy();
    expect(div).toBeGreaterThan(-1);
    expect(script).toBeGreaterThan(div);
    expect(script).toBeLessThan(h.indexOf('<header'));
    // sirf textContent — HTML ke taur par kabhi nahin
    expect(h).not.toMatch(/innerHTML\s*=\s*gvsAnn/);
  });
});

// spec: F13-AC7 (test ke dauran koi ad nahin; `result` slot sirf score card ke neeche, shuru mein chhupa)
describe('/daily-test (F13-AC7)', () => {
  it.skipIf(!built.includes('/daily-test'))('sirf ek `result` ad, hidden wrapper ke andar; quiz island maujood', () => {
    const h = html('/daily-test');
    const slots = [...h.matchAll(/data-ad-slot="([a-z]+)"/g)].map((m) => m[1]);
    expect(slots).toEqual(['result']);
    expect(h).toMatch(/<div[^>]*data-result-ad[^>]*hidden|<div[^>]*hidden[^>]*data-result-ad/);
    expect(h).toMatch(/component-url="[^"]*DailyTest/);
  });
});

// spec: Qadam 14 (11: "saari pages 404 ke baghair"), F25-AC1..AC5 (static/qanooni pages), F02-AC1 (refund link har paid page par)
describe.skipIf(built.length === 0)('Qadam 14: static pages (F25, F02-AC1)', () => {
  const src = (r: string) => {
    const base = join(process.cwd(), 'src', 'pages', r === '/' ? 'index' : r.slice(1));
    return [`${base}.astro`, join(base, 'index.astro')].find((p) => existsSync(p));
  };
  // Manifest ke static routes jin ka page on-demand nahin (prerender = false wale dist mein nahin hote)
  const prerendered = Object.keys(pages).filter((r) => {
    const f = src(r);
    return !f || !/export const prerender = false/.test(readFileSync(f, 'utf8'));
  });
  const LEGAL = ['/how-to-order', '/about', '/contact', '/privacy', '/terms', '/404'];

  it('spec ke har static (prerendered) PAGE ki file src mein bhi hai aur dist mein bhi', () => {
    for (const r of prerendered) {
      expect(src(r), `src: ${r}`).toBeTruthy();
      expect(existsSync(file(r)), `dist: ${r}`).toBe(true);
    }
  });

  it.each(LEGAL)('%s: "GVS niji academy hai, sarkari idara nahin" (F25-AC1), ad nahin (F25-AC5)', (r) => {
    const h = html(r);
    expect(decode(mainOf(h).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ')).toContain('GVS niji academy hai, sarkari idara nahin');
    expect(h).not.toMatch(/data-ad-slot/);
  });

  it('/privacy: ads, cookies, analytics aur localStorage ka zikr (F25-AC2)', () => {
    const t = decode(mainOf(html('/privacy')).replace(/<[^>]+>/g, ' ')).toLowerCase();
    for (const w of ['ishtihar', 'adsense', 'cookies', 'analytics', 'localstorage']) expect(t, w).toContain(w);
  });

  it('/terms#refund: intent 9.10 ki 5 sharait (F25-AC3)', () => {
    const h = html('/terms');
    const box = h.match(/<section[^>]*id="refund"[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(box).not.toBe('');
    expect((box.match(/<li/g) ?? []).length).toBe(5);
    const t = decode(box.replace(/<[^>]+>/g, ' '));
    for (const w of ['poori raqam wapas', 'sahih file muft', '24 ghante', 'refund nahin', 'Sarkari fee']) expect(t).toContain(w);
  });

  it('/how-to-order: 4 qadam, payment, refund link, HowTo JSON-LD (F25-AC4)', () => {
    const h = html('/how-to-order');
    expect((mainOf(h).match(/<li id="qadam-\d"/g) ?? []).length).toBe(4);
    expect(h).toMatch(/JazzCash/);
    expect(h).toMatch(/href="\/terms#refund"/);
    const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '{}') as { '@type'?: string; step?: { name: string }[] };
    expect(ld['@type']).toBe('HowTo');
    expect(ld.step?.map((s) => s.name)).toEqual(['Cheez chunein', 'Naam aur number dein', 'WhatsApp par bhejein', 'Payment aur delivery']);
  });

  // 17c owner ka faisla (a): namoone launch ke baad; tab tak "WhatsApp par maang lein" (usool 7: wada wohi jo pura ho)
  it('17c: catalog mein namoona na ho to kisi page par "namoona dekhein" ka wada nahin', async () => {
    const { default: catalog } = await import('../src/data/catalog.json');
    const anySample = (catalog as { products: { sample: string | null }[] }).products.some((p) => p.sample);
    if (anySample) return; // namoone lag gaye: ProductCard ka "Namoona dekhein" button sahih hai
    for (const r of built) {
      const t = decode(html(r).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' '));
      expect(t, r).not.toMatch(/namoona (pehle |zaroor )?dekh/i);
    }
  });

  it('/404: darwazon ke links, noindex', () => {
    const h = html('/404');
    for (const href of ['/job-prep', '/vu', '/board', '/career']) expect(h).toContain(`href="${href}"`);
    expect(h).toMatch(/<meta name="robots" content="noindex/);
  });

  it('/contact: WhatsApp link (Settings se taza hone wala)', () => {
    expect(html('/contact')).toMatch(/<a[^>]*href="https:\/\/wa\.me\/92\d{10}"[^>]*data-whatsapp-number/);
  });

  it.each(built.filter((r) => /data-add-to-cart=/.test(html(r))))('%s: paid page par refund policy ka link (F02-AC1)', (r) => {
    expect(html(r)).toMatch(/href="\/terms#refund"/);
  });
});
