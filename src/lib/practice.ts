// spec: F14-AC1..AC3 (mazameen + ginti, 10-10 ke sets, sirf verified), E06 GET /api/mcqs?subject=&offset= (offset ≤ 10,000), S15, S16
// Owner ka faisla (10b): sets purane pehle (id ke hisab se) — har dafa wohi set 1; practice ka score history mein nahin.
import { fail, ok, API_MSG, type ApiResult } from './api';
import { getSettings } from './settings';
import { slugify } from './slug';
import type { QuizMcq } from './daily';

export const SET_SIZE = 10;
export const MAX_OFFSET = 10_000;

export const PRACTICE_MSG = {
  subject: 'Yeh mazmoon list mein nahin.',
  offset: 'Set ka number sahih nahin.',
} as const;

export interface SubjectCard {
  subject: string;
  slug: string;
  count: number;
}

/** Settings ki tarteeb mein har mazmoon + verified sawalon ki ginti (ek query) */
export async function subjectCards(db: D1Database): Promise<SubjectCard[]> {
  const [{ subjects }, { results }] = await Promise.all([
    getSettings(db),
    db.prepare('SELECT subject, COUNT(*) AS n FROM mcqs WHERE verified = 1 GROUP BY subject').all<{ subject: string; n: number }>(),
  ]);
  const counts = new Map(results.map((r) => [r.subject, r.n]));
  return subjects.map((s) => ({ subject: s, slug: slugify(s, 'mazmoon'), count: counts.get(s) ?? 0 }));
}

/** URL ka slug → Settings ka mazmoon (na mile to null = 404) */
export async function subjectBySlug(db: D1Database, slug: string): Promise<string | null> {
  const { subjects } = await getSettings(db);
  return subjects.find((s) => slugify(s, 'mazmoon') === slug) ?? null;
}

type Row = { id: number; subject: string; question: string; options_json: string; answer_index: number; explanation: string | null };

/** Ek set: sirf verified, id ke hisab se, 10 sawal + aage aur hain ya nahin + kul ginti */
export async function practiceSet(db: D1Database, subject: string, offset: number): Promise<{ items: QuizMcq[]; hasMore: boolean; total: number; offset: number }> {
  const [list, total] = await db.batch([
    db.prepare(`SELECT id, subject, question, options_json, answer_index, explanation FROM mcqs WHERE verified = 1 AND subject = ?1 ORDER BY id LIMIT ${SET_SIZE + 1} OFFSET ?2`).bind(subject, offset),
    db.prepare('SELECT COUNT(*) AS n FROM mcqs WHERE verified = 1 AND subject = ?1').bind(subject),
  ]);
  const rows = list.results as Row[];
  return {
    items: rows.slice(0, SET_SIZE).map((r) => ({ id: r.id, subject: r.subject, question: r.question, options: JSON.parse(r.options_json) as string[], answerIndex: r.answer_index, explanation: r.explanation })),
    hasMore: rows.length > SET_SIZE,
    total: (total.results[0] as { n: number }).n,
    offset,
  };
}

/** E06: ?subject=<slug>&offset=<0..10000> */
export async function practiceApi(request: Request, db: D1Database): Promise<ApiResult> {
  const u = new URL(request.url);
  const slug = (u.searchParams.get('subject') ?? '').slice(0, 80);
  const raw = u.searchParams.get('offset') ?? '0';
  if (!/^\d{1,5}$/.test(raw) || Number(raw) > MAX_OFFSET) return fail(400, 'offset', PRACTICE_MSG.offset);
  try {
    const subject = await subjectBySlug(db, slug);
    if (!subject) return fail(400, 'subject', PRACTICE_MSG.subject);
    return ok({ subject, ...(await practiceSet(db, subject, Number(raw))) }, { 'Cache-Control': 'public, max-age=0, s-maxage=300' });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
