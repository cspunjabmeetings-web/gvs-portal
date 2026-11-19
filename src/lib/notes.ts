// spec: S20 /notes (mazmoon ke hisab se list), S21 /notes/<slug> (matn, 5 MCQs quiz, mutalliqa notes), F16-AC1, F16-AC4,
//       F12-AC5 + P-06 (mitaya note = 410; chhupa = 404). Owner ka faisla (Qadam 12, 2a): quiz ke 5 sawal note ke slug se tay shuda
//       (har visitor ko wohi 5 — cache ke qabil), sirf verified.
import { getSettings } from './settings';
import { slugify } from './slug';
import { seededRandom, type QuizMcq } from './daily';
import { isMockSlug } from './mocks';

export const NOTE_QUIZ_SIZE = 5;
export const RELATED_MAX = 3;

export interface NoteCard {
  slug: string;
  title: string;
  subject: string;
  summary: string | null;
}
export interface NoteGroup {
  subject: string;
  /** Mazmoon ka slug (section id) */
  slug: string;
  /** /mcqs/<slug> — sirf jab mazmoon Settings ki list mein ho (warna wahan 404) */
  practiceHref: string | null;
  notes: NoteCard[];
}
export interface NoteFull extends NoteCard {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
}
export interface NotePage {
  note: NoteFull;
  quiz: QuizMcq[];
  related: NoteCard[];
  /** /mcqs/<slug> ya null (mazmoon Settings ki list mein nahin) */
  practiceHref: string | null;
}

const practiceHref = (subject: string, subjects: string[]) => (subjects.includes(subject) ? `/mcqs/${slugify(subject, 'mazmoon')}` : null);

/** S20: khule notes, Settings ke mazameen ki tarteeb mein (list se bahar wale aakhir mein), har group mein naye upar */
export async function publicNotes(db: D1Database): Promise<NoteGroup[]> {
  const [{ subjects }, { results }] = await Promise.all([
    getSettings(db),
    db.prepare('SELECT slug, title, subject, summary FROM notes WHERE visible = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1000').all<NoteCard>(),
  ]);
  const by = new Map<string, NoteCard[]>();
  for (const n of results) by.set(n.subject, [...(by.get(n.subject) ?? []), n]);
  const order = [...subjects, ...[...by.keys()].filter((s) => !subjects.includes(s))];
  return order.filter((s) => by.has(s)).map((s) => ({ subject: s, slug: slugify(s, 'mazmoon'), practiceHref: practiceHref(s, subjects), notes: by.get(s)! }));
}

type Row = { id: number; subject: string; question: string; options_json: string; answer_index: number; explanation: string | null };

/** 5 jaanche sawal, `seed` (note ka slug) se tay shuda — wohi note = wohi 5 */
export async function noteQuiz(db: D1Database, subject: string, seed: string): Promise<QuizMcq[]> {
  const { results: ids } = await db.prepare('SELECT id FROM mcqs WHERE verified = 1 AND subject = ?1 ORDER BY id LIMIT 5000').bind(subject).all<{ id: number }>();
  const pool = ids.map((r) => r.id);
  const rnd = seededRandom(`note:${seed}`);
  const picked: number[] = [];
  while (picked.length < NOTE_QUIZ_SIZE && pool.length) picked.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  if (!picked.length) return [];
  const { results } = await db
    .prepare('SELECT id, subject, question, options_json, answer_index, explanation FROM mcqs WHERE id IN (SELECT value FROM json_each(?1)) AND verified = 1')
    .bind(JSON.stringify(picked))
    .all<Row>();
  const byId = new Map(results.map((r) => [r.id, r]));
  return picked
    .map((id) => byId.get(id))
    .filter((r): r is Row => !!r)
    .map((r) => ({ id: r.id, subject: r.subject, question: r.question, options: JSON.parse(r.options_json) as string[], answerIndex: r.answer_index, explanation: r.explanation }));
}

/** S21: note + quiz + mutalliqa (wohi mazmoon, naye pehle, ≤ 3). Mitaya → 'gone' (410); na mile / chhupa / ghalat slug → null (404) */
export async function notePage(db: D1Database, rawSlug: string): Promise<NotePage | 'gone' | null> {
  const slug = rawSlug.toLowerCase();
  if (!isMockSlug(slug)) return null;
  const row = await db
    .prepare('SELECT id, slug, title, subject, summary, body_md, visible, created_at, updated_at, deleted_at FROM notes WHERE slug = ?1')
    .bind(slug)
    .first<{ id: number; slug: string; title: string; subject: string; summary: string | null; body_md: string; visible: number; created_at: string; updated_at: string; deleted_at: string | null }>();
  if (!row) return null;
  if (row.deleted_at) return 'gone';
  if (!row.visible) return null;
  const [quiz, { results: related }, { subjects }] = await Promise.all([
    noteQuiz(db, row.subject, row.slug),
    db
      .prepare(`SELECT slug, title, subject, summary FROM notes WHERE subject = ?1 AND id != ?2 AND visible = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT ${RELATED_MAX}`)
      .bind(row.subject, row.id)
      .all<NoteCard>(),
    getSettings(db),
  ]);
  return {
    note: { id: row.id, slug: row.slug, title: row.title, subject: row.subject, summary: row.summary, body: row.body_md, createdAt: row.created_at, updatedAt: row.updated_at },
    quiz,
    related,
    practiceHref: practiceHref(row.subject, subjects),
  };
}
