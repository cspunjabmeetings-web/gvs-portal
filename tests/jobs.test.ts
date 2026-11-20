// spec: S22, S23, S24, E07, F18-AC1 (khuli ginti, idara filter, band neeche), F18-AC4 (Pakistan ka din 23:59:59; band par us idare ki khuli jobs),
//       F18-AC5, F01-AC4 (3 taza khuli, naye pehle), F12-AC5 (410/404), F19-AC2 (default fee), intent 14.2 (title ≤ 60). Owner 13b: band 30 din / ≤ 20.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { publicJobs, jobBySlug, orgJobs, latestJobs, jobTitle, CLOSED_MAX } from '../src/lib/jobs';

let d1: Awaited<ReturnType<typeof startD1>>;
// Pakistan: 19 Nov 2026, 11:59 PM (UTC 18:59)
const LATE = new Date('2026-11-19T18:59:30Z');
// Pakistan: 20 Nov 2026, 12:00:30 AM
const NEXT = new Date('2026-11-19T19:00:30Z');

let seq = 0;
async function add(org: string, post: string, last: string, o: { visible?: 0 | 1; deleted?: boolean; ourFee?: number | null; govt?: number | null; docs?: string[]; apply?: 0 | 1 } = {}) {
  seq++;
  await d1.db
    .prepare(
      `INSERT INTO jobs (slug, org, post, city, education, last_date, official_url, ad_url, govt_fee, our_fee, apply_service, documents_json, steps_json, visible, created_at, updated_at, deleted_at)
       VALUES (?1, ?2, ?3, 'Lahore', 'BA', ?4, 'https://ppsc.gop.pk', NULL, ?5, ?6, ?7, ?8, '["Form bharein"]', ?9, 't', 't', ?10)`,
    )
    .bind(`job-${seq}`, org, post, last, o.govt ?? null, o.ourFee ?? null, o.apply ?? 1, JSON.stringify(o.docs ?? []), o.visible ?? 1, o.deleted ? 'x' : null)
    .run();
  return `job-${seq}`;
}

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => {
  await d1.reset();
  seq = 0;
});

describe('S22 publicJobs (F18-AC1, AC4)', () => {
  it('khuli: qareeb tareekh pehle; band neeche (naye band pehle); chhupi/mitayi nahin; idare ginti ke sath', async () => {
    await add('PPSC', 'Aaj', '2026-11-19');
    await add('FPSC', 'Baad', '2026-12-20');
    await add('PPSC', 'Kal', '2026-11-20');
    await add('NTS', 'Guzri', '2026-11-18');
    await add('NTS', 'Purani', '2026-11-01');
    await add('PPSC', 'Chhupi', '2026-12-01', { visible: 0 });
    await add('PPSC', 'Mitayi', '2026-12-01', { deleted: true });
    const r = await publicJobs(d1.db, LATE);
    expect(r.open.map((j) => j.post)).toEqual(['Aaj', 'Kal', 'Baad']);
    expect(r.closed.map((j) => j.post)).toEqual(['Guzri', 'Purani']);
    expect(r.orgs).toEqual([
      { org: 'PPSC', count: 2 },
      { org: 'FPSC', count: 1 },
    ]);
    expect(r.org).toBeNull();
  });

  it('F18-AC4: raat 11:59 PKT tak khuli, 12:00 AM par band', async () => {
    await add('PPSC', 'Aaj', '2026-11-19');
    expect((await publicJobs(d1.db, LATE)).open.map((j) => j.post)).toEqual(['Aaj']);
    const next = await publicJobs(d1.db, NEXT);
    expect([next.open.length, next.closed.map((j) => j.post)]).toEqual([0, ['Aaj']]);
  });

  it('owner 1a: band sirf pichhle 30 din ki, ≤ 20', async () => {
    await add('NTS', '30 din', '2026-10-20');
    await add('NTS', '31 din', '2026-10-19');
    for (let i = 0; i < CLOSED_MAX + 3; i++) await add('PPSC', `B${i}`, '2026-11-10');
    const r = await publicJobs(d1.db, LATE);
    expect(r.closed).toHaveLength(CLOSED_MAX);
    const all = await publicJobs(d1.db, LATE, 'nts');
    expect(all.closed.map((j) => j.post)).toEqual(['30 din']);
  });

  it('owner 2a: ?idara= filter (chhote-bare harf ka farq nahin); anjaan idara → khali', async () => {
    await add('PPSC', 'A', '2026-12-01');
    await add('FPSC', 'B', '2026-12-01');
    await add('PPSC', 'C', '2026-11-10');
    const r = await publicJobs(d1.db, LATE, 'ppsc');
    expect([r.org, r.open.map((j) => j.post), r.closed.map((j) => j.post)]).toEqual(['PPSC', ['A'], ['C']]);
    expect(r.orgs.length).toBe(2);
    const none = await publicJobs(d1.db, LATE, "x' OR 1=1 --");
    expect([none.open.length, none.closed.length]).toEqual([0, 0]);
  });
});

describe('S24 jobBySlug (F18-AC2, AC4, F12-AC5)', () => {
  it('poori job: default fee, documents, tareeqa, khuli', async () => {
    const s = await add('PPSC', 'Educator', '2026-12-05', { govt: 700, docs: ['CNIC', 'Domicile'] });
    const r = (await jobBySlug(d1.db, s.toUpperCase(), LATE)) as Exclude<Awaited<ReturnType<typeof jobBySlug>>, 'gone' | null>;
    expect(r.job).toMatchObject({ org: 'PPSC', post: 'Educator', education: 'BA', govtFee: 700, fee: 300, applyService: true, documents: ['CNIC', 'Domicile'], steps: ['Form bharein'], open: true });
    const own = await add('PPSC', 'Own fee', '2026-12-05', { ourFee: 450 });
    expect(((await jobBySlug(d1.db, own, LATE)) as { job: { fee: number } }).job.fee).toBe(450);
  });

  it('band job: open false + us idare ki khuli jobs (khud nahin, doosra idara nahin); tareekh barhi → khuli (F18-AC5)', async () => {
    const s = await add('PPSC', 'Band', '2026-11-18');
    await add('PPSC', 'Khuli 1', '2026-12-01');
    await add('ppsc', 'Khuli 2', '2026-11-25');
    await add('PPSC', 'Purani bhi', '2026-11-10');
    await add('FPSC', 'Doosra', '2026-12-01');
    const r = (await jobBySlug(d1.db, s, LATE)) as { job: { open: boolean }; sameOrg: { post: string }[] };
    expect(r.job.open).toBe(false);
    expect(r.sameOrg.map((j) => j.post)).toEqual(['Khuli 2', 'Khuli 1']);
    await d1.db.prepare("UPDATE jobs SET last_date = '2026-12-10' WHERE slug = ?1").bind(s).run();
    expect(((await jobBySlug(d1.db, s, LATE)) as { job: { open: boolean } }).job.open).toBe(true);
  });

  it('chhupi / na mili / ghalat slug → null (404); mitayi → gone (410)', async () => {
    const h = await add('PPSC', 'Chhupi', '2026-12-01', { visible: 0 });
    const d = await add('PPSC', 'Mitayi', '2026-12-01', { deleted: true });
    for (const s of [h, 'nahin-hai', '../x', '']) expect(await jobBySlug(d1.db, s, LATE), s).toBeNull();
    expect(await jobBySlug(d1.db, d, LATE)).toBe('gone');
  });
});

describe('S23 orgJobs, E07 latestJobs (F01-AC4)', () => {
  it('orgJobs: sirf us idare ki khuli', async () => {
    await add('NTS', 'A', '2026-12-01');
    await add('nts', 'B', '2026-11-20');
    await add('NTS', 'Band', '2026-11-01');
    await add('PPSC', 'C', '2026-12-01');
    expect((await orgJobs(d1.db, 'NTS', LATE)).map((j) => j.post)).toEqual(['B', 'A']);
  });
  it('latest: 3 khuli, naye pehle; band/chhupi nahin; cache 300 s', async () => {
    await add('A', '1', '2026-12-01');
    await add('A', '2', '2026-12-01');
    await add('A', 'Band', '2026-11-01');
    await add('A', '3', '2026-12-01');
    await add('A', 'Chhupi', '2026-12-01', { visible: 0 });
    await add('A', '4', '2026-12-01');
    const r = await latestJobs(d1.db, LATE);
    expect(r.status).toBe(200);
    expect((r.body.jobs as { post: string }[]).map((j) => j.post)).toEqual(['4', '3', '2']);
    expect(r.headers?.['Cache-Control']).toMatch(/s-maxage=300/);
    expect(Object.keys((r.body.jobs as object[])[0]).sort()).toEqual(['city', 'id', 'lastDate', 'org', 'post', 'slug']);
  });
});

describe('jobTitle (intent 14.2, F21-AC1 ≤ 60)', () => {
  it('poora, chhota, aur kaata hua — sab ≤ 60', () => {
    expect(jobTitle({ org: 'PPSC', post: 'Educator', lastDate: '2026-12-05' })).toBe('PPSC Educator Jobs 2026: Last Date 5 Dec 2026 | GVS Academy');
    expect(jobTitle({ org: 'PPSC', post: 'Educator (BPS-14) Urdu', lastDate: '2026-12-05' })).toBe('PPSC Educator (BPS-14) Urdu Jobs 2026 | GVS Academy');
    const long = jobTitle({ org: 'Punjab Police', post: 'Constable aur Lady Constable bharti', lastDate: '2026-12-05' });
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long).toMatch(/… Jobs 2026 \| GVS Academy$/);
  });
});
