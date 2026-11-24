// spec: F30-AC3 (20-20 ke tay shuda tests), F30-AC4 (25 minute = 20 sawal), F30-AC2 (search ki kunji)
// Pure (browser + server), chhoti: student ke page par parser.ts na jaye.

export const TEST_SIZE = 20;
/** Aakhri test is se kam ka ho to pichhle mein jur jata hai */
export const MIN_TEST = 5;

export interface VuTest {
  from: number;
  size: number;
  minutes: number;
}

/** 20 sawal = 25 minute, usi hisab se */
export const minutesFor = (size: number) => Math.ceil(size * 1.25);

/** 43 → 20 + 23; 47 → 20 + 20 + 7; 3 → 3 */
export function splitTests(total: number): VuTest[] {
  const out: VuTest[] = [];
  for (let from = 0; from < total; ) {
    const left = total - from;
    // Baqi 25 se kam: 20 tak ho ya aakhir mein 1-4 bachte hon to sab isi test mein
    const size = left < TEST_SIZE + MIN_TEST ? left : TEST_SIZE;
    out.push({ from, size, minutes: minutesFor(size) });
    from += size;
  }
  return out;
}

/** "CS 101", "cs-101" → "cs101" (search dono taraf isi se) */
export const searchKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
