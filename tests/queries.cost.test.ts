// spec: 10.1 queries.cost.test (D1): har list query `meta.rows_read` ki hadd ke andar (index istemal); FX-02 (free tier: 5M reads/din)
// Golden guard (spec 13.x): agar koi query chupke se poori table parhne lage to yeh test toot jata hai.
// Tareeqa: bari table (hazaron rows) bana kar asal function chalao; har SELECT (bind ke sath) record karo, phir dobara chala kar rows_read naapo.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, SECRET, SITE } from './helpers/admin';
import { listOrders } from '../src/lib/admin-orders';
import { listNotifications } from '../src/lib/notify';
import { publicJobs, jobBySlug, latestJobs } from '../src/lib/jobs';
import { subjectCards, practiceSet } from '../src/lib/practice';
import { dailyQuestions } from '../src/lib/daily';
import { sitemapUrls } from '../src/lib/sitemap';
import { trackOrder } from '../src/lib/track';
import { publicNotes, notePage } from '../src/lib/notes';
import { publicMocks, mockBySlug } from '../src/lib/mocks';
import { runMaintenance } from '../src/lib/maintenance';

let d1: Awaited<ReturnType<typeof startD1>>;
const NOW = new Date('2026-11-20T10:00:00Z');
const N = { orders: 5000, mcqs: 3000, jobs: 600, notifications: 5000, notes: 300 };

interface Rec {
  sql: string;
  args: unknown[];
}

const REAL = Symbol('real');
type Wrapped = { [REAL]: D1PreparedStatement };

/** Statement ka wrapper: bind ki values record karta hai; batch mein asal statement jata hai */
function wrapStmt(real: D1PreparedStatement, sql: string, args: unknown[], recs: Rec[]): D1PreparedStatement {
  const rec: Rec = { sql, args };
  recs.push(rec);
  const w = {
    [REAL]: real,
    bind: (...a: unknown[]) => {
      recs.splice(recs.indexOf(rec), 1);
      return wrapStmt(real.bind(...a), sql, a, recs);
    },
    first: (col?: string) => (col === undefined ? real.first() : real.first(col)),
    all: () => real.all(),
    run: () => real.run(),
    raw: (o?: { columnNames?: boolean }) => real.raw(o as { columnNames: true }),
  };
  return w as unknown as D1PreparedStatement;
}

/** DB jo har prepare/bind record karta hai */
function recording(db: D1Database, recs: Rec[]): D1Database {
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') return (sql: string) => wrapStmt(target.prepare(sql), sql, [], recs);
      if (prop === 'batch') return (list: D1PreparedStatement[]) => target.batch(list.map((s) => (s as unknown as Wrapped)[REAL] ?? s));
      const v = Reflect.get(target, prop, target) as unknown;
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
}

/** fn chalao; us ke har SELECT ka rows_read (sab se bara) */
async function maxRowsRead(fn: (db: D1Database) => Promise<unknown>): Promise<{ max: number; sql: string }> {
  const recs: Rec[] = [];
  await fn(recording(d1.db, recs));
  let max = 0;
  let sql = '';
  for (const r of recs) {
    if (!/^\s*(SELECT|WITH)\b/i.test(r.sql)) continue;
    const res = await d1.db
      .prepare(r.sql)
      .bind(...r.args)
      .all();
    const n = res.meta.rows_read ?? 0;
    if (n > max) {
      max = n;
      sql = r.sql.replace(/\s+/g, ' ').slice(0, 160);
    }
  }
  return { max, sql };
}

beforeAll(async () => {
  d1 = await startD1();
  const db = d1.db;
  const cte = (n: number) => `WITH RECURSIVE c(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM c WHERE i < ${n})`;
  await db.batch([
    // Zyada tar purane complete orders; thore new/paid aaj ke
    db.prepare(
      `${cte(N.orders)} INSERT INTO orders (id, name, phone, phone_last4, items_json, total, status, created_at, updated_at, completed_at)
       SELECT printf('GVS-2601-%04d', i), 'Naam', '92300' || printf('%07d', i), printf('%04d', i % 10000), '[{"id":"vu-smart","name":"x","price":350,"fields":{"courseCode":"CS101"}}]', 350,
         CASE WHEN i > ${N.orders - 20} THEN 'new' WHEN i > ${N.orders - 40} THEN 'paid' ELSE 'complete' END,
         strftime('%Y-%m-%dT%H:%M:%fZ', '2026-01-01', '+' || (i * 80) || ' minutes'),
         strftime('%Y-%m-%dT%H:%M:%fZ', '2026-01-01', '+' || (i * 80) || ' minutes'),
         CASE WHEN i > ${N.orders - 40} THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%fZ', '2026-01-01', '+' || (i * 80) || ' minutes') END
       FROM c`,
    ),
    db.prepare(
      `${cte(N.mcqs)} INSERT INTO mcqs (subject, question, options_json, answer_index, verified, created_at)
       SELECT CASE i % 3 WHEN 0 THEN 'English' WHEN 1 THEN 'Urdu' ELSE 'Maths' END, 'Sawal ' || i, '["a","b","c"]', 0, i % 5 <> 0, '2026-01-01T00:00:00Z' FROM c`,
    ),
    db.prepare(
      `${cte(N.jobs)} INSERT INTO jobs (slug, org, post, last_date, official_url, created_at, updated_at)
       SELECT 'job-' || i, CASE i % 3 WHEN 0 THEN 'PPSC' WHEN 1 THEN 'FPSC' ELSE 'NTS' END, 'Post ' || i,
         date('2026-01-01', '+' || (i / 2) || ' days'), 'https://example.gov.pk', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z' FROM c`,
    ),
    db.prepare(
      `${cte(N.notifications)} INSERT INTO notifications (type, order_id, message, created_at, read_at)
       SELECT 'order_new', NULL, 'Naya order ' || i, strftime('%Y-%m-%dT%H:%M:%fZ', '2026-01-01', '+' || (i * 80) || ' minutes'),
         CASE WHEN i > ${N.notifications - 10} THEN NULL ELSE '2026-11-01T00:00:00Z' END FROM c`,
    ),
    db.prepare(
      `${cte(N.notes)} INSERT INTO notes (slug, title, subject, summary, body_md, created_at, updated_at)
       SELECT 'note-' || i, 'Note ' || i, 'English', 'Khulasa', '## A' || char(10) || 'matn', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z' FROM c`,
    ),
    db.prepare(`INSERT INTO mocks (slug, name, minutes, created_at) VALUES ('mock-1', 'Mock 1', 30, '2026-01-01T00:00:00Z')`),
    db.prepare(`UPDATE mcqs SET mock_id = 1 WHERE id <= 50`),
  ]);
}, 120_000);
afterAll(async () => d1?.dispose());

/**
 * Hadein (rows_read). Bari tables: orders 5000, mcqs 3000, jobs 600, notifications 5000, notes 300.
 * Hadd table ke size se kafi kam = index istemal ho raha hai. Jahan poori table parhna design mein hai (sitemap, mazameen ki ginti)
 * wahan hadd table ke size ke qareeb aur wajah likhi hai.
 */
const cases: [string, number, (db: D1Database) => Promise<unknown>][] = [
  ['admin orders: new filter (E11)', 400, async (db) => listOrders(await adminReq('/api/admin/orders?status=new'), { DB: db, SESSION_SECRET: SECRET }, { now: () => NOW })],
  ['admin orders: paid filter (E11)', 400, async (db) => listOrders(await adminReq('/api/admin/orders?status=paid'), { DB: db, SESSION_SECRET: SECRET }, { now: () => NOW })],
  ['admin orders: Sab (all) list', 400, async (db) => listOrders(await adminReq('/api/admin/orders?status=all'), { DB: db, SESSION_SECRET: SECRET }, { now: () => NOW })],
  ['admin notifications (E15)', 200, async (db) => listNotifications(await adminReq('/api/admin/notifications'), { DB: db, SESSION_SECRET: SECRET })],
  ['admin notifications unread=1 (E15)', 200, async (db) => listNotifications(await adminReq('/api/admin/notifications?unread=1'), { DB: db, SESSION_SECRET: SECRET })],
  ['track (E04)', 50, (db) => trackOrder(new Request(`${SITE}/api/track?id=GVS-2601-4990&last4=4990`, { headers: { 'CF-Connecting-IP': '1.2.3.4' } }), { DB: db, SESSION_SECRET: SECRET }, { now: () => NOW })],
  ['jobs list (/jobs)', 400, (db) => publicJobs(db, NOW)],
  ['job page', 100, (db) => jobBySlug(db, 'job-600', NOW)],
  ['practice set (E06)', 1200, (db) => practiceSet(db, 'English', 0)],
  ['mock page', 200, (db) => mockBySlug(db, 'mock-1')],
  ['maintenance: har 15 min wali dafa (auto-cancel, rate_limits)', 100, (db) => runMaintenance({ DB: db }, NOW)],
];

/** Yeh query design se badi hai (har mazmoon/har cheez ginti); hadd = table + kuch, taake dugna parhna pakda jaye */
const wide: [string, number, (db: D1Database) => Promise<unknown>][] = [
  ['subject cards (/mcqs): GROUP BY mazmoon', N.mcqs + 50, (db) => subjectCards(db)],
  ['daily test pool (din mein ek dafa, phir daily_pins)', N.mcqs + 50, (db) => dailyQuestions(db, NOW)],
  ['notes list (/notes, s-maxage=300)', N.notes + 50, (db) => publicNotes(db)],
  ['mocks list (/mock-tests)', N.mcqs + 50, (db) => publicMocks(db)],
  ['note page: 5 sawal ke liye mazmoon ke jaanche sawal (s-maxage=300)', N.mcqs / 3 + 50, (db) => notePage(db, 'note-5')],
  ['latest jobs (E07, s-maxage=300): jobs table chhoti (purani mitti hain)', N.jobs + 50, (db) => latestJobs(db, NOW)],
  ['maintenance: din wali dafa (9:00 PKT, din mein ek)', N.mcqs * 2 + 100, (db) => runMaintenance({ DB: db }, NOW, { daily: true })],
  ['sitemap.xml (s-maxage=3600)', N.mcqs + N.notes + N.jobs + 100, (db) => sitemapUrls(db, 'https://gvs.test', NOW)],
];

describe('queries.cost: index wali queries table ka chhota hissa parhti hain', () => {
  for (const [name, limit, fn] of cases) {
    it(`${name} ≤ ${limit} rows_read`, async () => {
      const r = await maxRowsRead(fn);
      expect(r.max, r.sql).toBeLessThanOrEqual(limit);
    });
  }
});

describe('queries.cost: poori table wali (cache ke peeche) dugna nahin parhtin', () => {
  for (const [name, limit, fn] of wide) {
    it(`${name} ≤ ${limit} rows_read`, async () => {
      const r = await maxRowsRead(fn);
      expect(r.max, r.sql).toBeLessThanOrEqual(limit);
    });
  }
});
