// spec: SA8, E05, F13-AC1 (sab ke liye wohi 10, din Pakistan 00:00 par), F13-AC2 (verified, mila jula, 15 din no-repeat, pin), P-03
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { dailyQuestions, dailyTest, pickMixed, seededRandom, DAILY_COUNT } from '../src/lib/daily';
import { addDays } from '../src/lib/pkdate';

let d1: Awaited<ReturnType<typeof startD1>>;
const T = (date: string, hhmm = '10:00') => new Date(`${date}T${hhmm}:00+05:00`);

async function seed(n: number, o: { subject?: (i: number) => string; verified?: (i: number) => boolean } = {}) {
  const rows = Array.from({ length: n }, (_, i) => ({ s: o.subject?.(i) ?? ['English', 'Urdu', 'Islamiat', 'Maths'][i % 4], q: `Sawal ${i}?`, v: (o.verified?.(i) ?? true) ? 1 : 0 }));
  await d1.db
    .prepare(
      `INSERT INTO mcqs (subject, question, options_json, answer_index, explanation, verified, created_at)
       SELECT json_extract(value,'$.s'), json_extract(value,'$.q'), '["a","b","c"]', 1, 'T', json_extract(value,'$.v'), 'x' FROM json_each(?1)`,
    )
    .bind(JSON.stringify(rows))
    .run();
}
const ids = (r: { items: { id: number }[] }) => r.items.map((x) => x.id);

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('SA8 / E05', () => {
  it('10 sawal, jawab + tashreeh ke sath; sab ke liye wohi (daily_pins auto mein mehfooz)', async () => {
    await seed(40);
    const a = await dailyQuestions(d1.db, T('2026-11-18', '09:00'));
    expect(a.date).toBe('2026-11-18');
    expect(a.items).toHaveLength(DAILY_COUNT);
    expect(a.items[0]).toMatchObject({ options: ['a', 'b', 'c'], answerIndex: 1, explanation: 'T' });
    const b = await dailyQuestions(d1.db, T('2026-11-18', '23:30'));
    expect(ids(b)).toEqual(ids(a));
    const pin = await d1.db.prepare("SELECT source FROM daily_pins WHERE date = '2026-11-18'").first<{ source: string }>();
    expect(pin?.source).toBe('auto');
  });

  it('naya sawal din ke beech add ho to bhi aaj ke wohi (F13-AC1)', async () => {
    await seed(40);
    const a = await dailyQuestions(d1.db, T('2026-11-18'));
    await seed(40);
    expect(ids(await dailyQuestions(d1.db, T('2026-11-18', '20:00')))).toEqual(ids(a));
  });

  it('Pakistan 00:00 par naya din (UTC 19:00)', async () => {
    await seed(40);
    expect((await dailyQuestions(d1.db, new Date('2026-11-18T18:59:00Z'))).date).toBe('2026-11-18');
    expect((await dailyQuestions(d1.db, new Date('2026-11-18T19:00:00Z'))).date).toBe('2026-11-19');
  });

  it('sirf verified (F13-AC2)', async () => {
    await seed(30, { verified: (i) => i % 2 === 0 });
    const { results } = await d1.db.prepare('SELECT id FROM mcqs WHERE verified = 0').all<{ id: number }>();
    const bad = new Set(results.map((r) => r.id));
    expect(ids(await dailyQuestions(d1.db, T('2026-11-18'))).some((i) => bad.has(i))).toBe(false);
  });

  it('mazameen mile jule: 4 mazameen → har ek se 2-3', async () => {
    await seed(40);
    const r = await dailyQuestions(d1.db, T('2026-11-18'));
    const per = new Map<string, number>();
    for (const q of r.items) per.set(q.subject, (per.get(q.subject) ?? 0) + 1);
    expect([...per.values()].sort()).toEqual([2, 2, 3, 3]);
  });

  it('pichhle 15 din ke sawal nahin dohrate (160 sawal, 16 din)', async () => {
    await seed(160);
    const seen = new Set<number>();
    for (let d = 0; d < 16; d++) {
      const r = await dailyQuestions(d1.db, T(addDays('2026-11-01', d)));
      for (const id of ids(r)) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
    expect(seen.size).toBe(160);
  });

  it('15 din ke baad dobara aa sakte hain; sawal kam hon to purane bhi (test khali nahin)', async () => {
    await seed(12);
    const a = await dailyQuestions(d1.db, T('2026-11-01'));
    const b = await dailyQuestions(d1.db, T('2026-11-02'));
    expect(a.items).toHaveLength(10);
    expect(b.items).toHaveLength(10); // 12 mein se 10 kal use hue, 2 fresh → saare se chunao
  });

  it('owner ka pin (source pin) wohi tarteeb; chhupa/mita sawal chhoot jata hai', async () => {
    await seed(20);
    await d1.db.prepare("INSERT INTO daily_pins (date, mcq_ids_json, source) VALUES ('2026-11-20', '[5,3,1,999]', 'pin')").run();
    await d1.db.prepare('UPDATE mcqs SET verified = 0 WHERE id = 3').run();
    expect(ids(await dailyQuestions(d1.db, T('2026-11-20')))).toEqual([5, 1]);
  });

  it('10 se kam verified: jo hain woh, aur mehfooz nahin (owner ke naye sawal aaj hi aa saken)', async () => {
    await seed(4);
    expect((await dailyQuestions(d1.db, T('2026-11-18'))).items).toHaveLength(4);
    expect(await d1.db.prepare("SELECT COUNT(*) n FROM daily_pins").first<{ n: number }>()).toEqual({ n: 0 });
    await seed(10);
    expect((await dailyQuestions(d1.db, T('2026-11-18', '12:00'))).items).toHaveLength(10);
    expect(await d1.db.prepare("SELECT COUNT(*) n FROM daily_pins").first<{ n: number }>()).toEqual({ n: 1 });
  });

  it('koi sawal nahin → khali list (200); cache header s-maxage=300', async () => {
    const r = await dailyTest(d1.db, T('2026-11-18'));
    expect(r.status).toBe(200);
    expect((r.body as { items: unknown[] }).items).toEqual([]);
    expect(r.headers?.['Cache-Control']).toBe('public, max-age=0, s-maxage=300');
  });

  it('database kharab → 503', async () => {
    const broken = { prepare: () => { throw new Error('x'); } } as unknown as D1Database;
    expect((await dailyTest(broken)).status).toBe(503);
  });
});

describe('pickMixed + seededRandom', () => {
  it('ek seed = ek nateeja; doosra seed = doosra', () => {
    const pool = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, subject: ['A', 'B', 'C'][i % 3] }));
    expect(pickMixed(pool, 10, '2026-11-18')).toEqual(pickMixed(pool, 10, '2026-11-18'));
    expect(pickMixed(pool, 10, '2026-11-18')).not.toEqual(pickMixed(pool, 10, '2026-11-19'));
    expect(new Set(pickMixed(pool, 10, 'x')).size).toBe(10);
    const r = seededRandom('a');
    const v = r();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});
