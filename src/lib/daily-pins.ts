// spec: E23 GET/POST /api/admin/daily-pins, DELETE /api/admin/daily-pins/:date (P-03, A09; GET spec v0.3.5), SA8 (pin ho to wohi 10),
//       F13-AC2 (owner kisi din ke 10 pin kare), 9.2 (cookie + Origin + JSON)
import * as v from 'valibot';
import { fail, ok, readJson, sameOrigin, API_MSG, type ApiResult } from './api';
import { adminPost, requireAdmin } from './admin-auth';
import { addDays, isDateStr, pkDate } from './pkdate';
import { DAILY_COUNT } from './daily';

export interface PinsEnv {
  DB: D1Database;
  SESSION_SECRET?: string;
}

/** Kitne din aage tak pin ho sakta hai */
export const PIN_AHEAD_DAYS = 60;

export const PIN_MSG = {
  date: `Tareekh aaj se ${PIN_AHEAD_DAYS} din aage tak honi chahiye.`,
  count: `Poore ${DAILY_COUNT} alag sawal chunein.`,
  notVerified: 'Kuch sawal maujood nahin ya chhupe (na jaanche) hain. Sirf jaanche hue sawal pin ho sakte hain.',
  notFound: 'Is tareekh par koi pin nahin.',
} as const;

export interface PinItem {
  id: number;
  subject: string;
  question: string;
  /** false = baad mein chhupa/mita diya — visitor ko yeh sawal nahin dikhe ga */
  ok: boolean;
}
export interface DailyPin {
  date: string;
  source: 'pin' | 'auto';
  items: PinItem[];
}

const PinBody = v.object({
  date: v.string(),
  ids: v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(1))), v.maxLength(50)),
});

const inWindow = (date: string, today: string) => isDateStr(date) && date >= today && date <= addDays(today, PIN_AHEAD_DAYS);

/** E23 GET: aaj (Pakistan) se 60 din aage tak ke din, sawal ke chhote matn ke sath */
export async function listPins(request: Request, env: PinsEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const today = pkDate((deps.now ?? (() => new Date()))());
  try {
    const { results } = await env.DB.prepare('SELECT date, mcq_ids_json, source FROM daily_pins WHERE date >= ?1 AND date <= ?2 ORDER BY date')
      .bind(today, addDays(today, PIN_AHEAD_DAYS))
      .all<{ date: string; mcq_ids_json: string; source: 'pin' | 'auto' }>();
    const rows = results.map((r) => ({ ...r, ids: JSON.parse(r.mcq_ids_json) as number[] }));
    const all = [...new Set(rows.flatMap((r) => r.ids))];
    const map = new Map<number, { subject: string; question: string; verified: number }>();
    if (all.length) {
      const q = await env.DB.prepare('SELECT id, subject, question, verified FROM mcqs WHERE id IN (SELECT value FROM json_each(?1))')
        .bind(JSON.stringify(all))
        .all<{ id: number; subject: string; question: string; verified: number }>();
      for (const m of q.results) map.set(m.id, m);
    }
    const pins: DailyPin[] = rows.map((r) => ({
      date: r.date,
      source: r.source,
      items: r.ids.map((id) => {
        const m = map.get(id);
        return { id, subject: m?.subject ?? '', question: m?.question ?? '(sawal mit chuka)', ok: m?.verified === 1 };
      }),
    }));
    return ok({ today, maxDate: addDays(today, PIN_AHEAD_DAYS), pins });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/** E23 POST { date, ids[10] }: sirf jaanche hue (verified) sawal; us din ka auto/pin badal deta hai */
export async function savePin(request: Request, env: PinsEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? adminPost(request);
  if (denied) return denied;
  const body = await readJson(request, 4 * 1024);
  if (!body.ok) return body.res;
  const p = v.safeParse(PinBody, body.data);
  if (!p.success) return fail(400, 'invalid', PIN_MSG.count);
  const { date, ids } = p.output;
  const today = pkDate((deps.now ?? (() => new Date()))());
  if (!inWindow(date, today)) return fail(400, 'date', PIN_MSG.date);
  if (ids.length !== DAILY_COUNT || new Set(ids).size !== DAILY_COUNT) return fail(400, 'count', PIN_MSG.count);
  try {
    const found = await env.DB.prepare('SELECT COUNT(*) AS n FROM mcqs WHERE verified = 1 AND id IN (SELECT value FROM json_each(?1))')
      .bind(JSON.stringify(ids))
      .first<{ n: number }>();
    if (found?.n !== DAILY_COUNT) return fail(400, 'not_verified', PIN_MSG.notVerified);
    await env.DB.prepare(
      "INSERT INTO daily_pins (date, mcq_ids_json, source) VALUES (?1, ?2, 'pin') ON CONFLICT(date) DO UPDATE SET mcq_ids_json = excluded.mcq_ids_json, source = 'pin'",
    )
      .bind(date, JSON.stringify(ids))
      .run();
    return ok({ date, ids });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/** E23 DELETE /:date — sirf aaj se aage; us din sawal phir khud chune jayenge (SA8) */
export async function deletePin(request: Request, env: PinsEnv, rawDate: string | undefined, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? (sameOrigin(request) ? null : fail(403, 'origin', API_MSG.origin));
  if (denied) return denied;
  const today = pkDate((deps.now ?? (() => new Date()))());
  const date = rawDate ?? '';
  if (!inWindow(date, today)) return fail(400, 'date', PIN_MSG.date);
  try {
    const res = await env.DB.prepare('DELETE FROM daily_pins WHERE date = ?1').bind(date).run();
    if (res.meta.changes !== 1) return fail(404, 'not_found', PIN_MSG.notFound);
    return ok({ date });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
