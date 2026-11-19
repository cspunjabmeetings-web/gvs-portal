// spec: E17 POST /api/admin/content/import (F11-AC3..AC6, AC8..AC10), E18 GET /api/admin/mcqs?hashes= (F11-AC7, P-07),
//       8.7 (har tukra parser.ts se dobara jaanch; chhote tukre), 9.4 (≤ 600 KB), FX-03, 9.2 (CSRF)
import * as v from 'valibot';
import { fail, ok, readJson, API_MSG, type ApiResult } from './api';
import { adminPost, requireAdmin } from './admin-auth';
import { getSettings } from './settings';
import { parseContent, qHash, type ParsedMcq, type ParsedMock, type ParsedNote } from './parser';
import { CHUNK, IMPORT_BODY_LIMIT } from './content-chunks';
import { slugify, uniqueSlug } from './slug';

export interface ContentEnv {
  DB: D1Database;
  SESSION_SECRET?: string;
}

export const IMPORT_MSG = {
  invalid: 'Is hisse mein ghaltiyan hain; kuch save nahin hua. Preview dobara dekhein.',
  empty: 'Save karne ke liye koi cheez nahin mili.',
  job: 'Job yahan save nahin hoti; Jobs tab (Qadam 13) mein daalein.',
  chunk: 'Ek dafa mein 25 sawal, ya 1 mock, ya 5 notes bhejein.',
  conflict: 'Isi waqt doosra save chal raha tha. Dobara koshish karein.',
  hashes: 'Sawalon ki pehchan (hash) sahih shakal mein nahin.',
} as const;

const ImportBody = v.object({
  text: v.pipe(v.string(), v.minLength(1), v.maxLength(IMPORT_BODY_LIMIT)),
  verified: v.boolean(),
});

type McqRow = { s: string; q: string; o: string; a: number; e: string | null; d: string | null; t: string | null; h: string };

async function mcqRows(list: ParsedMcq[]): Promise<McqRow[]> {
  return Promise.all(
    list.map(async (m) => ({
      s: m.subject,
      q: m.question,
      o: JSON.stringify(m.options),
      a: m.answerIndex,
      e: m.explanation,
      d: m.difficulty,
      t: m.asOfDate,
      h: await qHash(m.question),
    })),
  );
}

/** Ek query mein saare sawal (D1: ek query mein 100 bound parameters tak — is liye JSON + json_each) */
function insertMcqs(db: D1Database, rows: McqRow[], verified: boolean, at: string, mockSlug: string | null): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO mcqs (subject, question, options_json, answer_index, explanation, difficulty, as_of_date, verified, mock_id, created_at, q_hash)
       SELECT json_extract(value, '$.s'), json_extract(value, '$.q'), json_extract(value, '$.o'), json_extract(value, '$.a'),
              json_extract(value, '$.e'), json_extract(value, '$.d'), json_extract(value, '$.t'), CAST(?2 AS INTEGER),
              ${mockSlug === null ? 'NULL' : '(SELECT id FROM mocks WHERE slug = ?4)'}, ?3, json_extract(value, '$.h')
       FROM json_each(?1) ORDER BY key`,
    )
    .bind(...[JSON.stringify(rows), verified ? 1 : 0, at, ...(mockSlug === null ? [] : [mockSlug])]);
}

/** `base` aur `base-N` jo pehle se hain (mitaye hue samet — un ka URL 410 rehta hai) */
export async function takenSlugs(db: D1Database, table: 'mocks' | 'notes' | 'jobs', bases: string[]): Promise<Set<string>> {
  const taken = new Set<string>();
  for (const base of new Set(bases)) {
    // slug mein sirf a-z 0-9 - hain, is liye LIKE mein escape ki zaroorat nahin
    const { results } = await db.prepare(`SELECT slug FROM ${table} WHERE slug = ?1 OR slug LIKE ?2`).bind(base, `${base}-%`).all<{ slug: string }>();
    for (const r of results) taken.add(r.slug);
  }
  return taken;
}

/** E17: ek tukra save. Ghalat ho to kuch bhi nahin (400). */
export async function importChunk(request: Request, env: ContentEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? adminPost(request);
  if (denied) return denied;
  const body = await readJson(request, IMPORT_BODY_LIMIT + 1024);
  if (!body.ok) return body.res;
  const p = v.safeParse(ImportBody, body.data);
  if (!p.success) return fail(400, 'invalid', API_MSG.bad_json);
  const at = (deps.now ?? (() => new Date()))().toISOString();

  try {
    const { subjects } = await getSettings(env.DB);
    const r = parseContent(p.output.text, { subjects });
    if (r.errors.length) return { status: 400, body: { ok: false, error: { code: 'invalid', message: IMPORT_MSG.invalid, errors: r.errors.slice(0, 20) } } };
    if (!r.items.length) return fail(400, 'empty', IMPORT_MSG.empty);
    if (r.items.some((x) => x.kind === 'JOB')) return fail(400, 'job', IMPORT_MSG.job);

    const kinds = new Set(r.items.map((x) => x.kind));
    const mcqs = r.items.filter((x): x is ParsedMcq => x.kind === 'MCQ');
    const mocks = r.items.filter((x): x is ParsedMock => x.kind === 'MOCK');
    const notes = r.items.filter((x): x is ParsedNote => x.kind === 'NOTE');
    if (kinds.size !== 1 || mcqs.length > CHUNK.mcqs || mocks.length > 1 || notes.length > CHUNK.notes) return fail(400, 'chunk', IMPORT_MSG.chunk);

    const verified = p.output.verified;
    const db = env.DB;

    if (mcqs.length) {
      await db.batch([insertMcqs(db, await mcqRows(mcqs), verified, at, null)]);
      return ok({ saved: { MCQ: mcqs.length, MOCK: 0, NOTE: 0 } });
    }

    if (mocks.length) {
      const m = mocks[0];
      const base = slugify(m.name, 'mock');
      const slug = uniqueSlug(base, await takenSlugs(db, 'mocks', [base]));
      // Faisla (a): bina jaanche sawalon wala mock chhupa (visible = 0)
      await db.batch([
        db.prepare('INSERT INTO mocks (slug, name, minutes, summary, visible, created_at) VALUES (?1, ?2, CAST(?3 AS INTEGER), ?4, CAST(?5 AS INTEGER), ?6)').bind(slug, m.name, m.minutes, m.summary, verified ? 1 : 0, at),
        insertMcqs(db, await mcqRows(m.mcqs), verified, at, slug),
      ]);
      return ok({ saved: { MCQ: m.mcqs.length, MOCK: 1, NOTE: 0 }, slugs: [slug] });
    }

    // Notes: sawal nahin, is liye checkbox lagu nahin — foran visible
    const bases = notes.map((n) => slugify(n.title, 'note'));
    const taken = await takenSlugs(db, 'notes', bases);
    const slugs = bases.map((b) => {
      const s = uniqueSlug(b, taken);
      taken.add(s);
      return s;
    });
    await db.batch(
      notes.map((n, i) =>
        db.prepare('INSERT INTO notes (slug, title, subject, summary, body_md, visible, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)').bind(slugs[i], n.title, n.subject, n.summary, n.body, at),
      ),
    );
    return ok({ saved: { MCQ: 0, MOCK: 0, NOTE: notes.length }, slugs });
  } catch (e) {
    if (/UNIQUE/i.test(String((e as Error)?.message))) return fail(409, 'conflict', IMPORT_MSG.conflict);
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

export const HASHES_MAX = 100;

/** E18 GET ?hashes=h1,h2 → jo pehle se database mein hain (F11-AC7) */
export async function existingHashes(request: Request, env: ContentEnv): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const raw = new URL(request.url).searchParams.get('hashes');
  if (raw === null) return fail(400, 'hashes', IMPORT_MSG.hashes);
  const list = raw ? raw.split(',') : [];
  if (list.length > HASHES_MAX || list.some((h) => !/^[0-9a-f]{64}$/.test(h))) return fail(400, 'hashes', IMPORT_MSG.hashes);
  if (!list.length) return ok({ existing: [] });
  try {
    const { results } = await env.DB.prepare('SELECT DISTINCT q_hash AS h FROM mcqs WHERE q_hash IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(list)).all<{ h: string }>();
    return ok({ existing: results.map((r) => r.h) });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
