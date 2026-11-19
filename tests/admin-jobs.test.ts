// spec: E21, A07, F19-AC1 (paste = form), F19-AC2 (zaroori khane, default fee, Apply service Nahin), F19-AC3 (https), F19-AC5 (purani, Mitayen,
//       Sab purani mita dein), F18-AC4/AC5 (khuli = Pakistan ki aaj tak; tareekh barhayi to wapas khuli), F12-AC5 (deleted_at), A-12 (reserved slugs), 9.2
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, adminCookie, SECRET, SITE } from './helpers/admin';
import { listJobs, saveJobs, deleteJob, deleteOldJobs, JOBS_PAGE, JOBS_PER_SAVE, type AdminJobFull, type AdminJobRow } from '../src/lib/admin-jobs';
import { EMPTY_JOB_FORM, daysLeftLabel, formFromJob, hasBreaker, jobText, type JobForm } from '../src/lib/job-form';
import { parseContent, type ParsedJob } from '../src/lib/parser';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
// Pakistan: 19 Nov 2026, 11:30 PM (UTC 18:30) — din abhi khatam nahin
const NOW = new Date('2026-11-19T18:30:00Z');
const deps = { now: () => NOW };

const PASTE = `# JOB
Idara: PPSC
Post: Educator (BPS-14)
Shehar: Punjab bhar
Taleem: BA / BSc, 2nd division
Akhri tareekh: 2026-12-05
Official link: https://ppsc.gop.pk/jobs
Ishtihar link: https://drive.google.com/x
Sarkari fee: 700
Hamari fee: 300
Apply service: Haan
Documents:
- CNIC dono taraf ki tasveer
- Domicile
Tareeqa:
1. ppsc.gop.pk par account banayen
2. Online form bharein
---`;
const FORM: JobForm = {
  org: 'PPSC',
  post: 'Educator (BPS-14)',
  city: 'Punjab bhar',
  education: 'BA / BSc, 2nd division',
  lastDate: '2026-12-05',
  officialUrl: 'https://ppsc.gop.pk/jobs',
  adUrl: 'https://drive.google.com/x',
  govtFee: '700',
  ourFee: '300',
  applyService: true,
  documents: '- CNIC dono taraf ki tasveer\nDomicile\n',
  steps: '1. ppsc.gop.pk par account banayen\n2) Online form bharein',
};
const job = (org: string, post: string, last: string, extra = '') => `# JOB\nIdara: ${org}\nPost: ${post}\nAkhri tareekh: ${last}\nOfficial link: https://example.gov.pk/${encodeURIComponent(post)}\n${extra}---`;

async function save(body: unknown, o: { cookie?: string | null; origin?: string } = {}) {
  const r = await saveJobs(await adminReq('/api/admin/jobs', { body, ...o }), env(), deps);
  return { status: r.status, body: r.body as { ids?: number[]; slugs?: string[]; error?: { message: string; errors?: unknown[] } } };
}
async function list(q: string) {
  const r = await listJobs(await adminReq(`/api/admin/jobs?${q}`), env(), deps);
  return { status: r.status, body: r.body as { items: AdminJobRow[]; hasMore: boolean; counts: { open: number; old: number }; defaultFee: number; today: string; job?: AdminJobFull } };
}
async function del(id: string, o: { cookie?: string | null; origin?: string } = {}) {
  const headers: Record<string, string> = { Origin: o.origin ?? SITE };
  if (o.cookie !== null) headers.Cookie = o.cookie ?? (await adminCookie());
  return (await deleteJob(new Request(`${SITE}/api/admin/jobs/${id}`, { method: 'DELETE', headers }), env(), id, deps)).status;
}
const row = (id: number) => d1.db.prepare('SELECT * FROM jobs WHERE id = ?1').bind(id).first<Record<string, unknown>>();

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('job-form (F19-AC1: paste = form)', () => {
  it('form ka text parser mein bilkul paste jaisi job deta hai', () => {
    const strip = (t: string) => {
      const r = parseContent(t, { subjects: [] });
      expect(r.errors).toEqual([]);
      const { line, source, ...rest } = r.items[0] as ParsedJob;
      return rest;
    };
    expect(strip(jobText(FORM))).toEqual(strip(PASTE));
  });
  it('formFromJob → jobText → wahi job; khali ikhtiyari khane chhoot jate', () => {
    const j = parseContent(PASTE, { subjects: [] }).items[0] as ParsedJob;
    const again = parseContent(jobText(formFromJob(j)), { subjects: [] }).items[0] as ParsedJob;
    expect({ ...again, line: 0, source: '' }).toEqual({ ...j, line: 0, source: '' });
    const t = jobText({ ...EMPTY_JOB_FORM, org: 'NTS', post: 'Clerk', lastDate: '2026-12-01', officialUrl: 'https://nts.org.pk' });
    expect(t).not.toMatch(/Shehar|Hamari fee|Documents|Tareeqa/);
    expect(t).toMatch(/Apply service: Haan/);
  });
  it('khane mein naya-line wala matn ek line; "---" wali line rok', () => {
    expect(jobText({ ...FORM, post: 'Educator\n# MCQ' })).toMatch(/^Post: Educator # MCQ$/m);
    expect(hasBreaker({ ...FORM, documents: 'CNIC\n---\nx' })).toBe(true);
    expect(hasBreaker({ ...FORM, steps: '# NOTE' })).toBe(true);
    expect(hasBreaker(FORM)).toBe(false);
  });
  it('daysLeftLabel', () => {
    expect(daysLeftLabel('2026-11-19', '2026-11-19')).toBe('Aaj aakhri din');
    expect(daysLeftLabel('2026-11-20', '2026-11-19')).toBe('Kal aakhri din');
    expect(daysLeftLabel('2026-11-24', '2026-11-19')).toBe('5 din baqi');
    expect(daysLeftLabel('2026-11-18', '2026-11-19')).toBe('Band ho chuki');
  });
});

describe('E21 POST save (F19-AC1..AC3)', () => {
  it('paste aur form dono se ek jaisi row; slug idara-post', async () => {
    const a = await save({ action: 'save', text: PASTE });
    const b = await save({ action: 'save', text: jobText(FORM) });
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.slugs).toEqual(['ppsc-educator-bps-14']);
    expect(b.body.slugs).toEqual(['ppsc-educator-bps-14-2']);
    const pick = (r: Record<string, unknown> | null) => {
      const { id, slug, ...rest } = r!;
      return rest;
    };
    expect(pick(await row(a.body.ids![0]))).toEqual(pick(await row(b.body.ids![0])));
    expect(await row(a.body.ids![0])).toMatchObject({
      org: 'PPSC',
      city: 'Punjab bhar',
      last_date: '2026-12-05',
      govt_fee: 700,
      our_fee: 300,
      apply_service: 1,
      documents_json: '["CNIC dono taraf ki tasveer","Domicile"]',
      steps_json: '["ppsc.gop.pk par account banayen","Online form bharein"]',
      visible: 1,
      created_at: NOW.toISOString(),
    });
  });

  it('F19-AC2: khali Hamari fee = NULL (default_job_fee 300); Apply service Nahin = 0; zaroori khane', async () => {
    const r = await save({ action: 'save', text: job('NTS', 'Clerk', '2026-12-01', 'Apply service: Nahin\n') });
    expect(r.status).toBe(200);
    expect(await row(r.body.ids![0])).toMatchObject({ our_fee: null, apply_service: 0, govt_fee: null });
    expect((await list('tab=open')).body.defaultFee).toBe(300);
    const bad = await save({ action: 'save', text: '# JOB\nPost: Clerk\n---' });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body.error)).toMatch(/Idara/);
    expect(JSON.stringify(bad.body.error)).toMatch(/Akhri tareekh/);
    expect(JSON.stringify(bad.body.error)).toMatch(/Official link/);
  });

  it('F19-AC3: https ke ilawa link rad (official + ishtihar); kuch save nahin', async () => {
    for (const t of [job('PPSC', 'A', '2026-12-01').replace('https://', 'http://'), job('PPSC', 'B', '2026-12-01', 'Ishtihar link: javascript:alert(1)\n')]) {
      const r = await save({ action: 'save', text: t });
      expect(r.status).toBe(400);
      expect(r.body.error!.message).toMatch(/https:\/\//);
    }
    expect((await list('tab=open')).body.counts.open).toBe(0);
  });

  it('kai jobs ek paste mein (ek batch); ek bhi ghalat → kuch nahin; sirf # JOB; 20 ki hadd', async () => {
    const ok = await save({ action: 'save', text: [job('PPSC', 'A', '2026-12-01'), job('FPSC', 'B', '2026-12-02')].join('\n') });
    expect(ok.body.ids).toHaveLength(2);
    const bad = await save({ action: 'save', text: [job('PPSC', 'C', '2026-12-01'), job('PPSC', 'D', 'kal')].join('\n') });
    expect(bad.status).toBe(400);
    const mixed = await save({ action: 'save', text: job('PPSC', 'E', '2026-12-01') + '\n# MCQ\nMazmoon: English\nSawal: x?\nA) a*\nB) b\n---' });
    expect(mixed.status).toBe(400);
    const many = await save({ action: 'save', text: Array.from({ length: JOBS_PER_SAVE + 1 }, (_, i) => job('NTS', `P${i}`, '2026-12-01')).join('\n') });
    expect(many.status).toBe(400);
    expect((await list('tab=open')).body.counts.open).toBe(2);
  });

  it('A-12: ppsc/fpsc/nts slug kabhi nahin', async () => {
    const r = await save({ action: 'save', text: ['# JOB\nIdara: PPSC\nPost: -\nAkhri tareekh: 2026-12-01\nOfficial link: https://ppsc.gop.pk\n---', '# JOB\nIdara: N\nPost: TS\nAkhri tareekh: 2026-12-01\nOfficial link: https://nts.org.pk\n---'].join('\n') });
    expect(r.status).toBe(200);
    expect(r.body.slugs!.some((s) => ['ppsc', 'fpsc', 'nts'].includes(s))).toBe(false);
    expect(r.body.slugs![0]).toBe('ppsc-2');
    expect(r.body.slugs![1]).toBe('n-ts');
  });

  it('badalna: slug wahi; sirf ek job; F18-AC5: tareekh barhayi to wapas Khuli', async () => {
    const id = (await save({ action: 'save', text: job('PPSC', 'Lecturer', '2026-11-18') })).body.ids![0];
    expect((await list('tab=old')).body.items.map((x) => x.id)).toEqual([id]);
    const e = await save({ action: 'save', id, text: job('PPSC', 'Lecturer Urdu', '2026-11-30') });
    expect(e.status).toBe(200);
    expect(await row(id)).toMatchObject({ slug: 'ppsc-lecturer', post: 'Lecturer Urdu', last_date: '2026-11-30' });
    expect((await list('tab=open')).body.items.map((x) => x.id)).toEqual([id]);
    expect((await list('tab=old')).body.items).toEqual([]);
    expect((await save({ action: 'save', id, text: [job('A', 'B', '2026-12-01'), job('C', 'D', '2026-12-01')].join('\n') })).status).toBe(400);
    expect((await save({ action: 'save', id: 9999, text: job('A', 'B', '2026-12-01') })).status).toBe(404);
  });

  it('chhupana/dikhana', async () => {
    const id = (await save({ action: 'save', text: job('PPSC', 'A', '2026-12-01') })).body.ids![0];
    expect((await save({ action: 'visible', id, visible: false })).status).toBe(200);
    expect((await row(id))!.visible).toBe(0);
    expect((await list('tab=open')).body.items[0].visible).toBe(false);
    expect((await save({ action: 'visible', id: 999, visible: true })).status).toBe(404);
  });

  it('9.2: cookie nahin 401, doosra Origin 403, kharab body 400', async () => {
    expect((await save({ action: 'save', text: PASTE }, { cookie: null })).status).toBe(401);
    expect((await save({ action: 'save', text: PASTE }, { origin: 'https://evil.test' })).status).toBe(403);
    expect((await save({ action: 'x' })).status).toBe(400);
    expect((await listJobs(new Request(`${SITE}/api/admin/jobs`), env(), deps)).status).toBe(401);
  });
});

describe('E21 GET list (F18-AC4: Pakistan ki aaj tak khuli)', () => {
  it('khuli: aaj aakhri din bhi (11:30 PM PKT); purani: kal tak; khuli qareeb tareekh pehle, purani naye pehle; ginti', async () => {
    await save({ action: 'save', text: [job('A', 'Aaj', '2026-11-19'), job('B', 'Baad', '2026-12-10'), job('C', 'Kal', '2026-11-20'), job('D', 'Guzri', '2026-11-18'), job('E', 'Purani', '2026-10-01')].join('\n') });
    const open = await list('tab=open');
    expect(open.body.items.map((x) => x.post)).toEqual(['Aaj', 'Kal', 'Baad']);
    expect(open.body.counts).toEqual({ open: 3, old: 2 });
    expect(open.body.today).toBe('2026-11-19');
    expect((await list('tab=old')).body.items.map((x) => x.post)).toEqual(['Guzri', 'Purani']);
  });
  it('?id= poori job; mitayi nahin milti; 50 + hasMore', async () => {
    const id = (await save({ action: 'save', text: PASTE })).body.ids![0];
    const one = await list(`id=${id}`);
    expect(one.body.job).toMatchObject({ org: 'PPSC', education: 'BA / BSc, 2nd division', documents: ['CNIC dono taraf ki tasveer', 'Domicile'], steps: ['ppsc.gop.pk par account banayen', 'Online form bharein'], ourFee: 300, applyService: true });
    expect((await list('id=abc')).status).toBe(404);
    for (let i = 0; i < 3; i++) await save({ action: 'save', text: Array.from({ length: 20 }, (_, k) => job('NTS', `P${i}-${k}`, '2026-12-01')).join('\n') });
    const p1 = await list('tab=open');
    expect([p1.body.items.length, p1.body.hasMore]).toEqual([JOBS_PAGE, true]);
    expect((await list(`tab=open&offset=${JOBS_PAGE}`)).body.items.length).toBe(11);
  });
});

describe('E21 mitana (F19-AC5, F12-AC5)', () => {
  it('DELETE: deleted_at + visible 0; list mein nahin; dobara 404; 401/403', async () => {
    const id = (await save({ action: 'save', text: PASTE })).body.ids![0];
    expect(await del(String(id), { cookie: null })).toBe(401);
    expect(await del(String(id), { origin: 'https://evil.test' })).toBe(403);
    expect(await del(String(id))).toBe(200);
    expect(await row(id)).toMatchObject({ visible: 0, deleted_at: NOW.toISOString() });
    expect((await list('tab=open')).body.counts.open).toBe(0);
    expect((await list(`id=${id}`)).status).toBe(404);
    expect(await del(String(id))).toBe(404);
    // mitayi job ka slug dobara nahin milta (URL 410 rehta hai)
    expect((await save({ action: 'save', text: PASTE })).body.slugs).toEqual(['ppsc-educator-bps-14-2']);
  });
  it('delete-old: sirf purani (aaj wali nahin); tasdeeq zaroori', async () => {
    await save({ action: 'save', text: [job('A', 'Aaj', '2026-11-19'), job('D', 'Guzri', '2026-11-18'), job('E', 'Purani', '2026-10-01')].join('\n') });
    const call = async (body: unknown) => {
      const r = await deleteOldJobs(await adminReq('/api/admin/jobs/delete-old', { body }), env(), deps);
      return { status: r.status, body: r.body as { deleted?: number } };
    };
    expect((await call({})).status).toBe(400);
    expect((await call({ confirm: 'yes' })).status).toBe(400);
    const r = await call({ confirm: true });
    expect(r).toEqual({ status: 200, body: { ok: true, deleted: 2 } });
    expect((await list('tab=open')).body.counts).toEqual({ open: 1, old: 0 });
    expect((await deleteOldJobs(await adminReq('/api/admin/jobs/delete-old', { body: { confirm: true }, cookie: null }), env(), deps)).status).toBe(401);
  });
});
