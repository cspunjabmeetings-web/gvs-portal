// spec: E02 POST /api/orders, E03 whatsapp-opened, SA1 (order number), SA2, SA3, SA5, SA6, SA7,
//       F04-AC2..AC7, AC11, F05-AC4 (D1 kharabi par 503), 9.3 order rate limits
// Endpoints patle hain; saara kaam yahan (tests Node mein local D1 par chalte hain).
import * as v from 'valibot';
import { fail, ok, readJson, sameOrigin, clientIp, API_MSG, type ApiResult } from './api';
import { getSettings } from './settings';
import { priceOrder, type JobRow } from './price';
import { validateName, validatePhone } from './validators';
import { last4, waLink } from './phone';
import { buildOrderMessage } from './order-message';
import { checkLimit } from './ratelimit';
import { verifyTurnstile, type TurnstileVerdict } from './turnstile';
import { MAX_ITEMS } from './cart';

export interface OrderEnv {
  DB: D1Database;
  TURNSTILE_SECRET?: string;
  SESSION_SECRET?: string;
}

export interface OrderDeps {
  now?: () => Date;
  verify?: (secret: string, token: string, ip: string) => Promise<TurnstileVerdict>;
}

export const ORDER_MSG = {
  invalid: 'Order ki maloomat sahih nahin. Form dobara bharein.',
  closed: 'Abhi orders band hain. Aap ki list mehfooz hai.',
  turnstile: 'Hifazati jaanch mukammal nahin hui. Dobara koshish karein.',
  phone_limit: 'Is number se bohat orders aa chuke hain, thori der baad koshish karein.',
  ip_limit: 'Bohat orders aa chuke hain, thori der baad koshish karein.',
  not_found: 'Order nahin mila',
} as const;

const HOUR = 60 * 60 * 1000;

// ---- Waqt: Asia/Karachi (SA1) ----
function karachi(d: Date) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { y: get('year'), m: get('month'), d: get('day') };
}
/** `2611` (YYMM, Asia/Karachi) */
export const orderMonth = (d: Date) => {
  const k = karachi(d);
  return k.y.slice(2) + k.m;
};
/** `2026-11-17` (Asia/Karachi) */
export const karachiDate = (d: Date) => {
  const k = karachi(d);
  return `${k.y}-${k.m}-${k.d}`;
};

// ---- Input (Valibot, spec 8.1) ----
const Str = (max: number) => v.pipe(v.string(), v.maxLength(max));
const OrderBody = v.object({
  name: Str(200),
  phone: Str(30),
  items: v.pipe(
    v.array(
      v.object({
        id: Str(60),
        fields: v.pipe(v.record(Str(40), Str(200)), v.check((r) => Object.keys(r).length <= 10)),
        jobId: v.optional(v.pipe(v.string(), v.regex(/^[0-9]{1,10}$/))),
      }),
    ),
    v.minLength(1),
    v.maxLength(MAX_ITEMS),
  ),
  turnstileToken: Str(4096),
});

const OpenedBody = v.object({ last4: v.pipe(v.string(), v.regex(/^[0-9]{4}$/)) });
export const ORDER_ID_RE = /^GVS-[0-9]{4}-[0-9]{4,}$/;

function guard(request: Request): ApiResult | null {
  if (!sameOrigin(request)) return fail(403, 'origin', API_MSG.origin);
  return null;
}

/** E02: naya order */
export async function createOrder(request: Request, env: OrderEnv, deps: OrderDeps = {}): Promise<ApiResult> {
  const blocked = guard(request);
  if (blocked) return blocked;
  const body = await readJson(request);
  if (!body.ok) return body.res;

  const parsed = v.safeParse(OrderBody, body.data);
  if (!parsed.success) {
    // Items 10 se zyada ka alag paigham
    const d = body.data as { items?: unknown };
    if (Array.isArray(d?.items) && d.items.length > MAX_ITEMS) return fail(400, 'too_many', 'Ek order mein 10 cheezein hi ho sakti hain.');
    return fail(400, 'invalid', ORDER_MSG.invalid);
  }
  const input = parsed.output;
  const name = validateName(input.name);
  if (!name.ok) return fail(400, 'invalid_name', name.error);
  const phone = validatePhone(input.phone);
  if (!phone.ok) return fail(400, 'invalid_phone', phone.error);

  // Raaz na hon to order nahin (config ki ghalti) → 503, browser F05 rasta
  if (!env.TURNSTILE_SECRET || !env.SESSION_SECRET) return fail(503, 'unavailable', API_MSG.unavailable);

  const ip = clientIp(request);
  const now = (deps.now ?? (() => new Date()))();

  // F04-AC11: Turnstile pehle (spam D1 tak na pohanche)
  if (!input.turnstileToken) return fail(400, 'turnstile', ORDER_MSG.turnstile);
  const verdict = await (deps.verify ?? verifyTurnstile)(env.TURNSTILE_SECRET, input.turnstileToken, ip);
  if (verdict === null) return fail(503, 'unavailable', API_MSG.unavailable);
  if (!verdict) return fail(400, 'turnstile', ORDER_MSG.turnstile);

  try {
    const db = env.DB;
    const settings = await getSettings(db);
    if (!settings.orders_open) return fail(400, 'orders_closed', ORDER_MSG.closed);

    // Jobs sirf jin ka id aaya (Qadam 13 tak table khali)
    const jobIds = [...new Set(input.items.map((i) => i.jobId).filter((x): x is string => !!x))];
    const jobs = new Map<string, JobRow>();
    if (jobIds.length) {
      const { results } = await db
        .prepare(`SELECT id, org, post, last_date, visible, apply_service, deleted_at, our_fee, govt_fee, documents_json FROM jobs WHERE id IN (${jobIds.map(() => '?').join(',')})`)
        .bind(...jobIds.map(Number))
        .all<JobRow>();
      for (const j of results) jobs.set(String(j.id), j);
    }

    const priced = priceOrder(input.items, { defaultJobFee: settings.default_job_fee, today: karachiDate(now), jobs });
    if (!priced.ok) return fail(400, priced.code, priced.message);

    // SA5 / 9.3: phone 5 aur IP 20, har ghante
    const byPhone = await checkLimit(db, env.SESSION_SECRET, { scope: 'order:phone', value: phone.value, max: 5, windowMs: HOUR }, now);
    if (!byPhone.allowed) return fail(429, 'rate_limited', ORDER_MSG.phone_limit);
    const byIp = await checkLimit(db, env.SESSION_SECRET, { scope: 'order:ip', value: ip, max: 20, windowMs: HOUR }, now);
    if (!byIp.allowed) return fail(429, 'rate_limited', ORDER_MSG.ip_limit);

    // SA1: ek atomic batch (D1 batch = transaction). Order id counter se.
    const month = orderMonth(now);
    const at = now.toISOString();
    const idExpr = `(SELECT 'GVS-' || month || '-' || printf('%04d', last_number) FROM order_counter WHERE month = ?1)`;
    const results = await db.batch<{ id: string }>([
      db.prepare('INSERT INTO order_counter (month, last_number) VALUES (?1, 1) ON CONFLICT(month) DO UPDATE SET last_number = last_number + 1').bind(month),
      db
        .prepare(
          `INSERT INTO orders (id, name, phone, phone_last4, items_json, total, status, contacted, created_at, updated_at)
           VALUES (${idExpr}, ?2, ?3, ?4, ?5, ?6, 'new', 0, ?7, ?7) RETURNING id`,
        )
        .bind(month, name.value, '92' + phone.value.slice(1), last4(phone.value), JSON.stringify(priced.items), priced.total, at),
      // SA7: pehla event
      db.prepare(`INSERT INTO order_events (order_id, from_status, to_status, "by", at) VALUES (${idExpr}, NULL, 'new', 'system', ?2)`).bind(month, at),
      // SA6: order_new (naam/phone message mein nahin)
      db
        .prepare(`INSERT INTO notifications (type, order_id, message, created_at) VALUES ('order_new', ${idExpr}, 'Naya order ' || ${idExpr} || ': Rs. ' || CAST(?2 AS INTEGER) || ', ' || CAST(?3 AS INTEGER) || ' cheez(ein)', ?4)`)
        .bind(month, priced.total, priced.items.length, at),
      byPhone.increment,
      byIp.increment,
    ]);
    const id = results[1].results[0]?.id;
    if (!id) return fail(503, 'unavailable', API_MSG.unavailable);

    const origin = new URL(request.url).origin;
    const trackUrl = `${origin}/track?id=${id}`;
    const message = buildOrderMessage({ items: priced.items, name: name.value, orderId: id, trackUrl });
    return ok({
      id,
      total: priced.total,
      last4: last4(phone.value),
      trackUrl,
      message,
      whatsappNumber: settings.whatsapp_number,
      whatsappUrl: waLink(settings.whatsapp_number, message),
    });
  } catch {
    // F05-AC4: D1 ki had/kharabi → 503 (browser seedha WhatsApp rasta). Naam/phone log nahin (9.2).
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/** E03: "WhatsApp par bhejein" ka record, sirf pehli dafa (F04-AC7) */
export async function markWhatsappOpened(request: Request, env: OrderEnv, orderId: string, deps: OrderDeps = {}): Promise<ApiResult> {
  const blocked = guard(request);
  if (blocked) return blocked;
  if (!ORDER_ID_RE.test(orderId)) return fail(404, 'not_found', ORDER_MSG.not_found);
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const parsed = v.safeParse(OpenedBody, body.data);
  if (!parsed.success) return fail(404, 'not_found', ORDER_MSG.not_found);

  const at = (deps.now ?? (() => new Date()))().toISOString();
  try {
    const db = env.DB;
    const res = await db
      .prepare('UPDATE orders SET whatsapp_opened_at = ?1, updated_at = ?1 WHERE id = ?2 AND phone_last4 = ?3 AND whatsapp_opened_at IS NULL')
      .bind(at, orderId, parsed.output.last4)
      .run();
    if (res.meta.changes === 1) {
      await db
        .prepare(`INSERT INTO notifications (type, order_id, message, created_at) VALUES ('whatsapp_opened', ?1, 'Order ' || ?1 || ': customer ne WhatsApp khola', ?2)`)
        .bind(orderId, at)
        .run();
      return ok({ first: true });
    }
    // Pehle se record hai, ya order/last4 nahin mila: farq nahin batate
    const exists = await db.prepare('SELECT 1 AS x FROM orders WHERE id = ? AND phone_last4 = ?').bind(orderId, parsed.output.last4).first();
    return exists ? ok({ first: false }) : fail(404, 'not_found', ORDER_MSG.not_found);
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
