// spec: S18 /mock-tests (muft mocks ki list: naam, sawal, waqt), S19 /mock-tests/<slug> (saare sawal page ke sath), F15-AC1, F15-AC8 (≤ 100 sawal,
//       test ke dauran network nahin), F13-AC2 jaisa: sirf verified sawal; chhupa (visible=0) mock = 404. (Mitaya = 410: Qadam 11b.)
import type { QuizMcq } from './daily';

export const MOCK_MAX_QUESTIONS = 100;

export interface MockCard {
  slug: string;
  name: string;
  minutes: number;
  summary: string | null;
  questions: number;
}
export interface MockFull extends MockCard {
  items: QuizMcq[];
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
export const isMockSlug = (s: string) => SLUG_RE.test(s);

/** S18: khule mocks (visible, mitaye nahin, kam az kam 1 jaancha sawal), naye upar */
export async function publicMocks(db: D1Database): Promise<MockCard[]> {
  const { results } = await db
    .prepare(
      `SELECT k.slug, k.name, k.minutes, k.summary, COUNT(m.id) AS questions
       FROM mocks k JOIN mcqs m ON m.mock_id = k.id AND m.verified = 1
       WHERE k.visible = 1 AND k.deleted_at IS NULL
       GROUP BY k.id ORDER BY k.id DESC LIMIT 200`,
    )
    .all<MockCard>();
  return results.map((r) => ({ ...r, questions: Math.min(r.questions, MOCK_MAX_QUESTIONS) }));
}

type Row = { id: number; subject: string; question: string; options_json: string; answer_index: number; explanation: string | null };

/** S19: ek mock aur us ke jaanche hue sawal (import ki tarteeb mein, ≤ 100). Na mile / chhupa / sawal 0 → null */
export async function mockBySlug(db: D1Database, rawSlug: string): Promise<MockFull | null> {
  const slug = rawSlug.toLowerCase();
  if (!isMockSlug(slug)) return null;
  const mock = await db
    .prepare('SELECT id, slug, name, minutes, summary FROM mocks WHERE slug = ?1 AND visible = 1 AND deleted_at IS NULL')
    .bind(slug)
    .first<{ id: number; slug: string; name: string; minutes: number; summary: string | null }>();
  if (!mock) return null;
  const { results } = await db
    .prepare(`SELECT id, subject, question, options_json, answer_index, explanation FROM mcqs WHERE mock_id = ?1 AND verified = 1 ORDER BY id LIMIT ${MOCK_MAX_QUESTIONS}`)
    .bind(mock.id)
    .all<Row>();
  if (!results.length) return null;
  const items: QuizMcq[] = results.map((r) => ({ id: r.id, subject: r.subject, question: r.question, options: JSON.parse(r.options_json) as string[], answerIndex: r.answer_index, explanation: r.explanation }));
  return { slug: mock.slug, name: mock.name, minutes: mock.minutes, summary: mock.summary, questions: items.length, items };
}
