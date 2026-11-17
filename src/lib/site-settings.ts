// spec: E01, intent 12.4 ("frontend number hamesha /api/settings se; build ki value sirf fallback"),
//       F05-AC2 (number sessionStorage ke cache se, warna build fallback), F03-AC6 (orders_open)
// Browser mein chalta hai. 5 minute ka cache taake har page par request na jaye.
import { PUBLIC_WHATSAPP_FALLBACK } from 'astro:env/client';

const KEY = 'gvs.settings.v1';
const TTL_MS = 5 * 60 * 1000;

export interface ClientSettings {
  whatsapp_number: string;
  orders_open: boolean;
}

function read(): { at: number; s: ClientSettings } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as { at?: number; s?: ClientSettings };
    if (typeof d.at !== 'number' || typeof d.s?.whatsapp_number !== 'string') return null;
    return { at: d.at, s: d.s };
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

/** Cache purana ho to /api/settings se taza karo; nakami par jo hai wohi */
export async function refreshSettings(): Promise<ClientSettings | null> {
  const c = read();
  if (c && Date.now() - c.at < TTL_MS) {
    apply(c.s);
    return c.s;
  }
  try {
    const res = await fetch('/api/settings', { signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { ok?: boolean; settings?: ClientSettings };
    if (!res.ok || !data.ok || !data.settings) return c?.s ?? null;
    const s: ClientSettings = { whatsapp_number: data.settings.whatsapp_number || PUBLIC_WHATSAPP_FALLBACK, orders_open: data.settings.orders_open !== false };
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
