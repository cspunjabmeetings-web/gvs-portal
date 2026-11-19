// spec: F15-AC6 (result: review, mazmoon-war, kamzor, share), F15-AC3 (palette ki halat), F15-AC4 (timer, aakhri 5 minute), F15-AC5 (tasdeeq ka paigham), F15-AC7 + 7.5 (mockProgress), owner ke faislay 1a + 2
import { describe, it, expect, beforeEach } from 'vitest';
import { answer, answeredCount, cellOf, formatClock, goTo, isWarn, newProgress, readProgress, reviewItems, scoreMock, shareText, submitMessage, toggleFlag, unansweredCount, weakestOf, wrongSubjects, WARN_MS } from '../src/lib/mock-engine';
import { emptyHistory, homeHints, loadHistory, normalize, recordMock, saveHistory, setMockProgress, updateHistory, _resetHistoryMemory } from '../src/lib/history';

const qs = [
  { id: 11, subject: 'English', answerIndex: 0 },
  { id: 12, subject: 'English', answerIndex: 1 },
  { id: 13, subject: 'Urdu', answerIndex: 2 },
  { id: 14, subject: 'Urdu', answerIndex: 0 },
];
const NOW = new Date('2026-11-19T05:00:00Z');

beforeEach(() => _resetHistoryMemory());

describe('palette (F15-AC3)', () => {
  it('baqi → hal shuda; "baad mein" amber jawab ke sath bhi; dobara dabane par hat jata', () => {
    let p = newProgress('m', 20, NOW);
    expect(cellOf(p, 11)).toBe('empty');
    p = answer(p, 11, 2);
    expect(cellOf(p, 11)).toBe('answered');
    p = toggleFlag(p, 11);
    expect(cellOf(p, 11)).toBe('flagged');
    p = toggleFlag(toggleFlag(p, 12), 11);
    expect([cellOf(p, 11), cellOf(p, 12)]).toEqual(['answered', 'flagged']);
  });
  it('jawab badal sakte hain; ginti; jump hadd ke andar', () => {
    let p = answer(answer(newProgress('m', 20), 11, 2), 11, 0);
    expect(p.answers[11]).toBe(0);
    p = answer(p, 13, 2);
    expect([answeredCount(p, qs), unansweredCount(p, qs)]).toEqual([2, 2]);
    expect(goTo(p, 99, qs.length).idx).toBe(3);
    expect(goTo(p, -1, qs.length).idx).toBe(0);
  });
});

describe('tasdeeq (F15-AC5) aur timer (F15-AC4)', () => {
  it('"3 sawal baqi hain. Phir bhi jama karein?"', () => {
    expect(submitMessage(3)).toBe('3 sawal baqi hain. Phir bhi jama karein?');
    expect(submitMessage(1)).toBe('1 sawal baqi hai. Phir bhi jama karein?');
    expect(submitMessage(0)).toMatch(/Saare sawal hal ho gaye/);
  });
  it('ghari: 30:00, 0:07, 1:05:09; aakhri 5 minute', () => {
    expect(formatClock(30 * 60_000)).toBe('30:00');
    expect(formatClock(6_200)).toBe('0:07');
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock((3600 + 5 * 60 + 9) * 1000)).toBe('1:05:09');
    expect([isWarn(WARN_MS + 1), isWarn(WARN_MS), isWarn(1000)]).toEqual([false, true, true]);
  });
});

describe('score (11b ke result ki buniyad)', () => {
  it('score, feesad, mazmoon-war [sahih, kul]', () => {
    const p = answer(answer(answer(newProgress('m', 20), 11, 0), 12, 0), 13, 2);
    expect(scoreMock(p, qs)).toEqual({ score: 2, total: 4, percent: 50, bySubject: { English: [1, 2], Urdu: [1, 2] } });
  });
});

describe('mehfooz progress (F15-AC7, 7.5)', () => {
  it('save → reload → wahin se (jawab, nishan, sawal, baqi waqt)', () => {
    const p = { ...goTo(toggleFlag(answer(newProgress('ppsc-1', 20, NOW), 12, 1), 13), 2, 4), remainingMs: 600_000 };
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    const m = new Map<string, string>();
    saveHistory(setMockProgress(emptyHistory(), p as unknown as Record<string, unknown>), s);
    const back = readProgress(loadHistory(s).mockProgress, 'ppsc-1', qs, 20);
    expect(back).toEqual(p);
  });
  it('doosre mock ka, kharab, waqt khatam → null; had se zyada waqt kaat diya; anjaan sawal ke jawab chhoot jate', () => {
    const base = { slug: 'm', answers: { 11: 1, 999: 2, 12: 7 }, flagged: [13, 888], remainingMs: 99 * 60_000, savedAt: 'x', idx: 50 };
    expect(readProgress(base, 'doosra', qs, 20)).toBeNull();
    expect(readProgress(null, 'm', qs, 20)).toBeNull();
    expect(readProgress({ ...base, remainingMs: 0 }, 'm', qs, 20)).toBeNull();
    expect(readProgress({ ...base, remainingMs: 'x' }, 'm', qs, 20)).toBeNull();
    expect(readProgress(base, 'm', qs, 20)).toEqual({ slug: 'm', answers: { 11: 1 }, flagged: [13], remainingMs: 20 * 60_000, savedAt: 'x', idx: 3 });
  });
  it('ek waqt mein ek adhoora mock (owner ka faisla 2): naya purane ko badal deta; null = mita', () => {
    const s = new Map<string, string>();
    const st = { getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => void s.set(k, v) };
    updateHistory((h) => setMockProgress(h, newProgress('pehla', 10) as unknown as Record<string, unknown>), st);
    updateHistory((h) => setMockProgress(h, newProgress('doosra', 10) as unknown as Record<string, unknown>), st);
    expect((loadHistory(st).mockProgress as { slug: string }).slug).toBe('doosra');
    updateHistory((h) => setMockProgress(h, null), st);
    expect(loadHistory(st).mockProgress).toBeNull();
  });
});

describe('result (F15-AC6, Qadam 11b)', () => {
  const rq = qs.map((q) => ({ ...q, question: `Q${q.id}?`, options: ['a', 'b', 'c'], explanation: `T${q.id}` }));
  const done = answer(answer(answer(newProgress('m', 20), 11, 0), 12, 0), 13, 2); // 11 sahih, 12 ghalat, 13 sahih, 14 chhora

  it('har sawal: sahih / ghalat / chhora, aap ka jawab', () => {
    expect(reviewItems(done, rq).map((r) => [r.n, r.status, r.picked])).toEqual([
      [1, 'right', 0],
      [2, 'wrong', 0],
      [3, 'right', 2],
      [4, 'skipped', null],
    ]);
  });
  it('ghalat jawabon ke mazameen (chhore hue nahin)', () => {
    expect(wrongSubjects(done, qs)).toEqual(['English']);
  });
  it('sab se kamzor mazmoon: sab se kam feesad; sab sahih → null', () => {
    expect(weakestOf({ English: [1, 2], Urdu: [1, 4], Maths: [3, 3] })).toBe('Urdu');
    expect(weakestOf({ English: [2, 2] })).toBeNull();
  });
  it('share ka matn: mock, score, link — koi naam/phone nahin', () => {
    const t = shareText('PPSC Mock 1', { score: 18, total: 25, percent: 72 }, 'https://gvs.test/mock-tests/ppsc-mock-1');
    expect(t).toBe('Main ne GVS Academy ka muft mock test "PPSC Mock 1" diya: 18/25 (72%). Aap bhi dein: https://gvs.test/mock-tests/ppsc-mock-1');
    expect(t).not.toMatch(/03\d{9}|\+92/);
  });
});

describe('history mein mock (7.5, owner ke faislay 1a + 2a)', () => {
  it('recordMock: naam ke sath sab se naya nateeja, adhoora mita, ghalat mazameen weakSubjects + Home "Aap ke liye"', () => {
    let h = setMockProgress(emptyHistory(), newProgress('m', 20) as unknown as Record<string, unknown>);
    h = recordMock(h, 'ppsc-1', { score: 1, total: 4, bySubject: { English: [0, 2], Urdu: [1, 2] }, at: '2026-11-19T05:00:00Z', name: 'PPSC 1' }, ['English', 'English']);
    h = recordMock(h, 'ppsc-1', { score: 3, total: 4, bySubject: { English: [1, 2], Urdu: [2, 2] }, at: '2026-11-19T06:00:00Z', name: 'PPSC 1' }, ['English']);
    expect(h.mocks['ppsc-1']).toMatchObject({ score: 3, name: 'PPSC 1' });
    expect(h.mockProgress).toBeNull();
    expect(h.weakSubjects).toEqual({ English: 3 });
    expect(homeHints(h, '2026-11-19').weak).toEqual({ subject: 'English', slug: 'english', wrong: 3 });
  });
  it('normalize: naam string ho to rehta; kharab entry (at nahin) chhoot jati; ghalat naam hat jata', () => {
    const h = normalize({ v: 1, mocks: { a: { score: 1, total: 2, at: 'x', bySubject: {}, name: 'A' }, b: { score: 1, total: 2 }, c: { score: 1, total: 2, at: 'y', name: 5 } } });
    expect(Object.keys(h.mocks)).toEqual(['a', 'c']);
    expect(h.mocks.a.name).toBe('A');
    expect(h.mocks.c.name).toBeUndefined();
  });
});
