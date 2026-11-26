// spec: 10.x `no-pii-analytics.test.ts` (events mein naam/phone/order number nahin), F23-AC1 (intent 18 ke saare events, sirf analytics.ts se),
//       F23-AC2, F23-AC4 + FL-08 (/track ka query page_location mein nahin), qaida 11
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EVENT_NAMES, cleanLocation, cleanParams, track, _queued, initAnalytics, metaEvent, _metaQueued, initMetaPixel } from '../src/lib/analytics';

// intent 18 ki table
const INTENT_18 = [
  'view_product',
  'add_to_cart',
  'open_order_form',
  'order_created',
  'whatsapp_opened',
  'track_view',
  'daily_test_start',
  'daily_test_complete',
  'practice_set_complete',
  'mock_start',
  'mock_submit',
  'share_click',
  'job_view',
  'job_apply_click',
  'house_ad_click',
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|astro)$/.test(p) ? [p] : [];
  });
}
const SRC = walk(join(process.cwd(), 'src'));
/** src mein har `track('x', {...})` call (analytics.ts ke ilawa) */
const calls = SRC.filter((f) => !f.endsWith(join('lib', 'analytics.ts'))).flatMap((f) =>
  [...readFileSync(f, 'utf8').matchAll(/\btrack\(\s*'([a-z_]+)'\s*,\s*(\{[^}]*\})/g)].map((m) => ({ file: f, name: m[1], params: m[2] })),
);

describe('no-pii-analytics (F23-AC2)', () => {
  it('PII keys rad: name, phone, whatsapp, order, amount, price, total, cnic, email, last4', () => {
    expect(cleanParams({ name: 'Ali', customer_name: 'x', phone: '03001234567', whatsapp: 'x', order_id: 'x', orderId: 'x', amount: 350, price: 1, total: 2, cnic: 'x', email: 'a@b.c', last4: '4567', items: 2 })).toEqual({ items: 2 });
  });

  it('PII jaisi values kisi bhi key mein rad (phone, +92, order number, CNIC); lambi value rad', () => {
    for (const v of ['03001234567', '0300-1234567', '+923001234567', '923001234567', 'GVS-2611-0001', 'mera order gvs-2611-0042 hai', '35202-1234567-1', 'x'.repeat(101)]) {
      expect(cleanParams({ where: v }), v).toEqual({});
    }
    expect(cleanParams({ where: 'daily-test', ad: 'vu-packs', status: 'paid', org: 'PPSC', n: 3, ok: true })).toEqual({ where: 'daily-test', ad: 'vu-packs', status: 'paid', org: 'PPSC', n: 3, ok: true });
  });

  it('track() bhi wahi safai karta hai; anjaan event nahin jata', () => {
    track('order_created', { items: 2, id: 'GVS-2611-0009', amount: 700 } as never);
    expect(_queued().at(-1)).toEqual({ name: 'order_created', params: { items: 2 } });
    const n = _queued().length;
    track('user_login' as never, {} as never);
    expect(_queued()).toHaveLength(n);
  });

  it('F23-AC4: /track ka poora query hata; doosre pages se sirf id/last4/phone; hash bhi', () => {
    expect(cleanLocation('https://gvs.pk/track?id=GVS-2611-0001&last4=4567')).toBe('https://gvs.pk/track');
    expect(cleanLocation('https://gvs.pk/track/?id=GVS-2611-0001')).toBe('https://gvs.pk/track/');
    expect(cleanLocation('https://gvs.pk/jobs?idara=PPSC')).toBe('https://gvs.pk/jobs?idara=PPSC');
    expect(cleanLocation('https://gvs.pk/my-history?id=GVS-2611-0001&x=1#orders')).toBe('https://gvs.pk/my-history?x=1');
    expect(cleanLocation('kharab')).toBe('');
  });

  it('GA ID ghalat/khali ho to kuch shuru nahin hota (server par bhi)', () => {
    expect(() => initAnalytics('')).not.toThrow();
    expect(() => initAnalytics('UA-123')).not.toThrow();
  });
});

describe('events ki fehrist (F23-AC1)', () => {
  it('analytics.ts mein intent 18 ke saare 15 events, aur sirf wohi', () => {
    expect([...EVENT_NAMES].sort()).toEqual([...INTENT_18].sort());
  });

  it('src mein har track() call sirf intent 18 ka event bhejta hai, PII key ke baghair', () => {
    expect(calls.length).toBeGreaterThanOrEqual(12);
    for (const c of calls) {
      expect(INTENT_18, c.file).toContain(c.name);
      const keys = [...c.params.matchAll(/([A-Za-z_]+)\s*:/g)].map((m) => m[1]);
      for (const k of keys) expect(k, `${c.file}: ${c.name}.${k}`).not.toMatch(/name|phone|whatsapp|order|amount|price|total|cnic|email|last4/i);
      expect(c.params, c.file).not.toMatch(/data\.id|\.last4|phone|\bname\b|price|amount/);
    }
  });

  it('har event (auto ke ilawa) src mein kahin se chalta hai', () => {
    const fired = new Set(calls.map((c) => c.name));
    // view_product, job_view, share_click, house_ad_click analytics.ts ka autoEvents() bhejta hai
    for (const e of INTENT_18.filter((x) => !['view_product', 'job_view', 'share_click', 'house_ad_click'].includes(x))) expect(fired, e).toContain(e);
    const a = readFileSync(join(process.cwd(), 'src', 'lib', 'analytics.ts'), 'utf8');
    for (const e of ['view_product', 'job_view', 'share_click', 'house_ad_click']) expect(a).toMatch(new RegExp(`track\\('${e}'`));
  });

  it('analytics ka script sirf analytics.ts mein (googletagmanager kahin aur nahin)', () => {
    const hits = SRC.filter((f) => readFileSync(f, 'utf8').includes('googletagmanager'));
    expect(hits.map((f) => f.replace(process.cwd(), ''))).toEqual([join('', 'src', 'lib', 'analytics.ts').replace(/^/, process.platform === 'win32' ? '\\' : '/')]);
  });
});

describe('Meta Pixel (F23-AC5)', () => {
  it('sirf 5 standard events, sirf ginti aur catalog ids', () => {
    expect(metaEvent('view_product', { products: 'vu-quick,mcq-pack' })).toEqual(['ViewContent', { content_type: 'product', content_ids: ['vu-quick', 'mcq-pack'] }]);
    expect(metaEvent('job_view', { org: 'PPSC' })).toEqual(['ViewContent', { content_type: 'job', content_category: 'PPSC' }]);
    expect(metaEvent('add_to_cart', { product: 'cv-cover', source: 'card' })).toEqual(['AddToCart', { content_type: 'product', content_ids: ['cv-cover'] }]);
    expect(metaEvent('open_order_form', { items: 2 })).toEqual(['InitiateCheckout', { num_items: 2 }]);
    expect(metaEvent('order_created', { items: 3 })).toEqual(['Lead', { num_items: 3 }]);
    for (const e of EVENT_NAMES.filter((x) => !['view_product', 'job_view', 'add_to_cart', 'open_order_form', 'order_created'].includes(x))) {
      expect(metaEvent(e, {}), e).toBeNull();
    }
  });

  it('Lead mein raqam/order number/naam/phone nahin, chahe ghalti se bheje jayen', () => {
    track('order_created', { items: 1, id: 'GVS-2611-0009', amount: 700, name: 'Ali', phone: '03001234567' } as never);
    const last = _metaQueued().at(-1)!;
    expect(last).toEqual(['Lead', { num_items: 1 }]);
    expect(JSON.stringify(_metaQueued())).not.toMatch(/GVS-|0300|Ali|700/);
  });

  it('ajeeb product id (khali jagah, phone jaisa) Meta ko nahin jata', () => {
    expect(metaEvent('add_to_cart', { product: '03001234567 x' })).toBeNull();
    expect(metaEvent('view_product', { products: 'A B,<x>' })).toBeNull();
  });

  it('ID khali/ghalat ho to kuch shuru nahin hota (server par bhi)', () => {
    expect(() => initMetaPixel('')).not.toThrow();
    expect(() => initMetaPixel('abc')).not.toThrow();
  });

  it('fbevents script sirf analytics.ts mein; Base admin aur /track par pixel nahin chalata', () => {
    const hits = SRC.filter((f) => /connect\.facebook\.net|fbevents/.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => f.split(/[\\/]/).slice(-2).join('/'))).toEqual(['lib/analytics.ts']);
    const base = readFileSync(join(process.cwd(), 'src', 'layouts', 'Base.astro'), 'utf8');
    expect(base).toMatch(/startsWith\('\/admin'\)\)\s*\{[\s\S]*!== '\/track'\) initMetaPixel\(PUBLIC_META_PIXEL_ID\)/);
    const a = readFileSync(join(process.cwd(), 'src', 'lib', 'analytics.ts'), 'utf8');
    expect(a).toContain("fbq('set', 'autoConfig', false, id)");
  });

  it('/track par referrer sirf origin; privacy par Meta ka zikr', () => {
    expect(readFileSync(join(process.cwd(), 'src', 'pages', 'track.astro'), 'utf8')).toMatch(/name="referrer" content="origin"/);
    expect(readFileSync(join(process.cwd(), 'src', 'pages', 'privacy.astro'), 'utf8')).toMatch(/Meta Pixel/);
  });
});
