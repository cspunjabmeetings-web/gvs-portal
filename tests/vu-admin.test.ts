// spec: F29-AC1..AC4, E26-E28, 9.2
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, adminCookie, SECRET, SITE } from './helpers/admin';
import { normalizeCode, parseCourseList, parseVuMcqs } from '../src/lib/vu';
import { buildChunks } from '../src/lib/content-chunks';
import { listCourses, saveCourses, deleteCourse, listVuMcqs, saveVuMcq, deleteVuMcq, importVu, VU_ADMIN_MSG, type AdminCourse, type VuMcq } from '../src/lib/vu-admin';
import { dailyQuestions } from '../src/lib/daily';
import { subjectCards } from '../src/lib/practice';
import { publicMocks } from '../src/lib/mocks';
import { noteQuiz } from '../src/lib/notes';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
const T1 = new Date('2026-11-24T10:00:00Z');
type Body = Record<string, unknown> & { error?: { message: string; errors?: { line: number; message: string }[] }; items?: unknown[] };
type Fn = (r: Request, e: ReturnType<typeof env>, d?: { now?: () => Date }) => Promise<{ status: number; body: unknown }>;

async function post(fn: Fn, body: unknown, o: { cookie?: string | null; origin?: string } = {}, now = T1) {
  const r = await fn(await adminReq('/api/admin/vu/x', { body, ...o }), env(), { now: () => now });
  return { status: r.status, body: r.body as Body };
}
async function get(fn: Fn, params: Record<string, string> = {}, o: { cookie?: string | null } = {}) {
  const r = await fn(await adminReq(`/api/admin/vu/x?${new URLSearchParams(params)}`, o), env());
  return { status: r.status, body: r.body as Body };
}
async function del(fn: typeof deleteCourse, id: string, o: { cookie?: string | null; origin?: string } = {}) {
  const headers: Record<string, string> = { Origin: o.origin ?? SITE };
  if (o.cookie !== null) headers.Cookie = o.cookie ?? (await adminCookie());
  return fn(new Request(`${SITE}/api/admin/vu/x`, { method: 'DELETE', headers }), env(), id);
}
const add = (text: string) => post(saveCourses, { action: 'add', text });
const mcq = (q: string, code = 'CS101') => `# MCQ\nMazmoon: ${code}\nSawal: ${q}\nA) Ek\nB) Do*\nC) Teen\n---`;
const many = (n: number, from = 0) => Array.from({ length: n }, (_, i) => mcq(`Sawal number ${from + i}?`)).join('\n');
const imp = (text: string, term: string | undefined = 'mid', verified = true, now = T1) => post(importVu, { text, term, verified }, {}, now);
const courses = async () => (await get(listCourses)).body.items as AdminCourse[];
const list = async (p: Record<string, string> = {}) => (await get(listVuMcqs, { course: 'CS101', ...p })).body as unknown as { items: VuMcq[]; hasMore: boolean };

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('F29-AC1: code aur list', () => {
  it('code ki shaklein', () => {
    for (const s of ['cs101', 'CS 101', 'Cs-101', ' cs101 ']) expect(normalizeCode(s)).toBe('CS101');
    expect(normalizeCode('mgmt630')).toBe('MGMT630');
    expect(normalizeCode('cs101p')).toBe('CS101P');
    expect(normalizeCode('bt505t')).toBe('BT505T');
    expect(normalizeCode('BT 505T')).toBe('BT505T');
    for (const s of ['', 'CS', '101', 'CS1', 'CS1011', 'English', 'CS101xy', 'CS101 T', 'CS101T5']) expect(normalizeCode(s)).toBeNull();
  });
  it('har line; alag nishan; ghalat line number ke sath; isi list ka dohra', () => {
    const ok = parseCourseList('CS101 Introduction to Computing\r\n\nmth 101 - Calculus\nENG101: English, Comprehension');
    expect(ok.errors).toEqual([]);
    expect(ok.items).toEqual([
      { code: 'CS101', name: 'Introduction to Computing' },
      { code: 'MTH101', name: 'Calculus' },
      { code: 'ENG101', name: 'English, Comprehension' },
    ]);
    const bad = parseCourseList(`CS101 A\nEnglish\nCS201\ncs 101 B\nCS301 ${'x'.repeat(81)}`);
    expect(bad.errors.map((e) => e.line)).toEqual([2, 3, 4, 5]);
    expect(bad.errors[2].message).toContain('line 1');
    expect(parseCourseList(' \n').errors).toHaveLength(1);
    expect(parseCourseList(Array.from({ length: 501 }, (_, i) => `CS${100 + (i % 900)} N${i}`).join('\n')).errors).toHaveLength(1);
  });
  it('theory/practical code (BT505T, CS101P): list, MCQ, alag course, badalna, mitana', async () => {
    const l = parseCourseList('BT505T Molecular Biology Theory\nBT505P - Molecular Biology Practical\nBT505 Molecular Biology\nCS101 T Course');
    expect(l.errors).toEqual([]);
    expect(l.items.map((x) => x.code)).toEqual(['BT505T', 'BT505P', 'BT505', 'CS101']);
    expect(l.items[3].name).toBe('T Course');
    expect((await add('BT505T Theory\nbt505p Practical')).body).toMatchObject({ added: 2 });
    expect((await imp(mcq('Cell kya hai?', 'bt505t'))).body).toMatchObject({ saved: 1 });
    expect((await imp(mcq('Cell kya hai?', 'BT505P'))).body).toMatchObject({ saved: 1 });
    expect((await courses()).map((c) => [c.code, c.midOk])).toEqual([['BT505P', 1], ['BT505T', 1]]);
    expect((await post(saveCourses, { action: 'rename', code: 'bt505t', name: 'Naya' })).status).toBe(200);
    expect((await del(deleteCourse, 'BT505T')).status).toBe(409);
  });
  it('500 ek paste mein; dobara bhejne par sab pehle se', async () => {
    const text = Array.from({ length: 500 }, (_, i) => `CS${100 + i} Course number ${i} ka naam`).join('\n');
    expect((await add(text)).body).toMatchObject({ ok: true, added: 500, existing: [] });
    const again = await add(`${text.split('\n')[0]}\nMTH101 Calculus`);
    expect(again.body).toMatchObject({ added: 1, existing: ['CS100'] });
    expect(await courses()).toHaveLength(501);
  });
  it('kul had; ek bhi ghalat line to kuch nahin', async () => {
    await d1.db.prepare(`WITH RECURSIVE c(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM c WHERE i < 2000) INSERT INTO vu_courses (code, name, created_at) SELECT 'X' || i, 'n', 't' FROM c`).run();
    expect((await add('CS101 A')).body.error?.message).toBe(VU_ADMIN_MSG.full);
    await d1.reset();
    const r = await add('CS101 A\nghalat');
    expect(r.status).toBe(400);
    expect(r.body.error?.errors?.[0].line).toBe(2);
    expect(await courses()).toEqual([]);
  });
  it('naam badalna, chhupana, mitana (sawal hon to 409)', async () => {
    await add('CS101 Purana');
    expect((await post(saveCourses, { action: 'rename', code: 'cs 101', name: 'Naya naam' })).status).toBe(200);
    expect((await post(saveCourses, { action: 'rename', code: 'CS101', name: '  ' })).status).toBe(400);
    expect((await post(saveCourses, { action: 'visible', code: 'CS101', visible: false })).status).toBe(200);
    expect((await courses())[0]).toMatchObject({ code: 'CS101', name: 'Naya naam', visible: false });
    expect((await post(saveCourses, { action: 'visible', code: 'CS999', visible: false })).status).toBe(404);
    await imp(mcq('Ek sawal?'));
    expect((await del(deleteCourse, 'CS101')).status).toBe(409);
    const m = (await list()).items[0];
    expect((await del(deleteVuMcq, String(m.id))).status).toBe(200);
    expect((await del(deleteCourse, 'CS101')).status).toBe(200);
    expect((await del(deleteCourse, 'CS101')).status).toBe(404);
  });
});

describe('F29-AC2: import', () => {
  beforeEach(async () => {
    await add('CS101 Computing\nMTH101 Calculus');
  });
  it('100 sawal browser wale tukron mein; ginti; tarteeb', async () => {
    const r = parseVuMcqs(many(100), ['CS101']);
    expect(r.errors).toEqual([]);
    const chunks = buildChunks(r.items);
    expect(chunks).toHaveLength(4);
    for (const c of chunks) expect((await imp(c.text)).body).toMatchObject({ saved: 25, skipped: 0 });
    expect((await courses())[0]).toMatchObject({ code: 'CS101', midOk: 100, midAll: 100, finalAll: 0 });
    // Dobara bhejna mehfooz
    expect((await imp(chunks[0].text)).body).toMatchObject({ saved: 0, skipped: 25 });
    expect((await courses())[0].midAll).toBe(100);
  });
  it('"cs 101" bhi chalta hai; anjaan course, term na ho, doosri qism, 26 sawal → kuch save nahin', async () => {
    expect((await imp(mcq('A?', 'cs 101'))).status).toBe(200);
    const un = await imp(mcq('B?', 'CS999'));
    expect(un.status).toBe(400);
    expect(un.body.error?.errors?.[0]).toMatchObject({ line: 2 });
    expect(un.body.error?.errors?.[0].message).toContain('VU → Courses');
    expect((await post(importVu, { text: mcq('C?'), verified: true })).status).toBe(400);
    expect((await imp(mcq('C?'), 'dono')).status).toBe(400);
    expect((await imp('# MOCK\nNaam: X\nWaqt: 10\n' + mcq('D?') + '\n# END MOCK')).status).toBe(400);
    expect((await imp(many(26))).status).toBe(400);
    expect((await imp(`${mcq('Theek?')}\n# MCQ\nMazmoon: CS101\nSawal: Bina jawab?\nA) x\nB) y\n---`)).status).toBe(400);
    expect((await list()).items.map((m) => m.question)).toEqual(['A?']);
  });
  it('checkbox ke baghair na-jaanche; ek sawal mid + final + doosre course mein theek', async () => {
    await imp(mcq('Same?'), 'mid', false);
    expect((await imp(mcq('same ?'), 'final')).body).toMatchObject({ saved: 1 });
    expect((await imp(mcq('Same?', 'MTH101'))).body).toMatchObject({ saved: 1 });
    const [cs, mth] = await courses();
    expect(cs).toMatchObject({ midOk: 0, midAll: 1, finalOk: 1, finalAll: 1 });
    expect(mth).toMatchObject({ midOk: 1, midAll: 1 });
  });
});

describe('F29-AC3: list, badalna, jaancha, mitana', () => {
  beforeEach(async () => {
    await add('CS101 Computing\nMTH101 Calculus');
  });
  it('50-50, filters, search; course lazmi', async () => {
    for (let i = 0; i < 60; i += 20) await imp(many(20, i), 'mid', i < 40);
    await imp(mcq('Final wala %_ sawal?'), 'final');
    const a = await list();
    expect(a.items).toHaveLength(50);
    expect(a.hasMore).toBe(true);
    expect((await list({ offset: '50' })).items).toHaveLength(11);
    expect((await list({ term: 'final' })).items).toHaveLength(1);
    expect((await list({ verified: '0' })).items).toHaveLength(20);
    expect((await list({ q: '%_' })).items).toHaveLength(1);
    expect((await list({ course: 'MTH101' })).items).toHaveLength(0);
    expect((await get(listVuMcqs)).status).toBe(400);
  });
  it('jaancha: ginti aur verified_at (dobara tap waqt nahin badalta; chhupa kar dikhana = aakhir mein)', async () => {
    await imp(mcq('A?'), 'mid', false);
    const id = (await list()).items[0].id;
    const at = async () => (await d1.db.prepare('SELECT verified_at AS a FROM vu_mcqs WHERE id = ?1').bind(id).first<{ a: string | null }>())!.a;
    expect(await at()).toBeNull();
    const later = new Date('2026-11-25T10:00:00Z');
    await post(saveVuMcq, { action: 'verify', id, verified: true });
    await post(saveVuMcq, { action: 'verify', id, verified: true }, {}, later);
    expect(await at()).toBe(T1.toISOString());
    expect((await courses())[0].midOk).toBe(1);
    await post(saveVuMcq, { action: 'verify', id, verified: false });
    expect(await at()).toBeNull();
    expect((await courses())[0].midOk).toBe(0);
    await post(saveVuMcq, { action: 'verify', id, verified: true }, {}, later);
    expect(await at()).toBe(later.toISOString());
    expect((await post(saveVuMcq, { action: 'verify', id: 9999, verified: true })).status).toBe(404);
  });
  it('badalna: parser ke qaide; dohra 409; course/term wahi', async () => {
    await imp(`${mcq('A?')}\n${mcq('B?')}`);
    const [b, a] = (await list()).items;
    const base = { action: 'save', id: a.id, options: ['x', 'y'], answerIndex: 1 };
    expect((await post(saveVuMcq, { ...base, question: 'Naya A?' })).status).toBe(200);
    expect((await post(saveVuMcq, { ...base, question: 'B?' })).body.error?.message).toBe(VU_ADMIN_MSG.dup);
    expect((await post(saveVuMcq, { ...base, question: 'C?', options: ['x'] })).status).toBe(400);
    expect((await list()).items.find((m) => m.id === a.id)).toMatchObject({ question: 'Naya A?', options: ['x', 'y'], answerIndex: 1, subject: 'CS101', term: 'mid' });
    expect(b.question).toBe('B?');
  });
});

describe('9.2: hifazat', () => {
  it('bina cookie 401; ghalat Origin 403; kharab body 400', async () => {
    for (const fn of [listCourses, listVuMcqs]) expect((await get(fn, {}, { cookie: null })).status).toBe(401);
    for (const fn of [saveCourses, saveVuMcq, importVu] as Fn[]) {
      expect((await post(fn, {}, { cookie: null })).status).toBe(401);
      expect((await post(fn, {}, { origin: 'https://evil.test' })).status).toBe(403);
      expect((await post(fn, { action: 'udao' })).status).toBe(400);
    }
    for (const fn of [deleteCourse, deleteVuMcq]) {
      expect((await del(fn, '1', { cookie: null })).status).toBe(401);
      expect((await del(fn, '1', { origin: 'https://evil.test' })).status).toBe(403);
      expect((await del(fn, "1' OR 1")).status).toBe(404);
    }
  });
});

describe('F29-AC4: VU sawal purane hisson mein kabhi nahin', () => {
  it('rozana test, /mcqs, mocks, notes quiz, mcqs table', async () => {
    await add('CS101 Computing');
    for (let i = 0; i < 40; i += 20) await imp(many(20, i));
    expect((await d1.db.prepare('SELECT COUNT(*) AS n FROM mcqs').first<{ n: number }>())!.n).toBe(0);
    expect((await dailyQuestions(d1.db, T1)).items).toEqual([]);
    expect((await subjectCards(d1.db)).every((c) => c.count === 0)).toBe(true);
    expect(await publicMocks(d1.db)).toEqual([]);
    expect(await noteQuiz(d1.db, 'CS101', 'x')).toEqual([]);
  });
});
