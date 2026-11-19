// spec: S18, S19, F15-AC1 (list: naam, sawal, waqt), F15-AC8 (saare sawal ek dafa, ≤ 100), sirf verified sawal; chhupa mock 404
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, SECRET } from './helpers/admin';
import { importChunk } from '../src/lib/content-import';
import { publicMocks, mockBySlug, isMockSlug, MOCK_MAX_QUESTIONS } from '../src/lib/mocks';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
const NOW = new Date('2026-11-19T10:00:00Z');

const mcq = (q: string, subject = 'Pakistan Studies') => `# MCQ\nMazmoon: ${subject}\nSawal: ${q}\nA) 1930\nB) 1940*\nC) 1947\n---`;
const mockText = (name: string, n: number, minutes = 20) =>
  [`# MOCK\nNaam: ${name}\nWaqt: ${minutes} minute\nKhulasa: ${name} ka khulasa\n---`, ...Array.from({ length: n }, (_, i) => mcq(`${name} sawal ${i + 1}?`, i % 2 ? 'English' : 'Pakistan Studies')), '# END MOCK'].join('\n');
async function imp(text: string, verified = true) {
  const r = await importChunk(await adminReq('/api/admin/content/import', { body: { text, verified } }), env(), { now: () => NOW });
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
}

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('S18 publicMocks (F15-AC1)', () => {
  it('khule mocks naye upar: naam, sawal, waqt, khulasa', async () => {
    await imp(mockText('Pehla Mock', 5, 15));
    await imp(mockText('Doosra Mock', 3, 30));
    const list = await publicMocks(d1.db);
    expect(list).toEqual([
      { slug: 'doosra-mock', name: 'Doosra Mock', minutes: 30, summary: 'Doosra Mock ka khulasa', questions: 3 },
      { slug: 'pehla-mock', name: 'Pehla Mock', minutes: 15, summary: 'Pehla Mock ka khulasa', questions: 5 },
    ]);
  });

  it('chhupa, mitaya, ya bina jaanche sawal wala mock list mein nahin; ginti sirf jaanche sawal', async () => {
    await imp(mockText('Khula', 4));
    await imp(mockText('Na Jaancha', 4), false); // sawal verified 0 + mock visible 0
    await imp(mockText('Mitaya', 2));
    await d1.db.prepare("UPDATE mocks SET deleted_at = 'x', visible = 0 WHERE slug = 'mitaya'").run();
    await d1.db.prepare("UPDATE mocks SET visible = 1 WHERE slug = 'na-jaancha'").run(); // khula lekin sawal 0 jaanche
    await d1.db.prepare("UPDATE mcqs SET verified = 0 WHERE question = 'Khula sawal 1?'").run();
    const list = await publicMocks(d1.db);
    expect(list.map((m) => [m.slug, m.questions])).toEqual([['khula', 3]]);
  });
});

describe('S19 mockBySlug (F15-AC8)', () => {
  it('saare jaanche sawal import ki tarteeb mein, jawab + tashreeh ke sath', async () => {
    await imp(mockText('PPSC Educator Mock 1', 6, 25));
    const m = await mockBySlug(d1.db, 'PPSC-Educator-Mock-1');
    expect(m).toMatchObject({ slug: 'ppsc-educator-mock-1', name: 'PPSC Educator Mock 1', minutes: 25, questions: 6 });
    expect(m!.items.map((x) => x.question)).toEqual(Array.from({ length: 6 }, (_, i) => `PPSC Educator Mock 1 sawal ${i + 1}?`));
    expect(m!.items[0]).toMatchObject({ subject: 'Pakistan Studies', options: ['1930', '1940', '1947'], answerIndex: 1 });
  });

  it('100 sawal tak (mock 100 ki hadd)', async () => {
    await imp(mockText('Bara Mock', MOCK_MAX_QUESTIONS, 120));
    expect((await mockBySlug(d1.db, 'bara-mock'))!.items).toHaveLength(MOCK_MAX_QUESTIONS);
  });

  it('na mile, chhupa, mitaya, sawal 0, ghalat slug → null (404)', async () => {
    await imp(mockText('Chhupa', 3));
    await imp(mockText('Khali', 2));
    await d1.db.prepare("UPDATE mocks SET visible = 0 WHERE slug = 'chhupa'").run();
    await d1.db.prepare("UPDATE mcqs SET verified = 0 WHERE question LIKE 'Khali%'").run();
    for (const s of ['nahin-hai', 'chhupa', 'khali', '../etc', 'a b', '']) expect(await mockBySlug(d1.db, s), s).toBeNull();
    await imp(mockText('Mitaya', 2));
    await d1.db.prepare("UPDATE mocks SET deleted_at = 'x' WHERE slug = 'mitaya'").run();
    expect(await mockBySlug(d1.db, 'mitaya')).toBeNull();
  });

  it('isMockSlug', () => {
    expect(isMockSlug('ppsc-mock-2')).toBe(true);
    for (const s of ['-a', 'a-', 'A', 'a_b', 'x'.repeat(81)]) expect(isMockSlug(s), s).toBe(false);
  });
});
