// spec: F27-AC1..AC5, E30..E33 (8.4), intent 25.12, 25.13 (files ke naam), SA7 (event by 'agent'), 8.6
// Version 2 ki tayyari. Version 1 mein `agent_enabled = false` → har endpoint saada 404 (wujood zahir na ho).
// Key: settings ki row `agent_key_hash` mein sirf SHA-256 hex (owner ka faisla 1a); asal key kahin save nahin.
// Agent ke paas sirf yeh 4 kaam: list, notifications, complete, note. "Paid", qeemat, mitana — koi rasta nahin.
// agent_log mein sirf action + order_id (naam/phone kabhi nahin, qaida 11).
import * as v from 'valibot';
import { fail, ok, readJson, API_MSG, type ApiResult } from './api';
import { safeEqual } from './admin-auth';
import { getSettings } from './settings';
import { getProduct } from './catalog';
import { STATUS_LABEL } from './admin-ui';
import type { PricedItem } from './price';
import type { OrderStatus } from './track';

export interface AgentEnv {
  DB: D1Database;
}

export const AGENT_KEY_SETTING = 'agent_key_hash';
export const AGENT_PAGE = 50;
export const AGENT_NOTE_MAX = 500;

export const AGENT_MSG = {
  not_found: 'Not found.',
  unauthorized: 'Key sahih nahin.',
  order_not_found: 'Order nahin mila.',
  not_allowed: 'Agent sirf Paid ya Pending order complete kar sakta hai.',
  conflict: 'Order abhi badal chuka hai.',
  note: 'Note 500 harf tak likhein.',
  invalid: 'Maloomat sahih nahin.',
} as const;

const enc = new TextEncoder();

/** SHA-256 hex (key ka hash; V2 mein Settings ka button isi se `agent_key_hash` bharega) */
export async function hashAgentKey(key: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(key)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- fileHint → file ka rasta (intent 25.13) ----
/** Value ko file ke naam ke qabil banao: khali jagah → '-', sirf a-z A-Z 0-9 '-'; courseCode bare harf */
function filePart(key: string, value: string): string {
  const s = value
    .trim()
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '-');
  return key === 'courseCode' ? s.toUpperCase() : s;
}

/** `VU/{courseCode}/Smart.pdf` + `{courseCode:'cs101'}` → `VU/CS101/Smart.pdf`. Hint khali ya koi khana na ho → null */
export function resolveFileHint(hint: string, fields: Record<string, string>): string | null {
  if (!hint) return null;
  let missing = false;
  const out = hint.replace(/\{([A-Za-z0-9_]+)\}/g, (_, key: string) => {
    const part = filePart(key, fields[key] ?? '');
    if (!part) missing = true;
    return part;
  });
  return missing ? null : out;
}

// ---- Guard: band → 404, phir Bearer key ----
async function agentGuard(request: Request, db: D1Database): Promise<ApiResult | null> {
  try {
    const s = await getSettings(db);
    if (!s.agent_enabled) return fail(404, 'not_found', AGENT_MSG.not_found);
    const m = /^Bearer ([\x21-\x7e]{16,256})$/.exec(request.headers.get('Authorization') ?? '');
    const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(AGENT_KEY_SETTING).first<{ value: string }>();
    const stored = row?.value ?? '';
    // Hash na ho (V1: button band) to koi key kaam nahin karti
    if (!m || !/^[0-9a-f]{64}$/.test(stored)) return fail(401, 'unauthorized', AGENT_MSG.unauthorized);
    if (!(await safeEqual(await hashAgentKey(m[1]), stored))) return fail(401, 'unauthorized', AGENT_MSG.unauthorized);
    return null;
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

const logStmt = (db: D1Database, action: string, orderId: string | null, at: string) =>
  db.prepare('INSERT INTO agent_log (action, order_id, at) VALUES (?1, ?2, ?3)').bind(action, orderId, at);

const nowOf = (deps: { now?: () => Date }) => (deps.now ?? (() => new Date()))();

// ---- E30: paid, na-mukammal orders ----
export interface AgentOrderItem extends PricedItem {
  fileHint: string;
  file: string | null;
}

export interface AgentOrder {
  id: string;
  name: string;
  phone: string;
  status: OrderStatus;
  items: AgentOrderItem[];
  total: number;
  paidAt: string | null;
  dueAt: string | null;
  publicNote: string | null;
  adminNote: string | null;
}

interface OrderRow {
  id: string;
  name: string;
  phone: string;
  status: OrderStatus;
  items_json: string;
  total: number;
  paid_at: string | null;
  due_at: string | null;
  public_note: string | null;
  admin_note: string | null;
}

function agentItems(json: string): AgentOrderItem[] {
  let list: PricedItem[];
  try {
    const p: unknown = JSON.parse(json);
    list = Array.isArray(p) ? (p as PricedItem[]) : [];
  } catch {
    list = [];
  }
  return list.map((it) => {
    const fileHint = getProduct(it.id)?.fileHint ?? '';
    return { ...it, fields: { ...(it.fields ?? {}) }, fileHint, file: resolveFileHint(fileHint, it.fields ?? {}) };
  });
}

export async function agentOrders(request: Request, env: AgentEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await agentGuard(request, env.DB);
  if (denied) return denied;
  const status = new URL(request.url).searchParams.get('status') ?? 'paid';
  if (status !== 'paid') return fail(400, 'invalid', AGENT_MSG.invalid);
  try {
    const db = env.DB;
    const [rows] = await db.batch([
      db
        .prepare(
          `SELECT id, name, phone, status, items_json, total, paid_at, due_at, public_note, admin_note
           FROM orders WHERE status = 'paid' ORDER BY paid_at ASC, id ASC LIMIT ${AGENT_PAGE}`,
        ),
      logStmt(db, 'list_orders', null, nowOf(deps).toISOString()),
    ]);
    const orders: AgentOrder[] = ((rows.results ?? []) as OrderRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      status: r.status,
      items: agentItems(r.items_json),
      total: r.total,
      paidAt: r.paid_at,
      dueAt: r.due_at,
      publicNote: r.public_note,
      adminNote: r.admin_note,
    }));
    return ok({ orders });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

// ---- E31: naye notifications (purane pehle, taake agent `since` aage barhata jaye) ----
export async function agentNotifications(request: Request, env: AgentEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await agentGuard(request, env.DB);
  if (denied) return denied;
  const raw = new URL(request.url).searchParams.get('since');
  if (raw !== null && !/^\d{1,12}$/.test(raw)) return fail(400, 'invalid', AGENT_MSG.invalid);
  const since = raw === null ? 0 : Number(raw);
  try {
    const db = env.DB;
    const [rows] = await db.batch([
      db
        .prepare(`SELECT id, type, order_id, message, created_at FROM notifications WHERE id > ?1 ORDER BY id ASC LIMIT ${AGENT_PAGE + 1}`)
        .bind(since),
      logStmt(db, 'list_notifications', null, nowOf(deps).toISOString()),
    ]);
    const list = (rows.results ?? []) as { id: number; type: string; order_id: string | null; message: string; created_at: string }[];
    return ok({
      items: list.slice(0, AGENT_PAGE).map((r) => ({ id: r.id, type: r.type, orderId: r.order_id, message: r.message, createdAt: r.created_at })),
      hasMore: list.length > AGENT_PAGE,
    });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

const NoteField = v.pipe(v.string(), v.maxLength(2000));
const CompleteBody = v.object({ note: v.optional(NoteField) });
const NoteBody = v.object({ note: NoteField });

function cleanNote(s: string | undefined): string | null | 'long' {
  const t = (s ?? '').trim();
  if (t.length > AGENT_NOTE_MAX) return 'long';
  return t || null;
}

// ---- E32: complete (sirf paid/pending se; 8.6) ----
export async function agentComplete(request: Request, env: AgentEnv, id: string, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await agentGuard(request, env.DB);
  if (denied) return denied;
  const body = await readJson(request, 4096);
  if (!body.ok) return body.res;
  const p = v.safeParse(CompleteBody, body.data);
  if (!p.success) return fail(400, 'invalid', AGENT_MSG.invalid);
  const note = cleanNote(p.output.note);
  if (note === 'long') return fail(400, 'note', AGENT_MSG.note);
  const at = nowOf(deps).toISOString();
  try {
    const db = env.DB;
    const row = await db.prepare('SELECT status FROM orders WHERE id = ?').bind(id).first<{ status: OrderStatus }>();
    if (!row) return fail(404, 'order_not_found', AGENT_MSG.order_not_found);
    const from = row.status;
    if (from !== 'paid' && from !== 'pending') return fail(409, 'not_allowed', AGENT_MSG.not_allowed);
    const res = await db.batch([
      db
        .prepare(
          `UPDATE orders SET status = 'complete', completed_at = ?1, completed_by = 'agent', updated_at = ?1,
             admin_note = COALESCE(?2, admin_note)
           WHERE id = ?3 AND status = ?4`,
        )
        .bind(at, note, id, from),
      db
        .prepare(`INSERT INTO order_events (order_id, from_status, to_status, "by", at) SELECT ?1, ?2, 'complete', 'agent', ?3 WHERE changes() = 1`)
        .bind(id, from, at),
      db
        .prepare(`INSERT INTO notifications (type, order_id, message, created_at) SELECT 'status_changed', ?1, ?2, ?3 WHERE changes() = 1`)
        .bind(id, `Order ${id}: ${STATUS_LABEL[from]} se ${STATUS_LABEL.complete} (agent)`, at),
      logStmt(db, 'complete', id, at),
    ]);
    if (res[0].meta.changes !== 1) return fail(409, 'conflict', AGENT_MSG.conflict);
    return ok({ id, status: 'complete' });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

// ---- E33: admin note ----
export async function agentNote(request: Request, env: AgentEnv, id: string, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await agentGuard(request, env.DB);
  if (denied) return denied;
  const body = await readJson(request, 4096);
  if (!body.ok) return body.res;
  const p = v.safeParse(NoteBody, body.data);
  if (!p.success) return fail(400, 'invalid', AGENT_MSG.invalid);
  const note = cleanNote(p.output.note);
  if (note === 'long') return fail(400, 'note', AGENT_MSG.note);
  const at = nowOf(deps).toISOString();
  try {
    const db = env.DB;
    const res = await db.batch([
      db.prepare('UPDATE orders SET admin_note = ?1, updated_at = ?2 WHERE id = ?3').bind(note, at, id),
      db.prepare(`INSERT INTO agent_log (action, order_id, at) SELECT 'note', ?1, ?2 WHERE changes() = 1`).bind(id, at),
    ]);
    if (res[0].meta.changes !== 1) return fail(404, 'order_not_found', AGENT_MSG.order_not_found);
    return ok({ id, adminNote: note });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
