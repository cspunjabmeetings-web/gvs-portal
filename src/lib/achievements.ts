// spec: F33-AC1, AC2 (admin, E37), F33-AC3..AC5 (student, E36), 9.2
import * as v from 'valibot';
import { fail, ok, readJson, sameOrigin, API_MSG, type ApiResult } from './api';
import { adminPost, requireAdmin } from './admin-auth';
import type { ContentEnv } from './content-import';
import { ACH_LIMITS, checkAchievement, type Achievement, type Kind, type Place } from './achievements-rules';

type Deps = { now?: () => Date };
const unavailable = () => fail(503, 'unavailable', API_MSG.unavailable);
export const ACH_MSG = { invalid: 'Maloomat sahih shakal mein nahin.', not_found: 'Yeh entry nahin mili (shayad mit chuki).', full: `Kul ${ACH_LIMITS.total} entries tak.`, place: 'Jagah sahih nahin.' } as const;

type Row = { id: number; kind: Kind; body: string; person: string | null; course_code: string | null; semester: string | null; rating: number | null };
const toPublic = (r: Row): Achievement => ({ id: r.id, kind: r.kind, body: r.body, person: r.person, course: r.course_code, semester: r.semester, rating: r.rating });

/** Student ko: sirf dikhne wali, is jagah ki; ghalti par khali (patti ke liye page kabhi na toote) */
export async function publicAchievements(db: D1Database, place: 'vu' | 'job'): Promise<Achievement[]> {
  try {
    const { results } = await db
      .prepare("SELECT id, kind, body, person, course_code, semester, rating FROM achievements WHERE visible = 1 AND place IN (?1, 'both') ORDER BY sort, id LIMIT 50")
      .bind(place)
      .all<Row>();
    return results.map(toPublic);
  } catch {
    return [];
  }
}

/** E36 GET /api/achievements?place=job|vu (rozana test ke static page ke liye) */
export async function achievementsApi(request: Request, db: D1Database): Promise<ApiResult> {
  const place = new URL(request.url).searchParams.get('place');
  if (place !== 'vu' && place !== 'job') return fail(400, 'place', ACH_MSG.place);
  return ok({ items: await publicAchievements(db, place) }, { 'Cache-Control': 'public, max-age=0, s-maxage=300' });
}

export interface AdminAchievement extends Achievement {
  place: Place;
  visible: boolean;
  confirmedAt: string;
}

export async function listAchievements(request: Request, env: ContentEnv): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, kind, body, person, course_code, semester, rating, place, visible, confirmed_at FROM achievements ORDER BY sort, id LIMIT ${ACH_LIMITS.total}`,
    ).all<Row & { place: Place; visible: number; confirmed_at: string }>();
    const items: AdminAchievement[] = results.map((r) => ({ ...toPublic(r), place: r.place, visible: r.visible === 1, confirmedAt: r.confirmed_at }));
    return ok({ items });
  } catch {
    return unavailable();
  }
}

const str = (n: number) => v.pipe(v.string(), v.maxLength(n));
const Body = v.variant('action', [
  v.object({
    action: v.literal('save'),
    id: v.optional(v.number()),
    kind: v.picklist(['achievement', 'remark']),
    body: str(1000),
    person: str(200),
    course: str(40),
    semester: str(200),
    rating: v.nullable(v.number()),
    place: v.picklist(['vu', 'job', 'both']),
    confirm: v.boolean(),
  }),
  v.object({ action: v.literal('visible'), id: v.number(), visible: v.boolean() }),
  v.object({ action: v.literal('move'), id: v.number(), dir: v.picklist(['up', 'down']) }),
]);

export async function saveAchievement(request: Request, env: ContentEnv, deps: Deps = {}): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? adminPost(request);
  if (denied) return denied;
  const body = await readJson(request, 8 * 1024);
  if (!body.ok) return body.res;
  const p = v.safeParse(Body, body.data);
  if (!p.success) return fail(400, 'invalid', ACH_MSG.invalid);
  const b = p.output;
  const db = env.DB;
  const missing = () => fail(404, 'not_found', ACH_MSG.not_found);
  try {
    if (b.action === 'visible') {
      const r = await db.prepare('UPDATE achievements SET visible = CAST(?1 AS INTEGER) WHERE id = ?2').bind(b.visible ? 1 : 0, b.id).run();
      return r.meta.changes === 1 ? ok({ id: b.id }) : missing();
    }
    if (b.action === 'move') {
      const { results } = await db.prepare('SELECT id, sort FROM achievements ORDER BY sort, id').all<{ id: number; sort: number }>();
      const i = results.findIndex((x) => x.id === b.id);
      if (i < 0) return missing();
      const other = results[b.dir === 'up' ? i - 1 : i + 1];
      if (!other) return ok({ id: b.id });
      await db.batch([
        db.prepare('UPDATE achievements SET sort = CAST(?1 AS INTEGER) WHERE id = ?2').bind(other.sort, b.id),
        db.prepare('UPDATE achievements SET sort = CAST(?1 AS INTEGER) WHERE id = ?2').bind(results[i].sort, other.id),
      ]);
      return ok({ id: b.id });
    }
    const c = checkAchievement(b);
    if (!c.ok) return fail(400, 'invalid', c.message);
    const x = c.value;
    const at = (deps.now ?? (() => new Date()))().toISOString();
    const vals = [x.kind, x.body, x.person, x.course, x.semester, x.rating, x.place, at];
    if (b.id !== undefined) {
      const r = await db
        .prepare('UPDATE achievements SET kind = ?1, body = ?2, person = ?3, course_code = ?4, semester = ?5, rating = CAST(?6 AS INTEGER), place = ?7, confirmed_at = ?8 WHERE id = ?9')
        .bind(...vals, b.id)
        .run();
      return r.meta.changes === 1 ? ok({ id: b.id }) : missing();
    }
    // Nayi sab se upar; har sort alag (move isi par chalta hai)
    const row = await db
      .prepare(
        `INSERT INTO achievements (kind, body, person, course_code, semester, rating, place, confirmed_at, created_at, sort)
         SELECT ?1, ?2, ?3, ?4, ?5, CAST(?6 AS INTEGER), ?7, ?8, ?8, COALESCE(MIN(sort), 0) - 1 FROM achievements HAVING COUNT(*) < ${ACH_LIMITS.total} RETURNING id`,
      )
      .bind(...vals)
      .first<{ id: number }>();
    return row ? ok({ id: row.id }) : fail(400, 'full', ACH_MSG.full);
  } catch {
    return unavailable();
  }
}

export async function deleteAchievement(request: Request, env: ContentEnv, raw: string | undefined): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? (sameOrigin(request) ? null : fail(403, 'origin', API_MSG.origin));
  if (denied) return denied;
  if (!raw || !/^[1-9]\d{0,9}$/.test(raw)) return fail(404, 'not_found', ACH_MSG.not_found);
  try {
    const r = await env.DB.prepare('DELETE FROM achievements WHERE id = ?1').bind(Number(raw)).run();
    return r.meta.changes === 1 ? ok({ id: Number(raw) }) : fail(404, 'not_found', ACH_MSG.not_found);
  } catch {
    return unavailable();
  }
}
