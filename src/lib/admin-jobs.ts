// spec: E21 (GET/POST /api/admin/jobs, DELETE /api/admin/jobs/:id, POST /api/admin/jobs/delete-old), A07, F19-AC1 (paste = form),
//       F19-AC2 (zaroori khane; khali fee = default_job_fee → NULL; Apply service Nahin), F19-AC3 (https), F19-AC5 (purani: Mitayen,
//       "Sab purani mita dein"), F18-AC4/AC5 (khuli = Pakistan ki aaj tak; tareekh barhi to dobara khuli), F12-AC5 + P-06 (deleted_at → 410),
//       A-12 (ppsc/fpsc/nts reserved), 9.2 (cookie + Origin + JSON).
//       F19-AC6 (job mitane par us ki R2 tasveer bhi; pehle R2, phir DB). Upload E22 `job-image.ts` mein.
import * as v from 'valibot';
import { fail, ok, readJson, sameOrigin, API_MSG, type ApiResult } from './api';
import { adminPost, requireAdmin } from './admin-auth';
import { getSettings } from './settings';
import { parseContent, type ParsedJob } from './parser';
import { slugify, uniqueSlug } from './slug';
import { takenSlugs, type ContentEnv } from './content-import';
import { pkDate } from './pkdate';
import { deleteImages, type JobsEnv } from './job-image';

export const JOBS_PAGE = 50;
/** Ek paste mein zyada se zyada jobs (ek batch) */
export const JOBS_PER_SAVE = 20;
export const JOB_TEXT_LIMIT = 200 * 1024;
/** A-12: yeh idaron ke pages hain, kisi job ka slug nahin */
export const RESERVED_JOB_SLUGS = ['ppsc', 'fpsc', 'nts'] as const;

export const JOBS_MSG = {
  not_found: 'Yeh job nahin mili (shayad mit chuki).',
  invalid: 'Maloomat sahih shakal mein nahin.',
  empty: 'Koi job nahin mili. Text "# JOB" se shuru karein aur aakhir mein "---" likhein.',
  only_jobs: 'Jobs tab mein sirf "# JOB" wali cheezein. Sawal, mock aur notes Content tab mein daalein.',
  too_many: `Ek dafa mein ${JOBS_PER_SAVE} jobs tak save karein.`,
  edit_one: 'Badalte waqt sirf ek job ka text ho.',
  confirm: 'Tasdeeq zaroori hai.',
} as const;

export interface AdminJobRow {
  id: number;
  slug: string;
  org: string;
  post: string;
  city: string | null;
  lastDate: string;
  visible: boolean;
  applyService: boolean;
  ourFee: number | null;
  govtFee: number | null;
  /** R2 key (E22); null = tasveer nahin */
  imageKey: string | null;
}
export type AdminJobFull = AdminJobRow & Omit<ParsedJob, 'kind' | 'line' | 'source'>;

type JobRow = {
  id: number;
  slug: string;
  org: string;
  post: string;
  city: string | null;
  education: string | null;
  last_date: string;
  official_url: string;
  ad_url: string | null;
  govt_fee: number | null;
  our_fee: number | null;
  apply_service: number;
  documents_json: string;
  steps_json: string;
  visible: number;
  image_key: string | null;
};

const arr = (json: string): string[] => {
  try {
    const x: unknown = JSON.parse(json);
    return Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
};
const toRow = (r: JobRow): AdminJobRow => ({ id: r.id, slug: r.slug, org: r.org, post: r.post, city: r.city, lastDate: r.last_date, visible: r.visible === 1, applyService: r.apply_service === 1, ourFee: r.our_fee, govtFee: r.govt_fee, imageKey: r.image_key });
const toFull = (r: JobRow): AdminJobFull => ({
  ...toRow(r),
  education: r.education,
  officialUrl: r.official_url,
  adUrl: r.ad_url,
  documents: arr(r.documents_json),
  steps: arr(r.steps_json),
});

const parseId = (raw: string | undefined) => (raw && /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null);
const offsetOf = (u: URL) => Math.max(0, Math.min(1_000_000, Number(u.searchParams.get('offset')) || 0));
const COLS = 'id, slug, org, post, city, education, last_date, official_url, ad_url, govt_fee, our_fee, apply_service, documents_json, steps_json, visible, image_key';

async function guardPost(request: Request, env: ContentEnv): Promise<ApiResult | null> {
  return (await requireAdmin(request, env)) ?? adminPost(request);
}

/** E21 GET: ?tab=open|old (+offset) list, ya ?id= poori job (badalne ke liye). Har jawab mein default_job_fee aur aaj ki tareekh */
export async function listJobs(request: Request, env: ContentEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const u = new URL(request.url);
  const today = pkDate((deps.now ?? (() => new Date()))());
  try {
    const { default_job_fee } = await getSettings(env.DB);
    if (u.searchParams.has('id')) {
      const id = parseId(u.searchParams.get('id') ?? undefined);
      const r = id ? await env.DB.prepare(`SELECT ${COLS} FROM jobs WHERE id = ?1 AND deleted_at IS NULL`).bind(id).first<JobRow>() : null;
      if (!r) return fail(404, 'not_found', JOBS_MSG.not_found);
      return ok({ job: toFull(r), defaultFee: default_job_fee, today });
    }
    const tab = u.searchParams.get('tab') === 'old' ? 'old' : 'open';
    const offset = offsetOf(u);
    const [list, counts] = await env.DB.batch([
      env.DB.prepare(
        tab === 'open'
          ? `SELECT ${COLS} FROM jobs WHERE deleted_at IS NULL AND last_date >= ?1 ORDER BY last_date ASC, id DESC LIMIT ${JOBS_PAGE + 1} OFFSET ${offset}`
          : `SELECT ${COLS} FROM jobs WHERE deleted_at IS NULL AND last_date < ?1 ORDER BY last_date DESC, id DESC LIMIT ${JOBS_PAGE + 1} OFFSET ${offset}`,
      ).bind(today),
      env.DB.prepare('SELECT COALESCE(SUM(last_date >= ?1), 0) AS open, COALESCE(SUM(last_date < ?1), 0) AS old FROM jobs WHERE deleted_at IS NULL').bind(today),
    ]);
    const rows = list.results as JobRow[];
    const c = counts.results[0] as { open: number; old: number };
    return ok({ items: rows.slice(0, JOBS_PAGE).map(toRow), hasMore: rows.length > JOBS_PAGE, counts: { open: c.open, old: c.old }, defaultFee: default_job_fee, today });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

const SaveBody = v.variant('action', [
  v.object({ action: v.literal('visible'), id: v.number(), visible: v.boolean() }),
  v.object({ action: v.literal('save'), id: v.optional(v.number()), text: v.pipe(v.string(), v.maxLength(JOB_TEXT_LIMIT)) }),
]);

/** Text → sirf jobs (ghaltiyan ho to kuch nahin) */
export function jobsFromText(text: string, subjects: readonly string[]): { ok: true; jobs: ParsedJob[] } | { ok: false; message: string; errors?: { line: number; message: string }[] } {
  const r = parseContent(text, { subjects });
  if (r.errors.length) return { ok: false, message: r.errors[0].message, errors: r.errors.slice(0, 20) };
  if (!r.items.length) return { ok: false, message: JOBS_MSG.empty };
  if (r.items.some((x) => x.kind !== 'JOB')) return { ok: false, message: JOBS_MSG.only_jobs };
  if (r.items.length > JOBS_PER_SAVE) return { ok: false, message: JOBS_MSG.too_many };
  return { ok: true, jobs: r.items as ParsedJob[] };
}

const bindJob = (j: ParsedJob) => [j.org, j.post, j.city, j.education, j.lastDate, j.officialUrl, j.adUrl, j.govtFee, j.ourFee, j.applyService ? 1 : 0, JSON.stringify(j.documents), JSON.stringify(j.steps)];

/** E21 POST: { action:'save', text, id? } (naya: kai jobs; badalna: ek, slug wahi) ya { action:'visible', id, visible } */
export async function saveJobs(request: Request, env: ContentEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await guardPost(request, env);
  if (denied) return denied;
  const body = await readJson(request, JOB_TEXT_LIMIT + 4096);
  if (!body.ok) return body.res;
  const p = v.safeParse(SaveBody, body.data);
  if (!p.success) return fail(400, 'invalid', JOBS_MSG.invalid);
  const at = (deps.now ?? (() => new Date()))().toISOString();
  const db = env.DB;
  try {
    if (p.output.action === 'visible') {
      const res = await db.prepare('UPDATE jobs SET visible = CAST(?1 AS INTEGER), updated_at = ?3 WHERE id = ?2 AND deleted_at IS NULL').bind(p.output.visible ? 1 : 0, p.output.id, at).run();
      if (res.meta.changes !== 1) return fail(404, 'not_found', JOBS_MSG.not_found);
      return ok({ id: p.output.id, visible: p.output.visible });
    }
    const { subjects } = await getSettings(db);
    const r = jobsFromText(p.output.text, subjects);
    if (!r.ok) return { status: 400, body: { ok: false, error: { code: 'invalid', message: r.message, errors: r.errors ?? [] } } };

    if (p.output.id !== undefined) {
      if (r.jobs.length !== 1) return fail(400, 'invalid', JOBS_MSG.edit_one);
      const res = await db
        .prepare(
          `UPDATE jobs SET org = ?1, post = ?2, city = ?3, education = ?4, last_date = ?5, official_url = ?6, ad_url = ?7, govt_fee = CAST(?8 AS INTEGER),
           our_fee = CAST(?9 AS INTEGER), apply_service = CAST(?10 AS INTEGER), documents_json = ?11, steps_json = ?12, updated_at = ?13
           WHERE id = ?14 AND deleted_at IS NULL`,
        )
        .bind(...bindJob(r.jobs[0]), at, p.output.id)
        .run();
      if (res.meta.changes !== 1) return fail(404, 'not_found', JOBS_MSG.not_found);
      return ok({ ids: [p.output.id] });
    }

    // Naye: slug "idara-post", unique (mitaye hue samet), ppsc/fpsc/nts kabhi nahin (A-12)
    const bases = r.jobs.map((j) => slugify(`${j.org} ${j.post}`, 'job'));
    const taken = await takenSlugs(db, 'jobs', bases);
    for (const s of RESERVED_JOB_SLUGS) taken.add(s);
    const slugs = bases.map((b) => {
      const s = uniqueSlug(b, taken);
      taken.add(s);
      return s;
    });
    const res = await db.batch(
      r.jobs.map((j, i) =>
        db
          .prepare(
            `INSERT INTO jobs (slug, org, post, city, education, last_date, official_url, ad_url, govt_fee, our_fee, apply_service, documents_json, steps_json, visible, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CAST(?9 AS INTEGER), CAST(?10 AS INTEGER), CAST(?11 AS INTEGER), ?12, ?13, 1, ?14, ?14) RETURNING id`,
          )
          .bind(slugs[i], ...bindJob(j), at),
      ),
    );
    return ok({ ids: res.map((x) => (x.results[0] as { id: number }).id), slugs });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return fail(409, 'conflict', 'Isi waqt doosri job save hui. Dobara "Save" dabayen.');
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/** E21 DELETE /:id (F12-AC5): deleted_at → URL 410. DELETE ki hifazat cookie + Origin (body nahin) */
export async function deleteJob(request: Request, env: JobsEnv, rawId: string | undefined, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? (sameOrigin(request) ? null : fail(403, 'origin', API_MSG.origin));
  if (denied) return denied;
  const id = parseId(rawId);
  if (!id) return fail(404, 'not_found', JOBS_MSG.not_found);
  const at = (deps.now ?? (() => new Date()))().toISOString();
  try {
    const row = await env.DB.prepare('SELECT image_key FROM jobs WHERE id = ?1 AND deleted_at IS NULL').bind(id).first<{ image_key: string | null }>();
    if (!row) return fail(404, 'not_found', JOBS_MSG.not_found);
    await deleteImages(env, [row.image_key]);
    const res = await env.DB.prepare('UPDATE jobs SET deleted_at = ?2, visible = 0, image_key = NULL, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NULL').bind(id, at).run();
    if (res.meta.changes !== 1) return fail(404, 'not_found', JOBS_MSG.not_found);
    return ok({ id });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/** E21 POST delete-old { confirm: true } (F19-AC5): sirf woh jin ki aakhri tareekh guzar chuki (Pakistan ki aaj se pehle) */
export async function deleteOldJobs(request: Request, env: JobsEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await guardPost(request, env);
  if (denied) return denied;
  const body = await readJson(request, 1024);
  if (!body.ok) return body.res;
  if (!v.is(v.object({ confirm: v.literal(true) }), body.data)) return fail(400, 'confirm', JOBS_MSG.confirm);
  const now = (deps.now ?? (() => new Date()))();
  try {
    const { results } = await env.DB.prepare('SELECT image_key FROM jobs WHERE deleted_at IS NULL AND last_date < ?1 AND image_key IS NOT NULL').bind(pkDate(now)).all<{ image_key: string }>();
    await deleteImages(env, results.map((r) => r.image_key));
    const res = await env.DB.prepare('UPDATE jobs SET deleted_at = ?2, visible = 0, image_key = NULL, updated_at = ?2 WHERE deleted_at IS NULL AND last_date < ?1').bind(pkDate(now), now.toISOString()).run();
    return ok({ deleted: res.meta.changes });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
