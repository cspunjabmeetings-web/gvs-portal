// spec: 7.5, F01-AC3 + F17-AC5 (homeHints), F13-AC8 (streak, Pakistan ki tareekh), F17-AC4 (storage band), F17-AC6 (200 KB chhantai), F04-AC10 (orders ≤ 20), bookmarks ≤ 500
import { describe, it, expect, beforeEach } from 'vitest';
import {
  emptyHistory,
  normalize,
  currentStreak,
  recordDaily,
  weakestSubject,
  toggleBookmark,
  addOrder,
  prune,
  loadHistory,
  saveHistory,
  updateHistory,
  _resetHistoryMemory,
  homeHints,
  clearHistory,
  HISTORY_KEY,
  LIMITS,
} from '../src/lib/history';
import { pkDate, addDays, isDateStr } from '../src/lib/pkdate';
import { rememberOrder } from '../src/lib/cart';
import { track, _queued } from '../src/lib/analytics';

const r = (score: number, wrongSubjects: string[] = []) => ({ score, total: 10, wrongIds: wrongSubjects.map((_, i) => i + 1), wrongSubjects });

function fakeStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

beforeEach(() => _resetHistoryMemory());

describe('pkdate (F13-AC1: din Pakistan 00:00 par)', () => {
  it('UTC 18:59 = Pakistan 23:59 (wohi din); UTC 19:00 = agla din', () => {
    expect(pkDate(new Date('2026-11-18T18:59:59Z'))).toBe('2026-11-18');
    expect(pkDate(new Date('2026-11-18T19:00:00Z'))).toBe('2026-11-19');
  });
  it('addDays mahina/saal paar; isDateStr', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(isDateStr('2026-02-30')).toBe(false);
    expect(isDateStr('2026-11-18')).toBe(true);
  });
});

describe('streak aur rozana nateeja (F13-AC8)', () => {
  it('pehla din 1; agla din +1; din chhoota → 1', () => {
    let h = recordDaily(emptyHistory(), '2026-11-16', r(8));
    expect(h.streak).toEqual({ count: 1, lastDate: '2026-11-16' });
    h = recordDaily(h, '2026-11-17', r(6));
    expect(h.streak).toEqual({ count: 2, lastDate: '2026-11-17' });
    h = recordDaily(h, '2026-11-19', r(9));
    expect(h.streak).toEqual({ count: 1, lastDate: '2026-11-19' });
    expect(h.daily['2026-11-17']).toEqual({ score: 6, total: 10, wrongIds: [] });
  });

  it('aaj dobara → kuch nahin badalta (owner ka faisla)', () => {
    const h = recordDaily(emptyHistory(), '2026-11-18', r(4, ['English']));
    const again = recordDaily(h, '2026-11-18', r(10));
    expect(again).toBe(h);
    expect(again.daily['2026-11-18'].score).toBe(4);
  });

  it('currentStreak: aaj ya kal tak ka test ho to chalti, warna 0', () => {
    const h = recordDaily(recordDaily(emptyHistory(), '2026-11-16', r(5)), '2026-11-17', r(5));
    expect(currentStreak(h, '2026-11-17')).toBe(2);
    expect(currentStreak(h, '2026-11-18')).toBe(2); // aaj baqi, kal kiya
    expect(currentStreak(h, '2026-11-19')).toBe(0);
    expect(currentStreak(emptyHistory(), '2026-11-19')).toBe(0);
  });

  it('kamzor mazmoon = sab se zyada ghalat', () => {
    let h = recordDaily(emptyHistory(), '2026-11-16', r(7, ['English', 'Urdu', 'English']));
    h = recordDaily(h, '2026-11-17', r(8, ['Urdu']));
    expect(h.weakSubjects).toEqual({ English: 2, Urdu: 2 });
    h = recordDaily(h, '2026-11-18', r(9, ['Urdu']));
    expect(weakestSubject(h)).toBe('Urdu');
    expect(weakestSubject(emptyHistory())).toBeNull();
  });
});

describe('bookmarks aur orders', () => {
  it('bookmark on/off, naya upar, ≤ 500', () => {
    let h = toggleBookmark(emptyHistory(), 5);
    h = toggleBookmark(h, 7);
    expect(h.bookmarks).toEqual([7, 5]);
    expect(toggleBookmark(h, 5).bookmarks).toEqual([7]);
    let big = emptyHistory();
    for (let i = 1; i <= 505; i++) big = toggleBookmark(big, i);
    expect(big.bookmarks).toHaveLength(LIMITS.bookmarks);
    expect(big.bookmarks[0]).toBe(505);
  });

  it('orders: naya upar, dohra nahin, ≤ 20; cart.rememberOrder isi schema mein', () => {
    let h = emptyHistory();
    for (let i = 0; i < 25; i++) h = addOrder(h, { id: `GVS-2611-${String(i).padStart(4, '0')}`, last4: '1234', at: 'x' });
    expect(h.orders).toHaveLength(20);
    expect(h.orders[0].id).toBe('GVS-2611-0024');
    h = addOrder(h, { id: 'GVS-2611-0010', last4: '1234', at: 'y' });
    expect(h.orders.filter((o) => o.id === 'GVS-2611-0010')).toHaveLength(1);
    expect(h.orders[0].id).toBe('GVS-2611-0010');
  });
});

describe('normalize (kharab/purana data)', () => {
  it('ghalat version ya kharab cheezein chhor deta hai', () => {
    expect(normalize({ v: 2, streak: { count: 5, lastDate: 'x' } })).toEqual(emptyHistory());
    expect(normalize('ajeeb')).toEqual(emptyHistory());
    const h = normalize({ v: 1, streak: { count: 3.7, lastDate: '2026-11-18' }, daily: { a: { score: 1, total: 10 }, b: 'x' }, bookmarks: [1, 1, 'x', 2], orders: [{ id: 'GVS-1', last4: '1', at: 'z' }, { id: 5 }] });
    expect(h.streak).toEqual({ count: 3, lastDate: '2026-11-18' });
    expect(Object.keys(h.daily)).toEqual(['a']);
    expect(h.bookmarks).toEqual([1, 2]);
    expect(h.orders).toHaveLength(1);
  });

  it('Qadam 5 ka purana orders wala data (sirf { v, orders }) parha jata hai', () => {
    const s = fakeStore();
    s.setItem(HISTORY_KEY, JSON.stringify({ v: 1, orders: [{ id: 'GVS-2611-0002', last4: '4567', at: '2026-11-17T10:00:00Z' }] }));
    expect(loadHistory(s).orders[0].id).toBe('GVS-2611-0002');
  });
});

describe('200 KB ki hadd (F17-AC6)', () => {
  it('purane rozana nateeje pehle chhante jate hain; aakhri 7 din bachte hain', () => {
    let h = emptyHistory();
    const big = Array.from({ length: 300 }, (_, i) => i);
    for (let i = 0; i < 400; i++) h.daily[addDays('2025-01-01', i)] = { score: 1, total: 10, wrongIds: big };
    const p = prune(h);
    expect(new TextEncoder().encode(JSON.stringify(p)).length).toBeLessThanOrEqual(LIMITS.bytes);
    const days = Object.keys(p.daily).sort();
    expect(days.at(-1)).toBe(addDays('2025-01-01', 399));
    expect(days.length).toBeGreaterThanOrEqual(7);
    expect(days.length).toBeLessThan(400);
  });
  it('chhota data waisa hi', () => {
    const h = recordDaily(emptyHistory(), '2026-11-18', r(5));
    expect(prune(h)).toBe(h);
  });
});

describe('Home: yaad dihani aur "Aap ke liye" (F01-AC3, F17-AC5)', () => {
  it('khali history → kuch nahin', () => {
    expect(homeHints(emptyHistory(), '2026-11-19')).toEqual({ remindStreak: null, weak: null });
  });
  it('kal test diya, aaj nahin → yaad dihani; aaj de diya → nahin; parson ka → streak toot gayi, yaad dihani nahin', () => {
    const h = recordDaily(recordDaily(emptyHistory(), '2026-11-17', r(5)), '2026-11-18', r(6));
    expect(homeHints(h, '2026-11-19').remindStreak).toBe(2);
    expect(homeHints(recordDaily(h, '2026-11-19', r(7)), '2026-11-19').remindStreak).toBeNull();
    expect(homeHints(h, '2026-11-20').remindStreak).toBeNull();
  });
  it('kamzor mazmoon ka card: naam, ghalat ginti, /mcqs slug (practice.ts wala)', () => {
    const h = recordDaily(emptyHistory(), '2026-11-19', r(6, ['Pakistan Studies', 'Pakistan Studies', 'English']));
    expect(homeHints(h, '2026-11-19').weak).toEqual({ subject: 'Pakistan Studies', slug: 'pakistan-studies', wrong: 2 });
  });
});

describe('Sab history mitayen (F17-AC1)', () => {
  it('sirf gvs.v1 khali hota hai; cart ki key nahin chhuti', () => {
    const s = fakeStore();
    s.setItem('gvs.cart.v1', '{"v":1,"items":[1]}');
    saveHistory(addOrder(recordDaily(emptyHistory(), '2026-11-19', r(7)), { id: 'GVS-2611-0001', last4: '1234', at: 'x' }), s);
    clearHistory(s);
    expect(loadHistory(s)).toEqual(emptyHistory());
    expect(s.getItem('gvs.cart.v1')).toBe('{"v":1,"items":[1]}');
  });
});

describe('storage (F17-AC2, AC4)', () => {
  it('save → load; update', () => {
    const s = fakeStore();
    saveHistory(recordDaily(emptyHistory(), '2026-11-18', r(7)), s);
    expect(loadHistory(s).daily['2026-11-18'].score).toBe(7);
    updateHistory((h) => toggleBookmark(h, 9), s);
    expect(JSON.parse(s.m.get(HISTORY_KEY)!).bookmarks).toEqual([9]);
  });

  it('localStorage band (null) → memory mein, kuch nahin toot-ta', () => {
    const saved = saveHistory(recordDaily(emptyHistory(), '2026-11-18', r(3)), null);
    expect(loadHistory(null)).toEqual(saved);
  });

  it('setItem phenke (bhara/band) → bhi chalta hai', () => {
    const s = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
    expect(() => saveHistory(emptyHistory(), s)).not.toThrow();
  });

  it('Node mein localStorage nahin: rememberOrder (cart) phir bhi nahin toot-ta', () => {
    expect(() => rememberOrder({ id: 'GVS-2611-0001', last4: '1234', at: 'x' })).not.toThrow();
    expect(loadHistory().orders[0].id).toBe('GVS-2611-0001');
  });
});

describe('analytics.ts (F23-AC1/AC2 ka dhancha)', () => {
  it('PII wali keys aur lambe matn nahin jate', () => {
    track('daily_test_complete', { score: 8, questions: 10, name: 'Ali', phone: '0300', order_id: 'GVS-1', note: 'x'.repeat(200) });
    expect(_queued().at(-1)).toEqual({ name: 'daily_test_complete', params: { score: 8, questions: 10 } });
  });
});
