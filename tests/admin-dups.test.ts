// spec: F12-AC7, 9.2
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, SECRET } from './helpers/admin';
import { listDuplicates, deleteDuplicates, type DupGroup } from '../src/lib/admin-dups';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
const deps = { now: () => new Date('2026-11-24T10:00:00Z') };
/** [hash, verified, mockId] → id 1, 2, 3… */
async function seed(rows: [string, number, number | null][]) {
  await d1.db.prepare("INSERT INTO mocks (slug, name, minutes, created_at) VALUES ('m1', 'Mock 1', 10, 't')").run();
  for (const [h, ver, mock] of rows)
    await d1.db.prepare("INSERT INTO mcqs (subject, question, options_json, answer_index, verified, mock_id, created_at, q_hash) VALUES ('English', ?1, '[\"a\",\"b\"]', 0, ?2, ?3, 't', ?1)").bind(h, ver, mock).run();
}
const pin = (date: string, ids: number[]) => d1.db.prepare("INSERT INTO daily_pins (date, mcq_ids_json, source) VALUES (?1, ?2, 'auto')").bind(date, JSON.stringify(ids)).run();
async function groups() {
  const r = await listDuplicates(await adminReq('/api/admin/mcqs/duplicates'), env(), deps);
  return r.body as unknown as { groups: DupGroup[]; total: number };
}
async function remove(ids: unknown, o: { cookie?: string | null; origin?: string } = {}) {
  const r = await deleteDuplicates(await adminReq('/api/admin/mcqs/duplicates', { body: { ids }, ...o }), env(), deps);
  return { status: r.status, body: r.body as { deleted?: number; refused?: number } };
}
const left = async () => (await d1.db.prepare('SELECT id FROM mcqs ORDER BY id').all<{ id: number }>()).results.map((r) => r.id);

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('F12-AC7', () => {
  it('groups; pehla = mock wala, phir jaancha, phir purana; akela sawal nahin', async () => {
    await seed([['a', 0, null], ['a', 1, null], ['a', 1, 1], ['b', 0, null], ['b', 1, null], ['c', 1, null], ['d', 1, null], ['d', 1, null]]);
    const g = await groups();
    expect(g.total).toBe(3);
    expect(g.groups.map((x) => x.items.map((m) => m.id))).toEqual([[3, 2, 1], [5, 4], [7, 8]]);
    expect(g.groups[0].items[0]).toMatchObject({ locked: true, mockName: 'Mock 1' });
  });
  it('hatana: ginti; phir group khatam', async () => {
    await seed([['a', 1, null], ['a', 1, null], ['a', 1, null]]);
    expect((await remove([2, 3])).body).toMatchObject({ deleted: 2, refused: 0 });
    expect(await left()).toEqual([1]);
    expect((await groups()).total).toBe(0);
  });
  it('mock wala, aaj/aage ke rozana test wala nahin hatta; guzre din ka hatta hai', async () => {
    await seed([['a', 1, 1], ['a', 1, null], ['b', 1, null], ['b', 1, null], ['c', 1, null], ['c', 1, null]]);
    await pin('2026-11-24', [4]);
    await pin('2026-11-20', [6]);
    const g = await groups();
    expect(g.groups[1].items[0]).toMatchObject({ id: 4, locked: true });
    expect((await remove([1, 4, 6])).body).toMatchObject({ deleted: 1, refused: 2 });
    expect(await left()).toEqual([1, 2, 3, 4, 5]);
  });
  it('poora group ya akela sawal bhejne par kuch nahin mitta', async () => {
    await seed([['a', 1, null], ['a', 1, null], ['z', 1, null]]);
    expect((await remove([1, 2, 3])).body).toMatchObject({ deleted: 0, refused: 3 });
    expect(await left()).toEqual([1, 2, 3]);
  });
  it('401, 403, ghalat body 400', async () => {
    expect((await listDuplicates(await adminReq('/x', { cookie: null }), env())).status).toBe(401);
    expect((await remove([1], { cookie: null })).status).toBe(401);
    expect((await remove([1], { origin: 'https://evil.test' })).status).toBe(403);
    for (const bad of [[], ['1 OR 1'], [1.5], Array.from({ length: 101 }, (_, i) => i + 1), 'x']) expect((await remove(bad)).status).toBe(400);
  });
});
