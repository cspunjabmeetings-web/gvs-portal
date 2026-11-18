// spec: E18, E19, E20, F12-AC1..AC6, P-06 (deleted_at), 9.2
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, adminCookie, SECRET, SITE } from './helpers/admin';
import { importChunk } from '../src/lib/content-import';
import { listMcqs, saveMcq, deleteMcq, listMocks, setMockVisible, deleteMock, listNotes, saveNote, deleteNote, LIST_PAGE, type AdminMcq, type AdminMock, type AdminNoteRow } from '../src/lib/admin-content';
import { qHash } from '../src/lib/parser';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
const NOW = new Date('2026-11-18T10:00:00Z');

const mcq = (q: string, subject = 'Pakistan Studies') => `# MCQ\nMazmoon: ${subject}\nSawal: ${q}\nA) 1930\nB) 1940*\nC) 1947\n---`;
async function imp(text: string, verified = true) {
  const r = await importChunk(await adminReq('/api/admin/content/import', { body: { text, verified } }), env(), { now: () => NOW });
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  return r.body as { slugs?: string[] };
}
async function seedMcqs(n: number, verified = true, subject = 'Pakistan Studies') {
  for (let i = 0; i < n; i += 25) await imp(Array.from({ length: Math.min(25, n - i) }, (_, j) => mcq(`${subject} sawal ${i + j}?`, subject)).join('\n'), verified);
}
type McqList = { ok: boolean; items: AdminMcq[]; hasMore: boolean; summary: { total: number; unverified: number } };
async function mcqs(params: Record<string, string> = {}) {
  const r = await listMcqs(await adminReq(`/api/admin/mcqs?${new URLSearchParams(params)}`), env());
  return { status: r.status, body: r.body as McqList };
}
const post = async (fn: typeof saveMcq | typeof saveNote | typeof setMockVisible, path: string, body: unknown, o: { cookie?: string | null; origin?: string } = {}) => {
  const r = await fn(await adminReq(path, { body, ...o }), env(), { now: () => NOW } as never);
  return { status: r.status, body: r.body as Record<string, unknown> & { error?: { message: string } } };
};
async function del(fn: typeof deleteMcq | typeof deleteMock | typeof deleteNote, path: string, id: string, o: { cookie?: string | null; origin?: string } = {}) {
  const headers: Record<string, string> = { Origin: o.origin ?? SITE };
  if (o.cookie !== null) headers.Cookie = o.cookie ?? (await adminCookie());
  const r = await fn(new Request(SITE + path, { method: 'DELETE', headers }), env(), id, { now: () => NOW } as never);
  return r.status;
}
const count = async (sql: string) => (await d1.db.prepare(sql).first<{ n: number }>())!.n;

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('hifazat (9.2)', () => {
  it('bina cookie 401 (GET, POST, DELETE); ghalat Origin 403', async () => {
    expect((await listMcqs(await adminReq('/api/admin/mcqs', { cookie: null }), env())).status).toBe(401);
    expect((await listMocks(await adminReq('/api/admin/mocks', { cookie: null }), env())).status).toBe(401);
    expect((await listNotes(await adminReq('/api/admin/notes', { cookie: null }), env())).status).toBe(401);
    expect((await post(saveMcq, '/api/admin/mcqs', { action: 'verify', id: 1, verified: true }, { cookie: null })).status).toBe(401);
    expect((await post(saveMcq, '/api/admin/mcqs', { action: 'verify', id: 1, verified: true }, { origin: 'https://evil.test' })).status).toBe(403);
    expect(await del(deleteMcq, '/api/admin/mcqs/1', '1', { cookie: null })).toBe(401);
    expect(await del(deleteNote, '/api/admin/notes/1', '1', { origin: 'https://evil.test' })).toBe(403);
    expect((await post(saveMcq, '/api/admin/mcqs', { action: 'udao', id: 1 })).status).toBe(400);
  });
});

describe('F12-AC1: sawal ki list', () => {
  it('120 sawal: 50-50, naye upar, hasMore; khulasa', async () => {
    await seedMcqs(120);
    const a = await mcqs();
    expect(a.body.items).toHaveLength(LIST_PAGE);
    expect(a.body.hasMore).toBe(true);
    expect(a.body.items[0].question).toBe('Pakistan Studies sawal 119?');
    expect(a.body.summary).toEqual({ total: 120, unverified: 0 });
    const c = await mcqs({ offset: '100' });
    expect(c.body.items).toHaveLength(20);
    expect(c.body.hasMore).toBe(false);
  });

  it('search (%/_ mehfooz), mazmoon, jaanche/na jaanche, mock', async () => {
    await seedMcqs(3, true, 'English');
    await seedMcqs(2, false, 'Urdu');
    await imp(mcq('100% sahih_jawab?', 'Islamiat'));
    expect((await mcqs({ q: 'english sawal 1' })).body.items.map((x) => x.question)).toEqual(['English sawal 1?']);
    expect((await mcqs({ q: '%' })).body.items.map((x) => x.question)).toEqual(['100% sahih_jawab?']);
    expect((await mcqs({ q: '_' })).body.items).toHaveLength(1);
    expect((await mcqs({ subject: 'Urdu' })).body.items).toHaveLength(2);
    expect((await mcqs({ verified: '0' })).body.items.every((x) => !x.verified && x.subject === 'Urdu')).toBe(true);
    expect((await mcqs({ verified: '1' })).body.items).toHaveLength(4);
    expect((await mcqs()).body.summary).toEqual({ total: 6, unverified: 2 });
    await imp(`# MOCK\nNaam: Test Mock\nWaqt: 10\n---\n${mcq('Mock ka sawal?')}\n# END MOCK`);
    const mid = (await d1.db.prepare('SELECT id FROM mocks').first<{ id: number }>())!.id;
    const m = await mcqs({ mock: String(mid) });
    expect(m.body.items.map((x) => [x.question, x.mockName])).toEqual([['Mock ka sawal?', 'Test Mock']]);
  });
});

describe('F12-AC2, AC6: sawal badalna, banana, chhupana, mitana', () => {
  it('ek tap: chhupayen (verified 0) aur dikhayen (F12-AC6)', async () => {
    await seedMcqs(1);
    const id = (await mcqs()).body.items[0].id;
    expect((await post(saveMcq, '/api/admin/mcqs', { action: 'verify', id, verified: false })).status).toBe(200);
    expect(await count(`SELECT verified n FROM mcqs WHERE id = ${id}`)).toBe(0);
    await post(saveMcq, '/api/admin/mcqs', { action: 'verify', id, verified: true });
    expect(await count(`SELECT verified n FROM mcqs WHERE id = ${id}`)).toBe(1);
    expect((await post(saveMcq, '/api/admin/mcqs', { action: 'verify', id: 9999, verified: true })).status).toBe(404);
  });

  const form = (o: Record<string, unknown> = {}) => ({ action: 'save', subject: 'Pakistan Studies', question: 'Pakistan kab bana?', options: ['1945', '1947', '1950'], answerIndex: 1, explanation: '14 August.', difficulty: 'Aasan', asOfDate: null, ...o });

  it('badalna: parser wali jaanch, q_hash naya, verified wahi rehta hai', async () => {
    await seedMcqs(1, false);
    const id = (await mcqs()).body.items[0].id;
    const r = await post(saveMcq, '/api/admin/mcqs', form({ id }));
    expect(r.status).toBe(200);
    const row = await d1.db.prepare(`SELECT * FROM mcqs WHERE id = ${id}`).first<Record<string, unknown>>();
    expect(row).toMatchObject({ question: 'Pakistan kab bana?', options_json: '["1945","1947","1950"]', answer_index: 1, explanation: '14 August.', difficulty: 'Aasan', verified: 0, q_hash: await qHash('Pakistan kab bana?') });
  });

  it('ghalat form → parser ka paigham (bina "Line"), kuch nahin badla', async () => {
    await seedMcqs(1);
    const id = (await mcqs()).body.items[0].id;
    const cases: [Record<string, unknown>, RegExp][] = [
      [form({ id, options: ['Sirf ek'] , answerIndex: 0 }), /^2 se 5 options/],
      [form({ id, subject: 'Physics' }), /^Mazmoon "Physics" list mein nahin/],
      [form({ id, question: '' }), /"Sawal:" nahin likha/],
      [form({ id, question: 'x'.repeat(501) }), /500 harf/],
      [form({ id, answerIndex: 7 }), /sahih jawab par \* nahin laga/i],
      [form({ id, subject: 'Current Affairs' }), /Tareekh/],
      [form({ id, difficulty: 'Bohat' }), /Aasan, Darmiyana ya Mushkil/],
    ];
    for (const [body, re] of cases) {
      const r = await post(saveMcq, '/api/admin/mcqs', body);
      expect(r.status).toBe(400);
      expect(r.body.error?.message).toMatch(re);
      expect(r.body.error?.message).not.toMatch(/^Line/);
    }
    expect((await mcqs()).body.items[0].question).toBe('Pakistan Studies sawal 0?');
  });

  it('naye-line ya * se format nahin tootta (sab ek line, option ka * hata)', async () => {
    await seedMcqs(1);
    const id = (await mcqs()).body.items[0].id;
    const r = await post(saveMcq, '/api/admin/mcqs', form({ id, question: 'Do\nlines?', options: ['5*', '6', 'D) 7'], answerIndex: 1 }));
    expect(r.status).toBe(200);
    const m = (await mcqs()).body.items[0];
    expect(m.question).toBe('Do lines?');
    expect(m.options).toEqual(['5', '6', 'D) 7']);
    expect(m.answerIndex).toBe(1);
  });

  it('naya sawal (E18 banana), checkbox ke mutabiq verified', async () => {
    const r = await post(saveMcq, '/api/admin/mcqs', form({ verified: false }));
    expect(r.status).toBe(200);
    expect(await count(`SELECT verified n FROM mcqs WHERE id = ${r.body.id}`)).toBe(0);
    const r2 = await post(saveMcq, '/api/admin/mcqs', form({ question: 'Doosra?', verified: true }));
    expect(await count(`SELECT verified n FROM mcqs WHERE id = ${r2.body.id}`)).toBe(1);
    expect(await count(`SELECT COUNT(*) n FROM mcqs WHERE created_at = '${NOW.toISOString()}' AND mock_id IS NULL`)).toBe(2);
  });

  it('mitana: poora; dobara 404; ghalat id 404', async () => {
    await seedMcqs(2);
    const id = (await mcqs()).body.items[0].id;
    expect(await del(deleteMcq, `/api/admin/mcqs/${id}`, String(id))).toBe(200);
    expect(await count('SELECT COUNT(*) n FROM mcqs')).toBe(1);
    expect(await del(deleteMcq, `/api/admin/mcqs/${id}`, String(id))).toBe(404);
    expect(await del(deleteMcq, '/api/admin/mcqs/abc', 'abc')).toBe(404);
  });
});

describe('Mock (E19, F12-AC3, AC5)', () => {
  async function seedMock(verified = true) {
    await imp(`# MOCK\nNaam: PPSC Mock\nWaqt: 30 minute\nKhulasa: K\n---\n${mcq('M1?')}\n${mcq('M2?')}\n# END MOCK`, verified);
    return (await d1.db.prepare('SELECT id FROM mocks ORDER BY id DESC').first<{ id: number }>())!.id;
  }

  it('list: sawal ki ginti, na jaanche, chhupa/khula', async () => {
    await seedMock(false);
    const r = await listMocks(await adminReq('/api/admin/mocks'), env());
    expect((r.body as { items: AdminMock[] }).items[0]).toMatchObject({ name: 'PPSC Mock', minutes: 30, questions: 2, unverified: 2, visible: false, slug: 'ppsc-mock' });
  });

  it('chhupana/dikhana', async () => {
    const id = await seedMock();
    expect((await post(setMockVisible, '/api/admin/mocks', { id, visible: false })).status).toBe(200);
    expect(await count(`SELECT visible n FROM mocks WHERE id = ${id}`)).toBe(0);
    expect((await post(setMockVisible, '/api/admin/mocks', { id: 999, visible: true })).status).toBe(404);
  });

  it('mitana: deleted_at, list se ghaib, sawal bank mein (mock_id NULL), dobara 404, slug dobara nahin milta', async () => {
    const id = await seedMock();
    expect(await del(deleteMock, `/api/admin/mocks/${id}`, String(id))).toBe(200);
    const row = await d1.db.prepare(`SELECT deleted_at, visible FROM mocks WHERE id = ${id}`).first<{ deleted_at: string; visible: number }>();
    expect(row).toEqual({ deleted_at: NOW.toISOString(), visible: 0 });
    expect(await count('SELECT COUNT(*) n FROM mcqs WHERE mock_id IS NULL')).toBe(2);
    expect(((await listMocks(await adminReq('/api/admin/mocks'), env())).body as { items: AdminMock[] }).items).toEqual([]);
    expect(await del(deleteMock, `/api/admin/mocks/${id}`, String(id))).toBe(404);
    expect((await post(setMockVisible, '/api/admin/mocks', { id, visible: true })).status).toBe(404);
    expect((await imp(`# MOCK\nNaam: PPSC Mock\nWaqt: 30\n---\n${mcq('M3?')}\n# END MOCK`)).slugs).toEqual(['ppsc-mock-2']);
  });

  it('mitaye mock ke id par DELETE se doosre mock ke sawal nahin chhoote', async () => {
    const a = await seedMock();
    await del(deleteMock, `/api/admin/mocks/${a}`, String(a));
    const b = await seedMock();
    await del(deleteMock, `/api/admin/mocks/${a}`, String(a));
    expect(await count(`SELECT COUNT(*) n FROM mcqs WHERE mock_id = ${b}`)).toBe(2);
  });
});

describe('Notes (E20, F12-AC4, AC5)', () => {
  const NOTE = '# NOTE\nUnwan: Aain ki Tareekh\nMazmoon: Pakistan Studies\nKhulasa: Teeno aain.\nMatn:\n## 1956\n- nafiz\n---';
  async function seedNote() {
    await imp(NOTE);
    return (await d1.db.prepare('SELECT id FROM notes ORDER BY id DESC').first<{ id: number }>())!.id;
  }
  const save = (o: Record<string, unknown>) => post(saveNote, '/api/admin/notes', { action: 'save', title: 'Naya Unwan', subject: 'Urdu', summary: 'Naya khulasa', body: '## Naya\n- point: colon', ...o });

  it('list (matn ke baghair) aur ?id= par poora note', async () => {
    const id = await seedNote();
    const l = await listNotes(await adminReq('/api/admin/notes'), env());
    const items = (l.body as { items: AdminNoteRow[] }).items;
    expect(items[0]).toMatchObject({ id, slug: 'aain-ki-tareekh', title: 'Aain ki Tareekh', visible: true });
    expect(items[0]).not.toHaveProperty('body');
    const one = await listNotes(await adminReq(`/api/admin/notes?id=${id}`), env());
    expect((one.body as { note: { body: string } }).note.body).toBe('## 1956\n- nafiz');
    expect((await listNotes(await adminReq('/api/admin/notes?id=999'), env())).status).toBe(404);
  });

  it('badalna: slug KABHI nahin badalta (F12-AC4); updated_at', async () => {
    const id = await seedNote();
    expect((await save({ id })).status).toBe(200);
    const row = await d1.db.prepare(`SELECT slug, title, subject, summary, body_md, updated_at FROM notes WHERE id = ${id}`).first();
    expect(row).toEqual({ slug: 'aain-ki-tareekh', title: 'Naya Unwan', subject: 'Urdu', summary: 'Naya khulasa', body_md: '## Naya\n- point: colon', updated_at: NOW.toISOString() });
  });

  it('ghalat: khulasa 156, mazmoon list se bahar, matn khali, matn mein akeli ---', async () => {
    const id = await seedNote();
    expect((await save({ id, summary: 'x'.repeat(156) })).body.error?.message).toMatch(/155/);
    expect((await save({ id, subject: 'Physics' })).body.error?.message).toMatch(/list mein nahin/);
    expect((await save({ id, body: '  ' })).body.error?.message).toMatch(/Matn/);
    expect((await save({ id, body: 'upar\n---\nneeche' })).body.error?.message).toMatch(/akeli "---"/);
    expect((await save({ id, body: 'upar\n# MCQ\nneeche' })).body.error?.message).toMatch(/akeli "---"/);
    expect(await count(`SELECT COUNT(*) n FROM notes WHERE title = 'Aain ki Tareekh'`)).toBe(1);
  });

  it('chhupana; mitana → deleted_at, list se ghaib, badalna/chhupana 404, slug dobara nahin (F12-AC5)', async () => {
    const id = await seedNote();
    expect((await post(saveNote, '/api/admin/notes', { action: 'visible', id, visible: false })).status).toBe(200);
    expect(await count(`SELECT visible n FROM notes WHERE id = ${id}`)).toBe(0);
    expect(await del(deleteNote, `/api/admin/notes/${id}`, String(id))).toBe(200);
    expect(await count(`SELECT COUNT(*) n FROM notes WHERE id = ${id} AND deleted_at IS NOT NULL`)).toBe(1);
    expect(((await listNotes(await adminReq('/api/admin/notes'), env())).body as { items: unknown[] }).items).toEqual([]);
    expect((await save({ id })).status).toBe(404);
    expect((await post(saveNote, '/api/admin/notes', { action: 'visible', id, visible: true })).status).toBe(404);
    expect(await del(deleteNote, `/api/admin/notes/${id}`, String(id))).toBe(404);
    expect((await imp(NOTE)).slugs).toEqual(['aain-ki-tareekh-2']);
  });
});
