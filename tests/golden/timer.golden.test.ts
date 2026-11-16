// spec: F06, SA4, 10.1 timer (intent 7.3 ki teeno misalein). GOLDEN: kamzor karna mana (spec 13.9).
// Qadam 6 mein src/lib/timer.ts bante hi yeh test khud chalu ho jata hai.
// Contract (spec 8.5 SA4): addWorkingMinutes(paidAt, minutes, workStart, workEnd, 'Asia/Karachi') => Date
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const TIMER = join(process.cwd(), 'src', 'lib', 'timer.ts');

// Pakistan = UTC+5 (DST nahin). PKT waqt ko UTC Date mein badalna:
const pkt = (iso: string) => new Date(`${iso}+05:00`);

describe.skipIf(!existsSync(TIMER))('timer.golden (intent 7.3)', () => {
  const cases: Array<[string, string, string]> = [
    ['3:00 PM par Paid -> wada 5:00 PM', '2026-11-16T15:00:00', '2026-11-16T17:00:00'],
    ['9:30 PM par Paid -> wada kal 10:30 AM', '2026-11-16T21:30:00', '2026-11-17T10:30:00'],
    ['11:00 PM par Paid -> wada kal 11:00 AM', '2026-11-16T23:00:00', '2026-11-17T11:00:00'],
  ];

  for (const [name, paid, due] of cases) {
    it(name, async () => {
      const { addWorkingMinutes } = await import(/* @vite-ignore */ TIMER);
      const result: Date = addWorkingMinutes(pkt(paid), 120, '09:00', '22:00', 'Asia/Karachi');
      expect(result.toISOString()).toBe(pkt(due).toISOString());
    });
  }
});
