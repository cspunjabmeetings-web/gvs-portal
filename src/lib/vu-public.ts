// spec: F30-AC2..AC4, AC6 (student pages), E29 GET /api/vu/test, S31 /vu-mock, S32 /vu-mock/<code>
// Sirf jaanche sawal aur sirf dikhne wale courses. Ginti vu_courses ki row se (vu_mcqs poori kabhi nahin parhi jati).
import { fail, ok, API_MSG, type ApiResult } from './api';
import { activeProducts } from './catalog';
import type { QuizMcq } from './daily';
import { splitTests } from './vu-tests';
import { normalizeCode, VU_LIMITS, VU_TERMS, type VuTerm } from './vu';

export interface VuCourse {
  code: string;
  name: string;
  mid: number;
  final: number;
  /** F32: jaanche Important Questions */
  qMid: number;
  qFinal: number;
}
type Row = { code: string; name: string; mid_ok: number; final_ok: number; q_mid_ok: number; q_final_ok: number };
const toCourse = (r: Row): VuCourse => ({ code: r.code, name: r.name, mid: r.mid_ok, final: r.final_ok, qMid: r.q_mid_ok, qFinal: r.q_final_ok });

/** Course mein koi cheez hai (MCQs ya Important Questions) */
export const hasContent = (c: VuCourse) => c.mid + c.final + c.qMid + c.qFinal > 0;

/** Catalog ke qeemat wale VU packs (usool 7) */
export const vuPackList = () =>
  activeProducts()
    .filter((x) => x.door === 'vu' && x.price !== null)
    .map((x) => ({ id: x.id, name: x.name, price: x.price as number, includes: x.includes }));

/** S31: dikhne wale courses; sawal wale pehle, phir code ki tarteeb */
export async function vuCourses(db: D1Database): Promise<VuCourse[]> {
  const { results } = await db
    .prepare(`SELECT code, name, mid_ok, final_ok, q_mid_ok, q_final_ok FROM vu_courses WHERE visible = 1 ORDER BY (mid_ok + final_ok + q_mid_ok + q_final_ok = 0), code LIMIT ${VU_LIMITS.courses}`)
    .all<Row>();
  return results.map(toCourse);
}

/** S32: na mile / chhupa = null (404) */
export async function vuCourse(db: D1Database, code: string): Promise<VuCourse | null> {
  const r = await db.prepare('SELECT code, name, mid_ok, final_ok, q_mid_ok, q_final_ok FROM vu_courses WHERE code = ?1 AND visible = 1').bind(code).first<Row>();
  return r ? toCourse(r) : null;
}

/** F31-AC2: course ke jaanche sawal ke ids, tests ki tarteeb mein (meter mitaye/chhupe sawal na gine) */
export async function vuIds(db: D1Database, code: string): Promise<Record<VuTerm, number[]>> {
  const { results } = await db
    .prepare("SELECT id, term FROM vu_mcqs WHERE course_code = ?1 AND term IN ('mid', 'final') AND verified = 1 ORDER BY verified_at, id")
    .bind(code)
    .all<{ id: number; term: VuTerm }>();
  return { mid: results.filter((r) => r.term === 'mid').map((r) => r.id), final: results.filter((r) => r.term === 'final').map((r) => r.id) };
}

export const VU_TEST_MSG = { input: 'Test ka pata sahih nahin.', missing: 'Yeh test nahin mila. Page dobara kholen.' } as const;

type McqRow = { id: number; question: string; options_json: string; answer_index: number; explanation: string | null };

/** E29: ?course=cs101&term=mid&n=1 → us test ke jaanche sawal (jaanche jane ki tarteeb mein; do tests mein dohra nahin) */
export async function vuTestApi(request: Request, db: D1Database): Promise<ApiResult> {
  const u = new URL(request.url);
  const code = normalizeCode((u.searchParams.get('course') ?? '').slice(0, 20));
  const term = VU_TERMS.find((t) => t === u.searchParams.get('term')) as VuTerm | undefined;
  const raw = u.searchParams.get('n') ?? '';
  if (!code || !term || !/^[1-9]\d{0,3}$/.test(raw)) return fail(400, 'input', VU_TEST_MSG.input);
  try {
    const course = await vuCourse(db, code);
    const tests = course ? splitTests(course[term]) : [];
    const t = tests[Number(raw) - 1];
    if (!t) return fail(404, 'missing', VU_TEST_MSG.missing);
    const { results } = await db
      .prepare(
        `SELECT id, question, options_json, answer_index, explanation FROM vu_mcqs
         WHERE course_code = ?1 AND term = ?2 AND verified = 1 ORDER BY verified_at, id LIMIT CAST(?3 AS INTEGER) OFFSET CAST(?4 AS INTEGER)`,
      )
      .bind(code, term, t.size, t.from)
      .all<McqRow>();
    if (!results.length) return fail(404, 'missing', VU_TEST_MSG.missing);
    const items: QuizMcq[] = results.map((r) => ({ id: r.id, subject: code, question: r.question, options: JSON.parse(r.options_json) as string[], answerIndex: r.answer_index, explanation: r.explanation }));
    return ok({ items }, { 'Cache-Control': 'public, max-age=0, s-maxage=300' });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
