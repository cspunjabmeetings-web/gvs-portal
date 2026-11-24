// spec: F32-AC1, AC2, AC5, E34, E35, 9.2
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, adminCookie, SECRET, SITE } from './helpers/admin';
import { deleteCourse, listCourses, saveCourses, type AdminCourse } from '../src/lib/vu-admin';
import { deleteQuestion, importQuestions, listQuestions, publicQuestions, saveQuestion, type VuQuestion } from '../src/lib/vu-questions';
import { codesInSawal, parseSawal } from '../src/lib/vu-sawal';
import { hasContent, vuCourse, vuCourses } from '../src/lib/vu-public';
import { sitemapUrls } from '../src/lib/sitemap';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
let clock = Date.parse('2026-11-24T10:00:00Z');
const deps = () => ({ now: () => new Date((clock += 1000)) });
type Fn = (r: Request, e: ReturnType<typeof env>, d?: { now?: () => Date }) => Promise<{ status: number; body: unknown }>;
type Body = Record<string, unknown> & { error?: { message: string; errors?: { line: number; message: string }[] } };
async function post(fn: Fn, body: unknown, o: { cookie?: string | null; origin?: string } = {}) {
  const r = await fn(await adminReq('/x', { body, ...o }), env(), deps());
  return { status: r.status, body: r.body as Body };
}
async function del(fn: typeof deleteQuestion, id: string, o: { cookie?: string | null; origin?: string } = {}) {
  const headers: Record<string, string> = { Origin: o.origin ?? SITE };
  if (o.cookie !== null) headers.Cookie = o.cookie ?? (await adminCookie());
  return (await fn(new Request(`${SITE}/x`, { method: 'DELETE', headers }), env(), id)).status;
}
const sawal = (q: string, code = 'CS101', marks?: number | string) => `# SAWAL\nCourse: ${code}\nSawal: ${q}${marks ? `\nMarks: ${marks}` : ''}\n---`;
const imp = (text: string, term: string | undefined = 'mid', verified = true) => post(importQuestions, { text, term, verified });
const list = async (p: Record<string, string> = {}) => (await listQuestions(await adminReq(`/x?${new URLSearchParams({ course: 'CS101', ...p })}`), env())).body as unknown as { items: VuQuestion[]; hasMore: boolean };
const course = async (code = 'CS101') => ((await listCourses(await adminReq('/x'), env())).body as unknown as { items: AdminCourse[] }).items.find((c) => c.code === code)!;

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => {
  await d1.reset();
  await post(saveCourses, { action: 'add', text: 'CS101 Computing\nMTH101 Calculus' });
});

describe('# SAWAL parser', () => {
  it('sahih: multi-line sawal, marks ikhtiyari, "---" bhool jaye, cs 101, CRLF', () => {
    const r = parseSawal('# SAWAL\r\nCourse: cs 101\r\nSawal: RAM aur ROM\r\nmein farq batayen?\r\nMarks: 5\r\n# sawal\r\nMazmoon: CS101\r\nSawal: Doosra?', ['CS101']);
    expect(r.errors).toEqual([]);
    expect(r.items).toMatchObject([
      { course: 'CS101', question: 'RAM aur ROM mein farq batayen?', marks: 5, line: 1 },
      { course: 'CS101', question: 'Doosra?', marks: null, line: 6 },
    ]);
    expect(parseSawal(r.items.map((x) => x.source).join('\n'), ['CS101']).items.map((x) => x.question)).toEqual(r.items.map((x) => x.question));
  });
  it('ghaltiyan line ke sath; sahih wale phir bhi milte hain; Jawab mana; doosri qism mana', () => {
    const r = parseSawal(`${sawal('Theek?')}\n# SAWAL\nCourse: CS999\nSawal: x\n---\n# SAWAL\nCourse: CS101\nMarks: 500\n---\n# SAWAL\nCourse: CS101\nSawal: y\nJawab: raaz\n---`, ['CS101']);
    expect(r.items).toHaveLength(1);
    expect(r.errors.map((e) => e.line)).toEqual([6, 9, 11, 16]);
    expect(parseSawal('# MCQ\nMazmoon: CS101\n---', ['CS101']).errors[0].message).toContain('sirf # SAWAL');
    expect(parseSawal('aise hi', []).errors).toHaveLength(1);
    expect(parseSawal('', []).errors).toHaveLength(1);
    expect(parseSawal(sawal('x'.repeat(1001)), ['CS101']).items).toHaveLength(0);
    expect(codesInSawal('Course: cs 101\r\nMazmoon: MTH101\n')).toEqual(['CS101', 'MTH101']);
  });
});

describe('import + list (E34, E35)', () => {
  it('100 sawal (50-50), ginti, dohra chhoot jata hai, term alag', async () => {
    const many = (n: number, f: number) => Array.from({ length: n }, (_, i) => sawal(`Sawal ${f + i}?`, 'CS101', 5)).join('\n');
    for (const f of [0, 50]) expect((await imp(many(50, f))).body).toMatchObject({ saved: 50, skipped: 0 });
    expect((await imp(many(50, 0))).body).toMatchObject({ saved: 0, skipped: 50 });
    expect((await imp(sawal('Sawal 1?'), 'final')).body).toMatchObject({ saved: 1 });
    expect(await course()).toMatchObject({ qMidOk: 100, qMidAll: 100, qFinalOk: 1, qFinalAll: 1, midAll: 0 });
    const a = await list();
    expect(a.items).toHaveLength(50);
    expect(a.hasMore).toBe(true);
    expect((await list({ term: 'final' })).items).toHaveLength(1);
    expect((await list({ q: 'sawal 42' })).items).toHaveLength(1);
    expect((await imp(many(51, 200))).status).toBe(400);
  });
  it('anjaan course, term na ho, ek bhi ghalat → kuch save nahin', async () => {
    const un = await imp(`${sawal('A?')}\n${sawal('B?', 'CS999')}`);
    expect(un.status).toBe(400);
    expect(un.body.error?.errors?.[0].line).toBe(6);
    expect((await post(importQuestions, { text: sawal('A?'), verified: true })).status).toBe(400);
    expect((await list()).items).toEqual([]);
  });
  it('badalna, dohra 409, marks ki had, mitana, sawal wala course nahin mitta', async () => {
    await imp(`${sawal('A?')}\n${sawal('B?')}`);
    const [, a] = (await list()).items;
    const save = (o: Record<string, unknown>) => post(saveQuestion, { action: 'save', id: a.id, question: 'Naya?', marks: 10, ...o });
    expect((await save({})).status).toBe(200);
    expect((await save({ question: 'B?' })).status).toBe(409);
    for (const bad of [{ marks: 0 }, { marks: 101 }, { marks: 1.5 }, { question: '  ' }]) expect((await save(bad)).status).toBe(400);
    expect((await list()).items[1]).toMatchObject({ question: 'Naya?', marks: 10 });
    expect((await deleteCourse(new Request(`${SITE}/x`, { method: 'DELETE', headers: { Origin: SITE, Cookie: await adminCookie() } }), env(), 'CS101')).status).toBe(409);
    for (const m of (await list()).items) expect(await del(deleteQuestion, String(m.id))).toBe(200);
    expect(await course()).toMatchObject({ qMidOk: 0, qMidAll: 0 });
    expect(await del(deleteQuestion, '999')).toBe(404);
  });
});

describe('student (F32-AC2, AC5)', () => {
  it('sirf jaanche; jaanche jane ki tarteeb; jawab ka column hi nahin', async () => {
    await imp(sawal('Chhupa?'), 'mid', false);
    await imp(`${sawal('Pehla?', 'CS101', 5)}\n${sawal('Doosra?')}`);
    expect((await publicQuestions(d1.db, 'CS101', 'mid')).map((q) => q.question)).toEqual(['Pehla?', 'Doosra?']);
    expect(await publicQuestions(d1.db, 'CS101', 'final')).toEqual([]);
    const { id } = (await list({ verified: '0' })).items[0];
    await post(saveQuestion, { action: 'verify', id, verified: true });
    expect((await publicQuestions(d1.db, 'CS101', 'mid')).at(-1)?.question).toBe('Chhupa?');
    const cols = (await d1.db.prepare("SELECT name FROM pragma_table_info('vu_questions')").all<{ name: string }>()).results.map((r) => r.name);
    expect(cols.some((c) => /answer|jawab/i.test(c))).toBe(false);
  });
  it('sirf Important Questions wala course: list mein upar, sitemap mein dono pages', async () => {
    await imp(sawal('X?', 'MTH101'), 'final');
    expect((await vuCourses(d1.db)).map((c) => c.code)).toEqual(['MTH101', 'CS101']);
    const c = (await vuCourse(d1.db, 'MTH101'))!;
    expect([hasContent(c), c.qMid, c.qFinal]).toEqual([true, 0, 1]);
    const locs = (await sitemapUrls(d1.db, `${SITE}/`)).map((u) => u.loc.replace(SITE, '')).filter((l) => l.startsWith('/vu-mock/'));
    expect(locs).toEqual(['/vu-mock/mth101', '/vu-mock/mth101/questions']);
  });
});

it('9.2: 401, 403, 400', async () => {
  expect((await listQuestions(await adminReq('/x?course=CS101', { cookie: null }), env())).status).toBe(401);
  expect((await listQuestions(await adminReq('/x'), env())).status).toBe(400);
  for (const fn of [saveQuestion, importQuestions] as Fn[]) {
    expect((await post(fn, {}, { cookie: null })).status).toBe(401);
    expect((await post(fn, {}, { origin: 'https://evil.test' })).status).toBe(403);
    expect((await post(fn, { action: 'udao' })).status).toBe(400);
  }
  expect(await del(deleteQuestion, '1', { cookie: null })).toBe(401);
  expect(await del(deleteQuestion, '1', { origin: 'https://evil.test' })).toBe(403);
});
