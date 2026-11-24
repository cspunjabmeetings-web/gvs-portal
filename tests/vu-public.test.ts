// spec: F30-AC2..AC4, AC6, E29
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, SECRET, SITE } from './helpers/admin';
import { importVu, saveCourses, saveVuMcq } from '../src/lib/vu-admin';
import { vuCourse, vuCourses, vuTestApi } from '../src/lib/vu-public';
import { minutesFor, searchKey, splitTests } from '../src/lib/vu-tests';
import { sitemapUrls } from '../src/lib/sitemap';
import type { QuizMcq } from '../src/lib/daily';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
let clock = Date.parse('2026-11-24T10:00:00Z');
const deps = () => ({ now: () => new Date((clock += 1000)) });

const courses = async (body: unknown) => (await saveCourses(await adminReq('/x', { body }), env(), deps())).status;
async function imp(n: number, term = 'mid', verified = true, from = 0) {
  for (let i = 0; i < n; i += 25) {
    const text = Array.from({ length: Math.min(25, n - i) }, (_, j) => `# MCQ\nMazmoon: CS101\nSawal: ${term} sawal ${from + i + j}?\nA) x\nB) y*\n---`).join('\n');
    const r = await importVu(await adminReq('/x', { body: { text, term, verified } }), env(), deps());
    if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  }
}
async function test(params: Record<string, string>) {
  const r = await vuTestApi(new Request(`${SITE}/api/vu/test?${new URLSearchParams({ course: 'cs101', term: 'mid', n: '1', ...params })}`), d1.db);
  return { status: r.status, items: ((r.body as { items?: QuizMcq[] }).items ?? []) as QuizMcq[] };
}

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => {
  await d1.reset();
  await courses({ action: 'add', text: 'CS101 Introduction to Computing\nAB101 Khali course\nMTH101 Calculus' });
});

describe('F30-AC3: splitTests', () => {
  it('43 = 20 + 23, 47 = 20 + 20 + 7', () => {
    const sizes = (n: number) => splitTests(n).map((t) => t.size);
    expect(sizes(0)).toEqual([]);
    expect(sizes(3)).toEqual([3]);
    expect(sizes(20)).toEqual([20]);
    expect(sizes(24)).toEqual([24]);
    expect(sizes(25)).toEqual([20, 5]);
    expect(sizes(43)).toEqual([20, 23]);
    expect(sizes(47)).toEqual([20, 20, 7]);
    for (let n = 0; n < 300; n++) {
      const t = splitTests(n);
      expect(t.reduce((a, x) => a + x.size, 0)).toBe(n);
      let from = 0;
      for (const x of t) (expect(x.from).toBe(from), (from += x.size));
    }
  });
  it('waqt: 20 → 25, 7 → 9; search kunji', () => {
    expect([20, 7, 23, 3].map(minutesFor)).toEqual([25, 9, 29, 4]);
    for (const s of ['CS 101', 'cs-101', ' Cs101']) expect(searchKey(s)).toBe('cs101');
  });
});

describe('E29', () => {
  it('47 jaanche: 3 tests, dohra nahin, na-jaanche aur final wale nahin', async () => {
    await imp(47);
    await imp(10, 'mid', false, 500);
    await imp(5, 'final', true, 900);
    const all = [await test({ n: '1' }), await test({ n: '2' }), await test({ n: '3' })];
    expect(all.map((t) => t.items.length)).toEqual([20, 20, 7]);
    const ids = all.flatMap((t) => t.items.map((q) => q.id));
    expect(new Set(ids).size).toBe(47);
    expect(all[0].items[0]).toMatchObject({ subject: 'CS101', question: 'mid sawal 0?', answerIndex: 1 });
    expect((await test({ n: '4' })).status).toBe(404);
    expect((await test({ term: 'final' })).items).toHaveLength(5);
  });
  it('baad mein jaancha sawal aakhir mein (pehla test nahin badalta)', async () => {
    await imp(1, 'mid', false, 700);
    await imp(25);
    const before = (await test({})).items.map((q) => q.id);
    const { id } = (await d1.db.prepare('SELECT id FROM vu_mcqs WHERE verified = 0').first<{ id: number }>())!;
    await saveVuMcq(await adminReq('/x', { body: { action: 'verify', id, verified: true } }), env(), deps());
    expect((await test({})).items.map((q) => q.id)).toEqual(before);
    expect((await test({ n: '2' })).items.at(-1)?.id).toBe(id);
  });
  it('ghalat input 400; khali, chhupa ya anjaan course 404', async () => {
    for (const p of [{ course: 'x' }, { term: 'dono' }, { n: '0' }, { n: '-1' }, { n: '1 OR 1' }, { n: '99999' }]) expect((await test(p as unknown as Record<string, string>)).status).toBe(400);
    expect((await test({ course: 'mth101' })).status).toBe(404);
    expect((await test({ course: 'zz999' })).status).toBe(404);
    await imp(5);
    expect((await test({})).status).toBe(200);
    await courses({ action: 'visible', code: 'CS101', visible: false });
    expect((await test({})).status).toBe(404);
  });
});

describe('F30-AC2 / AC6: list aur sitemap', () => {
  it('sawal wale pehle, phir code; chhupa nahin; sitemap mein sirf sawal wale', async () => {
    await imp(5);
    expect((await vuCourses(d1.db)).map((c) => c.code)).toEqual(['CS101', 'AB101', 'MTH101']);
    expect(await vuCourse(d1.db, 'CS101')).toEqual({ code: 'CS101', name: 'Introduction to Computing', mid: 5, final: 0 });
    const locs = async () => (await sitemapUrls(d1.db, `${SITE}/`)).map((u) => u.loc.replace(SITE, '')).filter((l) => l.startsWith('/vu-mock'));
    expect(await locs()).toEqual(['/vu-mock', '/vu-mock/cs101']);
    await courses({ action: 'visible', code: 'CS101', visible: false });
    expect(await vuCourse(d1.db, 'CS101')).toBeNull();
    expect(await locs()).toEqual(['/vu-mock']);
  });
});
