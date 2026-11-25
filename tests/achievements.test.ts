// spec: F33-AC1..AC5, E36, E37, 9.2
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, adminCookie, SECRET, SITE } from './helpers/admin';
import { achievementsApi, deleteAchievement, listAchievements, publicAchievements, saveAchievement, type AdminAchievement } from '../src/lib/achievements';
import { checkAchievement, midtermCgpa, remarksFor, type Achievement, type AchForm } from '../src/lib/achievements-rules';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
const NOW = new Date('2026-11-24T10:00:00Z');
const F: AchForm = { kind: 'achievement', body: 'Topper pack lene wale 30 mein se 22 ka GPA 4.0', person: '', course: '', semester: 'Fall 2025', rating: null, place: 'vu', confirm: true };
async function post(body: unknown, o: { cookie?: string | null; origin?: string } = {}) {
  const r = await saveAchievement(await adminReq('/x', { body, ...o }), env(), { now: () => NOW });
  return { status: r.status, body: r.body as { id?: number; error?: { message: string } } };
}
const save = (x: Partial<AchForm> & { id?: number } = {}) => post({ action: 'save', ...F, ...x });
const list = async () => ((await listAchievements(await adminReq('/x'), env())).body as unknown as { items: AdminAchievement[] }).items;
const pub = async (p: 'vu' | 'job') => (await publicAchievements(d1.db, p)).map((a) => a.body);
async function del(id: string, o: { cookie?: string | null; origin?: string } = {}) {
  const headers: Record<string, string> = { Origin: o.origin ?? SITE };
  if (o.cookie !== null) headers.Cookie = o.cookie ?? (await adminCookie());
  return (await deleteAchievement(new Request(`${SITE}/x`, { method: 'DELETE', headers }), env(), id)).status;
}

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('F33-AC1, AC2: qaide', () => {
  it('tasdeeq ke baghair server rad (naya aur badalna dono)', async () => {
    const r = await save({ confirm: false });
    expect(r.status).toBe(400);
    expect(r.body.error?.message).toContain('tasdeeq');
    const { id } = (await save()).body;
    expect((await save({ id, confirm: false, body: 'Badla hua matn' })).status).toBe(400);
    expect((await list())[0]).toMatchObject({ body: F.body, confirmedAt: NOW.toISOString() });
    expect((await post({ action: 'save', ...F, confirm: undefined })).status).toBe(400);
  });
  it('lambai, phone, course, rating', () => {
    const bad = (x: Partial<AchForm>) => expect(checkAchievement({ ...F, ...x }).ok, JSON.stringify(x)).toBe(false);
    for (const body of ['abc', 'x'.repeat(161), 'Mera number 0300-1234567 hai', 'call +92 300 1234567', '923001234567 par']) bad({ body });
    bad({ person: 'x'.repeat(41) });
    bad({ person: 'Ali 03001234567' });
    bad({ course: 'English' });
    bad({ kind: 'remark', rating: 6 });
    bad({ kind: 'remark', rating: 0 });
    expect(checkAchievement({ ...F, course: 'cs 101', body: '  Do   lafz  ' })).toMatchObject({ ok: true, value: { course: 'CS101', body: 'Do lafz' } });
    expect(checkAchievement({ ...F, course: 'bt505t' })).toMatchObject({ value: { course: 'BT505T' } });
    // 18/20 ya 2025 jaise hindse phone nahin
    expect(checkAchievement({ ...F, body: 'CS101 midterm 18/20, Fall 2025, 300 students' }).ok).toBe(true);
    // achievement par rating nahin
    expect(checkAchievement({ ...F, rating: 5 })).toMatchObject({ value: { rating: null } });
  });
  it('midterm + CGPA par khabardari', () => {
    expect(midtermCgpa({ body: 'Midterm mein 4.0 CGPA', semester: '' })).toBe(true);
    expect(midtermCgpa({ body: '4 CGPA', semester: 'Spring Mid 2025' })).toBe(true);
    expect(midtermCgpa({ body: 'Midterm 18/20', semester: '' })).toBe(false);
    expect(midtermCgpa({ body: 'GPA 4.0', semester: 'Fall 2025' })).toBe(false);
  });
});

describe('F33-AC3, AC5: kahan dikhe', () => {
  it('VU, Job, dono; chhupi nahin; nayi upar; tarteeb; mitana', async () => {
    await save({ body: 'VU wali', place: 'vu' });
    await save({ body: 'Job wali', place: 'job' });
    const both = (await save({ body: 'Dono wali', place: 'both' })).body.id!;
    expect(await pub('vu')).toEqual(['Dono wali', 'VU wali']);
    expect(await pub('job')).toEqual(['Dono wali', 'Job wali']);
    expect((await post({ action: 'move', id: both, dir: 'down' })).status).toBe(200);
    expect((await list()).map((a) => a.body)).toEqual(['Job wali', 'Dono wali', 'VU wali']);
    await post({ action: 'move', id: both, dir: 'down' });
    await post({ action: 'move', id: both, dir: 'down' });
    expect((await list()).map((a) => a.body)).toEqual(['Job wali', 'VU wali', 'Dono wali']);
    await post({ action: 'visible', id: both, visible: false });
    expect(await pub('vu')).toEqual(['VU wali']);
    expect(await list()).toHaveLength(3);
    expect(await del(String(both))).toBe(200);
    expect(await del(String(both))).toBe(404);
    expect((await post({ action: 'visible', id: both, visible: true })).status).toBe(404);
  });
  it('E36: andaruni khane (confirmed_at, place) bahar nahin; ghalat jagah 400; table na ho to khali', async () => {
    await save();
    const r = await achievementsApi(new Request(`${SITE}/api/achievements?place=vu`), d1.db);
    expect(Object.keys((r.body as { items: object[] }).items[0]).sort()).toEqual(['body', 'course', 'id', 'kind', 'person', 'rating', 'semester']);
    expect((await achievementsApi(new Request(`${SITE}/api/achievements?place=x`), d1.db)).status).toBe(400);
    await d1.db.prepare('DROP TABLE achievements').run();
    expect(await publicAchievements(d1.db, 'vu')).toEqual([]);
  });
  it('kul 200 ki had', async () => {
    await d1.db.prepare("WITH RECURSIVE c(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM c WHERE i < 200) INSERT INTO achievements (kind, body, place, sort, confirmed_at, created_at) SELECT 'remark', 'x', 'vu', i, 't', 't' FROM c").run();
    expect((await save()).status).toBe(400);
    expect(await publicAchievements(d1.db, 'vu')).toHaveLength(50);
  });
});

it('F33-AC4: isi course ke remarks pehle, 3 tak, achievements nahin', () => {
  const a = (id: number, kind: Achievement['kind'], course: string | null): Achievement => ({ id, kind, body: 'b', person: null, course, semester: null, rating: null });
  const l = [a(1, 'remark', 'MTH101'), a(2, 'achievement', 'CS101'), a(3, 'remark', null), a(4, 'remark', 'CS101'), a(5, 'remark', 'CS101')];
  expect(remarksFor(l, 'CS101').map((x) => x.id)).toEqual([4, 5, 3]);
  expect(remarksFor([], 'CS101')).toEqual([]);
});

it('9.2: 401, 403, 400', async () => {
  expect((await listAchievements(await adminReq('/x', { cookie: null }), env())).status).toBe(401);
  expect((await post({ action: 'save', ...F }, { cookie: null })).status).toBe(401);
  expect((await post({ action: 'save', ...F }, { origin: 'https://evil.test' })).status).toBe(403);
  expect((await post({ action: 'udao' })).status).toBe(400);
  expect(await del('1', { cookie: null })).toBe(401);
  expect(await del('1', { origin: 'https://evil.test' })).toBe(403);
});
