// spec: E06, F14-AC1..AC3 (mazameen + ginti, 10-10 sets, sirf verified, offset ≤ 10,000), S15, S16
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { subjectCards, subjectBySlug, practiceSet, practiceApi, PRACTICE_MSG, SET_SIZE } from '../src/lib/practice';
import { DEFAULT_SETTINGS } from '../src/lib/settings';

let d1: Awaited<ReturnType<typeof startD1>>;

async function seed(subject: string, n: number, verified = 1) {
  const rows = Array.from({ length: n }, (_, i) => ({ s: subject, q: `${subject} ${verified ? 'V' : 'U'} ${i}?` }));
  await d1.db
    .prepare(
      `INSERT INTO mcqs (subject, question, options_json, answer_index, explanation, verified, created_at)
       SELECT json_extract(value,'$.s'), json_extract(value,'$.q'), '["a","b"]', 0, NULL, ${verified}, 'x' FROM json_each(?1)`,
    )
    .bind(JSON.stringify(rows))
    .run();
}
const api = async (q: string) => {
  const r = await practiceApi(new Request(`https://gvs.test/api/mcqs?${q}`), d1.db);
  return { status: r.status, body: r.body as { ok: boolean; items: { question: string }[]; hasMore: boolean; total: number; error?: { message: string } }, headers: r.headers };
};

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('F14-AC1: mazameen ke cards', () => {
  it('Settings ki tarteeb, slug, sirf verified ginti; 0 wale bhi', async () => {
    await seed('English', 23);
    await seed('English', 5, 0);
    await seed('Pakistan Studies', 3);
    const cards = await subjectCards(d1.db);
    expect(cards.map((c) => c.subject)).toEqual(DEFAULT_SETTINGS.subjects);
    expect(cards.find((c) => c.subject === 'English')).toEqual({ subject: 'English', slug: 'english', count: 23 });
    expect(cards.find((c) => c.subject === 'Pakistan Studies')).toEqual({ subject: 'Pakistan Studies', slug: 'pakistan-studies', count: 3 });
    expect(cards.find((c) => c.subject === 'Urdu')?.count).toBe(0);
  });

  it('slug → mazmoon; ghalat slug null', async () => {
    expect(await subjectBySlug(d1.db, 'everyday-science')).toBe('Everyday Science');
    expect(await subjectBySlug(d1.db, 'physics')).toBeNull();
  });
});

describe('F14-AC2/AC3: sets', () => {
  it('23 sawal: 10, 10, 3; purane pehle; sirf verified', async () => {
    await seed('English', 23);
    await seed('English', 5, 0);
    const a = await practiceSet(d1.db, 'English', 0);
    expect(a.items).toHaveLength(SET_SIZE);
    expect(a.items[0].question).toBe('English V 0?');
    expect(a).toMatchObject({ hasMore: true, total: 23, offset: 0 });
    const b = await practiceSet(d1.db, 'English', 10);
    expect(b.items[0].question).toBe('English V 10?');
    const c = await practiceSet(d1.db, 'English', 20);
    expect(c.items.map((x) => x.question)).toEqual(['English V 20?', 'English V 21?', 'English V 22?']);
    expect(c.hasMore).toBe(false);
    expect([...a.items, ...b.items, ...c.items].every((x) => x.question.includes(' V '))).toBe(true);
  });

  it('10 bilkul: hasMore false', async () => {
    await seed('Urdu', 10);
    expect((await practiceSet(d1.db, 'Urdu', 0)).hasMore).toBe(false);
  });
});

describe('E06', () => {
  it('slug se set; jawab ke sath; s-maxage=300', async () => {
    await seed('Islamiat', 12);
    const r = await api('subject=islamiat&offset=10');
    expect(r.status).toBe(200);
    expect(r.body.items.map((x) => x.question)).toEqual(['Islamiat V 10?', 'Islamiat V 11?']);
    expect(r.body.items[0]).toMatchObject({ options: ['a', 'b'], answerIndex: 0 });
    expect(r.headers?.['Cache-Control']).toBe('public, max-age=0, s-maxage=300');
  });

  it('ghalat mazmoon, offset > 10,000, manfi/ajeeb offset → 400', async () => {
    expect((await api('subject=physics&offset=0')).body.error?.message).toBe(PRACTICE_MSG.subject);
    expect((await api('subject=english&offset=10001')).body.error?.message).toBe(PRACTICE_MSG.offset);
    expect((await api('subject=english&offset=-10')).status).toBe(400);
    expect((await api('subject=english&offset=1e3')).status).toBe(400);
    expect((await api('subject=english&offset=10000')).status).toBe(200);
    expect((await api('subject=english')).status).toBe(200);
  });

  it('database kharab → 503', async () => {
    const broken = { prepare: () => { throw new Error('x'); } } as unknown as D1Database;
    expect((await practiceApi(new Request('https://gvs.test/api/mcqs?subject=english'), broken)).status).toBe(503);
  });
});
