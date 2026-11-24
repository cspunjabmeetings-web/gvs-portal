// spec: F32-AC1 (admin: E34 list/badalna/mitana, E35 import), F32-AC2 (student: sirf jaanche), 8.7, 9.2
import * as v from 'valibot';
import { fail, ok, readJson, sameOrigin, API_MSG, type ApiResult } from './api';
import { adminPost, requireAdmin } from './admin-auth';
import { LIST_PAGE } from './admin-content';
import type { ContentEnv } from './content-import';
import { qHash } from './parser';
import { normalizeCode, VU_TERMS, type VuTerm } from './vu';
import { VU_ADMIN_MSG } from './vu-admin';
import { codesInSawal, parseSawal, SAWAL_LIMITS } from './vu-sawal';

type Deps = { now?: () => Date };
const nowIso = (d: Deps) => (d.now ?? (() => new Date()))().toISOString();
const unavailable = () => fail(503, 'unavailable', API_MSG.unavailable);

export interface VuQuestion {
  id: number;
  term: VuTerm;
  question: string;
  marks: number | null;
  verified: boolean;
}

/** Course ki ginti: har tabdeeli ke batch ka aakhri hissa */
function recount(db: D1Database, codes: string[]): D1PreparedStatement {
  const n = (term: VuTerm, okOnly: boolean) => `(SELECT COUNT(*) FROM vu_questions m WHERE m.course_code = vu_courses.code AND m.term = '${term}'${okOnly ? ' AND m.verified = 1' : ''})`;
  return db
    .prepare(
      `UPDATE vu_courses SET q_mid_ok = ${n('mid', true)}, q_mid_all = ${n('mid', false)}, q_final_ok = ${n('final', true)}, q_final_all = ${n('final', false)}
       WHERE code IN (SELECT value FROM json_each(?1))`,
    )
    .bind(JSON.stringify(codes));
}

/** S33: ek course + term ke jaanche sawal, jaanche jane ki tarteeb mein */
export async function publicQuestions(db: D1Database, code: string, term: VuTerm): Promise<{ id: number; question: string; marks: number | null }[]> {
  const { results } = await db
    .prepare('SELECT id, question, marks FROM vu_questions WHERE course_code = ?1 AND term = ?2 AND verified = 1 ORDER BY verified_at, id LIMIT 500')
    .bind(code, term)
    .all<{ id: number; question: string; marks: number | null }>();
  return results;
}

export async function listQuestions(request: Request, env: ContentEnv): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const u = new URL(request.url);
  const code = normalizeCode(u.searchParams.get('course') ?? '');
  if (!code) return fail(400, 'course', VU_ADMIN_MSG.course);
  const where = ['course_code = ?'];
  const binds: unknown[] = [code];
  const term = u.searchParams.get('term');
  if (term === 'mid' || term === 'final') where.push(`term = '${term}'`);
  const ver = u.searchParams.get('verified');
  if (ver === '0' || ver === '1') where.push(`verified = ${ver}`);
  const q = (u.searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q) {
    where.push('instr(lower(question), lower(?)) > 0');
    binds.push(q);
  }
  const offset = Math.max(0, Math.min(1_000_000, Math.floor(Number(u.searchParams.get('offset')) || 0)));
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, term, question, marks, verified FROM vu_questions INDEXED BY idx_vu_questions_list WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ${LIST_PAGE + 1} OFFSET ${offset}`,
    )
      .bind(...binds)
      .all<{ id: number; term: VuTerm; question: string; marks: number | null; verified: number }>();
    const items: VuQuestion[] = results.slice(0, LIST_PAGE).map((r) => ({ ...r, verified: r.verified === 1 }));
    return ok({ items, hasMore: results.length > LIST_PAGE });
  } catch {
    return unavailable();
  }
}

const Body = v.variant('action', [
  v.object({ action: v.literal('verify'), id: v.number(), verified: v.boolean() }),
  v.object({ action: v.literal('save'), id: v.number(), question: v.pipe(v.string(), v.maxLength(4000)), marks: v.nullable(v.number()) }),
]);

export async function saveQuestion(request: Request, env: ContentEnv, deps: Deps = {}): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? adminPost(request);
  if (denied) return denied;
  const body = await readJson(request, 16 * 1024);
  if (!body.ok) return body.res;
  const p = v.safeParse(Body, body.data);
  if (!p.success) return fail(400, 'invalid', VU_ADMIN_MSG.invalid);
  const b = p.output;
  const db = env.DB;
  try {
    const row = await db.prepare('SELECT course_code AS code FROM vu_questions WHERE id = ?1').bind(b.id).first<{ code: string }>();
    if (!row) return fail(404, 'not_found', VU_ADMIN_MSG.not_found);
    if (b.action === 'verify') {
      await db.batch([
        db
          .prepare('UPDATE vu_questions SET verified_at = CASE WHEN ?1 = 0 THEN NULL WHEN verified = 1 THEN verified_at ELSE ?2 END, verified = CAST(?1 AS INTEGER) WHERE id = ?3')
          .bind(b.verified ? 1 : 0, nowIso(deps), b.id),
        recount(db, [row.code]),
      ]);
      return ok({ id: b.id, verified: b.verified });
    }
    const question = b.question.replace(/\s+/g, ' ').trim();
    if (!question || [...question].length > SAWAL_LIMITS.question) return fail(400, 'invalid', `Sawal 1 se ${SAWAL_LIMITS.question} harf ka ho.`);
    if (b.marks !== null && !(Number.isInteger(b.marks) && b.marks >= 1 && b.marks <= SAWAL_LIMITS.marks)) return fail(400, 'invalid', `Marks 1 se ${SAWAL_LIMITS.marks} tak hon.`);
    await db.prepare('UPDATE vu_questions SET question = ?1, marks = CAST(?2 AS INTEGER), q_hash = ?3 WHERE id = ?4').bind(question, b.marks, await qHash(question), b.id).run();
    return ok({ id: b.id });
  } catch (e) {
    return /UNIQUE/i.test(String((e as Error)?.message)) ? fail(409, 'dup', VU_ADMIN_MSG.dup) : unavailable();
  }
}

export async function deleteQuestion(request: Request, env: ContentEnv, raw: string | undefined): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? (sameOrigin(request) ? null : fail(403, 'origin', API_MSG.origin));
  if (denied) return denied;
  if (!raw || !/^[1-9]\d{0,9}$/.test(raw)) return fail(404, 'not_found', VU_ADMIN_MSG.not_found);
  const db = env.DB;
  try {
    const row = await db.prepare('SELECT course_code AS code FROM vu_questions WHERE id = ?1').bind(Number(raw)).first<{ code: string }>();
    if (!row) return fail(404, 'not_found', VU_ADMIN_MSG.not_found);
    await db.batch([db.prepare('DELETE FROM vu_questions WHERE id = ?1').bind(Number(raw)), recount(db, [row.code])]);
    return ok({ id: Number(raw) });
  } catch {
    return unavailable();
  }
}

const MAX_BODY = 256 * 1024;
const ImportBody = v.object({ text: v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_BODY)), term: v.picklist(VU_TERMS), verified: v.boolean() });

/** E35: ek tukra (≤ 50). Ghalat ho to kuch nahin; pehle se maujood chhoot jata hai. */
export async function importQuestions(request: Request, env: ContentEnv, deps: Deps = {}): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? adminPost(request);
  if (denied) return denied;
  const body = await readJson(request, MAX_BODY);
  if (!body.ok) return body.res;
  const p = v.safeParse(ImportBody, body.data);
  if (!p.success) return fail(400, 'invalid', VU_ADMIN_MSG.invalid);
  const { text, term, verified } = p.output;
  const db = env.DB;
  try {
    const { results } = await db.prepare('SELECT code FROM vu_courses WHERE code IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(codesInSawal(text))).all<{ code: string }>();
    const r = parseSawal(text, results.map((x) => x.code));
    if (r.errors.length) return { status: 400, body: { ok: false, error: { code: 'invalid', message: VU_ADMIN_MSG.list, errors: r.errors.slice(0, 20) } } };
    if (r.items.length > SAWAL_LIMITS.chunk) return fail(400, 'chunk', `Ek dafa mein ${SAWAL_LIMITS.chunk} sawal bhejein.`);
    const rows = await Promise.all(r.items.map(async (x) => ({ c: x.course, q: x.question, m: x.marks, h: await qHash(x.question) })));
    const [ins] = await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO vu_questions (course_code, term, question, marks, verified, verified_at, created_at, q_hash)
           SELECT json_extract(value, '$.c'), ?2, json_extract(value, '$.q'), json_extract(value, '$.m'), CAST(?3 AS INTEGER), CASE WHEN ?3 = 1 THEN ?4 END, ?4, json_extract(value, '$.h')
           FROM json_each(?1) WHERE true ORDER BY key RETURNING id`,
        )
        .bind(JSON.stringify(rows), term, verified ? 1 : 0, nowIso(deps)),
      recount(db, [...new Set(rows.map((x) => x.c))]),
    ]);
    return ok({ saved: ins.results.length, skipped: rows.length - ins.results.length });
  } catch {
    return unavailable();
  }
}
