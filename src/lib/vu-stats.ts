// spec: F34-AC1 (E38 ginti), F34-AC3, AC5 (E39 report), F34-AC4 (order ka nishan), F34-AC6 (180 din), 9.3 (rate limit; IP sirf hash, rate_limits mein)
import * as v from 'valibot';
import { clientIp, fail, ok, readJson, sameOrigin, API_MSG, type ApiResult } from './api';
import { requireAdmin } from './admin-auth';
import { addDays, pkDate } from './pkdate';
import { checkLimit } from './ratelimit';
import { VU_EVENTS, VU_SOURCES, orderSource, type Counts, type OrderSource, type ReportRow, type VuReport, type VuSource, type VuStat } from './vu-source';

export interface StatsEnv {
  DB: D1Database;
  SESSION_SECRET?: string;
}
type Deps = { now?: () => Date };
const clock = (d: Deps) => (d.now ?? (() => new Date()))();

export const STATS_KEEP_DAYS = 180;
export const EVENT_LIMIT = { max: 100, windowMs: 60 * 60 * 1000 } as const;
export const REPORT_DAYS = [7, 30, 90] as const;

const Body = v.object({
  events: v.pipe(
    v.array(
      v.object({
        course: v.pipe(v.string(), v.regex(/^[A-Z]{2,4}\d{3}[A-Z]?$/)),
        term: v.picklist(['mid', 'final']),
        event: v.picklist(VU_EVENTS),
        source: v.picklist(VU_SOURCES),
      }),
    ),
    v.minLength(1),
    v.maxLength(10),
  ),
});

/** +1 (sirf maujood, dikhne wale course par — is liye rows ki ginti mehdood) */
function bump(db: D1Database, day: string, e: { course: string; term: string; source: string; event: VuStat }): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO vu_stats (day, course_code, term, source, event, n) SELECT ?1, code, ?3, ?4, ?5, 1 FROM vu_courses WHERE code = ?2 AND visible = 1
       ON CONFLICT (day, course_code, term, source, event) DO UPDATE SET n = n + 1`,
    )
    .bind(day, e.course, e.term, e.source, e.event);
}

/** E38 POST /api/vu/event: { events: [{course, term, event, source}] } */
export async function recordEvents(request: Request, env: StatsEnv, deps: Deps = {}): Promise<ApiResult> {
  if (!sameOrigin(request)) return fail(403, 'origin', API_MSG.origin);
  const body = await readJson(request, 2 * 1024);
  if (!body.ok) return body.res;
  const p = v.safeParse(Body, body.data);
  if (!p.success) return fail(400, 'invalid', API_MSG.bad_json);
  if (!env.SESSION_SECRET) return fail(503, 'unavailable', API_MSG.unavailable);
  const now = clock(deps);
  try {
    const lim = await checkLimit(env.DB, env.SESSION_SECRET, { scope: 'vu:event', value: clientIp(request), ...EVENT_LIMIT }, now);
    if (!lim.allowed) return fail(429, 'rate_limited', 'Thori der baad koshish karein.');
    await env.DB.batch([...p.output.events.map((e) => bump(env.DB, pkDate(now), e)), lim.increment]);
    return ok();
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/** F34-AC4: order ban chuka; nishan + ginti. Kabhi order ko nahin rokta (caller catch karta hai). */
export async function tagOrder(db: D1Database, orderId: string, s: OrderSource, now: Date): Promise<void> {
  await db.batch([
    db.prepare('UPDATE orders SET source = ?1 WHERE id = ?2').bind(orderSource(s), orderId),
    bump(db, pkDate(now), { course: s.code, term: s.term, source: s.source, event: 'order' }),
  ]);
}

/** F34-AC6 */
export async function cleanVuStats(db: D1Database, now: Date): Promise<number> {
  const r = await db.prepare('DELETE FROM vu_stats WHERE day < ?1').bind(addDays(pkDate(now), -STATS_KEEP_DAYS)).run();
  return r.meta.changes ?? 0;
}

const zero = (): Counts => ({ view: 0, start: 0, done: 0, questions: 0, pack: 0, order: 0 });

/** E39 GET /api/admin/vu/report?days=7|30|90 */
export async function vuReport(request: Request, env: StatsEnv, deps: Deps = {}): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const raw = Number(new URL(request.url).searchParams.get('days'));
  const days = REPORT_DAYS.find((d) => d === raw) ?? 7;
  const to = pkDate(clock(deps));
  const from = addDays(to, -(days - 1));
  try {
    const [byCourse, bySource] = await env.DB.batch([
      env.DB.prepare(
        `SELECT s.course_code AS code, s.term, s.event, SUM(s.n) AS n,
                CASE s.term WHEN 'mid' THEN c.mid_ok + c.q_mid_ok ELSE c.final_ok + c.q_final_ok END AS has
         FROM vu_stats s LEFT JOIN vu_courses c ON c.code = s.course_code WHERE s.day >= ?1 GROUP BY s.course_code, s.term, s.event`,
      ).bind(from),
      env.DB.prepare('SELECT source, event, SUM(n) AS n FROM vu_stats WHERE day >= ?1 GROUP BY source, event').bind(from),
    ]);
    const total = zero();
    const rows = new Map<string, ReportRow>();
    for (const r of byCourse.results as { code: string; term: 'mid' | 'final'; event: VuStat; n: number; has: number | null }[]) {
      const k = `${r.code}:${r.term}`;
      const row = rows.get(k) ?? { code: r.code, term: r.term, ready: (r.has ?? 0) > 0, ...zero() };
      row[r.event] += r.n;
      total[r.event] += r.n;
      rows.set(k, row);
    }
    const src = new Map<VuSource, { source: VuSource } & Counts>();
    for (const r of bySource.results as { source: VuSource; event: VuStat; n: number }[]) {
      const row = src.get(r.source) ?? { source: r.source, ...zero() };
      row[r.event] += r.n;
      src.set(r.source, row);
    }
    const sort = <T extends Counts>(l: T[]) => l.sort((a, b) => b.order - a.order || b.view - a.view);
    const report: VuReport = { from, to, total, courses: sort([...rows.values()]), sources: [...src.values()].sort((a, b) => b.view - a.view || a.source.localeCompare(b.source)) };
    return ok({ report });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
