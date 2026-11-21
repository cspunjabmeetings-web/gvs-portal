// spec: 10.1 (D1), F24-AC1..AC7, SA9, SA15, F19-AC7, F09-AC4; CHANGE REQUEST Qadam 17a (preview noindex)
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { startD1 } from './helpers/d1';
import { makeOrder } from './helpers/admin';
import {
  runMaintenance,
  isDailySlot,
  freshMcqCount,
  AUTO_CANCEL_REASON,
  LOW_MCQ_MIN,
  type MaintenanceResult,
} from '../src/lib/maintenance';
import { listOrders } from '../src/lib/admin-orders';
import { isPreviewHost } from '../src/lib/api';
import { adminReq, SECRET } from './helpers/admin';

let d1: Awaited<ReturnType<typeof startD1>>;
const H = 3_600_000;
const DAY = 24 * H;
// 20 Nov 2026 3:00 PM Pakistan
const NOW = new Date('2026-11-20T10:00:00Z');
const env = () => ({ DB: d1.db, IMAGES: d1.images });
// Tests mein din wali dafa (sab kaam); 15 min wali alag test mein
const run = (now = NOW) => runMaintenance(env(), now, { daily: true });

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

const order = (id: string) => d1.db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Record<string, unknown>>();
const count = async (sql: string, ...b: unknown[]) => (await d1.db.prepare(sql).bind(...b).first<{ n: number }>())!.n;
const at = (ms: number) => new Date(NOW.getTime() - ms);

/** Bina koi kaam ke 70+ taza sawal (taake low_mcq_bank shor na kare) */
async function enoughMcqs(n = LOW_MCQ_MIN) {
  await d1.db
    .prepare(
      `WITH RECURSIVE c(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM c WHERE i < ?1)
       INSERT INTO mcqs (subject, question, options_json, answer_index, verified, created_at)
       SELECT 'English', 'Sawal ' || i, '["a","b"]', 0, 1, '2026-11-01T00:00:00Z' FROM c`,
    )
    .bind(n)
    .run();
}

describe('F24-AC1: bina payment order khud cancel', () => {
  it('49 ghante purana new → cancelled + wajah + event system + notification; 47 ghante wala nahin', async () => {
    await enoughMcqs();
    const old = await makeOrder(d1.db, { now: at(49 * H) });
    const fresh = await makeOrder(d1.db, { now: at(47 * H) });
    const r = await run();
    expect(r.autoCancelled).toBe(1);
    expect(r.failed).toEqual([]);
    expect(await order(old)).toMatchObject({ status: 'cancelled', cancel_reason: AUTO_CANCEL_REASON, updated_at: NOW.toISOString() });
    expect((await order(fresh))!.status).toBe('new');
    const ev = await d1.db.prepare('SELECT from_status, to_status, "by" FROM order_events WHERE order_id = ? AND to_status = ?').bind(old, 'cancelled').first();
    expect(ev).toEqual({ from_status: 'new', to_status: 'cancelled', by: 'system' });
    const n = await d1.db.prepare("SELECT message FROM notifications WHERE type = 'auto_cancelled'").all<{ message: string }>();
    expect(n.results.map((x) => x.message)).toEqual([`Order ${old}: 48 ghante mein payment nahin aayi, khud cancel ho gaya`]);
    expect(n.results[0].message).not.toMatch(/Ali|0300|923/);
  });

  it('paid/pending/complete purane orders nahin chhue jate; settings ke ghante (A-…) mane jate hain', async () => {
    await enoughMcqs();
    const ids: string[] = [];
    for (const s of ['paid', 'pending', 'complete']) {
      const id = await makeOrder(d1.db, { now: at(100 * H) });
      await d1.db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(s, id).run();
      ids.push(id);
    }
    await d1.db.prepare("UPDATE settings SET value = '5' WHERE key = 'auto_cancel_hours'").run();
    const six = await makeOrder(d1.db, { now: at(6 * H) });
    const r = await run();
    expect(r.autoCancelled).toBe(1);
    expect((await order(six))!.status).toBe('cancelled');
    for (const [i, s] of ['paid', 'pending', 'complete'].entries()) expect((await order(ids[i]))!.status).toBe(s);
  });
});

describe('F24-AC2: band job ki tasveer keep_days baad', () => {
  async function job(lastDate: string, key: string) {
    const r = await d1.db
      .prepare(
        `INSERT INTO jobs (slug, org, post, last_date, official_url, image_key, created_at, updated_at)
         VALUES (?1, 'PPSC', 'Educator', ?2, 'https://ppsc.gop.pk', ?3, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z') RETURNING id`,
      )
      .bind(`job-${lastDate}`, lastDate, key)
      .first<{ id: number }>();
    await d1.images.put(key, new Uint8Array([1, 2, 3]));
    return r!.id;
  }
  it('akhri tareekh + 31 din → R2 aur DB dono se gayi; 29 din wali aur khuli job wali bachi', async () => {
    await enoughMcqs();
    const gone = await job('2026-10-20', 'jobs/1-a.webp'); // 31 din pehle (PKT 20 Nov)
    const kept = await job('2026-10-22', 'jobs/2-b.webp'); // 29 din
    const open = await job('2026-12-01', 'jobs/3-c.webp');
    const r = await run();
    expect(r.imagesRemoved).toBe(1);
    const key = async (id: number) => (await d1.db.prepare('SELECT image_key FROM jobs WHERE id = ?').bind(id).first<{ image_key: string | null }>())!.image_key;
    expect(await key(gone)).toBeNull();
    expect(await d1.images.get('jobs/1-a.webp')).toBeNull();
    expect(await key(kept)).toBe('jobs/2-b.webp');
    expect(await d1.images.head('jobs/2-b.webp')).not.toBeNull();
    expect(await key(open)).toBe('jobs/3-c.webp');
  });

  it('R2 na ho to DB nahin badalta (agli dafa dobara); baqi kaam phir bhi chalte hain', async () => {
    await enoughMcqs();
    const id = await job('2026-09-01', 'jobs/9-z.webp');
    const old = await makeOrder(d1.db, { now: at(49 * H) });
    const r = await runMaintenance({ DB: d1.db }, NOW, { daily: true });
    expect(r.failed).toEqual(['jobImages']);
    expect(r.autoCancelled).toBe(1);
    expect((await order(old))!.status).toBe('cancelled');
    expect((await d1.db.prepare('SELECT image_key FROM jobs WHERE id = ?').bind(id).first<{ image_key: string }>())!.image_key).toBe('jobs/9-z.webp');
  });
});

describe('F24-AC3 / SA15: 90 din baad naam/phone/last4 khali', () => {
  it('91 din purana complete aur cancelled → khali, admin card "purged"; 89 din aur paid wala nahin', async () => {
    await enoughMcqs();
    const mk = async (status: string, ageDays: number) => {
      const id = await makeOrder(d1.db, { now: at(200 * DAY) });
      const t = at(ageDays * DAY).toISOString();
      await d1.db
        .prepare('UPDATE orders SET status = ?1, completed_at = ?2, updated_at = ?3 WHERE id = ?4')
        .bind(status, status === 'complete' ? t : null, t, id)
        .run();
      return id;
    };
    const c91 = await mk('complete', 91);
    const x91 = await mk('cancelled', 91);
    const c89 = await mk('complete', 89);
    const p200 = await mk('paid', 200);
    const r = await run();
    expect(r.purged).toBe(2);
    for (const id of [c91, x91]) expect(await order(id)).toMatchObject({ name: '', phone: '', phone_last4: '' });
    for (const id of [c89, p200]) expect((await order(id))!.name).toBe('Ali Raza');
    const list = await listOrders(await adminReq('/api/admin/orders?filter=all'), { DB: d1.db, SESSION_SECRET: SECRET });
    const items = (list.body as { orders: { id: string; purged: boolean }[] }).orders;
    expect(items.find((o) => o.id === c91)!.purged).toBe(true);
    expect(items.find((o) => o.id === c89)!.purged).toBe(false);
  });
});

describe('F24-AC4: sawal kam → low_mcq_bank din mein ek dafa', () => {
  it('69 taza sawal → notification; dobara chalne par nahin; agle din phir', async () => {
    await enoughMcqs(LOW_MCQ_MIN - 1);
    expect((await run()).lowMcqNotified).toBe(true);
    expect((await run(new Date(NOW.getTime() + 15 * 60_000))).lowMcqNotified).toBe(false);
    const msgs = await d1.db.prepare("SELECT message FROM notifications WHERE type = 'low_mcq_bank'").all<{ message: string }>();
    expect(msgs.results).toEqual([{ message: `Rozana test ke sawal kam hain: 69 naye jaanche hue sawal bache. Agle 7 din ke liye ${LOW_MCQ_MIN} chahiye.` }]);
    expect((await run(new Date(NOW.getTime() + DAY))).lowMcqNotified).toBe(true);
  });

  it('70 taza → nahin; pichhle 15 din (aur aage) ke pins wale sawal taza nahin gine jate; na-jaanche nahin', async () => {
    await enoughMcqs(LOW_MCQ_MIN);
    expect((await run()).lowMcqNotified).toBe(false);
    await d1.db.prepare("INSERT INTO mcqs (subject, question, options_json, answer_index, verified, created_at) VALUES ('Urdu', 'x', '[\"a\",\"b\"]', 0, 0, ?)").bind(NOW.toISOString()).run();
    await d1.db.prepare("INSERT INTO daily_pins (date, mcq_ids_json, source) VALUES ('2026-11-10', '[1,2,3]', 'auto'), ('2026-11-25', '[4]', 'pin'), ('2026-10-01', '[5]', 'auto')").run();
    expect(await freshMcqCount(d1.db, NOW)).toBe(LOW_MCQ_MIN - 4);
    expect((await run()).lowMcqNotified).toBe(true);
  });
});

describe('F24-AC5: purani rate_limits', () => {
  it('1 din se purani rows gayin; chalti rok bachi', async () => {
    await enoughMcqs();
    await d1.db
      .prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 5), (?3, ?4, 5)')
      .bind('old', at(25 * H).toISOString(), 'live', at(10 * 60_000).toISOString())
      .run();
    expect((await run()).rateLimitsDeleted).toBe(1);
    const keys = await d1.db.prepare('SELECT key FROM rate_limits').all<{ key: string }>();
    expect(keys.results.map((k) => k.key)).toEqual(['live']);
  });
});

describe('F24-AC7: idempotent', () => {
  it('poora maintenance do dafa: doosri dafa koi tabdeeli nahin; DB ki ginti wahi', async () => {
    await enoughMcqs(10);
    await makeOrder(d1.db, { now: at(49 * H) });
    const done = await makeOrder(d1.db, { now: at(200 * DAY) });
    await d1.db.prepare("UPDATE orders SET status = 'complete', completed_at = ?1 WHERE id = ?2").bind(at(100 * DAY).toISOString(), done).run();
    await d1.db.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES ('k', ?1, 1)").bind(at(2 * DAY).toISOString()).run();
    const first = await run();
    expect(first).toMatchObject({ autoCancelled: 1, purged: 1, lowMcqNotified: true, failed: [] });
    // makeOrder ke purane waqt wali rate_limits rows bhi saaf hoti hain (k + order ki rows)
    expect(first.rateLimitsDeleted).toBeGreaterThanOrEqual(1);
    const snap = async () => ({
      ev: await count('SELECT COUNT(*) AS n FROM order_events'),
      no: await count('SELECT COUNT(*) AS n FROM notifications'),
      orders: (await d1.db.prepare('SELECT id, status, name, updated_at FROM orders ORDER BY id').all()).results,
    });
    const before = await snap();
    const second: MaintenanceResult = await run(new Date(NOW.getTime() + 15 * 60_000));
    expect(second).toEqual({ autoCancelled: 0, imagesRemoved: 0, purged: 0, lowMcqNotified: false, rateLimitsDeleted: 0, failed: [] });
    expect(await snap()).toEqual(before);
  });
});

describe('FX-02: bhari kaam din mein ek dafa (9:00–9:14 PKT), halke har 15 min', () => {
  it('isDailySlot', () => {
    expect(isDailySlot(new Date('2026-11-20T04:00:00Z'))).toBe(true); // 9:00 PKT
    expect(isDailySlot(new Date('2026-11-20T04:14:59Z'))).toBe(true);
    expect(isDailySlot(new Date('2026-11-20T04:15:00Z'))).toBe(false);
    expect(isDailySlot(new Date('2026-11-20T03:59:00Z'))).toBe(false);
    expect(isDailySlot(NOW)).toBe(false); // 3 PM
  });
  it('3 PM wali dafa: auto-cancel + rate_limits; purge/tasveer/ginti nahin. 9:00 wali: sab', async () => {
    await enoughMcqs(5);
    const old = await makeOrder(d1.db, { now: at(49 * H) });
    const done = await makeOrder(d1.db, { now: at(200 * DAY) });
    await d1.db.prepare("UPDATE orders SET status = 'complete', completed_at = ?1 WHERE id = ?2").bind(at(100 * DAY).toISOString(), done).run();
    const r = await runMaintenance(env(), NOW);
    expect(r).toMatchObject({ autoCancelled: 1, purged: 0, lowMcqNotified: false, failed: [] });
    expect((await order(old))!.status).toBe('cancelled');
    expect((await order(done))!.name).toBe('Ali Raza');
    const morning = await runMaintenance(env(), new Date('2026-11-21T04:05:00Z'));
    expect(morning).toMatchObject({ purged: 1, lowMcqNotified: true, failed: [] });
  });
});

describe('F24-AC6: sirf Cron Trigger (request par nahin)', () => {
  const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
  it('wrangler.toml: main = src/worker.ts aur har 15 minute cron', () => {
    const w = src('wrangler.toml');
    expect(w).toMatch(/^main = "src\/worker\.ts"$/m);
    expect(w).toMatch(/\[triggers\]\s*\ncrons = \["\*\/15 \* \* \* \*"\]/);
  });
  it('worker.ts: fetch = adapter ka handle, scheduled → runMaintenance', () => {
    const w = src('src/worker.ts');
    expect(w).toMatch(/fetch: handle/);
    expect(w).toMatch(/async scheduled\([^)]*\)[\s\S]*runMaintenance\(/);
  });
  it('src/pages aur middleware mein maintenance kahin import nahin', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else files.push(p);
      }
    };
    walk(join(process.cwd(), 'src'));
    const users = files.filter((f) => /maintenance['"]/.test(readFileSync(f, 'utf8'))).map((f) => f.replace(/\\/g, '/').replace(/.*\/src\//, 'src/'));
    expect(users).toEqual(['src/worker.ts']);
  });
});

describe('CHANGE REQUEST 17a: preview (*.workers.dev) noindex', () => {
  it('isPreviewHost', () => {
    expect(isPreviewHost('gvs-portal.abc.workers.dev')).toBe(true);
    expect(isPreviewHost('workers.dev')).toBe(true);
    expect(isPreviewHost('gvsacademy.pk')).toBe(false);
    expect(isPreviewHost('workers.dev.evil.pk')).toBe(false);
    expect(isPreviewHost('localhost')).toBe(false);
  });
  it('public/_headers static pages ke liye workers.dev par X-Robots-Tag; production domain par nahin', () => {
    const h = readFileSync(join(process.cwd(), 'public/_headers'), 'utf8');
    // 17b: asal host <worker>.<account>.workers.dev (do hisse) — placeholder ek hi hissa pakadta hai
    expect(h).toMatch(/^https:\/\/:worker\.:account\.workers\.dev\/\*\n {2}X-Robots-Tag: noindex, nofollow$/m);
    expect(h.split('\n').filter((l) => /^\S/.test(l) && !l.startsWith('#'))).toEqual(['https://:worker.:account.workers.dev/*']);
  });
});

describe('Qadam 17b: static pages bina redirect', () => {
  it('wrangler.toml assets: html_handling = drop-trailing-slash (warna /about → 307 /about/)', () => {
    const w = readFileSync(join(process.cwd(), 'wrangler.toml'), 'utf8');
    expect(w).toMatch(/\[assets\][^[]*\nhtml_handling = "drop-trailing-slash"/);
  });
});
