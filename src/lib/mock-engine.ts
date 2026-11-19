// spec: F15-AC3 (palette: hal shuda / baqi / "baad mein dekhein"), F15-AC4 (ulti ginti, aakhri 5 minute, waqt khatam), F15-AC5 (baqi sawal ki ginti),
//       F15-AC7 + 7.5 (mockProgress: slug, answers, flagged, remainingMs, savedAt; owner ka faisla 1a: page band ho to timer rukta hai)
// Pure functions — browser aur tests dono. Koi network nahin (F15-AC8).

export const WARN_MS = 5 * 60 * 1000;

export interface MockQ {
  id: number;
  subject: string;
  answerIndex: number;
}

/** 7.5 ki shakal (+ `idx`: kis sawal par the) */
export interface MockProgress {
  slug: string;
  answers: Record<string, number>;
  flagged: number[];
  remainingMs: number;
  savedAt: string;
  idx: number;
}

export type Cell = 'answered' | 'flagged' | 'empty';

export const newProgress = (slug: string, minutes: number, now = new Date()): MockProgress => ({ slug, answers: {}, flagged: [], remainingMs: minutes * 60_000, savedAt: now.toISOString(), idx: 0 });

/** Palette ka khana: "baad mein" sab se pehle (jawab ho tab bhi — dobara dekhna hai), phir hal shuda, warna baqi */
export function cellOf(p: MockProgress, id: number): Cell {
  if (p.flagged.includes(id)) return 'flagged';
  return p.answers[id] !== undefined ? 'answered' : 'empty';
}

export const answeredCount = (p: MockProgress, qs: readonly MockQ[]) => qs.filter((q) => p.answers[q.id] !== undefined).length;
export const unansweredCount = (p: MockProgress, qs: readonly MockQ[]) => qs.length - answeredCount(p, qs);

export function answer(p: MockProgress, id: number, option: number): MockProgress {
  return { ...p, answers: { ...p.answers, [id]: option } };
}
export function toggleFlag(p: MockProgress, id: number): MockProgress {
  return { ...p, flagged: p.flagged.includes(id) ? p.flagged.filter((x) => x !== id) : [...p.flagged, id] };
}
export function goTo(p: MockProgress, idx: number, total: number): MockProgress {
  return { ...p, idx: Math.max(0, Math.min(total - 1, idx)) };
}

/** F15-AC5 ka paigham */
export function submitMessage(unanswered: number): string {
  if (unanswered === 0) return 'Saare sawal hal ho gaye. Test jama karein? Is ke baad jawab nahin badal sakein ge.';
  return `${unanswered} ${unanswered === 1 ? 'sawal baqi hai' : 'sawal baqi hain'}. Phir bhi jama karein?`;
}

/** Timer ka matn: 1:05:09 / 29:59 / 0:07 */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
export const isWarn = (ms: number) => ms <= WARN_MS;

export interface MockScore {
  score: number;
  total: number;
  percent: number;
  bySubject: Record<string, [number, number]>;
}

/** Score + mazmoon-war [sahih, kul] (7.5 `mocks[slug].bySubject`) */
export function scoreMock(p: MockProgress, qs: readonly MockQ[]): MockScore {
  const bySubject: Record<string, [number, number]> = {};
  let score = 0;
  for (const q of qs) {
    const ok = p.answers[q.id] === q.answerIndex;
    if (ok) score++;
    const s = (bySubject[q.subject] ??= [0, 0]);
    s[0] += ok ? 1 : 0;
    s[1] += 1;
  }
  return { score, total: qs.length, percent: qs.length ? Math.round((score / qs.length) * 100) : 0, bySubject };
}

/**
 * Mehfooz progress parho (F15-AC7). Ghalat slug, kharab shakal, waqt khatam ya had se zyada → null.
 * Sirf is mock ke sawalon ke jawab rakhe jate hain (owner ne sawal hata diya ho to woh jawab chhoot jata hai).
 */
export function readProgress(raw: unknown, slug: string, qs: readonly MockQ[], minutes: number): MockProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.slug !== slug) return null;
  const max = minutes * 60_000;
  const rem = r.remainingMs;
  if (typeof rem !== 'number' || !Number.isFinite(rem) || rem <= 0) return null;
  const valid = new Map(qs.map((q) => [String(q.id), q]));
  const answers: Record<string, number> = {};
  if (r.answers && typeof r.answers === 'object')
    for (const [k, v] of Object.entries(r.answers as Record<string, unknown>)) if (valid.has(k) && typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4) answers[k] = v;
  const flagged = Array.isArray(r.flagged) ? [...new Set(r.flagged.filter((x): x is number => typeof x === 'number' && valid.has(String(x))))] : [];
  const idx = typeof r.idx === 'number' && Number.isInteger(r.idx) ? Math.max(0, Math.min(qs.length - 1, r.idx)) : 0;
  return { slug, answers, flagged, remainingMs: Math.min(rem, max), savedAt: typeof r.savedAt === 'string' ? r.savedAt : '', idx };
}
