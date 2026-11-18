// spec: F12-AC4 (note ka slug unwan se, unique; edit par nahin badalta), S19/S21 (/mock-tests/<slug>, /notes/<slug>)
// Pure. Unique banane ka kaam server (content-import.ts) DB dekh kar karta hai.

export const SLUG_MAX = 80;

/** "Pakistan ke Aain ki Tareekh (1956, 1962, 1973)" → "pakistan-ke-aain-ki-tareekh-1956-1962-1973" */
export function slugify(text: string, fallback = 'item'): string {
  const s = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
  return s || fallback;
}

/** `base` pehle se ho to base-2, base-3 … (taken = pehle se maujood slugs, mitaye hue samet) */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const suffix = `-${i}`;
    const s = base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '') + suffix;
    if (!taken.has(s)) return s;
  }
}
