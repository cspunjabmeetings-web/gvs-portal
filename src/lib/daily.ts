// spec: SA8 (rozana 10 sawal: sirf verified, mazameen mila jula, pichhle 15 din ke nahin, seed = Pakistan ki tareekh, pin ho to wohi,
//       natija daily_pins mein), E05 GET /api/daily-test (s-maxage=300, jawab ke sath), F13-AC1, F13-AC2, P-03 (daily_pins.source)
import { fail, ok, API_MSG, type ApiResult } from './api';
import { addDays, pkDate } from './pkdate';

export const DAILY_COUNT = 10;
export const NO_REPEAT_DAYS = 15;

export interface QuizMcq {
  id: number;
  subject: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string | null;
}

type Row = { id: number; subject: string; question: string; options_json: string; answer_index: number; explanation: string | null };
const toQuiz = (r: Row): QuizMcq => ({ id: r.id, subject: r.subject, question: r.question, options: JSON.parse(r.options_json) as string[], answerIndex: r.answer_index, explanation: r.explanation });

/** Chhota, tay shuda random (mulberry32) — ek hi tareekh = ek hi tarteeb */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rnd: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Mazameen bari bari (round-robin), har mazmoon andar se seed ke hisab se mila jula */
export function pickMixed(pool: { id: number; subject: string }[], count: number, seed: string): number[] {
  const rnd = seededRandom(seed);
  const bySubject = new Map<string, number[]>();
  for (const p of pool) bySubject.set(p.subject, [...(bySubject.get(p.subject) ?? []), p.id]);
  const subjects = shuffle([...bySubject.keys()].sort(), rnd);
  const lists = subjects.map((s) => shuffle(bySubject.get(s)!.sort((x, y) => x - y), rnd));
  const out: number[] = [];
  for (let round = 0; out.length < count; round++) {
    let any = false;
    for (const l of lists) {
      if (round < l.length) {
        out.push(l[round]);
        any = true;
        if (out.length === count) break;
      }
    }
    if (!any) break;
  }
  return out;
}

async function rowsByIds(db: D1Database, ids: number[]): Promise<QuizMcq[]> {
  if (!ids.length) return [];
  const { results } = await db
    .prepare(
      `SELECT id, subject, question, options_json, answer_index, explanation FROM mcqs
       WHERE verified = 1 AND id IN (SELECT value FROM json_each(?1))`,
    )
    .bind(JSON.stringify(ids))
    .all<Row>();
  const map = new Map(results.map((r) => [r.id, r]));
  // Pin/auto ki tarteeb wahi; mita ya chhupa sawal chhoot jata hai
  return ids.flatMap((id) => (map.has(id) ? [toQuiz(map.get(id)!)] : []));
}

/** SA8: aaj (Pakistan) ke sawal. Pehli request auto chunti aur daily_pins mein mehfooz karti hai — sab ke liye wohi 10. */
export async function dailyQuestions(db: D1Database, now: Date = new Date()): Promise<{ date: string; items: QuizMcq[] }> {
  const date = pkDate(now);
  const readPin = () => db.prepare('SELECT mcq_ids_json FROM daily_pins WHERE date = ?1').bind(date).first<{ mcq_ids_json: string }>();
  const pinned = await readPin();
  if (pinned) return { date, items: await rowsByIds(db, JSON.parse(pinned.mcq_ids_json) as number[]) };

  const [recent, pool] = await db.batch([
    db.prepare('SELECT mcq_ids_json FROM daily_pins WHERE date >= ?1 AND date < ?2').bind(addDays(date, -NO_REPEAT_DAYS), date),
    db.prepare('SELECT id, subject FROM mcqs WHERE verified = 1'),
  ]);
  const used = new Set<number>();
  for (const r of recent.results as { mcq_ids_json: string }[]) for (const id of JSON.parse(r.mcq_ids_json) as number[]) used.add(id);
  const all = pool.results as { id: number; subject: string }[];
  const fresh = all.filter((p) => !used.has(p.id));
  // 15 din ke baghair 10 na milen to purane bhi (test khali na ho)
  const ids = pickMixed(fresh.length >= DAILY_COUNT ? fresh : all, DAILY_COUNT, date);

  // Poore 10 hon tabhi mehfooz — warna owner ke naye sawal aaj hi shamil ho saken
  if (ids.length === DAILY_COUNT) {
    await db.prepare("INSERT OR IGNORE INTO daily_pins (date, mcq_ids_json, source) VALUES (?1, ?2, 'auto')").bind(date, JSON.stringify(ids)).run();
    const won = await readPin(); // do requests ek sath aayen to jo pehle likha wohi
    if (won) return { date, items: await rowsByIds(db, JSON.parse(won.mcq_ids_json) as number[]) };
  }
  return { date, items: await rowsByIds(db, ids) };
}

/** E05 */
export async function dailyTest(db: D1Database, now?: Date): Promise<ApiResult> {
  try {
    const d = await dailyQuestions(db, now);
    return ok(d, { 'Cache-Control': 'public, max-age=0, s-maxage=300' });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
