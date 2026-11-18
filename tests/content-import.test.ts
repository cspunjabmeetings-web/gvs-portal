// spec: E17, E18 (?hashes=), F11-AC3..AC10, 8.7 (server dobara jaanch), 9.4 (600 KB), FX-03 (tukre), 9.2; slug F12-AC4
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, SECRET, SITE } from './helpers/admin';
import { importChunk, existingHashes, IMPORT_MSG } from '../src/lib/content-import';
import { buildChunks, hashMcqs, CHUNK } from '../src/lib/content-chunks';
import { parseContent, qHash } from '../src/lib/parser';
import { saveAdminSettings } from '../src/lib/admin-settings';
import { slugify, uniqueSlug } from '../src/lib/slug';
import { DEFAULT_SETTINGS } from '../src/lib/settings';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
const NOW = new Date('2026-11-18T10:00:00Z');

type Body = { ok: boolean; saved?: { MCQ: number; MOCK: number; NOTE: number }; slugs?: string[]; existing?: string[]; error?: { code: string; message: string; errors?: { line: number; message: string }[] } };
async function imp(text: string, verified = true, o: { cookie?: string | null; origin?: string } = {}) {
  const r = await importChunk(await adminReq('/api/admin/content/import', { body: { text, verified }, ...o }), env(), { now: () => NOW });
  return { status: r.status, body: r.body as Body };
}
const count = async (sql: string) => (await d1.db.prepare(sql).first<{ n: number }>())!.n;

const mcq = (q = 'Qarardad-e-Pakistan kis saal manzoor hui?', subject = 'Pakistan Studies', star = true) =>
  `# MCQ\nMazmoon: ${subject}\nSawal: ${q}\nA) 1930\nB) 1940${star ? '*' : ''}\nC) 1947\nD) 1956\nTashreeh: 23 March 1940.\nMushkil: Aasan\n---`;
const mock = (n: number, name = 'PPSC Educator Mock Test 1') =>
  [`# MOCK\nNaam: ${name}\nWaqt: 30 minute\nKhulasa: 25 sawal.\n---`, ...Array.from({ length: n }, (_, i) => mcq(`Mock sawal ${i + 1}?`)), '# END MOCK'].join('\n');
const note = (title = 'Pakistan ke Aain ki Tareekh (1956, 1962, 1973)') => `# NOTE\nUnwan: ${title}\nMazmoon: Pakistan Studies\nKhulasa: Teeno aain.\nMatn:\n## 1956\n- nafiz hua\n---`;

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('E17: hifazat (9.2, 9.4)', () => {
  it('bina cookie 401, ghalat Origin 403, kharab body 400', async () => {
    expect((await imp(mcq(), true, { cookie: null })).status).toBe(401);
    expect((await imp(mcq(), true, { origin: 'https://evil.test' })).status).toBe(403);
    const r = await importChunk(await adminReq('/api/admin/content/import', { body: { text: mcq(), verified: 'haan' } }), env());
    expect(r.status).toBe(400);
    expect(await count('SELECT COUNT(*) n FROM mcqs')).toBe(0);
  });

  it('600 KB se bari body 413 (F11-AC9)', async () => {
    const r = await imp('x'.repeat(610 * 1024));
    expect(r.status).toBe(413);
  });
});

describe('E17: MCQ (F11-AC3, AC5, AC6, AC10)', () => {
  it('sahih tukra: sawal database mein foran, options/jawab/hash ke sath', async () => {
    const r = await imp([mcq(), mcq('Pakistan ka pehla aain kab nafiz hua?')].join('\n'));
    expect(r).toMatchObject({ status: 200, body: { ok: true, saved: { MCQ: 2, MOCK: 0, NOTE: 0 } } });
    const row = await d1.db.prepare('SELECT * FROM mcqs ORDER BY id LIMIT 1').first<Record<string, unknown>>();
    expect(row).toMatchObject({
      subject: 'Pakistan Studies',
      question: 'Qarardad-e-Pakistan kis saal manzoor hui?',
      options_json: '["1930","1940","1947","1956"]',
      answer_index: 1,
      explanation: '23 March 1940.',
      difficulty: 'Aasan',
      as_of_date: null,
      verified: 1,
      mock_id: null,
      created_at: NOW.toISOString(),
      q_hash: await qHash('Qarardad-e-Pakistan kis saal manzoor hui?'),
    });
  });

  it('checkbox khali → verified 0 (F11-AC6)', async () => {
    await imp(mcq(), false);
    expect(await count('SELECT verified n FROM mcqs')).toBe(0);
  });

  it('ek bhi ghalti → poora tukra rad, ghaltiyan line ke sath, kuch save nahin (server dobara jaanch)', async () => {
    const r = await imp([mcq(), mcq('Do?', 'Pakistan Studies', false)].join('\n'));
    expect(r.status).toBe(400);
    expect(r.body.error?.message).toBe(IMPORT_MSG.invalid);
    expect(r.body.error?.errors?.[0].message).toMatch(/^Line \d+: sawal 2 mein sahih jawab par \* nahin laga/);
    expect(await count('SELECT COUNT(*) n FROM mcqs')).toBe(0);
  });

  it('mazmoon Settings ki list se: naya mazmoon jodne ke baad foran qabool (F11-AC5, F10-AC4)', async () => {
    expect((await imp(mcq('Newton ka pehla qanoon?', 'Physics'))).status).toBe(400);
    await saveAdminSettings(await adminReq('/api/admin/settings', { body: { settings: { subjects: [...DEFAULT_SETTINGS.subjects, 'Physics'] } } }), env());
    expect((await imp(mcq('Newton ka pehla qanoon?', 'Physics'))).status).toBe(200);
  });

  it('25 sawal theek, 26 rad (tukra); qismein mila kar rad; JOB rad; khali rad', async () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => mcq(`Sawal ${i}?`)).join('\n');
    expect((await imp(many(CHUNK.mcqs))).status).toBe(200);
    expect((await imp(many(26))).body.error?.message).toBe(IMPORT_MSG.chunk);
    expect((await imp(mcq() + '\n' + note())).body.error?.message).toBe(IMPORT_MSG.chunk);
    expect((await imp('# JOB\nIdara: PPSC\nPost: X\nAkhri tareekh: 2026-12-05\nOfficial link: https://ppsc.gop.pk\n---')).body.error?.message).toBe(IMPORT_MSG.job);
    expect((await imp('\n\n')).status).toBe(400);
    expect(await count('SELECT COUNT(*) n FROM mcqs')).toBe(25);
  });
});

describe('E17: MOCK (F11-AC8)', () => {
  it('mock + 30 sawal: mock_id ke sath bank mein; slug naam se', async () => {
    const r = await imp(mock(30));
    expect(r.body).toMatchObject({ ok: true, saved: { MCQ: 30, MOCK: 1, NOTE: 0 }, slugs: ['ppsc-educator-mock-test-1'] });
    const m = await d1.db.prepare('SELECT * FROM mocks').first<Record<string, unknown>>();
    expect(m).toMatchObject({ slug: 'ppsc-educator-mock-test-1', name: 'PPSC Educator Mock Test 1', minutes: 30, summary: '25 sawal.', visible: 1, deleted_at: null });
    expect(await count(`SELECT COUNT(*) n FROM mcqs WHERE mock_id = ${m!.id} AND verified = 1`)).toBe(30);
    // Tarteeb wohi
    const first = await d1.db.prepare('SELECT question FROM mcqs ORDER BY id LIMIT 1').first<{ question: string }>();
    expect(first?.question).toBe('Mock sawal 1?');
  });

  it('checkbox khali → mock chhupa (visible 0) aur sawal verified 0 (faisla a)', async () => {
    await imp(mock(3), false);
    expect(await count('SELECT visible n FROM mocks')).toBe(0);
    expect(await count('SELECT COUNT(*) n FROM mcqs WHERE verified = 0')).toBe(3);
  });

  it('100 sawal ka mock ek request mein; dohra naam → -2 slug', async () => {
    expect((await imp(mock(100))).body.saved?.MCQ).toBe(100);
    expect((await imp(mock(1))).body.slugs).toEqual(['ppsc-educator-mock-test-1-2']);
    expect(await count('SELECT COUNT(*) n FROM mcqs')).toBe(101);
  });

  it('do mock ek tukre mein rad', async () => {
    expect((await imp(mock(1) + '\n' + mock(1, 'Doosra'))).body.error?.message).toBe(IMPORT_MSG.chunk);
  });
});

describe('E17: NOTE (F12-AC4 slug)', () => {
  it('note visible, slug unique; mitaya hua slug bhi dobara nahin milta (410 rehta hai)', async () => {
    const r = await imp([note(), note(), note('Aqwam-e-Muttahida')].join('\n'));
    expect(r.body).toMatchObject({ saved: { NOTE: 3 }, slugs: ['pakistan-ke-aain-ki-tareekh-1956-1962-1973', 'pakistan-ke-aain-ki-tareekh-1956-1962-1973-2', 'aqwam-e-muttahida'] });
    const n = await d1.db.prepare("SELECT * FROM notes WHERE slug = 'aqwam-e-muttahida'").first<Record<string, unknown>>();
    expect(n).toMatchObject({ title: 'Aqwam-e-Muttahida', subject: 'Pakistan Studies', summary: 'Teeno aain.', body_md: '## 1956\n- nafiz hua', visible: 1 });
    await d1.db.prepare("UPDATE notes SET deleted_at = 'x' WHERE slug = 'aqwam-e-muttahida'").run();
    expect((await imp(note('Aqwam-e-Muttahida'), false)).body.slugs).toEqual(['aqwam-e-muttahida-2']);
    expect(await count("SELECT visible n FROM notes WHERE slug = 'aqwam-e-muttahida-2'")).toBe(1); // checkbox notes par lagu nahin
  });

  it('6 notes rad (tukra 5)', async () => {
    expect((await imp(Array.from({ length: 6 }, (_, i) => note(`Note ${i}`)).join('\n'))).status).toBe(400);
  });
});

describe('E18 GET ?hashes= (F11-AC7)', () => {
  const get = async (q: string, cookie?: string | null) => {
    const r = await existingHashes(await adminReq(`/api/admin/mcqs${q}`, { cookie }), env());
    return { status: r.status, body: r.body as Body };
  };
  it('pehle se maujood hash wapas; bina cookie 401; ghalat shakal 400', async () => {
    await imp(mcq());
    const h1 = await qHash('Qarardad-e-Pakistan kis saal manzoor hui?');
    const h2 = await qHash('Naya sawal?');
    expect((await get(`?hashes=${h1},${h2}`)).body.existing).toEqual([h1]);
    expect((await get(`?hashes=`)).body.existing).toEqual([]);
    expect((await get(`?hashes=${h1}`, null)).status).toBe(401);
    expect((await get('?hashes=abc')).status).toBe(400);
    expect((await get('')).status).toBe(400);
    expect((await get(`?hashes=${Array(101).fill(h1).join(',')}`)).status).toBe(400);
  });
});

describe('browser ke tukre (content-chunks)', () => {
  const opts = { subjects: DEFAULT_SETTINGS.subjects };
  it('25-25 sawal, mock akela, 5-5 notes, JOB bahar; har tukra server qabool kare', async () => {
    const text = [...Array.from({ length: 30 }, (_, i) => mcq(`S${i}?`)), mock(2), ...Array.from({ length: 6 }, (_, i) => note(`N ${i}`)), '# JOB\nIdara: A\nPost: B\nAkhri tareekh: 2026-12-05\nOfficial link: https://a.pk\n---'].join('\n');
    const r = parseContent(text, opts);
    expect(r.errors).toEqual([]);
    const chunks = buildChunks(r.items);
    expect(chunks.map((c) => [c.kind, c.indexes.length])).toEqual([
      ['MCQ', 25],
      ['MOCK', 1],
      ['NOTE', 5],
      ['MCQ', 5],
      ['NOTE', 1],
    ]);
    for (const c of chunks) expect((await imp(c.text)).status).toBe(200);
    expect(await count('SELECT COUNT(*) n FROM mcqs')).toBe(32);
    expect(await count('SELECT COUNT(*) n FROM notes')).toBe(6);
  });

  it('paste ke andar dohra sawal pakda jata hai (mock ke andar bhi)', async () => {
    const r = parseContent([mcq('Kaun?'), mcq('KAUN'), mock(1)].join('\n') + '\n' + mcq('Mock sawal 1'), opts);
    const { repeats } = await hashMcqs(r.items);
    expect([...repeats.entries()].map(([q, first]) => [q.number, first])).toEqual([
      [2, 1],
      [4, 3],
    ]);
  });
});

describe('slug', () => {
  it('slugify aur uniqueSlug', () => {
    expect(slugify('Pakistan ke Aain ki Tareekh (1956, 1962, 1973)')).toBe('pakistan-ke-aain-ki-tareekh-1956-1962-1973');
    expect(slugify('  Ça va? — Déjà vu!  ')).toBe('ca-va-deja-vu');
    expect(slugify('پاکستان', 'note')).toBe('note');
    expect(slugify('a'.repeat(100)).length).toBe(80);
    expect(uniqueSlug('x', new Set(['x', 'x-2']))).toBe('x-3');
    expect(uniqueSlug('a'.repeat(80), new Set(['a'.repeat(80)]))).toBe('a'.repeat(78) + '-2');
  });
});

void SITE;
