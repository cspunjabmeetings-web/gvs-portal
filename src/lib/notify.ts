// spec: E15 (GET /api/admin/notifications?since=&unread=, POST /api/admin/notifications/read), F09-AC1..AC4, F08-AC11, intent 12.5
// Sirf server par. Notification ke matn mein customer ka naam/phone kabhi nahin (qaida 11) — matn banane wale (orders.ts, admin-orders.ts) sirf order number likhte hain.
import * as v from 'valibot';
import { fail, ok, readJson, API_MSG, type ApiResult } from './api';
import { adminPost, requireAdmin } from './admin-auth';
import { todayStartUtc } from './admin-orders';

export interface NotifyEnv {
  DB: D1Database;
  SESSION_SECRET?: string;
}

export const NOTIFY_PAGE = 50;
export const READ_MAX_IDS = 100;

export const NOTIFICATION_TYPES = ['order_new', 'whatsapp_opened', 'status_changed', 'auto_cancelled', 'low_mcq_bank'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface AdminNotification {
  id: number;
  type: NotificationType;
  orderId: string | null;
  message: string;
  createdAt: string;
  readAt: string | null;
}

interface Row {
  id: number;
  type: NotificationType;
  order_id: string | null;
  message: string;
  created_at: string;
  read_at: string | null;
}

const toItem = (r: Row): AdminNotification => ({ id: r.id, type: r.type, orderId: r.order_id, message: r.message, createdAt: r.created_at, readAt: r.read_at });

/** Query param → musbat integer, warna null */
function cursor(v: string | null): number | null {
  if (!v || !/^\d{1,12}$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}

const unreadCount = async (db: D1Database) =>
  (await db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE read_at IS NULL').first<{ n: number }>())?.n ?? 0;

// ---- E15 GET: list (naye upar) + na-parhi ginti ----
// since = is id ke baad wali (polling); before = is id se pehle wali ("Aur dikhayen"); unread=1 = sirf na-parhi
export async function listNotifications(request: Request, env: NotifyEnv): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const url = new URL(request.url);
  const since = cursor(url.searchParams.get('since'));
  const before = cursor(url.searchParams.get('before'));
  const onlyUnread = url.searchParams.get('unread') === '1';

  const where: string[] = [];
  const vals: number[] = [];
  if (since !== null) {
    vals.push(since);
    where.push(`id > ?${vals.length}`);
  }
  if (before !== null) {
    vals.push(before);
    where.push(`id < ?${vals.length}`);
  }
  if (onlyUnread) where.push('read_at IS NULL');
  const sql = `SELECT id, type, order_id, message, created_at, read_at FROM notifications ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ${NOTIFY_PAGE + 1}`;

  try {
    const [rows, unread] = await Promise.all([
      env.DB.prepare(sql)
        .bind(...vals)
        .all<Row>(),
      unreadCount(env.DB),
    ]);
    const list = rows.results ?? [];
    return ok({ items: list.slice(0, NOTIFY_PAGE).map(toItem), hasMore: list.length > NOTIFY_PAGE, unread });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

// ---- E15 POST read: kuch ids ya sab ----
const ReadBody = v.union([
  v.object({ all: v.literal(true) }),
  v.object({ ids: v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(1))), v.minLength(1), v.maxLength(READ_MAX_IDS)) }),
]);

export async function markRead(request: Request, env: NotifyEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? adminPost(request);
  if (denied) return denied;
  const body = await readJson(request, 4096);
  if (!body.ok) return body.res;
  const p = v.safeParse(ReadBody, body.data);
  if (!p.success) return fail(400, 'invalid', 'Maloomat sahih nahin.');
  const at = (deps.now ?? (() => new Date()))().toISOString();
  try {
    if ('all' in p.output) {
      await env.DB.prepare('UPDATE notifications SET read_at = ?1 WHERE read_at IS NULL').bind(at).run();
    } else {
      // D1 ek query mein 100 parameters tak leta hai: ids ek JSON parameter mein
      await env.DB.prepare('UPDATE notifications SET read_at = ?1 WHERE read_at IS NULL AND id IN (SELECT value FROM json_each(?2))')
        .bind(at, JSON.stringify([...new Set(p.output.ids)]))
        .run();
    }
    return ok({ unread: await unreadCount(env.DB) });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/**
 * F09-AC4: `low_mcq_bank` Pakistan ke ek din mein sirf ek dafa. Ek hi SQL statement (atomic).
 * Bulane wala rozana test / cron ka qadam (F24) hai; yahan sirf dohri rok. true = nayi bani.
 */
export async function notifyLowMcqBank(db: D1Database, message: string, now = new Date()): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT INTO notifications (type, order_id, message, created_at)
       SELECT 'low_mcq_bank', NULL, ?1, ?2
       WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE type = 'low_mcq_bank' AND created_at >= ?3)`,
    )
    .bind(message.slice(0, 300), now.toISOString(), todayStartUtc(now))
    .run();
  return res.meta.changes === 1;
}
