// spec: E11..E14, F08-AC1..AC9, AC12, 8.6 (darjon ki ijazat), SA4 (wada), SA6 (notification), SA7 (event),
//       9.2 (LIKE wildcard escape, parameterized SQL), 9.4 (note ≤ 500, cancel wajah ≤ 200), A-01, A-08, 7.3 v0.3.6 (khulasa updated_at index se)
// Sirf server par. Endpoints patle; middleware + requireAdmin pehle se jaanch karte hain.
import * as v from 'valibot';
import { fail, ok, readJson, API_MSG, type ApiResult } from './api';
import { adminPost, requireAdmin } from './admin-auth';
import { getSettings, type Settings } from './settings';
import { getProduct } from './catalog';
import { addWorkingMinutes, orderMinutes } from './timer';
import { karachiDate } from './orders';
import type { PricedItem } from './price';
import type { OrderStatus } from './track';

export interface AdminOrdersEnv {
  DB: D1Database;
  SESSION_SECRET?: string;
}

export const PAGE_SIZE = 50;
export const FILTERS = ['new', 'wa', 'paid', 'pending', 'complete', 'cancelled', 'all'] as const;
export type Filter = (typeof FILTERS)[number];

// 8.6 ki list aur labels admin-ui.ts mein (UI aur server dono ek hi list)
export { ALLOWED, STATUS_LABEL, canMove } from './admin-ui';
import { STATUS_LABEL, canMove } from './admin-ui';

export const ADMIN_ORDER_MSG = {
  not_found: 'Order nahin mila.',
  not_allowed: 'Yeh tabdeeli mumkin nahin.',
  reason: 'Cancel ki wajah likhein (200 harf tak).',
  due: 'Wada ka waqt sahih nahin.',
  due_status: 'Wada sirf Paid ya Pending order par badla ja sakta hai.',
  conflict: 'Order abhi badal chuka hai. List taza kar ke dobara koshish karein.',
  note: 'Note 500 harf tak likhein.',
  invalid: 'Maloomat sahih nahin.',
} as const;

export interface AdminOrder {
  id: string;
  name: string;
  /** `923XXXXXXXXX`; 90 din baad '' */
  phone: string;
  /** F08-AC12: naam/number mita diya gaya */
  purged: boolean;
  items: PricedItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  whatsappOpenedAt: string | null;
  contacted: boolean;
  publicNote: string | null;
  adminNote: string | null;
  cancelReason: string | null;
  /** SA4: wade ke minute (sab se lamba) — Paid dialog isi se "Wada: ..." banata hai */
  minutes: number;
}

interface Row {
  id: string;
  name: string;
  phone: string;
  items_json: string;
  total: number;
  status: OrderStatus;
  created_at: string;
  paid_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  whatsapp_opened_at: string | null;
  contacted: number;
  public_note: string | null;
  admin_note: string | null;
  cancel_reason: string | null;
}

const COLS = 'id, name, phone, items_json, total, status, created_at, paid_at, due_at, completed_at, whatsapp_opened_at, contacted, public_note, admin_note, cancel_reason';

function parseItems(json: string): PricedItem[] {
  try {
    const x = JSON.parse(json) as unknown;
    return Array.isArray(x) ? (x as PricedItem[]) : [];
  } catch {
    return [];
  }
}

/** SA4: settings override → catalog → default; kai cheezon mein sab se lamba */
export function minutesFor(items: Pick<PricedItem, 'id'>[], s: Pick<Settings, 'default_delivery_minutes' | 'delivery_overrides'>): number {
  return orderMinutes(
    items.map((i) => i.id),
    { defaultMinutes: s.default_delivery_minutes, overrides: s.delivery_overrides, catalogMinutes: (id) => getProduct(id)?.deliveryMinutes },
  );
}

function toOrder(r: Row, s: Settings): AdminOrder {
  const items = parseItems(r.items_json);
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    purged: r.name === '' && r.phone === '',
    items,
    total: r.total,
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    dueAt: r.due_at,
    completedAt: r.completed_at,
    whatsappOpenedAt: r.whatsapp_opened_at,
    contacted: r.contacted === 1,
    publicNote: r.public_note,
    adminNote: r.admin_note,
    cancelReason: r.cancel_reason,
    minutes: minutesFor(items, s),
  };
}

/** Pakistan ka "aaj" UTC mein kab shuru hua (A-01). Asia/Karachi = UTC+5, DST nahin. */
export const todayStartUtc = (now: Date) => new Date(`${karachiDate(now)}T00:00:00+05:00`).toISOString();

// ---- E11: list + khulasa ----
export async function listOrders(request: Request, env: AdminOrdersEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const url = new URL(request.url);
  const filter = (FILTERS as readonly string[]).includes(url.searchParams.get('status') ?? '') ? (url.searchParams.get('status') as Filter) : 'all';
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 40);
  const offset = Math.min(10_000, Math.max(0, Math.floor(Number(url.searchParams.get('offset')) || 0)));
  const now = (deps.now ?? (() => new Date()))();

  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (filter === 'wa') where.push("status = 'new' AND whatsapp_opened_at IS NULL");
  else if (filter !== 'all') {
    where.push('status = ?');
    binds.push(filter);
  }
  if (q) {
    // 17c: instr (LIKE nahin) — D1 mein LIKE pattern ki hadd 50 bytes (escape ke baad lamba ho jata tha); instr ki
    // koi hadd nahin aur % _ aam harf. lower() = LIKE jaisa ASCII chhote/bare harf ka farq nahin.
    const parts = ['instr(id, ?) > 0', 'instr(lower(name), lower(?)) > 0'];
    binds.push(q.toUpperCase(), q);
    // Phone ke hindse: "0300-12" → "30012" (phone 923... mein mehfooz)
    let digits = q.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length >= 3) {
      parts.push('instr(phone, ?) > 0');
      binds.push(digits);
    }
    where.push(`(${parts.join(' OR ')})`);
  }

  try {
    const db = env.DB;
    const s = await getSettings(db);
    const sql = `SELECT ${COLS} FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const { results } = await db
      .prepare(sql)
      .bind(...binds, PAGE_SIZE + 1, offset)
      .all<Row>();
    const start = todayStartUtc(now);
    const sum = await db
      .prepare(
        `SELECT
           COALESCE(SUM(created_at >= ?1), 0) AS newToday,
           COALESCE(SUM(paid_at >= ?1 AND status IN ('paid','pending','complete')), 0) AS paidToday,
           COALESCE(SUM(completed_at >= ?1 AND status = 'complete'), 0) AS completeToday,
           COALESCE(SUM(CASE WHEN paid_at >= ?1 AND status IN ('paid','pending','complete') THEN total ELSE 0 END), 0) AS earnedToday
         FROM orders WHERE updated_at >= ?1`,
        // v0.3.6: har tabdeeli (banana, paid, complete) updated_at barhati hai → aaj ke saare orders is index range mein
      )
      .bind(start)
      .first<{ newToday: number; paidToday: number; completeToday: number; earnedToday: number }>();
    return ok({
      orders: results.slice(0, PAGE_SIZE).map((r) => toOrder(r, s)),
      hasMore: results.length > PAGE_SIZE,
      summary: {
        newToday: Number(sum?.newToday ?? 0),
        paidToday: Number(sum?.paidToday ?? 0),
        completeToday: Number(sum?.completeToday ?? 0),
        earnedToday: Number(sum?.earnedToday ?? 0),
      },
      work: { start: s.work_start, end: s.work_end },
      payment: { jazzcashNumber: s.jazzcash_number, jazzcashTitle: s.jazzcash_title, easypaisaNumber: s.easypaisa_number, easypaisaTitle: s.easypaisa_title },
    });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

// ---- E12: darja / wada ----
const StatusBody = v.object({
  status: v.optional(v.picklist(['new', 'paid', 'pending', 'complete', 'cancelled'])),
  dueAt: v.optional(v.pipe(v.string(), v.maxLength(40))),
  cancelReason: v.optional(v.pipe(v.string(), v.maxLength(1000))),
});

function parseDue(s: string | undefined, now: Date): Date | null | 'bad' {
  if (s === undefined) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return 'bad';
  // Pichhle 1 din se pehle ya 60 din se aage ka wada ghalti hai
  if (d.getTime() < now.getTime() - 864e5 || d.getTime() > now.getTime() + 60 * 864e5) return 'bad';
  return d;
}

async function loadRow(db: D1Database, id: string) {
  return db.prepare(`SELECT ${COLS} FROM orders WHERE id = ?`).bind(id).first<Row>();
}

async function guardPost(request: Request, env: AdminOrdersEnv): Promise<ApiResult | null> {
  return (await requireAdmin(request, env)) ?? adminPost(request);
}

export async function changeStatus(request: Request, env: AdminOrdersEnv, id: string, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await guardPost(request, env);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const p = v.safeParse(StatusBody, body.data);
  if (!p.success || (!p.output.status && p.output.dueAt === undefined)) return fail(400, 'invalid', ADMIN_ORDER_MSG.invalid);
  const now = (deps.now ?? (() => new Date()))();
  const at = now.toISOString();
  const due = parseDue(p.output.dueAt, now);
  if (due === 'bad') return fail(400, 'due', ADMIN_ORDER_MSG.due);

  try {
    const db = env.DB;
    const row = await loadRow(db, id);
    if (!row) return fail(404, 'not_found', ADMIN_ORDER_MSG.not_found);
    const s = await getSettings(db);
    const from = row.status;
    const to = p.output.status;

    // A-08: sirf wada badalna
    if (!to || to === from) {
      if (!due) return fail(400, 'not_allowed', ADMIN_ORDER_MSG.not_allowed);
      if (from !== 'paid' && from !== 'pending') return fail(400, 'due_status', ADMIN_ORDER_MSG.due_status);
      await db.prepare('UPDATE orders SET due_at = ?1, updated_at = ?2 WHERE id = ?3').bind(due.toISOString(), at, id).run();
      return ok({ order: toOrder((await loadRow(db, id))!, s) });
    }

    if (!canMove(from, to)) return fail(400, 'not_allowed', ADMIN_ORDER_MSG.not_allowed);

    const set: string[] = ['status = ?1', 'updated_at = ?2'];
    const vals: (string | null)[] = [to, at];
    const add = (col: string, val: string | null) => {
      vals.push(val);
      set.push(`${col} = ?${vals.length}`);
    };
    if (to === 'paid' && from === 'new') {
      add('paid_at', at);
      const items = parseItems(row.items_json);
      // SA4: wada kaam ke auqaat mein; owner ne badla ho to wohi
      let dueIso: string;
      try {
        dueIso = (due ?? addWorkingMinutes(now, minutesFor(items, s), s.work_start, s.work_end, 'Asia/Karachi')).toISOString();
      } catch {
        dueIso = new Date(now.getTime() + minutesFor(items, s) * 60_000).toISOString();
      }
      add('due_at', dueIso);
    } else if (to === 'paid' && due) {
      add('due_at', due.toISOString());
    }
    if (to === 'new') {
      add('paid_at', null);
      add('due_at', null);
    }
    if (to === 'complete') {
      add('completed_at', at);
      add('completed_by', 'admin');
    }
    if (from === 'complete') {
      add('completed_at', null);
      add('completed_by', null);
    }
    if (to === 'cancelled') {
      const reason = (p.output.cancelReason ?? '').trim();
      if (!reason || reason.length > 200) return fail(400, 'reason', ADMIN_ORDER_MSG.reason);
      add('cancel_reason', reason);
    }

    vals.push(id, from);
    const idIdx = vals.length - 1;
    const fromIdx = vals.length;
    const res = await db.batch([
      // Sirf tab jab darja abhi bhi wohi ho (do tab ek sath na badlein)
      db.prepare(`UPDATE orders SET ${set.join(', ')} WHERE id = ?${idIdx} AND status = ?${fromIdx}`).bind(...vals),
      db
        .prepare(`INSERT INTO order_events (order_id, from_status, to_status, "by", at) SELECT ?1, ?2, ?3, 'admin', ?4 WHERE changes() = 1`)
        .bind(id, from, to, at),
      db
        // Event likha gaya ho (changes() = 1) tabhi notification (SA6)
        .prepare(`INSERT INTO notifications (type, order_id, message, created_at) SELECT 'status_changed', ?1, ?2, ?3 WHERE changes() = 1`)
        .bind(id, `Order ${id}: ${STATUS_LABEL[from]} se ${STATUS_LABEL[to]}`, at),
    ]);
    if (res[0].meta.changes !== 1) return fail(409, 'conflict', ADMIN_ORDER_MSG.conflict);
    return ok({ order: toOrder((await loadRow(db, id))!, s) });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

// ---- E13: note ----
const NoteBody = v.object({ kind: v.picklist(['public', 'admin']), text: v.pipe(v.string(), v.maxLength(2000)) });

export async function setNote(request: Request, env: AdminOrdersEnv, id: string, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await guardPost(request, env);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const p = v.safeParse(NoteBody, body.data);
  if (!p.success) return fail(400, 'invalid', ADMIN_ORDER_MSG.invalid);
  const text = p.output.text.trim();
  if (text.length > 500) return fail(400, 'note', ADMIN_ORDER_MSG.note);
  const col = p.output.kind === 'public' ? 'public_note' : 'admin_note';
  const at = (deps.now ?? (() => new Date()))().toISOString();
  try {
    const res = await env.DB.prepare(`UPDATE orders SET ${col} = ?1, updated_at = ?2 WHERE id = ?3`)
      .bind(text || null, at, id)
      .run();
    if (res.meta.changes !== 1) return fail(404, 'not_found', ADMIN_ORDER_MSG.not_found);
    return ok({ kind: p.output.kind, text: text || null });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

// ---- E14: "Rabta hua" ----
const ContactedBody = v.object({ contacted: v.boolean() });

export async function setContacted(request: Request, env: AdminOrdersEnv, id: string, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await guardPost(request, env);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const p = v.safeParse(ContactedBody, body.data);
  if (!p.success) return fail(400, 'invalid', ADMIN_ORDER_MSG.invalid);
  const at = (deps.now ?? (() => new Date()))().toISOString();
  try {
    const res = await env.DB.prepare('UPDATE orders SET contacted = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(p.output.contacted ? 1 : 0, at, id)
      .run();
    if (res.meta.changes !== 1) return fail(404, 'not_found', ADMIN_ORDER_MSG.not_found);
    return ok({ contacted: p.output.contacted });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
