// spec: F31-AC1..AC3, AC5, AC6
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emptyHistory, homeHints, normalize, prune } from '../src/lib/history';
import { nextTest, packFor, readiness, recordVu, vuKey, vuShareText } from '../src/lib/vu-progress';
import { activeProducts, getProduct } from '../src/lib/catalog';
import { itemDetail } from '../src/lib/cart';
import { resolveFileHint } from '../src/lib/agent';
import { startD1 } from './helpers/d1';
import { makeOrder } from './helpers/admin';

const items = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: from + i, answerIndex: 1 }));
const ids = (from: number, n: number) => items(from, n).map((q) => q.id);
const K = vuKey('CS101', 'mid');
const rec = (h: ReturnType<typeof emptyHistory>, n: number, answers: Record<string, number>, validIds = ids(1, 6), list = items(1, 4)) => recordVu(h, K, { n, items: list, answers, validIds, at: '2026-11-24T10:00:00Z' });

describe('F31-AC1/AC2: progress aur tayyari', () => {
  it('sahih/ghalat/chhora; dobara dene par naya jawab, chhora hua purani halat mein', () => {
    let h = rec(emptyHistory(), 1, { 1: 1, 2: 1, 3: 0 });
    expect(h.vu[K]).toMatchObject({ right: [1, 2], wrong: [3], tests: { 1: { score: 2, total: 4 } }, total: 6 });
    expect(readiness(h.vu[K], ids(1, 6), 2)).toEqual({ right: 2, wrong: 1, total: 6, percent: 33, testsDone: 1, testsLeft: 1 });
    h = rec(h, 1, { 1: 0, 3: 1 });
    expect([...h.vu[K].right].sort()).toEqual([2, 3]);
    expect(h.vu[K].wrong).toEqual([1]);
    expect(h.vu[K].tests[1]).toEqual({ score: 1, total: 4 });
  });
  it('mitaye/chhupe sawal nahin ginte (meter aur mehfooz dono)', () => {
    const h = rec(emptyHistory(), 1, { 1: 1, 2: 1 });
    expect(readiness(h.vu[K], [2, 3, 4], 1)).toMatchObject({ right: 1, total: 3, percent: 33 });
    expect(rec(h, 2, { 5: 1 }, [2, 5, 6], items(5, 2)).vu[K].right).toEqual([2, 5]);
  });
  it('khali; agla test', () => {
    expect(readiness(undefined, [], 0)).toEqual({ right: 0, wrong: 0, total: 0, percent: 0, testsDone: 0, testsLeft: 0 });
    const h = rec(emptyHistory(), 1, { 1: 1 });
    expect(nextTest(undefined, 2)).toBe(1);
    expect(nextTest(h.vu[K], 2)).toBe(2);
    expect(nextTest(h.vu[K], 1)).toBeNull();
  });
  it('normalize: kharab data chhoot jata, sahih bachta; purana data (vu ke baghair) chalta', () => {
    const h = rec(emptyHistory(), 1, { 1: 1 });
    expect(normalize(JSON.parse(JSON.stringify(h)))).toEqual(h);
    expect(normalize({ v: 1 }).vu).toEqual({});
    expect(normalize({ v: 1, vu: { 'x:mid': h.vu[K], 'CS101:dono': h.vu[K], 'CS101:final': { right: 'a' }, [K]: { ...h.vu[K], right: [1, 'x', null] } } }).vu).toEqual({ [K]: { ...h.vu[K], right: [1] } });
  });
  it('F31-AC6: Home ke ishare, mocks, weakSubjects mein VU nahin; 200 KB had', () => {
    const h = rec(emptyHistory(), 1, { 1: 0, 2: 0 });
    expect(homeHints(h, '2026-11-24')).toEqual({ remindStreak: null, weak: null });
    expect([h.mocks, h.weakSubjects, h.bookmarks]).toEqual([{}, {}, []]);
    for (let i = 0; i < 300; i++) h.vu[`ZZ${100 + i}:mid`] = { right: ids(100000, 200), wrong: [], tests: {}, total: 200, at: `2026-01-01T00:${String(i % 60).padStart(2, '0')}:00Z` };
    const p = prune(h);
    expect(JSON.stringify(p).length).toBeLessThanOrEqual(200 * 1024);
    expect(Object.keys(p.vu).length).toBeGreaterThan(50);
    expect(p.vu[K]).toBeDefined(); // sab se naya
  });
});

describe('F31-AC3: pack', () => {
  it('49 Complete, 50 Smart, 79 Smart, 80 Quick; sab catalog mein', () => {
    expect([0, 49, 50, 79, 80, 100].map(packFor)).toEqual(['vu-complete', 'vu-complete', 'vu-smart', 'vu-smart', 'vu-quick', 'vu-quick']);
    for (const p of [0, 50, 80]) expect(getProduct(packFor(p))?.active).toBe(true);
  });
  it('4 packs mein ikhtiyari term; detail "CS101, Midterm"; file ka rasta term se nahin badalta', () => {
    const packs = activeProducts().filter((p) => p.door === 'vu');
    expect(packs).toHaveLength(4);
    for (const p of packs) {
      expect(p.fields.find((f) => f.key === 'term')).toMatchObject({ required: false, options: ['Midterm', 'Final Term'] });
      expect(resolveFileHint(p.fileHint, { courseCode: 'cs101', term: 'Midterm' })).toBe(resolveFileHint(p.fileHint, { courseCode: 'CS101' }));
    }
    expect(itemDetail({ fields: { courseCode: 'CS101', term: 'Midterm' } })).toBe(' (CS101, Midterm)');
  });
});

describe('asal order (server)', () => {
  let d1: Awaited<ReturnType<typeof startD1>>;
  beforeAll(async () => {
    d1 = await startD1();
  }, 60_000);
  afterAll(async () => d1?.dispose());
  it('term ke sath aur term ke baghair; qeemat server ki; ghalat term rad', async () => {
    const id = await makeOrder(d1.db, { items: [{ id: 'vu-smart', price: 1, fields: { courseCode: 'CS101', term: 'Final Term' } }] });
    const row = await d1.db.prepare('SELECT items_json, total FROM orders WHERE id = ?1').bind(id).first<{ items_json: string; total: number }>();
    expect(row!.total).toBe(350);
    expect(JSON.parse(row!.items_json)[0].fields).toEqual({ courseCode: 'CS101', term: 'Final Term' });
    await makeOrder(d1.db, { phone: '0300-7654321', items: [{ id: 'vu-smart', fields: { courseCode: 'CS101' } }] });
    await expect(makeOrder(d1.db, { phone: '0300-7654322', items: [{ id: 'vu-smart', fields: { courseCode: 'CS101', term: 'Dono' } }] })).rejects.toThrow('list mein se');
  });
});

it('F31-AC5: share matn', () => {
  expect(vuShareText('CS101 Midterm: Test 1', { score: 15, total: 20, percent: 75 }, 'https://gvs.test/vu-mock/cs101?term=mid&src=share')).toBe(
    'Main ne GVS Academy par "CS101 Midterm: Test 1" mein 15/20 (75%) liye. Aap bhi muft test dein: https://gvs.test/vu-mock/cs101?term=mid&src=share',
  );
});
