// spec: F19-AC1 (paste ya form — dono ka nateeja ek jaisa), intent 10.6 (# JOB format). Pure: browser (form → preview) + server (save).
// Form ki values ko `# JOB` text bana kar WAHI parser.ts chalta hai — is liye do qaide nahin, ek.
import type { ParsedJob } from './parser';

export interface JobForm {
  org: string;
  post: string;
  city: string;
  education: string;
  lastDate: string;
  officialUrl: string;
  adUrl: string;
  govtFee: string;
  ourFee: string;
  applyService: boolean;
  /** Ek line = ek document */
  documents: string;
  /** Ek line = ek qadam */
  steps: string;
}

export const EMPTY_JOB_FORM: JobForm = { org: '', post: '', city: '', education: '', lastDate: '', officialUrl: '', adUrl: '', govtFee: '', ourFee: '', applyService: true, documents: '', steps: '' };

/** Aisi line jo parser mein job ko wahin tod de (`---`, `# MCQ`…) */
export const JOB_BREAKER = /^\s*(?:-{3,}|#\s*(?:mcq|mock|note|job|end\s*mock))\s*$/i;
export const JOB_FORM_MSG = { breaker: 'Kisi khane mein akeli "---" ya "# JOB…" wali line na likhein.' } as const;

const one = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();
/** "- x", "• x", "1. x", "2) x" → "x"; khali lines hata */
const lines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d{1,2}[.)])\s*/, '').trim())
    .filter(Boolean);

export function hasBreaker(f: JobForm): boolean {
  return [f.documents, f.steps].some((t) => t.split(/\r?\n/).some((l) => JOB_BREAKER.test(l)));
}

/** Form → `# JOB` text (khali ikhtiyari khane chhoot jate) */
export function jobText(f: JobForm): string {
  const out = ['# JOB', `Idara: ${one(f.org)}`, `Post: ${one(f.post)}`];
  if (one(f.city)) out.push(`Shehar: ${one(f.city)}`);
  if (one(f.education)) out.push(`Taleem: ${one(f.education)}`);
  out.push(`Akhri tareekh: ${one(f.lastDate)}`, `Official link: ${one(f.officialUrl)}`);
  if (one(f.adUrl)) out.push(`Ishtihar link: ${one(f.adUrl)}`);
  if (one(f.govtFee)) out.push(`Sarkari fee: ${one(f.govtFee)}`);
  if (one(f.ourFee)) out.push(`Hamari fee: ${one(f.ourFee)}`);
  out.push(`Apply service: ${f.applyService ? 'Haan' : 'Nahin'}`);
  const docs = lines(f.documents);
  if (docs.length) out.push('Documents:', ...docs.map((d) => `- ${d}`));
  const steps = lines(f.steps);
  if (steps.length) out.push('Tareeqa:', ...steps.map((s, i) => `${i + 1}. ${s}`));
  out.push('---');
  return out.join('\n');
}

/** Save shuda job → form (badalne ke liye) */
export function formFromJob(j: Omit<ParsedJob, 'kind' | 'line' | 'source'>): JobForm {
  return {
    org: j.org,
    post: j.post,
    city: j.city ?? '',
    education: j.education ?? '',
    lastDate: j.lastDate,
    officialUrl: j.officialUrl,
    adUrl: j.adUrl ?? '',
    govtFee: j.govtFee === null ? '' : String(j.govtFee),
    ourFee: j.ourFee === null ? '' : String(j.ourFee),
    applyService: j.applyService,
    documents: j.documents.join('\n'),
    steps: j.steps.join('\n'),
  };
}

/** Pakistan ki aaj ki tareekh ke hisab se: aakhri din 23:59:59 tak khuli (F18-AC4, A-02) */
export const isOpenOn = (lastDate: string, today: string) => lastDate >= today;

/** "aaj aakhri din" / "3 din baqi" / "band" (admin list) */
export function daysLeftLabel(lastDate: string, today: string): string {
  if (lastDate < today) return 'Band ho chuki';
  const d = Math.round((Date.parse(`${lastDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return d === 0 ? 'Aaj aakhri din' : d === 1 ? 'Kal aakhri din' : `${d} din baqi`;
}
