// spec: F29-AC1..AC4 (VU courses + sawal, admin), E26 courses, E27 sawal, E28 import, 8.7 (tukre, dobara jaanch), 9.2 (CSRF)
// VU ke sawal apni table mein hain; rozana test, /mcqs, mocks aur notes inhein kabhi nahin parhte (F29-AC4).
import * as v from 'valibot';
import { fail, ok, readJson, sameOrigin, API_MSG, type ApiResult } from './api';
import { adminPost, requireAdmin } from './admin-auth';
import { LIST_PAGE, mcqFromForm, type AdminMcq } from './admin-content';
import { IMPORT_MSG, type ContentEnv } from './content-import';
import { CHUNK, IMPORT_BODY_LIMIT } from './content-chunks';
import { PARSER_LIMITS, qHash, type ParsedMcq } from './parser';
import { codesInText, normalizeCode, parseCourseList, parseVuMcqs, VU_LIMITS, VU_TERMS, type VuTerm } from './vu';

type Deps = { now?: () => Date };
const nowIso = (d: Deps) => (d.now ?? (() => new Date()))().toISOString();

export const VU_ADMIN_MSG = {
  not_found: 'Yeh cheez nahin mili (shayad mit chuki).',
  invalid: 'Maloomat sahih shakal mein nahin.',
  course: 'Pehle course chunein.',
  has_mcqs: 'Is course mein sawal hain, is liye mitta nahin. Chahein to chhupa dein.',
  list: 'List mein ghaltiyan hain; kuch save nahin hua.',
  full: `Kul ${VU_LIMITS.courses} courses tak ho sakte hain.`,
  dup: 'Yeh sawal is course aur term mein pehle se hai.',
} as const;

const guardPost = async (request: Request, env: ContentEnv) => (await requireAdmin(request, env)) ?? adminPost(request);
const guardDelete = async (request: Request, env: ContentEnv) => (await requireAdmin(request, env)) ?? (sameOrigin(request) ? null : fail(403, 'origin', API_MSG.origin));
const unavailable = () => fail(503, 'unavailable', API_MSG.unavailable);
const isUnique = (e: unknown) => /UNIQUE/i.test(String((e as Error)?.message));

/** Course ki ginti (jaanche / kul): har tabdeeli ke batch ka aakhri hissa, taake list poori vu_mcqs na parhe */
function recount(db: D1Database, codes: string[]): D1PreparedStatement {
  const n = (term: VuTerm, okOnly: boolean) => `(SELECT COUNT(*) FROM vu_mcqs m WHERE m.course_code = vu_courses.code AND m.term = '${term}'${okOnly ? ' AND m.verified = 1' : ''})`;
  return db
    .prepare(
      `UPDATE vu_courses SET mid_ok = ${n('mid', true)}, mid_all = ${n('mid', false)}, final_ok = ${n('final', true)}, final_all = ${n('final', false)}
       WHERE code IN (SELECT value FROM json_each(?1))`,
    )
    .bind(JSON.stringify(codes));
}

// ======================= Courses (E26) =======================

export interface AdminCourse {
  code: string;
  name: string;
  visible: boolean;
  midOk: number;
  midAll: number;
  finalOk: number;
  finalAll: number;
}
type CourseRow = { code: string; name: string; visible: number; mid_ok: number; mid_all: number; final_ok: number; final_all: number };

export async function listCourses(request: Request, env: ContentEnv): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  try {
    const { results } = await env.DB.prepare(`SELECT code, name, visible, mid_ok, mid_all, final_ok, final_all FROM vu_courses ORDER BY code LIMIT ${VU_LIMITS.courses}`).all<CourseRow>();
    const items: AdminCourse[] = results.map((r) => ({ code: r.code, name: r.name, visible: r.visible === 1, midOk: r.mid_ok, midAll: r.mid_all, finalOk: r.final_ok, finalAll: r.final_all }));
    return ok({ items });
  } catch {
    return unavailable();
  }
}

const COURSE_BODY = 128 * 1024;
const CourseBody = v.variant('action', [
  v.object({ action: v.literal('add'), text: v.pipe(v.string(), v.maxLength(COURSE_BODY)) }),
  v.object({ action: v.literal('rename'), code: v.string(), name: v.pipe(v.string(), v.maxLength(500)) }),
  v.object({ action: v.literal('visible'), code: v.string(), visible: v.boolean() }),
]);

export async function saveCourses(request: Request, env: ContentEnv, deps: Deps = {}): Promise<ApiResult> {
  const denied = await guardPost(request, env);
  if (denied) return denied;
  const body = await readJson(request, COURSE_BODY);
  if (!body.ok) return body.res;
  const p = v.safeParse(CourseBody, body.data);
  if (!p.success) return fail(400, 'invalid', VU_ADMIN_MSG.invalid);
  const db = env.DB;
  const b = p.output;
  try {
    if (b.action === 'add') {
      const r = parseCourseList(b.text);
      if (r.errors.length) return { status: 400, body: { ok: false, error: { code: 'invalid', message: VU_ADMIN_MSG.list, errors: r.errors.slice(0, 20) } } };
      const json = JSON.stringify(r.items);
      const [old, total] = await db.batch([
        db.prepare("SELECT code FROM vu_courses WHERE code IN (SELECT json_extract(value, '$.code') FROM json_each(?1))").bind(json),
        db.prepare('SELECT COUNT(*) AS n FROM vu_courses'),
      ]);
      const existing = (old.results as { code: string }[]).map((x) => x.code);
      if ((total.results[0] as { n: number }).n + r.items.length - existing.length > VU_LIMITS.courses) return fail(400, 'full', VU_ADMIN_MSG.full);
      const ins = await db
        .prepare(
          `INSERT OR IGNORE INTO vu_courses (code, name, created_at)
           SELECT json_extract(value, '$.code'), json_extract(value, '$.name'), ?2 FROM json_each(?1) WHERE true RETURNING code`,
        )
        .bind(json, nowIso(deps))
        .all();
      return ok({ added: ins.results.length, existing });
    }
    const code = normalizeCode(b.code);
    if (!code) return fail(404, 'not_found', VU_ADMIN_MSG.not_found);
    let changes: number;
    if (b.action === 'rename') {
      // Wahi jaanch jo list ki line par hoti hai
      const r = parseCourseList(`${code} ${b.name.replace(/[\r\n]+/g, ' ')}`);
      if (r.errors.length) return fail(400, 'invalid', r.errors[0].message.replace(/^Line 1: /, ''));
      changes = (await db.prepare('UPDATE vu_courses SET name = ?2 WHERE code = ?1').bind(code, r.items[0].name).run()).meta.changes;
    } else {
      changes = (await db.prepare('UPDATE vu_courses SET visible = CAST(?2 AS INTEGER) WHERE code = ?1').bind(code, b.visible ? 1 : 0).run()).meta.changes;
    }
    return changes === 1 ? ok({ code }) : fail(404, 'not_found', VU_ADMIN_MSG.not_found);
  } catch {
    return unavailable();
  }
}

export async function deleteCourse(request: Request, env: ContentEnv, raw: string | undefined): Promise<ApiResult> {
  const denied = await guardDelete(request, env);
  if (denied) return denied;
  const code = normalizeCode(raw ?? '');
  if (!code) return fail(404, 'not_found', VU_ADMIN_MSG.not_found);
  try {
    const res = await env.DB.prepare('DELETE FROM vu_courses WHERE code = ?1 AND NOT EXISTS (SELECT 1 FROM vu_mcqs WHERE course_code = ?1)').bind(code).run();
    if (res.meta.changes === 1) return ok({ code });
    const there = await env.DB.prepare('SELECT 1 AS x FROM vu_courses WHERE code = ?1').bind(code).first();
    return there ? fail(409, 'has_mcqs', VU_ADMIN_MSG.has_mcqs) : fail(404, 'not_found', VU_ADMIN_MSG.not_found);
  } catch {
    return unavailable();
  }
}

// ======================= Sawal (E27) =======================

export interface VuMcq extends AdminMcq {
  term: VuTerm;
}
type Row = { id: number; course_code: string; term: VuTerm; question: string; options_json: string; answer_index: number; explanation: string | null; difficulty: string | null; verified: number };

/** Ek course ke sawal: term, verified, q, offset. Course lazmi hai (poori table kabhi nahin parhi jati). */
export async function listVuMcqs(request: Request, env: ContentEnv): Promise<ApiResult> {
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
    // INDEXED BY: warna ORDER BY id par SQLite poori table ulti parh sakta hai
    const { results } = await env.DB.prepare(
      `SELECT id, course_code, term, question, options_json, answer_index, explanation, difficulty, verified FROM vu_mcqs INDEXED BY idx_vu_mcqs_test
       WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ${LIST_PAGE + 1} OFFSET ${offset}`,
    )
      .bind(...binds)
      .all<Row>();
    const items: VuMcq[] = results.slice(0, LIST_PAGE).map((r) => ({
      id: r.id,
      subject: r.course_code,
      term: r.term,
      question: r.question,
      options: JSON.parse(r.options_json) as string[],
      answerIndex: r.answer_index,
      explanation: r.explanation,
      difficulty: r.difficulty,
      asOfDate: null,
      verified: r.verified === 1,
      mockId: null,
      mockName: null,
    }));
    return ok({ items, hasMore: results.length > LIST_PAGE });
  } catch {
    return unavailable();
  }
}

const McqBody = v.variant('action', [
  v.object({ action: v.literal('verify'), id: v.number(), verified: v.boolean() }),
  v.object({
    action: v.literal('save'),
    id: v.number(),
    question: v.pipe(v.string(), v.maxLength(2000)),
    options: v.pipe(v.array(v.pipe(v.string(), v.maxLength(1000))), v.maxLength(PARSER_LIMITS.maxOptions + 1)),
    answerIndex: v.number(),
    explanation: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(4000)))),
    difficulty: v.optional(v.nullable(v.string())),
  }),
]);

/** Jaancha/chhupa, ya badalna (course aur term nahin badalte) */
export async function saveVuMcq(request: Request, env: ContentEnv, deps: Deps = {}): Promise<ApiResult> {
  const denied = await guardPost(request, env);
  if (denied) return denied;
  const body = await readJson(request, 16 * 1024);
  if (!body.ok) return body.res;
  const p = v.safeParse(McqBody, body.data);
  if (!p.success) return fail(400, 'invalid', VU_ADMIN_MSG.invalid);
  const b = p.output;
  const db = env.DB;
  try {
    const row = await db.prepare('SELECT course_code AS code FROM vu_mcqs WHERE id = ?1').bind(b.id).first<{ code: string }>();
    if (!row) return fail(404, 'not_found', VU_ADMIN_MSG.not_found);
    if (b.action === 'verify') {
      // verified_at: naya jaancha sawal hamesha tests ki qatar ke aakhir mein (dobara tap waqt nahin badalta)
      await db.batch([
        db
          .prepare('UPDATE vu_mcqs SET verified_at = CASE WHEN ?1 = 0 THEN NULL WHEN verified = 1 THEN verified_at ELSE ?2 END, verified = CAST(?1 AS INTEGER) WHERE id = ?3')
          .bind(b.verified ? 1 : 0, nowIso(deps), b.id),
        recount(db, [row.code]),
      ]);
      return ok({ id: b.id, verified: b.verified });
    }
    const r = mcqFromForm({ ...b, subject: row.code }, [row.code]);
    if (!r.ok) return fail(400, 'invalid', r.message);
    const m = r.mcq;
    await db
      .prepare('UPDATE vu_mcqs SET question = ?1, options_json = ?2, answer_index = CAST(?3 AS INTEGER), explanation = ?4, difficulty = ?5, q_hash = ?6 WHERE id = ?7')
      .bind(m.question, JSON.stringify(m.options), m.answerIndex, m.explanation, m.difficulty, await qHash(m.question), b.id)
      .run();
    return ok({ id: b.id });
  } catch (e) {
    return isUnique(e) ? fail(409, 'dup', VU_ADMIN_MSG.dup) : unavailable();
  }
}

export async function deleteVuMcq(request: Request, env: ContentEnv, raw: string | undefined): Promise<ApiResult> {
  const denied = await guardDelete(request, env);
  if (denied) return denied;
  if (!raw || !/^[1-9]\d{0,9}$/.test(raw)) return fail(404, 'not_found', VU_ADMIN_MSG.not_found);
  const db = env.DB;
  try {
    const row = await db.prepare('SELECT course_code AS code FROM vu_mcqs WHERE id = ?1').bind(Number(raw)).first<{ code: string }>();
    if (!row) return fail(404, 'not_found', VU_ADMIN_MSG.not_found);
    await db.batch([db.prepare('DELETE FROM vu_mcqs WHERE id = ?1').bind(Number(raw)), recount(db, [row.code])]);
    return ok({ id: Number(raw) });
  } catch {
    return unavailable();
  }
}

// ======================= Import (E28) =======================

const ImportBody = v.object({
  text: v.pipe(v.string(), v.minLength(1), v.maxLength(IMPORT_BODY_LIMIT)),
  term: v.picklist(VU_TERMS),
  verified: v.boolean(),
});

/** Ek tukra (≤ 25 sawal). Ghalat ho to kuch nahin. Isi course + term ka pehle se maujood sawal chhoot jata hai (dobara bhejna mehfooz). */
export async function importVu(request: Request, env: ContentEnv, deps: Deps = {}): Promise<ApiResult> {
  const denied = await guardPost(request, env);
  if (denied) return denied;
  const body = await readJson(request, IMPORT_BODY_LIMIT + 1024);
  if (!body.ok) return body.res;
  const p = v.safeParse(ImportBody, body.data);
  if (!p.success) return fail(400, 'invalid', VU_ADMIN_MSG.invalid);
  const { text, term, verified } = p.output;
  const db = env.DB;
  try {
    const { results } = await db.prepare('SELECT code FROM vu_courses WHERE code IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(codesInText(text))).all<{ code: string }>();
    const r = parseVuMcqs(text, results.map((x) => x.code));
    if (r.errors.length) return { status: 400, body: { ok: false, error: { code: 'invalid', message: IMPORT_MSG.invalid, errors: r.errors.slice(0, 20) } } };
    const list = r.items as ParsedMcq[];
    if (!list.length) return fail(400, 'empty', IMPORT_MSG.empty);
    if (list.length > CHUNK.mcqs) return fail(400, 'chunk', `Ek dafa mein ${CHUNK.mcqs} sawal bhejein.`);
    const rows = await Promise.all(
      list.map(async (m) => ({ c: m.subject, q: m.question, o: JSON.stringify(m.options), a: m.answerIndex, e: m.explanation, d: m.difficulty, h: await qHash(m.question) })),
    );
    const [ins] = await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO vu_mcqs (course_code, term, question, options_json, answer_index, explanation, difficulty, verified, verified_at, created_at, q_hash)
           SELECT json_extract(value, '$.c'), ?2, json_extract(value, '$.q'), json_extract(value, '$.o'), json_extract(value, '$.a'), json_extract(value, '$.e'),
                  json_extract(value, '$.d'), CAST(?3 AS INTEGER), CASE WHEN ?3 = 1 THEN ?4 END, ?4, json_extract(value, '$.h')
           FROM json_each(?1) WHERE true ORDER BY key RETURNING id`,
        )
        .bind(JSON.stringify(rows), term, verified ? 1 : 0, nowIso(deps)),
      recount(db, [...new Set(rows.map((x) => x.c))]),
    ]);
    const saved = ins.results.length;
    return ok({ saved, skipped: rows.length - saved });
  } catch {
    return unavailable();
  }
}
