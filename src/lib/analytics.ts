// spec: F23-AC1 (intent 18 ke saare events, sirf analytics.ts ke zariye), F23-AC2 (naam/phone/raqam/order number kabhi nahin), F23-AC3 (GA4
//       deferred: pehli interaction ya idle ke baad; load na ho to site par asar nahin), F23-AC4 + FL-08 (/track ka query page_location mein
//       nahin), Q-02 (GA4), FX-04, F22-AC4 (house_ad_click), qaida 11. Owner ka faisla (Qadam 15b): GA4 ID abhi nahin → PUBLIC_GA_ID khali =
//       koi request nahin, events sirf queue mein (Qadam 18 mein ID).
// Browser mein chalta hai (server par import ho to kuch nahin karta).

type Value = string | number | boolean;

/** intent 18 ki table — har event ke params (TS ghalat key rokta hai) */
export interface EventParams {
  view_product: { products: string };
  add_to_cart: { product: string; source: 'card' | 'job' | 'reorder' | 'vu' };
  open_order_form: { items: number };
  order_created: { items: number };
  whatsapp_opened: { fallback: boolean };
  track_view: { status: string };
  daily_test_start: { questions: number };
  daily_test_complete: { score: number; questions: number };
  practice_set_complete: { subject: string; set: number; score: number; questions: number };
  mock_start: { mock: string; questions: number; resumed: boolean };
  mock_submit: { mock: string; score: number; questions: number; auto: boolean };
  share_click: { where: string };
  job_view: { org: string };
  job_apply_click: { org: string };
  house_ad_click: { slot: string; ad: string };
}
export type EventName = keyof EventParams;
export const EVENT_NAMES: readonly EventName[] = [
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

/** Zaati maloomat wali keys kabhi nahin */
const BLOCKED_KEY = /name|phone|mobile|whatsapp|order|amount|total|price|cnic|email|last4/i;
/** Value mein phone ya order number jaisa kuch ho to woh param hi nahin jata */
const PII_VALUE = /GVS-\d{4}-\d{3,}|(?:\+?92|0)3\d{2}[-\s]?\d{7}|\b92\d{10}\b|\d{5}-\d{7}-\d/i;

export function cleanParams(params: Record<string, unknown>): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const [k, v] of Object.entries(params)) {
    if (BLOCKED_KEY.test(k)) continue;
    if (typeof v === 'number') {
      if (Number.isFinite(v)) out[k] = v;
    } else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') {
      if (v.length > 100 || PII_VALUE.test(v)) continue;
      out[k] = v;
    }
  }
  return out;
}

/** F23-AC4: /track ka poora query, aur har page se `id`/`last4` param hata do (order number analytics mein na jaye) */
export function cleanLocation(href: string): string {
  try {
    const u = new URL(href);
    u.hash = '';
    if (u.pathname.replace(/\/+$/, '') === '/track') u.search = '';
    else for (const k of ['id', 'last4', 'phone']) u.searchParams.delete(k);
    return u.href;
  } catch {
    return '';
  }
}

type Queued = { name: EventName; params: Record<string, Value> };
const queue: Queued[] = [];
type Gtag = (...args: unknown[]) => void;
let gtag: Gtag | null = null;

export function track<N extends EventName>(name: N, params: EventParams[N]): void {
  try {
    if (!EVENT_NAMES.includes(name)) return;
    const clean = cleanParams(params as unknown as Record<string, unknown>);
    if (gtag) gtag('event', name, clean);
    else {
      queue.push({ name, params: clean });
      if (queue.length > 50) queue.shift();
    }
  } catch {
    /* analytics kabhi site na toore */
  }
}

/** Test ke liye */
export const _queued = () => queue.slice();

let started = false;

/** GA4 ko deferred shuru karo: pehli interaction ya ~4 s idle ke baad. id khali = kuch nahin (sirf queue). */
export function initAnalytics(id: string): void {
  if (started || typeof window === 'undefined' || !/^G-[A-Z0-9]{4,20}$/.test(id)) return;
  started = true;
  const w = window as unknown as { dataLayer: unknown[]; gtag?: Gtag };
  const start = () => {
    if (gtag) return;
    try {
      w.dataLayer = w.dataLayer || [];
      // gtag ka asal tareeqa: dataLayer mein `arguments` daalna
      w.gtag = function () {
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer.push(arguments);
      };
      gtag = w.gtag;
      gtag('js', new Date());
      // page_location/referrer config mein — har event inhi ko istemal karta hai (FL-08)
      gtag('config', id, { send_page_view: false, page_location: cleanLocation(location.href), page_referrer: document.referrer ? cleanLocation(document.referrer) : '' });
      gtag('event', 'page_view', {});
      for (const q of queue.splice(0)) gtag('event', q.name, q.params);
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      s.onerror = () => undefined; // F23-AC3: block/fail ho to bhi site chale
      document.head.appendChild(s);
    } catch {
      /* chup */
    }
  };
  const once = () => {
    for (const e of ['pointerdown', 'keydown', 'scroll'] as const) removeEventListener(e, once);
    start();
  };
  for (const e of ['pointerdown', 'keydown', 'scroll'] as const) addEventListener(e, once, { once: true, passive: true });
  setTimeout(start, 4000);
}

/** Page par khud chalne wale events: view_product, job_view, aur click par share_click / house_ad_click */
export function autoEvents(): void {
  try {
    const products = [...new Set([...document.querySelectorAll<HTMLElement>('[data-add-to-cart]')].map((f) => f.dataset.addToCart ?? ''))].filter(Boolean);
    if (products.length) track('view_product', { products: products.join(',').slice(0, 100) });
    const job = document.querySelector<HTMLElement>('article[data-job][data-job-org]');
    if (job) track('job_view', { org: job.dataset.jobOrg ?? '' });
    document.addEventListener(
      'click',
      (e) => {
        const t = e.target as Element | null;
        const ad = t?.closest<HTMLElement>('[data-house-ad]');
        if (ad) {
          const slot = ad.closest<HTMLElement>('[data-ad-slot]')?.dataset.adSlot ?? '';
          track('house_ad_click', { slot, ad: ad.dataset.houseAd ?? '' });
        }
        if (t?.closest('[data-share]')) track('share_click', { where: location.pathname.split('/')[1] || 'home' });
      },
      { capture: true },
    );
  } catch {
    /* chup */
  }
}
