// spec: E01, intent 12.4 ("frontend number hamesha /api/settings se; build ki value sirf fallback"),
//       F05-AC2 (number sessionStorage ke cache se, warna build fallback), F03-AC6 (orders_open),
//       F10-AC3 (elaan ki patti), F10-AC7 (naya number poori site par; admin ke browser mein foran)
// Browser mein chalta hai. 5 minute ka cache (spec ki 10 minute ki hadd se kam) taake har page par request na jaye.
import { PUBLIC_WHATSAPP_FALLBACK } from 'astro:env/client';
import { toDisplay, waLink } from './phone';

// v2: Qadam 8 mein announcement_text shamil hua
const KEY = 'gvs.settings.v2';
const OLD_KEYS = ['gvs.settings.v1'];
const TTL_MS = 5 * 60 * 1000;

export interface ClientSettings {
  whatsapp_number: string;
  orders_open: boolean;
  /** khali = patti nahin (server sirf "on" hone par matn bhejta hai) */
  announcement_text: string;
}

function read(): { at: number; s: ClientSettings } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as { at?: number; s?: ClientSettings };
    if (typeof d.at !== 'number' || typeof d.s?.whatsapp_number !== 'string') return null;
    return { at: d.at, s: { ...d.s, announcement_text: typeof d.s.announcement_text === 'string' ? d.s.announcement_text : '' } };
  } catch {
    return null;
  }
}

function apply(s: ClientSettings) {
  (globalThis as { __gvsSettings?: ClientSettings }).__gvsSettings = s;
}

/** Cache se foran (agar ho) */
export function cachedSettings(): ClientSettings | null {
  const c = read();
  if (c) apply(c.s);
  return c?.s ?? null;
}

/** WhatsApp number: cache, warna build ka fallback */
export function whatsappNumber(): string {
  return read()?.s.whatsapp_number || PUBLIC_WHATSAPP_FALLBACK;
}

/** F10-AC7: admin ne settings badli → apne browser ka cache foran khatam */
export function clearSettingsCache() {
  try {
    sessionStorage.removeItem(KEY);
    for (const k of OLD_KEYS) sessionStorage.removeItem(k);
  } catch {
    /* private mode */
  }
}

/** F10-AC7: static pages par likha number (Footer, TrustStrip: `[data-whatsapp-number]`) taza number se badlo */
export function applyNumberLinks(number: string) {
  if (!/^03\d{9}$/.test(number)) return;
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-whatsapp-number]')) {
    a.href = waLink(number);
    a.textContent = toDisplay(number);
  }
}

let inflight: Promise<ClientSettings | null> | null = null;

/** Cache purana ho to /api/settings se taza karo; nakami par jo hai wohi. Ek waqt mein ek hi request (CartBar + AnnouncementBar). */
export function refreshSettings(): Promise<ClientSettings | null> {
  inflight ??= load().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function load(): Promise<ClientSettings | null> {
  const c = read();
  if (c && Date.now() - c.at < TTL_MS) {
    apply(c.s);
    return c.s;
  }
  try {
    const res = await fetch('/api/settings', { signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { ok?: boolean; settings?: Partial<ClientSettings> & { announcement_on?: boolean } };
    if (!res.ok || !data.ok || !data.settings) return c?.s ?? null;
    const d = data.settings;
    const s: ClientSettings = {
      whatsapp_number: d.whatsapp_number || PUBLIC_WHATSAPP_FALLBACK,
      orders_open: d.orders_open !== false,
      announcement_text: d.announcement_on && typeof d.announcement_text === 'string' ? d.announcement_text : '',
    };
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), s }));
    } catch {
      /* private mode */
    }
    apply(s);
    return s;
  } catch {
    return c?.s ?? null;
  }
}
