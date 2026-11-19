// spec: E23 GET/POST/DELETE /api/admin/daily-pins (P-03, A09, spec v0.3.5), SA8 (pin ho to wohi 10), F13-AC2, 9.2
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, adminCookie, SECRET, SITE } from './helpers/admin';
import { listPins, savePin, deletePin, PIN_MSG, type DailyPin } from '../src/lib/daily-pins';
import { dailyQuestions, dailyTest } from '../src/lib/daily';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
// Pakistan: 19 Nov 2026, 10:00
const NOW = new Date('2026-11-19T05:00:00Z');
const deps = { now: () => NOW };
const TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

async function seed(n: number, verified = (_i: number) => true) {
  const rows = Array.from({ length: n }, (_, i) => ({ s: ['English', 'Urdu'][i % 2], q: `Pin sawal ${i + 1}?`, v: verified(i) ? 1 : 0 }));
  await d1.db
    .prepare(
      `INSERT INTO mcqs (subject, question, options_json, answer_index, explanation, verified, created_at)
       SELECT json_extract(value,'$.s'), json_extract(value,'$.q'), '["a","b","c"]', 1, 'T', json_extract(value,'$.v'), 'x' FROM json_each(?1)`,
    )
    .bind(JSON.stringify(rows))
    .run();
}
const save = async (body: unknown, o: { cookie?: string | null; origin?: string } = {}) => {
  const r = await savePin(await adminReq('/api/admin/daily-pins', { body, ...o }), env(), deps);
  return { status: r.status, body: r.body as { error?: { message: string } } };
};
async function del(date: string, o: { cookie?: string | null; origin?: string } = {}) {
  const headers: Record<string, string> = { Origin: o.origin ?? SITE };
  if (o.cookie !== null) headers.Cookie = o.cookie ?? (await adminCookie());
  return (await deletePin(new Request(`${SITE}/api/admin/daily-pins/${date}`, { method: 'DELETE', headers }), env(), date, deps)).status;
}
async function list() {
  const r = await listPins(await adminReq('/api/admin/daily-pins'), env(), deps);
  return { status: r.status, body: r.body as { today: string; maxDate: string; pins: DailyPin[] } };
}

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('hifazat (9.2)', () => {
  it('bina cookie 401 (GET, POST, DELETE); ghalat Origin 403; ghalat body 400', async () => {
    expect((await listPins(await adminReq('/api/admin/daily-pins', { cookie: null }), env(), deps)).status).toBe(401);
    expect((await save({ date: '2026-11-20', ids: TEN }, { cookie: null })).status).toBe(401);
    expect((await save({ date: '2026-11-20', ids: TEN }, { origin: 'https://evil.test' })).status).toBe(403);
    expect(await del('2026-11-20', { cookie: null })).toBe(401);
    expect(await del('2026-11-20', { origin: 'https://evil.test' })).toBe(403);
    expect((await save({ date: '2026-11-20', ids: 'x' })).status).toBe(400);
  });
});

describe('E23 POST', () => {
  it('kal ke 10 pin → kal /api/daily-test par wohi 10, usi tarteeb mein', async () => {
    await seed(30);
    const pick = [21, 3, 15, 8, 30, 1, 12, 27, 6, 19];
    expect((await save({ date: '2026-11-20', ids: pick })).status).toBe(200);
    const d = await dailyQuestions(d1.db, new Date('2026-11-20T08:00:00+05:00'));
    expect(d.items.map((x) => x.id)).toEqual(pick);
    const row = await d1.db.prepare("SELECT source FROM daily_pins WHERE date = '2026-11-20'").first<{ source: string }>();
    expect(row?.source).toBe('pin');
    const api = await dailyTest(d1.db, new Date('2026-11-20T08:00:00+05:00'));
    expect((api.body as { items: { id: number }[] }).items.map((x) => x.id)).toEqual(pick);
  });

  it('aaj ka auto din bhi pin se badal jata hai; dobara save = naya pin', async () => {
    await seed(30);
    await dailyQuestions(d1.db, NOW); // aaj auto
    expect((await save({ date: '2026-11-19', ids: TEN })).status).toBe(200);
    expect((await dailyQuestions(d1.db, NOW)).items.map((x) => x.id)).toEqual(TEN);
    const other = TEN.map((x) => x + 10);
    expect((await save({ date: '2026-11-19', ids: other })).status).toBe(200);
    expect((await dailyQuestions(d1.db, NOW)).items.map((x) => x.id)).toEqual(other);
  });

  it('10 se kam/zyada ya dohra id rad', async () => {
    await seed(30);
    for (const ids of [TEN.slice(0, 9), [...TEN, 11], [1, 1, 2, 3, 4, 5, 6, 7, 8, 9]]) {
      const r = await save({ date: '2026-11-20', ids });
      expect(r.status).toBe(400);
      expect(r.body.error?.message).toBe(PIN_MSG.count);
    }
  });

  it('na jaancha (chhupa) ya na maujood sawal rad; kuch save nahin', async () => {
    await seed(12, (i) => i !== 4); // id 5 chhupa
    const r = await save({ date: '2026-11-20', ids: TEN });
    expect(r.status).toBe(400);
    expect(r.body.error?.message).toBe(PIN_MSG.notVerified);
    expect((await save({ date: '2026-11-20', ids: [1, 2, 3, 4, 6, 7, 8, 9, 10, 999] })).status).toBe(400);
    expect((await d1.db.prepare('SELECT COUNT(*) AS n FROM daily_pins').first<{ n: number }>())!.n).toBe(0);
  });

  it('purani tareekh, 60 din se aage, ghalat shakal rad', async () => {
    await seed(10);
    for (const date of ['2026-11-18', '2027-01-19', '2026-11-31', '20-11-2026', '']) {
      const r = await save({ date, ids: TEN });
      expect(r.status, date).toBe(400);
      expect(r.body.error?.message).toBe(PIN_MSG.date);
    }
    expect((await save({ date: '2027-01-18', ids: TEN })).status).toBe(200); // theek 60 din
  });
});

describe('E23 GET + DELETE', () => {
  it('GET: aaj se aage ke din, sawal ka matn, source; purane din nahin; chhupa sawal ok=false', async () => {
    await seed(20);
    await d1.db.prepare("INSERT INTO daily_pins (date, mcq_ids_json, source) VALUES ('2026-11-10', ?1, 'auto')").bind(JSON.stringify(TEN)).run();
    await dailyQuestions(d1.db, NOW);
    await save({ date: '2026-11-22', ids: TEN });
    await d1.db.prepare('UPDATE mcqs SET verified = 0 WHERE id = 3').run();
    const { status, body } = await list();
    expect(status).toBe(200);
    expect(body.today).toBe('2026-11-19');
    expect(body.maxDate).toBe('2027-01-18');
    expect(body.pins.map((p) => [p.date, p.source])).toEqual([
      ['2026-11-19', 'auto'],
      ['2026-11-22', 'pin'],
    ]);
    const p = body.pins[1];
    expect(p.items[0]).toEqual({ id: 1, subject: 'English', question: 'Pin sawal 1?', ok: true });
    expect(p.items[2].ok).toBe(false);
  });

  it('DELETE: pin hata → us din sawal khud chune jate hain; na ho to 404; purana din 400', async () => {
    await seed(30);
    await save({ date: '2026-11-20', ids: TEN });
    expect(await del('2026-11-20')).toBe(200);
    expect(await del('2026-11-20')).toBe(404);
    expect(await del('2026-11-18')).toBe(400);
    expect(await del('kal')).toBe(400);
    const d = await dailyQuestions(d1.db, new Date('2026-11-20T08:00:00+05:00'));
    expect(d.items).toHaveLength(10);
    const row = await d1.db.prepare("SELECT source FROM daily_pins WHERE date = '2026-11-20'").first<{ source: string }>();
    expect(row?.source).toBe('auto');
  });
});
