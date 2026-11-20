// spec: S22 /jobs (khuli jobs ginti ke sath, idare ka filter, band neeche), S23 /jobs/ppsc|fpsc|nts, S24 /jobs/<slug>, E07 GET /api/jobs/latest,
//       F18-AC1..AC4 (khuli = akhri tareekh ka din Pakistan waqt 23:59:59 tak; band par us idare ki khuli jobs), F01-AC4, F12-AC5 + P-06
//       (mitayi = 410, chhupi = 404). Owner ke faislay (13b): band jobs sirf pichhle 30 din ki, ≤ 20 (1a); filter `?idara=` link (2a).
import { ok, fail, API_MSG, type ApiResult } from './api';
import { getSettings } from './settings';
import { pkDate, addDays } from './pkdate';
import { isMockSlug } from './mocks';

export const CLOSED_DAYS = 30;
export const CLOSED_MAX = 20;
export const LATEST_MAX = 3;
export const OPEN_MAX = 200;

export interface JobCard {
  id: number;
  slug: string;
  org: string;
  post: string;
  city: string | null;
  lastDate: string;
}
export interface JobFull extends JobCard {
  education: string | null;
  officialUrl: string;
  adUrl: string | null;
  imageKey: string | null;
  govtFee: number | null;
  /** our_fee ya default_job_fee (F19-AC2) */
  fee: number;
  applyService: boolean;
  documents: string[];
  steps: string[];
  open: boolean;
  updatedAt: string;
}
export interface JobsList {
  open: JobCard[];
  closed: JobCard[];
  /** Khuli jobs ke idare (filter chips), ginti ke sath */
  orgs: { org: string; count: number }[];
  /** `?idara=` jo laga (sahih shakal mein) ya null */
  org: string | null;
}

const CARD = 'id, slug, org, post, city, last_date';
type CardRow = { id: number; slug: string; org: string; post: string; city: string | null; last_date: string };
const toCard = (r: CardRow): JobCard => ({ id: r.id, slug: r.slug, org: r.org, post: r.post, city: r.city, lastDate: r.last_date });
const arr = (json: string): string[] => {
  try {
    const x: unknown = JSON.parse(json);
    return Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
};
const PUBLIC = 'visible = 1 AND deleted_at IS NULL';

/** S22: khuli (qareeb akhri tareekh pehle), band (pichhle 30 din, naye band pehle, ≤ 20); `org` ho to sirf us idare ki (chhote-bare harf ka farq nahin) */
export async function publicJobs(db: D1Database, now: Date, rawOrg?: string | null): Promise<JobsList> {
  const today = pkDate(now);
  const { results: orgRows } = await db.prepare(`SELECT org, COUNT(*) AS n FROM jobs WHERE ${PUBLIC} AND last_date >= ?1 GROUP BY org COLLATE NOCASE ORDER BY n DESC, org`).bind(today).all<{ org: string; n: number }>();
  const orgs = orgRows.map((r) => ({ org: r.org, count: r.n }));
  const want = rawOrg ? rawOrg.trim().slice(0, 150) : '';
  const org = want ? (orgs.find((o) => o.org.toLowerCase() === want.toLowerCase())?.org ?? want) : null;
  const where = org ? ' AND org = ?2 COLLATE NOCASE' : '';
  const [open, closed] = await db.batch([
    db.prepare(`SELECT ${CARD} FROM jobs WHERE ${PUBLIC} AND last_date >= ?1${where} ORDER BY last_date ASC, id DESC LIMIT ${OPEN_MAX}`).bind(...(org ? [today, org] : [today])),
    db
      .prepare(`SELECT ${CARD} FROM jobs WHERE ${PUBLIC} AND last_date < ?1 AND last_date >= ?3${where} ORDER BY last_date DESC, id DESC LIMIT ${CLOSED_MAX}`)
      .bind(...(org ? [today, org, addDays(today, -CLOSED_DAYS)] : [today, null, addDays(today, -CLOSED_DAYS)])),
  ]);
  return { open: (open.results as CardRow[]).map(toCard), closed: (closed.results as CardRow[]).map(toCard), orgs, org };
}

type FullRow = CardRow & {
  education: string | null;
  official_url: string;
  ad_url: string | null;
  image_key: string | null;
  govt_fee: number | null;
  our_fee: number | null;
  apply_service: number;
  documents_json: string;
  steps_json: string;
  visible: number;
  deleted_at: string | null;
  updated_at: string;
};

/** S24: job + (band ho to) us idare ki khuli jobs. Mitayi → 'gone' (410); chhupi / na mili / ghalat slug → null (404) */
export async function jobBySlug(db: D1Database, rawSlug: string, now: Date): Promise<{ job: JobFull; sameOrg: JobCard[] } | 'gone' | null> {
  const slug = rawSlug.toLowerCase();
  if (!isMockSlug(slug)) return null;
  const r = await db
    .prepare(`SELECT ${CARD}, education, official_url, ad_url, image_key, govt_fee, our_fee, apply_service, documents_json, steps_json, visible, deleted_at, updated_at FROM jobs WHERE slug = ?1`)
    .bind(slug)
    .first<FullRow>();
  if (!r) return null;
  if (r.deleted_at) return 'gone';
  if (!r.visible) return null;
  const today = pkDate(now);
  const [{ default_job_fee }, { results: same }] = await Promise.all([
    getSettings(db),
    db.prepare(`SELECT ${CARD} FROM jobs WHERE ${PUBLIC} AND last_date >= ?1 AND org = ?2 COLLATE NOCASE AND id != ?3 ORDER BY last_date ASC, id DESC LIMIT 6`).bind(today, r.org, r.id).all<CardRow>(),
  ]);
  return {
    job: {
      ...toCard(r),
      education: r.education,
      officialUrl: r.official_url,
      adUrl: r.ad_url,
      imageKey: r.image_key,
      govtFee: r.govt_fee,
      fee: r.our_fee ?? default_job_fee,
      applyService: r.apply_service === 1,
      documents: arr(r.documents_json),
      steps: arr(r.steps_json),
      open: r.last_date >= today,
      updatedAt: r.updated_at,
    },
    sameOrg: same.map(toCard),
  };
}

/** S23: ek idare (PPSC/FPSC/NTS) ki khuli jobs */
export async function orgJobs(db: D1Database, org: string, now: Date): Promise<JobCard[]> {
  const { results } = await db.prepare(`SELECT ${CARD} FROM jobs WHERE ${PUBLIC} AND last_date >= ?1 AND org = ?2 COLLATE NOCASE ORDER BY last_date ASC, id DESC LIMIT ${OPEN_MAX}`).bind(pkDate(now), org).all<CardRow>();
  return results.map(toCard);
}

/** E07 (F01-AC4): 3 taza khuli jobs, naye pehle */
export async function latestJobs(db: D1Database, now: Date = new Date()): Promise<ApiResult> {
  try {
    const { results } = await db.prepare(`SELECT ${CARD} FROM jobs WHERE ${PUBLIC} AND last_date >= ?1 ORDER BY id DESC LIMIT ${LATEST_MAX}`).bind(pkDate(now)).all<CardRow>();
    return ok({ jobs: results.map(toCard) }, { 'Cache-Control': 'public, max-age=0, s-maxage=300' });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/** Visitor ke liye bhi wohi label (admin list jaisa) */
export { daysLeftLabel as daysLeft } from './job-form';

/** "5 Dec 2026" */
export const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** intent 14.2: "<Idara> <Post> Jobs <saal>: Last Date <tareekh> | GVS Academy"; 60 harf se lamba ho to chhota (F21-AC1) */
export function jobTitle(j: Pick<JobCard, 'org' | 'post' | 'lastDate'>): string {
  const year = j.lastDate.slice(0, 4);
  const tail = ` Jobs ${year}: Last Date ${fmtDate(j.lastDate)} | GVS Academy`;
  const full = `${j.org} ${j.post}${tail}`;
  if (full.length <= 60) return full;
  const short = `${j.org} ${j.post} Jobs ${year} | GVS Academy`;
  if (short.length <= 60) return short;
  const room = 60 - ` Jobs ${year} | GVS Academy`.length;
  return `${`${j.org} ${j.post}`.slice(0, room - 1).trimEnd()}… Jobs ${year} | GVS Academy`;
}
