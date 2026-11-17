// spec: E04 GET /api/track, F06-AC1..AC4, AC7, AC9 (no-store), 9.2 Track, 9.3 (track rate limits)
// Ghalat id ya ghalat last4: bilkul ek hi jawab. Jawab mein phone kabhi nahin.
// D1 writes sirf ghalat koshish par (9.3 "D1 writes bachane ka usool"); kamyab track (aur 60 s polling) sirf read.
import { fail, ok, clientIp, API_MSG, type ApiResult } from './api';
import { checkLimit } from './ratelimit';
import { getSettings } from './settings';
import { getProduct } from './catalog';
import type { PricedItem } from './price';

export interface TrackEnv {
  DB: D1Database;
  SESSION_SECRET?: string;
}

export type OrderStatus = 'new' | 'paid' | 'pending' | 'complete' | 'cancelled';

export interface TrackItem extends PricedItem {
  /** Catalog: is service mein customer ke documents chahiye (F06-AC7) */
  needsDocuments?: boolean;
}

export interface TrackData {
  id: string;
  status: OrderStatus;
  total: number;
  items: TrackItem[];
  createdAt: string;
  dueAt: string | null;
  publicNote: string | null;
  cancelReason: string | null;
  /** Sirf `new` par (F06-AC7); khali string = abhi tay nahin */
  payment?: { jazzcashNumber: string; jazzcashTitle: string; easypaisaNumber: string; easypaisaTitle: string };
}

export const TRACK_MSG = {
  not_found: 'Order nahin mila',
  limited: 'Thori der baad koshish karein',
} as const;

const ID_RE = /^GVS-[0-9]{4}-[0-9]{4,6}$/;
const LAST4_RE = /^[0-9]{4}$/;
const MIN = 60_000;

interface Row {
  id: string;
  status: OrderStatus;
  total: number;
  items_json: string;
  created_at: string;
  due_at: string | null;
  public_note: string | null;
  cancel_reason: string | null;
}

function items(json: string): TrackItem[] {
  try {
    const v = JSON.parse(json) as PricedItem[];
    return Array.isArray(v) ? v.map((i) => ({ ...i, ...(getProduct(i.id)?.needsDocuments ? { needsDocuments: true } : {}) })) : [];
  } catch {
    return [];
  }
}

export async function trackOrder(request: Request, env: TrackEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const url = new URL(request.url);
  // Order number chhote harf mein likha ho to bhi chale
  const id = (url.searchParams.get('id') ?? '').trim().toUpperCase().slice(0, 32);
  const last4 = (url.searchParams.get('last4') ?? '').trim().slice(0, 8);
  if (!env.SESSION_SECRET) return fail(503, 'unavailable', API_MSG.unavailable);

  const now = (deps.now ?? (() => new Date()))();
  const ip = clientIp(request);
  try {
    const db = env.DB;
    // F06-AC4 / 9.3: order id + IP par 5 ghalat / 15 min; IP par 30 ghalat / 10 min
    const byOrder = await checkLimit(db, env.SESSION_SECRET, { scope: 'track:order', value: `${id}|${ip}`, max: 5, windowMs: 15 * MIN }, now);
    const byIp = await checkLimit(db, env.SESSION_SECRET, { scope: 'track:ip', value: ip, max: 30, windowMs: 10 * MIN }, now);
    if (!byOrder.allowed || !byIp.allowed) return fail(429, 'rate_limited', TRACK_MSG.limited);

    const row =
      ID_RE.test(id) && LAST4_RE.test(last4)
        ? await db
            .prepare('SELECT id, status, total, items_json, created_at, due_at, public_note, cancel_reason FROM orders WHERE id = ? AND phone_last4 = ?')
            .bind(id, last4)
            .first<Row>()
        : null;

    if (!row) {
      await db.batch([byOrder.increment, byIp.increment]);
      return fail(404, 'not_found', TRACK_MSG.not_found);
    }

    const data: TrackData = {
      id: row.id,
      status: row.status,
      total: row.total,
      items: items(row.items_json),
      createdAt: row.created_at,
      dueAt: row.due_at,
      publicNote: row.public_note,
      cancelReason: row.status === 'cancelled' ? row.cancel_reason : null,
    };
    if (row.status === 'new') {
      const s = await getSettings(db);
      data.payment = { jazzcashNumber: s.jazzcash_number, jazzcashTitle: s.jazzcash_title, easypaisaNumber: s.easypaisa_number, easypaisaTitle: s.easypaisa_title };
    }
    return ok({ order: data });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
