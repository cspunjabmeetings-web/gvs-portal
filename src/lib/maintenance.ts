// spec: F24-AC1..AC7, SA9 (Cron Trigger har 15 min, request par nahin), SA15 (90 din purge), SA7 (event by 'system'),
//       F19-AC7 (band job ki tasveer keep_days baad), F09-AC4 (low_mcq_bank din mein ek), FX-02 (D1 kharcha)
// Sirf `scheduled` handler (src/worker.ts) se chalta hai. Har kaam idempotent aur alag try/catch mein.
// Log/notification mein naam/phone kabhi nahin (qaida 11) — sirf ginti aur order number.
import { getSettings } from './settings';
import { notifyLowMcqBank } from './notify';
import { cleanVuStats } from './vu-stats';
import { pkDate, addDays } from './pkdate';
import { NO_REPEAT_DAYS, DAILY_COUNT } from './daily';

export interface MaintenanceEnv {
  DB: D1Database;
  IMAGES?: R2Bucket;
}

export const AUTO_CANCEL_REASON = 'Payment waqt par nahin aayi';
export const PURGE_DAYS = 90;
/** F24-AC4: agle 7 din × 10 sawal */
export const LOW_MCQ_DAYS = 7;
export const LOW_MCQ_MIN = LOW_MCQ_DAYS * DAILY_COUNT;
/** Sab se lambi rate-limit window 1 ghanta; 1 din purani row kisi kaam ki nahin */
export const RATE_LIMIT_KEEP_MS = 24 * 60 * 60 * 1000;
/** Ek dafa mein had (free plan ka CPU/D1 kharcha); baqi agli dafa (15 min baad) */
export const BATCH_ORDERS = 50;
export const BATCH_IMAGES = 100;
export const BATCH_PURGE = 500;
/**
 * FX-02: bhari kaam (tasveerein, 90 din purge, sawal ki ginti) din mein ek dafa — subah 9:00–9:14 (Pakistan) wali cron dafa.
 * Har 15 min sirf halke, index wale kaam (auto-cancel, rate_limits). queries.cost.test ne pakda: ginti har dafa poori mcqs parhti.
 */
export const DAILY_SLOT_PKT = { hour: 9, minuteBelow: 15 };

/** Kya yeh cron dafa din wali hai? (Pakistan UTC+5, DST nahin) */
export function isDailySlot(now: Date): boolean {
  const pk = new Date(now.getTime() + 5 * 3_600_000);
  return pk.getUTCHours() === DAILY_SLOT_PKT.hour && pk.getUTCMinutes() < DAILY_SLOT_PKT.minuteBelow;
}

export interface MaintenanceResult {
  autoCancelled: number;
  imagesRemoved: number;
  purged: number;
  lowMcqNotified: boolean;
  rateLimitsDeleted: number;
  /** Jo kaam fail hue (sirf naam; baqi kaam phir bhi chale) */
  failed: string[];
}

const DAY = 24 * 60 * 60 * 1000;

/** F24-AC1: `new` order jo auto_cancel_hours se purana ho → cancelled + event 'system' + notification */
export async function autoCancel(db: D1Database, hours: number, now: Date): Promise<number> {
  const at = now.toISOString();
  const cutoff = new Date(now.getTime() - hours * 3_600_000).toISOString();
  const { results } = await db
    .prepare(`SELECT id FROM orders WHERE status = 'new' AND created_at < ?1 ORDER BY created_at LIMIT ${BATCH_ORDERS}`)
    .bind(cutoff)
    .all<{ id: string }>();
  if (!results.length) return 0;
  const stmts: D1PreparedStatement[] = [];
  for (const { id } of results) {
    stmts.push(
      // Beech mein admin ne Paid kar diya ho to kuch nahin (status = 'new' ki shart)
      db
        .prepare(`UPDATE orders SET status = 'cancelled', cancel_reason = ?1, updated_at = ?2 WHERE id = ?3 AND status = 'new' AND created_at < ?4`)
        .bind(AUTO_CANCEL_REASON, at, id, cutoff),
      db
        .prepare(`INSERT INTO order_events (order_id, from_status, to_status, "by", at) SELECT ?1, 'new', 'cancelled', 'system', ?2 WHERE changes() = 1`)
        .bind(id, at),
      db
        .prepare(`INSERT INTO notifications (type, order_id, message, created_at) SELECT 'auto_cancelled', ?1, ?2, ?3 WHERE changes() = 1`)
        .bind(id, `Order ${id}: ${hours} ghante mein payment nahin aayi, khud cancel ho gaya`, at),
    );
  }
  const res = await db.batch(stmts);
  let n = 0;
  for (let i = 0; i < res.length; i += 3) n += res[i].meta.changes === 1 ? 1 : 0;
  return n;
}

/** F24-AC2: band job ki tasveer akhri tareekh ke keepDays baad: pehle R2, phir DB (R2 fail → DB wahi, agli dafa dobara) */
export async function removeOldJobImages(db: D1Database, images: R2Bucket | undefined, keepDays: number, now: Date): Promise<number> {
  const before = addDays(pkDate(now), -keepDays);
  const { results } = await db
    .prepare(`SELECT id, image_key FROM jobs WHERE image_key IS NOT NULL AND last_date < ?1 ORDER BY last_date LIMIT ${BATCH_IMAGES}`)
    .bind(before)
    .all<{ id: number; image_key: string }>();
  if (!results.length) return 0;
  if (!images) throw new Error('R2 binding nahin');
  await images.delete(results.map((r) => r.image_key));
  const res = await db.batch(results.map((r) => db.prepare('UPDATE jobs SET image_key = NULL WHERE id = ?1 AND image_key = ?2').bind(r.id, r.image_key)));
  return res.reduce((s, r) => s + (r.meta.changes ?? 0), 0);
}

/** F24-AC3 / SA15: complete/cancelled ke 90 din baad naam, phone, phone_last4 khali */
export async function purgeOldOrders(db: D1Database, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - PURGE_DAYS * DAY).toISOString();
  const res = await db
    .prepare(
      `UPDATE orders SET name = '', phone = '', phone_last4 = ''
       WHERE id IN (
         SELECT id FROM orders
         WHERE status IN ('complete', 'cancelled') AND COALESCE(completed_at, updated_at) < ?1
           AND (name <> '' OR phone <> '' OR phone_last4 <> '')
         LIMIT ${BATCH_PURGE}
       )`,
    )
    .bind(cutoff)
    .run();
  return res.meta.changes ?? 0;
}

/** F24-AC4: rozana test ke liye taza jaanche hue sawal (pichhle 15 din aur aage ke pins ke ilawa) */
export async function freshMcqCount(db: D1Database, now: Date): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM mcqs WHERE verified = 1 AND id NOT IN (
         SELECT j.value FROM daily_pins AS p, json_each(p.mcq_ids_json) AS j WHERE p.date >= ?1
       )`,
    )
    .bind(addDays(pkDate(now), -NO_REPEAT_DAYS))
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function checkLowMcqBank(db: D1Database, now: Date): Promise<boolean> {
  const n = await freshMcqCount(db, now);
  if (n >= LOW_MCQ_MIN) return false;
  return notifyLowMcqBank(db, `Rozana test ke sawal kam hain: ${n} naye jaanche hue sawal bache. Agle ${LOW_MCQ_DAYS} din ke liye ${LOW_MCQ_MIN} chahiye.`, now);
}

/** F24-AC5: purani rate_limits rows */
export async function cleanRateLimits(db: D1Database, now: Date): Promise<number> {
  const res = await db.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(new Date(now.getTime() - RATE_LIMIT_KEEP_MS).toISOString()).run();
  return res.meta.changes ?? 0;
}

/** SA9: maintenance. Ek kaam fail ho to baqi chalte hain. `daily` na diya ho to cron ke waqt se (isDailySlot). */
export async function runMaintenance(env: MaintenanceEnv, now: Date = new Date(), opts: { daily?: boolean } = {}): Promise<MaintenanceResult> {
  const daily = opts.daily ?? isDailySlot(now);
  const out: MaintenanceResult = { autoCancelled: 0, imagesRemoved: 0, purged: 0, lowMcqNotified: false, rateLimitsDeleted: 0, failed: [] };
  const db = env.DB;
  let s: Awaited<ReturnType<typeof getSettings>> | null = null;
  try {
    s = await getSettings(db);
  } catch {
    out.failed.push('settings');
  }
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch {
      out.failed.push(name);
    }
  };
  if (s) {
    const settings = s;
    await step('autoCancel', async () => {
      out.autoCancelled = await autoCancel(db, settings.auto_cancel_hours, now);
    });
    if (daily) {
      await step('jobImages', async () => {
        out.imagesRemoved = await removeOldJobImages(db, env.IMAGES, settings.job_image_keep_days, now);
      });
    }
  }
  if (daily) {
    await step('purge', async () => {
      out.purged = await purgeOldOrders(db, now);
    });
    await step('lowMcqBank', async () => {
      out.lowMcqNotified = await checkLowMcqBank(db, now);
    });
  }
  if (daily) await step('vuStats', async () => void (await cleanVuStats(db, now))); // F34-AC6
  await step('rateLimits', async () => {
    out.rateLimitsDeleted = await cleanRateLimits(db, now);
  });
  return out;
}
