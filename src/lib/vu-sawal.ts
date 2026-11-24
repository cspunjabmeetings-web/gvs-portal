// spec: F32-AC1 (# SAWAL format: Course, Sawal, Marks). Pure (browser + server). Jawab ka khana jaan boojh kar nahin (owner 1a).
import { normalizeCode } from './vu';

export const SAWAL_LIMITS = { question: 1000, marks: 100, perPaste: 300, chunk: 50 } as const;

export interface ParsedSawal {
  line: number;
  number: number;
  course: string;
  question: string;
  marks: number | null;
  source: string;
}

const HEADER = /^#\s*([a-z]+)(?:\s+\S+)*\s*$/i;
const SEP = /^-{3,}\s*$/;
const FIELD = /^(course|mazmoon|sawal|marks|jawab)\s*:\s*(.*)$/i;
const BOM = String.fromCharCode(0xfeff);

/** Text → sawal + ghaltiyan (line number ke sath). Ghalat block chhoot jata hai, baqi chalte hain. */
export function parseSawal(text: string, codes: readonly string[]): { items: ParsedSawal[]; errors: { line: number; message: string }[] } {
  const items: ParsedSawal[] = [];
  const errors: { line: number; message: string }[] = [];
  const known = new Set(codes);
  const lines = (text.startsWith(BOM) ? text.slice(1) : text).split(/\r\n?|\n/);
  let number = 0;
  let start = -1;
  let block: { n: number; t: string }[] = [];

  function flush() {
    if (start < 0) return;
    const head = start;
    start = -1;
    number++;
    const bad = (n: number, msg: string) => errors.push({ line: n, message: `Line ${n}: sawal ${number} mein ${msg}` });
    const before = errors.length;
    const f: Record<string, { v: string; n: number }> = {};
    let inSawal = false;
    for (const { n, t } of block) {
      if (!t.trim()) continue;
      const m = FIELD.exec(t.trim());
      if (m) {
        const k = m[1].toLowerCase() === 'mazmoon' ? 'course' : m[1].toLowerCase();
        inSawal = k === 'sawal';
        if (k === 'jawab') bad(n, '"Jawab:" yahan nahin likhte (jawab sirf pack mein).');
        else if (f[k]) bad(n, `"${m[1]}:" do dafa likha hai.`);
        else f[k] = { v: m[2].trim(), n };
      } else if (inSawal && f.sawal) f.sawal.v = `${f.sawal.v} ${t.trim()}`.trim();
      else bad(n, `yeh line samajh nahin aayi ("${t.trim().slice(0, 40)}").`);
    }
    const course = f.course ? normalizeCode(f.course.v) : null;
    if (!f.course?.v) bad(head, '"Course:" nahin likha.');
    else if (!course || !known.has(course)) bad(f.course.n, `course "${f.course.v.slice(0, 40)}" list mein nahin (pehle VU → Courses mein daalein).`);
    const question = (f.sawal?.v ?? '').replace(/\s+/g, ' ').trim();
    if (!question) bad(f.sawal?.n ?? head, '"Sawal:" nahin likha.');
    else if ([...question].length > SAWAL_LIMITS.question) bad(f.sawal.n, `sawal ${SAWAL_LIMITS.question} harf se lamba hai.`);
    let marks: number | null = null;
    if (f.marks?.v) {
      marks = /^\d{1,3}$/.test(f.marks.v) ? Number(f.marks.v) : NaN;
      if (!(marks >= 1 && marks <= SAWAL_LIMITS.marks)) bad(f.marks.n, `"Marks:" 1 se ${SAWAL_LIMITS.marks} tak ka hindsa ho.`);
    }
    if (errors.length > before) return;
    const source = `# SAWAL\nCourse: ${course}\nSawal: ${question}${marks ? `\nMarks: ${marks}` : ''}\n---`;
    items.push({ line: head, number, course: course!, question, marks, source });
  }

  lines.forEach((t, i) => {
    const n = i + 1;
    const h = HEADER.exec(t.trim());
    if (h) {
      flush();
      if (/^#\s*sawal\s*$/i.test(t.trim())) {
        start = n;
        block = [];
      } else errors.push({ line: n, message: `Line ${n}: yahan sirf # SAWAL daalein.` });
    } else if (SEP.test(t.trim())) flush();
    else if (start >= 0) block.push({ n, t });
    else if (t.trim() && !errors.some((e) => e.line > n - 12 && /sirf # SAWAL/.test(e.message))) errors.push({ line: n, message: `Line ${n}: "# SAWAL" se shuru karein.` });
  });
  flush();
  if (!items.length && !errors.length) errors.push({ line: 1, message: 'Koi "# SAWAL" nahin mila.' });
  if (items.length > SAWAL_LIMITS.perPaste) errors.unshift({ line: 1, message: `Ek dafa mein ${SAWAL_LIMITS.perPaste} sawal tak.` });
  return { items, errors };
}

/** Text ke codes (server sirf inhi ko dhoondhta hai) */
export function codesInSawal(text: string): string[] {
  const all = [...text.matchAll(/^[ \t]*(?:course|mazmoon)[ \t]*:[ \t]*(.*?)[ \t]*\r?$/gim)].map((m) => normalizeCode(m[1]));
  return [...new Set(all.filter((c): c is string => c !== null))];
}
