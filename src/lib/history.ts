// spec: 7.5 (history schema: key gvs.v1, v:1), F13-AC8 (streak + score, Pakistan ki tareekh), F17-AC2 (sirf browser),
//       F17-AC4 (localStorage band ho to bhi chale), F17-AC6 (versioned, 200 KB se zyada par purani entries chhant),
//       F04-AC10 ("Mere orders", ≤ 20), bookmarks ≤ 500
// Pure functions + chhota storage layer. Server par kuch nahin jata.
import { addDays } from './pkdate';
import { slugify } from './slug';

export const HISTORY_KEY = 'gvs.v1';
export const HISTORY_EVENT = 'gvs:history';
export const LIMITS = { bytes: 200 * 1024, orders: 20, bookmarks: 500 } as const;

export interface DailyEntry {
  score: number;
  total: number;
  wrongIds: number[];
}
export interface MockEntry {
  score: number;
  total: number;
  bySubject: Record<string, [number, number]>;
  at: string;
  /** Qadam 11b (owner ka faisla 2a): /my-history par naam; purane entries mein na ho to slug */
  name?: string;
}
export interface SavedOrder {
  id: string;
  last4: string;
  at: string;
}
/** F31-AC1: ek VU course + term (key "CS101:mid") */
export interface VuEntry {
  right: number[];
  wrong: number[];
  tests: Record<string, { score: number; total: number }>;
  /** Us waqt ke kul jaanche sawal (/my-history ke liye) */
  total: number;
  at: string;
}
export interface History {
  v: 1;
  streak: { count: number; lastDate: string } | null;
  daily: Record<string, DailyEntry>;
  mocks: Record<string, MockEntry>;
  mockProgress: Record<string, unknown> | null;
  bookmarks: number[];
  weakSubjects: Record<string, number>;
  orders: SavedOrder[];
  vu: Record<string, VuEntry>;
}

export const emptyHistory = (): History => ({ v: 1, streak: null, daily: {}, mocks: {}, mockProgress: null, bookmarks: [], weakSubjects: {}, orders: [], vu: {} });

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Kharab/purana data → saaf History (jo samajh aaye rakho, baqi chhor do) */
export function normalize(raw: unknown): History {
  const h = emptyHistory();
  if (!isObj(raw) || raw.v !== 1) return h;
  const s = raw.streak;
  if (isObj(s) && isNum(s.count) && typeof s.lastDate === 'string') h.streak = { count: Math.max(0, Math.floor(s.count)), lastDate: s.lastDate };
  if (isObj(raw.daily))
    for (const [d, e] of Object.entries(raw.daily))
      if (isObj(e) && isNum(e.score) && isNum(e.total)) h.daily[d] = { score: e.score, total: e.total, wrongIds: Array.isArray(e.wrongIds) ? e.wrongIds.filter(isNum) : [] };
  if (isObj(raw.mocks))
    for (const [k, e] of Object.entries(raw.mocks))
      if (isObj(e) && isNum(e.score) && isNum(e.total) && typeof e.at === 'string')
        h.mocks[k] = { score: e.score, total: e.total, at: e.at, bySubject: isObj(e.bySubject) ? (e.bySubject as MockEntry['bySubject']) : {}, ...(typeof e.name === 'string' ? { name: e.name } : {}) };
  if (isObj(raw.mockProgress)) h.mockProgress = raw.mockProgress;
  if (Array.isArray(raw.bookmarks)) h.bookmarks = [...new Set(raw.bookmarks.filter(isNum))].slice(0, LIMITS.bookmarks);
  if (isObj(raw.weakSubjects)) for (const [k, n] of Object.entries(raw.weakSubjects)) if (isNum(n)) h.weakSubjects[k] = n;
  if (Array.isArray(raw.orders))
    h.orders = raw.orders.filter((o): o is SavedOrder => isObj(o) && typeof o.id === 'string' && typeof o.last4 === 'string' && typeof o.at === 'string').slice(0, LIMITS.orders);
  if (isObj(raw.vu))
    for (const [k, e] of Object.entries(raw.vu)) {
      if (!/^[A-Z]{2,4}\d{3}[A-Z]?:(mid|final)$/.test(k) || !isObj(e) || !Array.isArray(e.right) || !Array.isArray(e.wrong) || typeof e.at !== 'string') continue;
      const tests: VuEntry['tests'] = {};
      if (isObj(e.tests)) for (const [n, t] of Object.entries(e.tests)) if (isObj(t) && isNum(t.score) && isNum(t.total)) tests[n] = { score: t.score, total: t.total };
      h.vu[k] = { right: e.right.filter(isNum), wrong: e.wrong.filter(isNum), tests, total: isNum(e.total) ? e.total : 0, at: e.at };
    }
  return h;
}

// ---------- Streak aur rozana test (F13-AC8) ----------

/** Aaj ki tareekh par chalti streak: aaj ya kal tak ka test ho to count, warna 0 */
export function currentStreak(h: History, today: string): number {
  if (!h.streak) return 0;
  return h.streak.lastDate === today || h.streak.lastDate === addDays(today, -1) ? h.streak.count : 0;
}

export const doneToday = (h: History, today: string) => !!h.daily[today];

/**
 * Aaj ka pehla nateeja mehfooz (dobara khelna practice hai — owner ka faisla, score/streak nahin badalte).
 * wrongSubjects = har ghalat sawal ka mazmoon (kamzor mazmoon ke liye).
 */
export function recordDaily(h: History, today: string, r: { score: number; total: number; wrongIds: number[]; wrongSubjects: string[] }): History {
  if (h.daily[today]) return h;
  const next = structuredClone(h);
  next.daily[today] = { score: r.score, total: r.total, wrongIds: r.wrongIds };
  const prev = h.streak;
  next.streak = prev && prev.lastDate === addDays(today, -1) ? { count: prev.count + 1, lastDate: today } : prev && prev.lastDate === today ? prev : { count: 1, lastDate: today };
  for (const s of r.wrongSubjects) next.weakSubjects[s] = (next.weakSubjects[s] ?? 0) + 1;
  return next;
}

/** Sab se zyada ghalat jawab wala mazmoon (barabar ho to pehla) */
export function weakestSubject(h: History): string | null {
  let best: string | null = null;
  let n = 0;
  for (const [s, c] of Object.entries(h.weakSubjects)) if (c > n) (best = s), (n = c);
  return best;
}

/**
 * Home ke liye (F01-AC3, F17-AC5): streak chal rahi ho aur aaj ka test baqi → yaad dihani;
 * kamzor mazmoon ho → us ki practice ka link (/mcqs/<slug>, practice.ts wala slug).
 */
export function homeHints(h: History, today: string): { remindStreak: number | null; weak: { subject: string; slug: string; wrong: number } | null } {
  const streak = currentStreak(h, today);
  const subject = weakestSubject(h);
  return {
    remindStreak: streak >= 1 && !doneToday(h, today) ? streak : null,
    weak: subject ? { subject, slug: slugify(subject, 'mazmoon'), wrong: h.weakSubjects[subject] } : null,
  };
}

// ---------- Adhoora mock (F15-AC7; 7.5: ek waqt mein ek — owner ka faisla) ----------

/** Adhoora mock rakho (null = mitao). Doosre mock ka purana progress badal jata hai. */
export function setMockProgress(h: History, p: Record<string, unknown> | null): History {
  return { ...h, mockProgress: p };
}

/**
 * F15-AC6 / 7.5: mock ka sab se naya nateeja mocks[slug] mein; ghalat jawabon ke mazameen weakSubjects mein (owner ka faisla 1a).
 * Adhoora progress bhi mit jata hai.
 */
export function recordMock(h: History, slug: string, entry: MockEntry, wrongSubjects: string[]): History {
  const next = structuredClone(h);
  next.mocks[slug] = entry;
  next.mockProgress = null;
  for (const s of wrongSubjects) next.weakSubjects[s] = (next.weakSubjects[s] ?? 0) + 1;
  return next;
}

// ---------- Bookmarks, orders ----------

export function toggleBookmark(h: History, id: number): History {
  const next = structuredClone(h);
  next.bookmarks = h.bookmarks.includes(id) ? h.bookmarks.filter((x) => x !== id) : [id, ...h.bookmarks].slice(0, LIMITS.bookmarks);
  return next;
}

/** Naya order sab se upar, ≤ 20 (F04-AC10) */
export function addOrder(h: History, o: SavedOrder): History {
  const next = structuredClone(h);
  next.orders = [o, ...h.orders.filter((x) => x.id !== o.id)].slice(0, LIMITS.orders);
  return next;
}

// ---------- 200 KB ki hadd (F17-AC6) ----------

const size = (h: History) => new TextEncoder().encode(JSON.stringify(h)).length;

/** Had se zyada ho to sab se purane rozana nateeje, phir purane mock nateeje, phir purane bookmarks chhanto */
export function prune(h: History, maxBytes: number = LIMITS.bytes): History {
  if (size(h) <= maxBytes) return h;
  const next = structuredClone(h);
  const days = Object.keys(next.daily).sort();
  const mocks = Object.entries(next.mocks).sort((a, b) => a[1].at.localeCompare(b[1].at)).map(([k]) => k);
  const vu = Object.entries(next.vu).sort((a, b) => a[1].at.localeCompare(b[1].at)).map(([k]) => k);
  while (size(next) > maxBytes) {
    if (days.length > 7) delete next.daily[days.shift()!];
    else if (mocks.length) delete next.mocks[mocks.shift()!];
    else if (vu.length > 1) delete next.vu[vu.shift()!];
    else if (next.bookmarks.length > 50) next.bookmarks = next.bookmarks.slice(0, Math.floor(next.bookmarks.length / 2));
    else if (days.length) delete next.daily[days.shift()!];
    else break;
  }
  return next;
}

// ---------- Storage (F17-AC4: band ho to memory) ----------

type Store = Pick<Storage, 'getItem' | 'setItem'>;
let memory: History | null = null;

function store(): Store | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const k = '__gvs_probe';
    ls.setItem(k, '1');
    ls.removeItem(k);
    return ls;
  } catch {
    return null;
  }
}

export function loadHistory(ls: Store | null = store()): History {
  if (!ls) return memory ?? emptyHistory();
  try {
    return normalize(JSON.parse(ls.getItem(HISTORY_KEY) ?? 'null'));
  } catch {
    return memory ?? emptyHistory();
  }
}

export function saveHistory(h: History, ls: Store | null = store()): History {
  const p = prune(h);
  memory = p;
  try {
    ls?.setItem(HISTORY_KEY, JSON.stringify(p));
  } catch {
    /* bhara hua / band: memory mein rehta hai */
  }
  try {
    globalThis.dispatchEvent?.(new CustomEvent(HISTORY_EVENT));
  } catch {
    /* Node mein CustomEvent na ho */
  }
  return p;
}

/** F17-AC4: localStorage chal raha hai? (band ho to history sirf is page ke khulne tak) */
export const historyStorageOk = () => store() !== null;

/** "Sab history mitayen" (sirf is browser se; cart alag key hai, nahin chhuti) */
export const clearHistory = (ls: Store | null = store()) => saveHistory(emptyHistory(), ls);

/** load → badlo → save */
export function updateHistory(fn: (h: History) => History, ls: Store | null = store()): History {
  return saveHistory(fn(loadHistory(ls)), ls);
}

/** Test ke liye */
export function _resetHistoryMemory() {
  memory = null;
}
