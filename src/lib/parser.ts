// spec: SA12, 8.7 (content text ka parser), 9.4 (hadein), F11-AC2..AC5, F11-AC7 (q_hash, P-07), F11-AC8, F11-AC9; intent 10.2–10.6
// Shared: browser (Content tab ka preview, P-02) aur server (E17 har tukra dobara jaanchta hai). Koi dependency nahin.
// Nateeja: { items, errors:[{line, message}] }. Ek cheez ki ghalti baqi sahih cheezon ko nahin rokti (F11-AC3).

export const PARSER_LIMITS = {
  maxItems: 500,
  question: 500,
  option: 200,
  explanation: 1000,
  minOptions: 2,
  maxOptions: 5,
  mockQuestions: 100,
  mockMinutesMin: 1,
  mockMinutesMax: 300,
  mockSummary: 300,
  noteSummary: 155,
  noteBody: 20_000,
  jobList: 20,
  /** Naam/unwan/idara/post jaise ek-line khane (spec mein hadd nahin; hifazat ke liye) */
  shortText: 150,
  url: 500,
} as const;

export const DIFFICULTIES = ['Aasan', 'Darmiyana', 'Mushkil'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const CURRENT_AFFAIRS = 'Current Affairs';

export interface ParsedMcq {
  kind: 'MCQ';
  /** `# MCQ` wali line (1 se) */
  line: number;
  /** Paste mein sawal ka number (1 se), paigham ke liye */
  number: number;
  subject: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string | null;
  difficulty: Difficulty | null;
  asOfDate: string | null;
  /** Asal text (server dobara jaanch sake) */
  source: string;
}

export interface ParsedMock {
  kind: 'MOCK';
  line: number;
  name: string;
  minutes: number;
  summary: string | null;
  mcqs: ParsedMcq[];
  source: string;
}

export interface ParsedNote {
  kind: 'NOTE';
  line: number;
  title: string;
  subject: string;
  summary: string;
  body: string;
  source: string;
}

export interface ParsedJob {
  kind: 'JOB';
  line: number;
  org: string;
  post: string;
  city: string | null;
  education: string | null;
  lastDate: string;
  officialUrl: string;
  adUrl: string | null;
  govtFee: number | null;
  /** null = settings ka default_job_fee */
  ourFee: number | null;
  applyService: boolean;
  documents: string[];
  steps: string[];
  source: string;
}

export type ParsedItem = ParsedMcq | ParsedMock | ParsedNote | ParsedJob;
export interface ParseError {
  line: number;
  message: string;
}
export interface ParseResult {
  items: ParsedItem[];
  errors: ParseError[];
  /** Kitni cheezein mili (sahih + ghalat; mock ke sawal alag gine jate hain) */
  counts: { MCQ: number; MOCK: number; NOTE: number; JOB: number };
}

export interface ParseOptions {
  /** Settings ki mazameen ki list (F10-AC4) */
  subjects: readonly string[];
}

// ---------- Chhote helpers ----------

const HEADER = /^#\s*(mcq|mock|note|job|end\s*mock)\s*$/i;
const SEP = /^-{3,}\s*$/;
const FIELD = /^([A-Za-z][A-Za-z ]{0,30}?)\s*:\s?(.*)$/;
const OPTION = /^([A-Ea-e])\s*[).]\s*(.*)$/;
const LETTERS = 'ABCDE';

const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const len = (s: string) => [...s].length;

function isDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function isHttps(s: string): boolean {
  if (!/^https:\/\//i.test(s) || len(s) > PARSER_LIMITS.url) return false;
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
}

/** "700", "Rs. 700", "1,500" → number; khali → null; ghalat → NaN */
function money(s: string): number | null {
  const t = s.replace(/^rs\.?\s*/i, '').replace(/,/g, '').trim();
  if (!t) return null;
  return /^\d{1,6}$/.test(t) ? Number(t) : NaN;
}

/** Ek block ki line (asal number ke sath) */
interface Line {
  n: number;
  text: string;
}

/** Block ki lines ko `Naam: value` khanon mein. Multi-line khane (`Matn`, `Documents`, `Tareeqa`) apni aage ki lines le lete hain. */
interface Fields {
  get(name: string): { value: string; line: number } | undefined;
  options: { letter: string; text: string; line: number }[];
  lists: Map<string, { items: { text: string; line: number }[]; line: number }>;
  body: { text: string; line: number } | null;
}

interface BlockSpec {
  fields: string[];
  /** Is khane ke baad block ki baqi saari lines us ki value (NOTE `Matn`) */
  rest?: string;
  /** In khanon ke neeche `- x` / `1. x` lines ki list */
  lists?: string[];
  options?: boolean;
}

const MCQ_SPEC: BlockSpec = { fields: ['mazmoon', 'sawal', 'tashreeh', 'mushkil', 'tareekh'], options: true };
const MOCK_SPEC: BlockSpec = { fields: ['naam', 'waqt', 'khulasa'] };
const NOTE_SPEC: BlockSpec = { fields: ['unwan', 'mazmoon', 'khulasa', 'matn'], rest: 'matn' };
const JOB_SPEC: BlockSpec = {
  fields: ['idara', 'post', 'shehar', 'taleem', 'akhri tareekh', 'official link', 'ishtihar link', 'sarkari fee', 'hamari fee', 'apply service', 'documents', 'tareeqa'],
  lists: ['documents', 'tareeqa'],
};

function readFields(lines: Line[], spec: BlockSpec, errors: ParseError[]): Fields | null {
  const map = new Map<string, { value: string; line: number }>();
  const options: Fields['options'] = [];
  const lists: Fields['lists'] = new Map();
  let body: Fields['body'] = null;
  let currentList: string | null = null;
  let lastField: string | null = null;
  let ok = true;

  for (let i = 0; i < lines.length; i++) {
    const { n, text } = lines[i];
    const t = text.trim();
    if (!t) continue;

    // Multi-line list (Documents / Tareeqa)
    if (currentList) {
      const item = /^(?:[-•*]|\d{1,2}[.)])\s+(.*)$/.exec(t);
      if (item) {
        lists.get(currentList)!.items.push({ text: clean(item[1]), line: n });
        continue;
      }
      currentList = null;
    }

    if (spec.options) {
      const o = OPTION.exec(t);
      if (o) {
        options.push({ letter: o[1].toUpperCase(), text: o[2].trim(), line: n });
        lastField = null;
        continue;
      }
    }

    const f = FIELD.exec(t);
    const name = f ? key(f[1]) : '';
    if (f && spec.fields.includes(name)) {
      if (map.has(name) || lists.has(name) || (spec.rest === name && body)) {
        errors.push({ line: n, message: `Line ${n}: "${f[1].trim()}" do dafa likha hai.` });
        ok = false;
        continue;
      }
      if (spec.rest === name) {
        // Baqi saari lines (pehli line ki value bhi) matn hain
        const rest = [f[2], ...lines.slice(i + 1).map((l) => l.text)].join('\n').replace(/^\n+|\s+$/g, '');
        body = { text: rest, line: n };
        break;
      }
      if (spec.lists?.includes(name)) {
        lists.set(name, { items: [], line: n });
        if (f[2].trim()) lists.get(name)!.items.push({ text: clean(f[2]), line: n });
        currentList = name;
        lastField = null;
        continue;
      }
      map.set(name, { value: f[2].trim(), line: n });
      lastField = name;
      continue;
    }

    // Sawal/Tashreeh/Khulasa agli line tak ja sakte hain (option se pehle). Agli line mein colon ho
    // ("spelling of the word:") to bhi — agar woh 3+ alfaz ka anjaan naam ho (ghalat likha khana nahin lagta).
    const looksLikeText = !f || (!spec.fields.includes(name) && name.split(' ').length >= 3);
    if (looksLikeText && lastField && ['sawal', 'tashreeh', 'khulasa'].includes(lastField) && options.length === 0) {
      const prev = map.get(lastField)!;
      prev.value = `${prev.value} ${t}`.trim();
      continue;
    }

    errors.push({
      line: n,
      message: f ? `Line ${n}: "${f[1].trim()}" khana pehchana nahin gaya.` : `Line ${n}: yeh line samajh nahin aayi ("${t.slice(0, 40)}").`,
    });
    ok = false;
  }

  if (!ok) return null;
  return { get: (k) => map.get(k), options, lists, body };
}

function subjectOf(v: string, subjects: readonly string[]): string | null {
  const k = key(v);
  return subjects.find((s) => key(s) === k) ?? null;
}

// ---------- Har qism ki jaanch ----------

function buildMcq(lines: Line[], header: number, number: number, source: string, opts: ParseOptions, errors: ParseError[]): ParsedMcq | null {
  const before = errors.length;
  const f = readFields(lines, MCQ_SPEC, errors);
  if (!f) return null;
  const err = (line: number, msg: string) => errors.push({ line, message: `Line ${line}: sawal ${number} mein ${msg}` });

  const subj = f.get('mazmoon');
  const subject = subj ? subjectOf(subj.value, opts.subjects) : null;
  if (!subj || !subj.value) err(header, '"Mazmoon:" nahin likha.');
  else if (!subject) err(subj.line, `mazmoon "${subj.value}" list mein nahin (Settings → Mazameen dekhein).`);

  const q = f.get('sawal');
  const question = q ? clean(q.value) : '';
  if (!question) err(q?.line ?? header, '"Sawal:" nahin likha.');
  else if (len(question) > PARSER_LIMITS.question) err(q!.line, `sawal ${PARSER_LIMITS.question} harf se lamba hai.`);

  const opt = f.options;
  if (opt.length < PARSER_LIMITS.minOptions || opt.length > PARSER_LIMITS.maxOptions) {
    err(opt[0]?.line ?? header, `${PARSER_LIMITS.minOptions} se ${PARSER_LIMITS.maxOptions} options hone chahiye (abhi ${opt.length}).`);
  } else {
    opt.forEach((o, i) => {
      if (o.letter !== LETTERS[i]) err(o.line, `options A, B, C… ki tarteeb mein hon ("${o.letter})" ki jagah "${LETTERS[i]})").`);
    });
  }
  const starred = opt.filter((o) => /\*\s*$/.test(o.text));
  if (opt.length >= PARSER_LIMITS.minOptions && starred.length === 0) err(opt[0].line, 'sahih jawab par * nahin laga.');
  if (starred.length > 1) err(starred[1].line, 'ek se zyada jawab par * laga hai (sirf ek sahih).');
  const options = opt.map((o) => clean(o.text.replace(/\*\s*$/, '')));
  options.forEach((o, i) => {
    if (!o) err(opt[i].line, `option ${opt[i].letter} khali hai.`);
    else if (len(o) > PARSER_LIMITS.option) err(opt[i].line, `option ${opt[i].letter} ${PARSER_LIMITS.option} harf se lamba hai.`);
  });
  if (new Set(options.map(key)).size !== options.length) err(opt[0]?.line ?? header, 'do options bilkul ek jaise hain.');

  const ex = f.get('tashreeh');
  const explanation = ex && clean(ex.value) ? clean(ex.value) : null;
  if (explanation && len(explanation) > PARSER_LIMITS.explanation) err(ex!.line, `tashreeh ${PARSER_LIMITS.explanation} harf se lambi hai.`);

  const d = f.get('mushkil');
  const difficulty = d && d.value ? (DIFFICULTIES.find((x) => key(x) === key(d.value)) ?? null) : null;
  if (d && d.value && !difficulty) err(d.line, '"Mushkil:" sirf Aasan, Darmiyana ya Mushkil.');

  const dt = f.get('tareekh');
  const asOfDate = dt && dt.value ? dt.value : null;
  if (asOfDate && !isDate(asOfDate)) err(dt!.line, 'tareekh YYYY-MM-DD shakal mein likhein (maslan 2026-11-16).');
  if (subject === CURRENT_AFFAIRS && !asOfDate) err(header, 'Current Affairs ke sawal par "Tareekh:" zaroori hai.');

  if (errors.length > before) return null;
  return { kind: 'MCQ', line: header, number, subject: subject!, question, options, answerIndex: options.findIndex((_, i) => /\*\s*$/.test(opt[i].text)), explanation, difficulty, asOfDate, source };
}

function buildMock(lines: Line[], header: number, errors: ParseError[]): Omit<ParsedMock, 'mcqs' | 'source'> | null {
  const before = errors.length;
  const f = readFields(lines, MOCK_SPEC, errors);
  if (!f) return null;
  const err = (line: number, msg: string) => errors.push({ line, message: `Line ${line}: mock mein ${msg}` });

  const nm = f.get('naam');
  const name = nm ? clean(nm.value) : '';
  if (!name) err(header, '"Naam:" nahin likha.');
  else if (len(name) > PARSER_LIMITS.shortText) err(nm!.line, `naam ${PARSER_LIMITS.shortText} harf se lamba hai.`);

  const w = f.get('waqt');
  const m = w ? /^(\d{1,4})\s*(?:minute|minutes|mint|min|m)?\.?$/i.exec(w.value.trim()) : null;
  const minutes = m ? Number(m[1]) : NaN;
  if (!w || !w.value) err(header, '"Waqt:" nahin likha (maslan "Waqt: 30 minute").');
  else if (!(minutes >= PARSER_LIMITS.mockMinutesMin && minutes <= PARSER_LIMITS.mockMinutesMax))
    err(w.line, `waqt ${PARSER_LIMITS.mockMinutesMin} se ${PARSER_LIMITS.mockMinutesMax} minute ho (maslan "Waqt: 30 minute").`);

  const s = f.get('khulasa');
  const summary = s && clean(s.value) ? clean(s.value) : null;
  if (summary && len(summary) > PARSER_LIMITS.mockSummary) err(s!.line, `khulasa ${PARSER_LIMITS.mockSummary} harf se lamba hai.`);

  if (errors.length > before) return null;
  return { kind: 'MOCK', line: header, name, minutes, summary };
}

function buildNote(lines: Line[], header: number, source: string, opts: ParseOptions, errors: ParseError[]): ParsedNote | null {
  const before = errors.length;
  const f = readFields(lines, NOTE_SPEC, errors);
  if (!f) return null;
  const err = (line: number, msg: string) => errors.push({ line, message: `Line ${line}: note mein ${msg}` });

  const t = f.get('unwan');
  const title = t ? clean(t.value) : '';
  if (!title) err(header, '"Unwan:" nahin likha.');
  else if (len(title) > PARSER_LIMITS.shortText) err(t!.line, `unwan ${PARSER_LIMITS.shortText} harf se lamba hai.`);

  const subj = f.get('mazmoon');
  const subject = subj ? subjectOf(subj.value, opts.subjects) : null;
  if (!subj || !subj.value) err(header, '"Mazmoon:" nahin likha.');
  else if (!subject) err(subj.line, `mazmoon "${subj.value}" list mein nahin (Settings → Mazameen dekhein).`);

  const s = f.get('khulasa');
  const summary = s ? clean(s.value) : '';
  if (!summary) err(header, '"Khulasa:" nahin likha (yahi Google mein description banta hai).');
  else if (len(summary) > PARSER_LIMITS.noteSummary) err(s!.line, `khulasa ${PARSER_LIMITS.noteSummary} harf tak ho (abhi ${len(summary)}).`);

  const body = f.body?.text ?? '';
  if (!body.trim()) err(f.body?.line ?? header, '"Matn:" nahin likha ya khali hai (Matn aakhri khana ho).');
  else if (len(body) > PARSER_LIMITS.noteBody) err(f.body!.line, `matn ${PARSER_LIMITS.noteBody.toLocaleString('en-US')} harf se lamba hai.`);

  if (errors.length > before) return null;
  return { kind: 'NOTE', line: header, title, subject: subject!, summary, body, source };
}

function buildJob(lines: Line[], header: number, source: string, errors: ParseError[]): ParsedJob | null {
  const before = errors.length;
  const f = readFields(lines, JOB_SPEC, errors);
  if (!f) return null;
  const err = (line: number, msg: string) => errors.push({ line, message: `Line ${line}: job mein ${msg}` });
  const text = (k: string, label: string, required: boolean) => {
    const v = f.get(k);
    const val = v ? clean(v.value) : '';
    if (!val) {
      if (required) err(header, `"${label}:" nahin likha.`);
      return null;
    }
    if (len(val) > PARSER_LIMITS.shortText) err(v!.line, `${label} ${PARSER_LIMITS.shortText} harf se lamba hai.`);
    return val;
  };

  const org = text('idara', 'Idara', true) ?? '';
  const post = text('post', 'Post', true) ?? '';
  const city = text('shehar', 'Shehar', false);
  const education = text('taleem', 'Taleem', false);

  const ld = f.get('akhri tareekh');
  const lastDate = ld ? ld.value.trim() : '';
  if (!lastDate) err(header, '"Akhri tareekh:" nahin likhi.');
  else if (!isDate(lastDate)) err(ld!.line, 'akhri tareekh YYYY-MM-DD shakal mein likhein (maslan 2026-12-05).');

  const ol = f.get('official link');
  const officialUrl = ol ? ol.value.trim() : '';
  if (!officialUrl) err(header, '"Official link:" nahin likha.');
  else if (!isHttps(officialUrl)) err(ol!.line, 'official link https:// se shuru hone wala sahih link ho.');

  const al = f.get('ishtihar link');
  const adUrl = al && al.value.trim() ? al.value.trim() : null;
  if (adUrl && !isHttps(adUrl)) err(al!.line, 'ishtihar link https:// se shuru hone wala sahih link ho.');

  const gf = f.get('sarkari fee');
  const govtFee = gf ? money(gf.value) : null;
  if (Number.isNaN(govtFee)) err(gf!.line, 'sarkari fee sirf raqam ho (maslan 700).');
  const of = f.get('hamari fee');
  const ourFee = of ? money(of.value) : null;
  if (Number.isNaN(ourFee)) err(of!.line, 'hamari fee sirf raqam ho (maslan 300), ya khali chhorein.');

  const ap = f.get('apply service');
  let applyService = true;
  if (ap && ap.value.trim()) {
    const v = key(ap.value);
    if (['haan', 'han', 'yes', 'ha'].includes(v)) applyService = true;
    else if (['nahin', 'nahi', 'no', 'na'].includes(v)) applyService = false;
    else err(ap.line, '"Apply service:" sirf Haan ya Nahin.');
  }

  const list = (k: string, label: string) => {
    const l = f.lists.get(k);
    const items = l?.items.map((x) => x.text).filter(Boolean) ?? [];
    if (l && items.length > PARSER_LIMITS.jobList) err(l.line, `${label} ${PARSER_LIMITS.jobList} se zyada hain (abhi ${items.length}).`);
    l?.items.forEach((x) => {
      if (len(x.text) > 300) err(x.line, `${label} ki line 300 harf se lambi hai.`);
    });
    return items;
  };
  const documents = list('documents', 'Documents');
  const steps = list('tareeqa', 'Tareeqa ke qadam');

  if (errors.length > before) return null;
  return { kind: 'JOB', line: header, org, post, city, education, lastDate, officialUrl, adUrl, govtFee: govtFee as number | null, ourFee: ourFee as number | null, applyService, documents, steps, source };
}

// ---------- Main ----------

/** Content text → cheezein + ghaltiyan (line number ke sath, Roman Urdu) */
export function parseContent(input: string, opts: ParseOptions): ParseResult {
  const raw = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const all: Line[] = raw.map((text, i) => ({ n: i + 1, text }));
  const items: ParsedItem[] = [];
  const errors: ParseError[] = [];
  const counts = { MCQ: 0, MOCK: 0, NOTE: 0, JOB: 0 };

  let i = 0;
  let mcqNo = 0;
  let mock: { header: number; info: Omit<ParsedMock, 'mcqs' | 'source'> | null; mcqs: ParsedMcq[]; broken: boolean } | null = null;

  const closeMock = (endLine: number) => {
    if (!mock) return;
    const m = mock;
    mock = null;
    if (!m.info) return;
    if (m.mcqs.length === 0 && !m.broken) {
      errors.push({ line: m.header, message: `Line ${m.header}: mock "${m.info.name}" mein koi sawal nahin.` });
      return;
    }
    if (m.mcqs.length > PARSER_LIMITS.mockQuestions) {
      errors.push({ line: m.header, message: `Line ${m.header}: mock "${m.info.name}" mein ${PARSER_LIMITS.mockQuestions} se zyada sawal hain (abhi ${m.mcqs.length}).` });
      return;
    }
    if (m.broken) {
      errors.push({ line: m.header, message: `Line ${m.header}: mock "${m.info.name}" ke andar ghaltiyan hain, is liye poora mock save nahin hoga.` });
      return;
    }
    items.push({ ...m.info, mcqs: m.mcqs, source: raw.slice(m.header - 1, endLine).join('\n') });
  };

  while (i < all.length) {
    const { n, text } = all[i];
    const t = text.trim();
    if (!t || SEP.test(t)) {
      i++;
      continue;
    }
    const h = HEADER.exec(t);
    if (!h) {
      errors.push({ line: n, message: `Line ${n}: yeh line kisi "# MCQ", "# MOCK", "# NOTE" ya "# JOB" ke andar nahin.` });
      if (mock) mock.broken = true;
      i++;
      continue;
    }
    const kind = h[1].toUpperCase().replace(/\s+/g, ' ');

    if (kind === 'END MOCK') {
      if (!mock) errors.push({ line: n, message: `Line ${n}: "# END MOCK" se pehle "# MOCK" nahin.` });
      else closeMock(n);
      i++;
      continue;
    }

    // Block: header ke baad `---` ya agle header tak
    let j = i + 1;
    while (j < all.length && !SEP.test(all[j].text.trim()) && !HEADER.test(all[j].text.trim())) j++;
    const body = all.slice(i + 1, j);
    const end = j < all.length && SEP.test(all[j].text.trim()) ? j + 1 : j; // `---` shamil
    const source = raw.slice(i, end).join('\n');
    i = end;

    if (mock && kind !== 'MCQ') {
      errors.push({ line: n, message: `Line ${n}: mock ke andar sirf "# MCQ" aa sakta hai; pehle "# END MOCK" likhein.` });
      mock.broken = true;
      if (kind === 'MOCK') {
        counts.MOCK++;
        continue;
      }
    }

    if (kind === 'MCQ') {
      counts.MCQ++;
      mcqNo++;
      const before = errors.length;
      const q = buildMcq(body, n, mcqNo, source, opts, errors);
      if (mock) {
        if (q) mock.mcqs.push(q);
        if (errors.length > before) mock.broken = true;
      } else if (q) items.push(q);
    } else if (kind === 'MOCK') {
      counts.MOCK++;
      mock = { header: n, info: buildMock(body, n, errors), mcqs: [], broken: false };
    } else if (kind === 'NOTE') {
      counts.NOTE++;
      const note = buildNote(body, n, source, opts, errors);
      if (note) items.push(note);
    } else if (kind === 'JOB') {
      counts.JOB++;
      const job = buildJob(body, n, source, errors);
      if (job) items.push(job);
    }
  }

  if (mock) {
    const m = mock as { header: number };
    errors.push({ line: m.header, message: `Line ${m.header}: mock ke aakhir mein "# END MOCK" nahin likha.` });
    mock = null;
  }

  // F11-AC4 / 9.4: ek paste mein ≤ 500 cheezein (mock ke sawal bhi gine jate hain)
  const total = counts.MCQ + counts.MOCK + counts.NOTE + counts.JOB;
  if (total > PARSER_LIMITS.maxItems) {
    return { items: [], errors: [{ line: 1, message: `${PARSER_LIMITS.maxItems} se zyada cheezein (${total}); hisson mein bhejein.` }], counts };
  }
  if (total === 0 && errors.length === 0 && all.some((l) => l.text.trim())) {
    errors.push({ line: 1, message: 'Line 1: koi "# MCQ", "# MOCK", "# NOTE" ya "# JOB" nahin mila.' });
  }

  errors.sort((a, b) => a.line - b.line);
  return { items, errors, counts };
}

// ---------- F11-AC7: ek jaisa sawal (q_hash, P-07) ----------

/** Chhote harf, sirf harf/hindse, ek space — "Qarardad-e-Pakistan kis saal?" aur "qarardad e pakistan kis saal" ek jaise */
export function normalizeQuestion(q: string): string {
  return q
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** SHA-256 hex (browser aur Workers dono mein Web Crypto) */
export async function qHash(question: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeQuestion(question)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
