// spec: E18 (GET list, POST banana/badalna/verified, DELETE), E19 (mocks: dekhna, chhupana, mitana), E20 (notes: dekhna, badalna,
//       chhupana, mitana), F12-AC1..AC6, P-06 (deleted_at → 410 Qadam 11/12), 9.2 (CSRF)
// Sawal/note ki jaanch WAHI parser.ts wali: form ki values ko content text bana kar parseContent se guzarte hain.
import * as v from 'valibot';
import { fail, ok, readJson, sameOrigin, API_MSG, type ApiResult } from './api';
import { adminPost, requireAdmin } from './admin-auth';
import { getSettings } from './settings';
import { likeEscape } from './admin-orders';
import { parseContent, qHash, PARSER_LIMITS, type ParsedMcq, type ParsedNote } from './parser';
import { existingHashes, type ContentEnv } from './content-import';

export const LIST_PAGE = 50;
const LETTERS = 'ABCDE';

export const CONTENT_ADMIN_MSG = {
  not_found: 'Yeh cheez nahin mili (shayad mit chuki).',
  invalid: 'Maloomat sahih shakal mein nahin.',
} as const;

const one = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();
/** Parser ke paigham se "Line 3: sawal 1 mein " / "Line 3: note mein " hata kar form ke liye */
const formMsg = (m: string) => {
  const t = m.replace(/^Line \d+:\s*(?:sawal \d+ mein|note mein)\s*/i, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

async function guardPost(request: Request, env: ContentEnv): Promise<ApiResult | null> {
  return (await requireAdmin(request, env)) ?? adminPost(request);
}
/** DELETE: body nahin, is liye sirf cookie + Origin (9.2) */
async function guardDelete(request: Request, env: ContentEnv): Promise<ApiResult | null> {
  return (await requireAdmin(request, env)) ?? (sameOrigin(request) ? null : fail(403, 'origin', API_MSG.origin));
}
const parseId = (raw: string | undefined) => (raw && /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null);
const offsetOf = (u: URL) => Math.max(0, Math.min(1_000_000, Number(u.searchParams.get('offset')) || 0));

// ======================= Sawal (E18) =======================

export interface AdminMcq {
  id: number;
  subject: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string | null;
  difficulty: string | null;
  asOfDate: string | null;
  verified: boolean;
  mockId: number | null;
  mockName: string | null;
}

type McqRow = {
  id: number;
  subject: string;
  question: string;
  options_json: string;
  answer_index: number;
  explanation: string | null;
  difficulty: string | null;
  as_of_date: string | null;
  verified: number;
  mock_id: number | null;
  mock_name: string | null;
};

const toMcq = (r: McqRow): AdminMcq => ({
  id: r.id,
  subject: r.subject,
  question: r.question,
  options: JSON.parse(r.options_json) as string[],
  answerIndex: r.answer_index,
  explanation: r.explanation,
  difficulty: r.difficulty,
  asOfDate: r.as_of_date,
  verified: r.verified === 1,
  mockId: r.mock_id,
  mockName: r.mock_name,
});

/** E18 GET: ?hashes= (9b) ya list (F12-AC1): q, subject, verified=0|1, mock=<id>, offset */
export async function listMcqs(request: Request, env: ContentEnv): Promise<ApiResult> {
  const u = new URL(request.url);
  if (u.searchParams.has('hashes')) return existingHashes(request, env);
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const where: string[] = [];
  const binds: unknown[] = [];
  const q = (u.searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q) {
    where.push(`m.question LIKE ? ESCAPE '\\'`);
    binds.push(`%${likeEscape(q)}%`);
  }
  const subject = (u.searchParams.get('subject') ?? '').trim();
  if (subject) {
    where.push('m.subject = ?');
    binds.push(subject.slice(0, 60));
  }
  const ver = u.searchParams.get('verified');
  if (ver === '0' || ver === '1') where.push(`m.verified = ${ver}`);
  const mock = parseId(u.searchParams.get('mock') ?? undefined);
  if (mock) {
    where.push('m.mock_id = ?');
    binds.push(mock);
  }
  const offset = offsetOf(u);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  try {
    const [list, summary] = await env.DB.batch([
      env.DB.prepare(
        `SELECT m.id, m.subject, m.question, m.options_json, m.answer_index, m.explanation, m.difficulty, m.as_of_date, m.verified, m.mock_id, k.name AS mock_name
         FROM mcqs m LEFT JOIN mocks k ON k.id = m.mock_id ${w} ORDER BY m.id DESC LIMIT ${LIST_PAGE + 1} OFFSET ${offset}`,
      ).bind(...binds),
      env.DB.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(verified = 0), 0) AS unverified FROM mcqs'),
    ]);
    const rows = list.results as McqRow[];
    const s = summary.results[0] as { total: number; unverified: number };
    return ok({ items: rows.slice(0, LIST_PAGE).map(toMcq), hasMore: rows.length > LIST_PAGE, summary: { total: s.total, unverified: s.unverified } });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

const McqBody = v.variant('action', [
  v.object({ action: v.literal('verify'), id: v.number(), verified: v.boolean() }),
  v.object({
    action: v.literal('save'),
    id: v.optional(v.number()),
    subject: v.pipe(v.string(), v.maxLength(100)),
    question: v.pipe(v.string(), v.maxLength(2000)),
    options: v.pipe(v.array(v.pipe(v.string(), v.maxLength(1000))), v.maxLength(PARSER_LIMITS.maxOptions + 1)),
    answerIndex: v.number(),
    explanation: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(4000)))),
    difficulty: v.optional(v.nullable(v.string())),
    asOfDate: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(20)))),
    verified: v.optional(v.boolean()),
  }),
]);

/** Form → content text → parser (dono jagah ek hi qaida) */
export function mcqFromForm(f: { subject: string; question: string; options: string[]; answerIndex: number; explanation?: string | null; difficulty?: string | null; asOfDate?: string | null }, subjects: readonly string[]) {
  const lines = ['# MCQ', `Mazmoon: ${one(f.subject)}`, `Sawal: ${one(f.question)}`];
  f.options.forEach((o, i) => lines.push(`${LETTERS[i] ?? 'Z'}) ${one(o).replace(/\*+$/, '').trim()}${i === f.answerIndex ? '*' : ''}`));
  if (f.explanation && one(f.explanation)) lines.push(`Tashreeh: ${one(f.explanation)}`);
  if (f.difficulty && one(f.difficulty)) lines.push(`Mushkil: ${one(f.difficulty)}`);
  if (f.asOfDate && one(f.asOfDate)) lines.push(`Tareekh: ${one(f.asOfDate)}`);
  lines.push('---');
  const r = parseContent(lines.join('\n'), { subjects });
  return r.errors.length ? { ok: false as const, message: formMsg(r.errors[0].message) } : { ok: true as const, mcq: r.items[0] as ParsedMcq };
}

/** E18 POST: { action:'verify', id, verified } (F12-AC6) ya { action:'save', id?, … } (F12-AC2) */
export async function saveMcq(request: Request, env: ContentEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await guardPost(request, env);
  if (denied) return denied;
  const body = await readJson(request, 16 * 1024);
  if (!body.ok) return body.res;
  const p = v.safeParse(McqBody, body.data);
  if (!p.success) return fail(400, 'invalid', CONTENT_ADMIN_MSG.invalid);
  const db = env.DB;
  try {
    if (p.output.action === 'verify') {
      const res = await db.prepare('UPDATE mcqs SET verified = CAST(?1 AS INTEGER) WHERE id = ?2').bind(p.output.verified ? 1 : 0, p.output.id).run();
      if (res.meta.changes !== 1) return fail(404, 'not_found', CONTENT_ADMIN_MSG.not_found);
      return ok({ id: p.output.id, verified: p.output.verified });
    }
    const f = p.output;
    const { subjects } = await getSettings(db);
    const r = mcqFromForm(f, subjects);
    if (!r.ok) return fail(400, 'invalid', r.message);
    const m = r.mcq;
    const vals = [m.subject, m.question, JSON.stringify(m.options), m.answerIndex, m.explanation, m.difficulty, m.asOfDate, await qHash(m.question)];
    if (f.id !== undefined) {
      const res = await db
        .prepare(
          `UPDATE mcqs SET subject = ?1, question = ?2, options_json = ?3, answer_index = CAST(?4 AS INTEGER), explanation = ?5, difficulty = ?6, as_of_date = ?7, q_hash = ?8 WHERE id = ?9`,
        )
        .bind(...vals, f.id)
        .run();
      if (res.meta.changes !== 1) return fail(404, 'not_found', CONTENT_ADMIN_MSG.not_found);
      return ok({ id: f.id });
    }
    const at = (deps.now ?? (() => new Date()))().toISOString();
    const row = await db
      .prepare(
        `INSERT INTO mcqs (subject, question, options_json, answer_index, explanation, difficulty, as_of_date, q_hash, verified, created_at)
         VALUES (?1, ?2, ?3, CAST(?4 AS INTEGER), ?5, ?6, ?7, ?8, CAST(?9 AS INTEGER), ?10) RETURNING id`,
      )
      .bind(...vals, f.verified ? 1 : 0, at)
      .first<{ id: number }>();
    return ok({ id: row!.id });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/** E18 DELETE: sawal ka URL nahin, is liye poora mitta hai */
export async function deleteMcq(request: Request, env: ContentEnv, rawId: string | undefined): Promise<ApiResult> {
  const denied = await guardDelete(request, env);
  if (denied) return denied;
  const id = parseId(rawId);
  if (!id) return fail(404, 'not_found', CONTENT_ADMIN_MSG.not_found);
  try {
    const res = await env.DB.prepare('DELETE FROM mcqs WHERE id = ?1').bind(id).run();
    if (res.meta.changes !== 1) return fail(404, 'not_found', CONTENT_ADMIN_MSG.not_found);
    return ok({ id });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

// ======================= Mock (E19) =======================

export interface AdminMock {
  id: number;
  slug: string;
  name: string;
  minutes: number;
  summary: string | null;
  visible: boolean;
  questions: number;
  unverified: number;
  createdAt: string;
}

/** E19 GET: mitaye hue nahin; naye upar */
export async function listMocks(request: Request, env: ContentEnv): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const offset = offsetOf(new URL(request.url));
  try {
    const { results } = await env.DB.prepare(
      `SELECT k.id, k.slug, k.name, k.minutes, k.summary, k.visible, k.created_at,
              (SELECT COUNT(*) FROM mcqs WHERE mock_id = k.id) AS questions,
              (SELECT COUNT(*) FROM mcqs WHERE mock_id = k.id AND verified = 0) AS unverified
       FROM mocks k WHERE k.deleted_at IS NULL ORDER BY k.id DESC LIMIT ${LIST_PAGE + 1} OFFSET ${offset}`,
    ).all<{ id: number; slug: string; name: string; minutes: number; summary: string | null; visible: number; created_at: string; questions: number; unverified: number }>();
    const items: AdminMock[] = results.slice(0, LIST_PAGE).map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      minutes: r.minutes,
      summary: r.summary,
      visible: r.visible === 1,
      questions: r.questions,
      unverified: r.unverified,
      createdAt: r.created_at,
    }));
    return ok({ items, hasMore: results.length > LIST_PAGE });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

const VisibleBody = v.object({ id: v.number(), visible: v.boolean() });

/** E19 POST: chhupana/dikhana */
export async function setMockVisible(request: Request, env: ContentEnv): Promise<ApiResult> {
  const denied = await guardPost(request, env);
  if (denied) return denied;
  const body = await readJson(request, 1024);
  if (!body.ok) return body.res;
  const p = v.safeParse(VisibleBody, body.data);
  if (!p.success) return fail(400, 'invalid', CONTENT_ADMIN_MSG.invalid);
  try {
    const res = await env.DB.prepare('UPDATE mocks SET visible = CAST(?1 AS INTEGER) WHERE id = ?2 AND deleted_at IS NULL').bind(p.output.visible ? 1 : 0, p.output.id).run();
    if (res.meta.changes !== 1) return fail(404, 'not_found', CONTENT_ADMIN_MSG.not_found);
    return ok({ id: p.output.id, visible: p.output.visible });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/** E19 DELETE (F12-AC3, AC5): deleted_at; sawal bank mein rehte hain (mock_id = NULL) */
export async function deleteMock(request: Request, env: ContentEnv, rawId: string | undefined, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await guardDelete(request, env);
  if (denied) return denied;
  const id = parseId(rawId);
  if (!id) return fail(404, 'not_found', CONTENT_ADMIN_MSG.not_found);
  const at = (deps.now ?? (() => new Date()))().toISOString();
  try {
    const [, del] = await env.DB.batch([
      env.DB.prepare('UPDATE mcqs SET mock_id = NULL WHERE mock_id = ?1 AND EXISTS (SELECT 1 FROM mocks WHERE id = ?1 AND deleted_at IS NULL)').bind(id),
      env.DB.prepare('UPDATE mocks SET deleted_at = ?2, visible = 0 WHERE id = ?1 AND deleted_at IS NULL').bind(id, at),
    ]);
    if (del.meta.changes !== 1) return fail(404, 'not_found', CONTENT_ADMIN_MSG.not_found);
    return ok({ id });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

// ======================= Notes (E20) =======================

export interface AdminNoteRow {
  id: number;
  slug: string;
  title: string;
  subject: string;
  summary: string | null;
  visible: boolean;
  updatedAt: string;
}

/** E20 GET: list (matn ke baghair), ya ?id= par poora note (badalne ke liye) */
export async function listNotes(request: Request, env: ContentEnv): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const u = new URL(request.url);
  try {
    if (u.searchParams.has('id')) {
      const id = parseId(u.searchParams.get('id') ?? undefined);
      const n = id
        ? await env.DB.prepare('SELECT id, slug, title, subject, summary, body_md, visible FROM notes WHERE id = ?1 AND deleted_at IS NULL').bind(id).first<{ id: number; slug: string; title: string; subject: string; summary: string | null; body_md: string; visible: number }>()
        : null;
      if (!n) return fail(404, 'not_found', CONTENT_ADMIN_MSG.not_found);
      return ok({ note: { id: n.id, slug: n.slug, title: n.title, subject: n.subject, summary: n.summary, body: n.body_md, visible: n.visible === 1 } });
    }
    const offset = offsetOf(u);
    const { results } = await env.DB.prepare(
      `SELECT id, slug, title, subject, summary, visible, updated_at FROM notes WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ${LIST_PAGE + 1} OFFSET ${offset}`,
    ).all<{ id: number; slug: string; title: string; subject: string; summary: string | null; visible: number; updated_at: string }>();
    const items: AdminNoteRow[] = results.slice(0, LIST_PAGE).map((r) => ({ id: r.id, slug: r.slug, title: r.title, subject: r.subject, summary: r.summary, visible: r.visible === 1, updatedAt: r.updated_at }));
    return ok({ items, hasMore: results.length > LIST_PAGE });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

const NoteBody = v.variant('action', [
  v.object({ action: v.literal('visible'), id: v.number(), visible: v.boolean() }),
  v.object({
    action: v.literal('save'),
    id: v.number(),
    title: v.pipe(v.string(), v.maxLength(500)),
    subject: v.pipe(v.string(), v.maxLength(100)),
    summary: v.pipe(v.string(), v.maxLength(1000)),
    body: v.pipe(v.string(), v.maxLength(PARSER_LIMITS.noteBody + 5000)),
  }),
]);

const BODY_BREAKERS = /^\s*(?:-{3,}|#\s*(?:mcq|mock|note|job|end\s*mock))\s*$/im;
const BODY_MSG = 'Matn mein akeli "---" ya "# MCQ/# NOTE…" wali line na likhein.';

export function noteFromForm(f: { title: string; subject: string; summary: string; body: string }, subjects: readonly string[]) {
  // Matn ke andar aisi line note ko wahin khatam kar deti hai (parser ka format)
  if (BODY_BREAKERS.test(f.body)) return { ok: false as const, message: BODY_MSG };
  const text = ['# NOTE', `Unwan: ${one(f.title)}`, `Mazmoon: ${one(f.subject)}`, `Khulasa: ${one(f.summary)}`, 'Matn:', f.body.replace(/\r\n?/g, '\n'), '---'].join('\n');
  const r = parseContent(text, { subjects });
  if (r.errors.length) {
    const e = r.errors[0].message;
    // Matn ke andar `---` ya `# MCQ` jaisi line note ko wahin khatam kar deti hai
    const msg = /ke andar nahin|ke andar sirf|pehle "# MOCK"/.test(e) ? 'Matn mein akeli "---" ya "# MCQ/# NOTE…" wali line na likhein.' : formMsg(e);
    return { ok: false as const, message: msg };
  }
  if (r.items.length !== 1) return { ok: false as const, message: 'Matn mein akeli "---" ya "# MCQ/# NOTE…" wali line na likhein.' };
  return { ok: true as const, note: r.items[0] as ParsedNote };
}

/** E20 POST: { action:'visible', id, visible } ya { action:'save', id, … } — slug KABHI nahin badalta (F12-AC4) */
export async function saveNote(request: Request, env: ContentEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await guardPost(request, env);
  if (denied) return denied;
  const body = await readJson(request, 64 * 1024);
  if (!body.ok) return body.res;
  const p = v.safeParse(NoteBody, body.data);
  if (!p.success) return fail(400, 'invalid', CONTENT_ADMIN_MSG.invalid);
  const at = (deps.now ?? (() => new Date()))().toISOString();
  const db = env.DB;
  try {
    if (p.output.action === 'visible') {
      const res = await db.prepare('UPDATE notes SET visible = CAST(?1 AS INTEGER), updated_at = ?3 WHERE id = ?2 AND deleted_at IS NULL').bind(p.output.visible ? 1 : 0, p.output.id, at).run();
      if (res.meta.changes !== 1) return fail(404, 'not_found', CONTENT_ADMIN_MSG.not_found);
      return ok({ id: p.output.id, visible: p.output.visible });
    }
    const { subjects } = await getSettings(db);
    const r = noteFromForm(p.output, subjects);
    if (!r.ok) return fail(400, 'invalid', r.message);
    const n = r.note;
    const res = await db
      .prepare('UPDATE notes SET title = ?1, subject = ?2, summary = ?3, body_md = ?4, updated_at = ?5 WHERE id = ?6 AND deleted_at IS NULL')
      .bind(n.title, n.subject, n.summary, n.body, at, p.output.id)
      .run();
    if (res.meta.changes !== 1) return fail(404, 'not_found', CONTENT_ADMIN_MSG.not_found);
    return ok({ id: p.output.id });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/** E20 DELETE (F12-AC5): deleted_at → URL 410 (Qadam 12) */
export async function deleteNote(request: Request, env: ContentEnv, rawId: string | undefined, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = await guardDelete(request, env);
  if (denied) return denied;
  const id = parseId(rawId);
  if (!id) return fail(404, 'not_found', CONTENT_ADMIN_MSG.not_found);
  const at = (deps.now ?? (() => new Date()))().toISOString();
  try {
    const res = await env.DB.prepare('UPDATE notes SET deleted_at = ?2, visible = 0, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NULL').bind(id, at).run();
    if (res.meta.changes !== 1) return fail(404, 'not_found', CONTENT_ADMIN_MSG.not_found);
    return ok({ id });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

