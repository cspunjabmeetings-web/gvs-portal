// spec: F33-AC1, AC2 (qaide), F33-AC4 (kaun se remarks). Pure (browser + server), valibot nahin.

export type Place = 'vu' | 'job' | 'both';
export type Kind = 'achievement' | 'remark';

/** Student ko jane wala hissa */
export interface Achievement {
  id: number;
  kind: Kind;
  body: string;
  person: string | null;
  course: string | null;
  semester: string | null;
  rating: number | null;
}

export const ACH_LIMITS = { body: 160, bodyMin: 5, person: 40, semester: 30, total: 200, strip: 12, cards: 3 } as const;
export const PLACE_LABEL: Record<Place, string> = { vu: 'Sirf VU', job: 'Sirf Job', both: 'VU aur Job dono' };

/** Pakistani number (03…, +92…, 92…): remark mein kisi ka number na jaye */
const PHONE = /(?:\+?92|0)[\s-]?3\d{2}[\s-]?\d{3}[\s-]?\d{4}/;

export interface AchForm {
  kind: Kind;
  body: string;
  person: string;
  course: string;
  semester: string;
  rating: number | null;
  place: Place;
  confirm: boolean;
}
export type AchClean = { kind: Kind; body: string; person: string | null; course: string | null; semester: string | null; rating: number | null; place: Place };

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export function checkAchievement(f: AchForm): { ok: true; value: AchClean } | { ok: false; message: string } {
  const bad = (message: string) => ({ ok: false as const, message });
  if (!f.confirm) return bad('Pehle tasdeeq ka dabba lagayen: yeh sach hai, saboot hai aur student ki ijazat hai.');
  const body = clean(f.body);
  const n = [...body].length;
  if (n < ACH_LIMITS.bodyMin || n > ACH_LIMITS.body) return bad(`Matn ${ACH_LIMITS.bodyMin} se ${ACH_LIMITS.body} harf ka ho (abhi ${n}).`);
  const person = clean(f.person);
  if ([...person].length > ACH_LIMITS.person) return bad(`Naam ${ACH_LIMITS.person} harf tak.`);
  const semester = clean(f.semester);
  if ([...semester].length > ACH_LIMITS.semester) return bad(`Semester ${ACH_LIMITS.semester} harf tak.`);
  if (PHONE.test(`${body} ${person} ${semester}`)) return bad('Phone number na likhein.');
  let course: string | null = null;
  if (f.course.trim()) {
    const m = /^([A-Za-z]{2,4})[\s-]*(\d{3})([A-Za-z]?)$/.exec(f.course.trim());
    if (!m) return bad('Course code sahih nahin (maslan CS101).');
    course = `${m[1]}${m[2]}${m[3]}`.toUpperCase();
  }
  if (f.rating !== null && !(Number.isInteger(f.rating) && f.rating >= 1 && f.rating <= 5)) return bad('Rating 1 se 5 tak.');
  return { ok: true, value: { kind: f.kind, body, person: person || null, course, semester: semester || null, rating: f.kind === 'remark' ? f.rating : null, place: f.place } };
}

/** Midterm par CGPA nahin hota: sirf khabardari (save nahin rukta) */
export const midtermCgpa = (f: Pick<AchForm, 'body' | 'semester'>) => /\bmid/i.test(`${f.body} ${f.semester}`) && /\bc?gpa\b/i.test(f.body);

/** Nateeje par remarks: isi course ke pehle, phir baqi (doosre course ke aakhir mein) */
export function remarksFor(list: readonly Achievement[], code: string): Achievement[] {
  const rank = (a: Achievement) => (a.course === code ? 0 : a.course === null ? 1 : 2);
  return list
    .filter((a) => a.kind === 'remark')
    .map((a, i) => ({ a, i }))
    .sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i)
    .slice(0, ACH_LIMITS.cards)
    .map((x) => x.a);
}

/** "CS101 · Fall 2025" */
export const achTag = (a: Pick<Achievement, 'course' | 'semester'>) => [a.course, a.semester].filter(Boolean).join(' · ');
