// spec: F12-AC7 (dohre sawal dhoondna aur hatana), E18 GET/POST /api/admin/mcqs/duplicates, 9.2
import * as v from 'valibot';
import { fail, ok, readJson, API_MSG, type ApiResult } from './api';
import { adminPost, requireAdmin } from './admin-auth';
import { CONTENT_ADMIN_MSG } from './admin-content';
import type { ContentEnv } from './content-import';
import { pkDate } from './pkdate';

export const DUP_GROUPS = 30;
export const DUP_DELETE_MAX = 100;

export interface DupMcq {
  id: number;
  subject: string;
  question: string;
  options: string[];
  answerIndex: number;
  verified: boolean;
  mockName: string | null;
  /** Kisi mock mein ya aaj/aage ke rozana test mein: kabhi nahin hatta */
  locked: boolean;
}
export interface DupGroup {
  hash: string;
  items: DupMcq[];
}

type Deps = { now?: () => Date };
const today = (d: Deps) => pkDate((d.now ?? (() => new Date()))());
/** Aaj aur aage ke rozana test (pin ya auto) ke sawal */
const PINNED = 'SELECT j.value FROM daily_pins p, json_each(p.mcq_ids_json) j WHERE p.date >= ';

type Row = { id: number; subject: string; question: string; options_json: string; answer_index: number; verified: number; q_hash: string; mock_id: number | null; mock_name: string | null; pinned: number };

/** GET: har group mein pehla = jo rahe ga (mock/pin wala, phir jaancha, phir purana) */
export async function listDuplicates(request: Request, env: ContentEnv, deps: Deps = {}): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  try {
    const [rows, total] = await env.DB.batch([
      env.DB.prepare(
        `WITH d AS (SELECT q_hash FROM mcqs WHERE q_hash IS NOT NULL GROUP BY q_hash HAVING COUNT(*) > 1 ORDER BY q_hash LIMIT ${DUP_GROUPS})
         SELECT m.id, m.subject, m.question, m.options_json, m.answer_index, m.verified, m.q_hash, m.mock_id, k.name AS mock_name, m.id IN (${PINNED} ?1) AS pinned
         FROM d JOIN mcqs m ON m.q_hash = d.q_hash LEFT JOIN mocks k ON k.id = m.mock_id
         ORDER BY m.q_hash, (m.mock_id IS NOT NULL OR pinned) DESC, m.verified DESC, m.id LIMIT 1000`,
      ).bind(today(deps)),
      env.DB.prepare('SELECT COUNT(*) AS n FROM (SELECT 1 FROM mcqs WHERE q_hash IS NOT NULL GROUP BY q_hash HAVING COUNT(*) > 1)'),
    ]);
    const groups: DupGroup[] = [];
    for (const r of rows.results as Row[]) {
      if (groups.at(-1)?.hash !== r.q_hash) groups.push({ hash: r.q_hash, items: [] });
      groups.at(-1)!.items.push({
        id: r.id,
        subject: r.subject,
        question: r.question,
        options: JSON.parse(r.options_json) as string[],
        answerIndex: r.answer_index,
        verified: r.verified === 1,
        mockName: r.mock_name,
        locked: r.mock_id !== null || r.pinned === 1,
      });
    }
    return ok({ groups, total: (total.results[0] as { n: number }).n });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

const Body = v.object({ ids: v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(1))), v.minLength(1), v.maxLength(DUP_DELETE_MAX)) });

/**
 * POST { ids }: server dobara jaanchta hai — mock/rozana test wala nahin hatta, aur wohi sawal kisi aur id par (jo is list mein nahin) bachna
 * zaroori hai. Is liye ek group kabhi khali nahin hota, aur akela (bina dohre) sawal bhi yahan se nahin mitta.
 */
export async function deleteDuplicates(request: Request, env: ContentEnv, deps: Deps = {}): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? adminPost(request);
  if (denied) return denied;
  const body = await readJson(request, 8 * 1024);
  if (!body.ok) return body.res;
  const p = v.safeParse(Body, body.data);
  if (!p.success) return fail(400, 'invalid', CONTENT_ADMIN_MSG.invalid);
  const ids = [...new Set(p.output.ids)];
  try {
    const { results } = await env.DB.prepare(
      `DELETE FROM mcqs WHERE id IN (SELECT value FROM json_each(?1)) AND mock_id IS NULL AND id NOT IN (${PINNED} ?2)
         AND EXISTS (SELECT 1 FROM mcqs o WHERE o.q_hash = mcqs.q_hash AND o.id NOT IN (SELECT value FROM json_each(?1)))
       RETURNING id`,
    )
      .bind(JSON.stringify(ids), today(deps))
      .all<{ id: number }>();
    return ok({ deleted: results.length, refused: ids.length - results.length });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
