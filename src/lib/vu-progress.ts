// spec: F31-AC1 (progress is phone mein), F31-AC2 (tayyari), F31-AC3 (score par pack), F31-AC5 (share)
// Pure; browser mein chalta hai. Server ko kuch nahin jata.
import type { History, VuEntry } from './history';

/** WhatsApp channel ka link (owner baad mein de ga). Khali = button chhupa */
export const CHANNEL_URL: string = '';

export const vuKey = (code: string, term: 'mid' | 'final') => `${code}:${term}`;
export const emptyVu = (): VuEntry => ({ right: [], wrong: [], tests: {}, total: 0, at: '' });

/**
 * Ek test ka nateeja jorna. Dobara dene par naya jawab purane ki jagah; chhora hua sawal purani halat mein rehta hai.
 * `validIds` = us course + term ke aaj ke jaanche sawal: mitaye/chhupe sawal ginti se nikal jate hain.
 */
export function recordVu(
  h: History,
  key: string,
  o: { n: number; items: readonly { id: number; answerIndex: number }[]; answers: Record<string, number>; validIds: readonly number[]; at: string },
): History {
  const next = structuredClone(h);
  const old = next.vu[key] ?? emptyVu();
  const right = new Set(old.right);
  const wrong = new Set(old.wrong);
  let score = 0;
  for (const q of o.items) {
    const a = o.answers[q.id];
    if (a === undefined) continue;
    const ok = a === q.answerIndex;
    if (ok) score++;
    (ok ? right : wrong).add(q.id);
    (ok ? wrong : right).delete(q.id);
  }
  const valid = new Set(o.validIds);
  next.vu[key] = {
    right: [...right].filter((id) => valid.has(id)),
    wrong: [...wrong].filter((id) => valid.has(id)),
    tests: { ...old.tests, [o.n]: { score, total: o.items.length } },
    total: o.validIds.length,
    at: o.at,
  };
  return next;
}

export interface VuReady {
  right: number;
  wrong: number;
  total: number;
  percent: number;
  testsDone: number;
  testsLeft: number;
}

/** Tayyari = sahih kiye hue sawal / kul jaanche sawal */
export function readiness(e: VuEntry | undefined, validIds: readonly number[], tests: number): VuReady {
  const valid = new Set(validIds);
  const right = (e?.right ?? []).filter((id) => valid.has(id)).length;
  const wrong = (e?.wrong ?? []).filter((id) => valid.has(id)).length;
  const testsDone = Object.keys(e?.tests ?? {}).filter((n) => Number(n) >= 1 && Number(n) <= tests).length;
  return { right, wrong, total: valid.size, percent: valid.size ? Math.round((right / valid.size) * 100) : 0, testsDone, testsLeft: tests - testsDone };
}

/** Owner ka faisla: 50 se kam Complete, 50–79 Smart, 80+ Quick */
export function packFor(percent: number): string {
  return percent < 50 ? 'vu-complete' : percent < 80 ? 'vu-smart' : 'vu-quick';
}

/** Pehla test jo abhi nahin diya (na ho to null) */
export function nextTest(e: VuEntry | undefined, tests: number): number | null {
  for (let n = 1; n <= tests; n++) if (!e?.tests[n]) return n;
  return null;
}

export const vuShareText = (name: string, s: { score: number; total: number; percent: number }, url: string) =>
  `Main ne GVS Academy par "${name}" mein ${s.score}/${s.total} (${s.percent}%) liye. Aap bhi muft test dein: ${url}`;
