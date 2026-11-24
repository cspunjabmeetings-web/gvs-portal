// spec: F29-AC1 (course code + naam, poori list paste), F29-AC2 (# MCQ format, Mazmoon = course code)
// Pure (browser + server): code ki shakal, courses ki list parhna, paste ka text parser ke qabil banana.
import { parseContent, type ParseResult } from './parser';

export const VU_TERMS = ['mid', 'final'] as const;
export type VuTerm = (typeof VU_TERMS)[number];
export const TERM_LABEL: Record<VuTerm, string> = { mid: 'Midterm', final: 'Final Term' };

export const VU_LIMITS = { paste: 500, courses: 2000, name: 80 } as const;

export const VU_MSG = {
  empty: 'Kam az kam ek course likhein, maslan: CS101 Introduction to Computing',
  tooMany: `Ek dafa mein ${VU_LIMITS.paste} courses tak.`,
  onlyMcq: 'VU mein sirf # MCQ sawal daalein (# MOCK, # NOTE ya # JOB nahin).',
} as const;

const CODE = /^([A-Za-z]{2,4})[\s-]*(\d{3})([A-Za-z]?)$/;
const BOM = String.fromCharCode(0xfeff);

/** "cs 101", "CS-101", "cs101" → "CS101"; "bt505t" → "BT505T" (aakhir mein ek harf: T theory, P practical); warna null */
export function normalizeCode(raw: string): string | null {
  const m = CODE.exec(raw.trim());
  return m ? `${m[1]}${m[2]}${m[3]}`.toUpperCase() : null;
}

export interface CourseLine {
  code: string;
  name: string;
}

/** Har line: "CS101 Introduction to Computing" (beech mein -, : ya , bhi chalta hai). Khali lines chhoot jati hain. */
export function parseCourseList(text: string): { items: CourseLine[]; errors: { line: number; message: string }[] } {
  const items: CourseLine[] = [];
  const errors: { line: number; message: string }[] = [];
  const seen = new Map<string, number>();
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  src.split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1;
    const t = raw.replace(/\s+/g, ' ').trim();
    if (!t) return;
    const bad = (msg: string) => errors.push({ line: n, message: `Line ${n}: ${msg}` });
    const m = /^([A-Za-z]{2,4}[\s-]?\d{3}[A-Za-z]?)(?:\s*[-–:,]\s*|\s+)(.+)$/.exec(t);
    const code = normalizeCode(m ? m[1] : t);
    if (!code) return void bad(`"${t.slice(0, 40)}" mein course code nahin mila (maslan CS101 Introduction to Computing).`);
    const name = m ? m[2].trim() : '';
    if (!name) return void bad(`${code} ka naam nahin likha.`);
    if ([...name].length > VU_LIMITS.name) return void bad(`${code} ka naam ${VU_LIMITS.name} harf se lamba hai.`);
    if (seen.has(code)) return void bad(`${code} isi list ki line ${seen.get(code)} mein pehle aa chuka hai.`);
    seen.set(code, n);
    items.push({ code, name });
  });
  if (!items.length && !errors.length) errors.push({ line: 1, message: VU_MSG.empty });
  if (items.length > VU_LIMITS.paste) errors.unshift({ line: 1, message: VU_MSG.tooMany });
  return { items, errors };
}

const MAZMOON = /^([ \t]*mazmoon[ \t]*:[ \t]*)(.*?)[ \t]*$/gim;

/** "Mazmoon: cs 101" → "Mazmoon: CS101" (lines ki ginti wahi rehti hai) */
export function normalizeVuText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(MAZMOON, (all, label: string, val: string) => {
    const code = normalizeCode(val);
    return code ? label + code : all;
  });
}

/** Text mein likhe hue course codes (server sirf inhi ko database mein dhoondhta hai) */
export function codesInText(text: string): string[] {
  const all = [...normalizeVuText(text).matchAll(MAZMOON)].map((m) => normalizeCode(m[2]));
  return [...new Set(all.filter((c): c is string => c !== null))];
}

/** Wahi parser.ts; sirf # MCQ, mazmoon = course code */
export function parseVuMcqs(text: string, codes: readonly string[]): ParseResult {
  const r = parseContent(normalizeVuText(text), { subjects: codes });
  const errors = r.errors.map((e) => ({ ...e, message: e.message.replace('(Settings → Mazameen dekhein)', '(pehle VU → Courses mein daalein)') }));
  for (const it of r.items) if (it.kind !== 'MCQ') errors.push({ line: it.line, message: `Line ${it.line}: ${VU_MSG.onlyMcq}` });
  errors.sort((a, b) => a.line - b.line);
  return { ...r, items: r.items.filter((x) => x.kind === 'MCQ'), errors };
}
