// spec: SA5, 9.3 (rate limits), 7.2 rate_limits (key = SHA-256(secret + value), asal phone/IP kabhi nahin)
// Fixed window: pehle read (writes bachane ke liye), had ke andar ho to increment statement wapas.

export interface Limit {
  /** Hash se pehle ka hissa, maslan 'order:phone' */
  scope: string;
  value: string;
  max: number;
  windowMs: number;
}

export async function hashKey(secret: string, scope: string, value: string): Promise<string> {
  const data = new TextEncoder().encode(`${secret}|${scope}|${value}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface LimitCheck {
  allowed: boolean;
  /** Rok ho to kitni der baad khulegi (ms); warna 0 (F07-AC2 "bachay minute") */
  retryAfterMs: number;
  /** Kamyabi par yeh statement chalayein (order ke batch mein, taake sirf asal koshish gine) */
  increment: D1PreparedStatement;
}

export async function checkLimit(db: D1Database, secret: string, l: Limit, now: Date): Promise<LimitCheck> {
  const key = await hashKey(secret, l.scope, l.value);
  const since = new Date(now.getTime() - l.windowMs).toISOString();
  const row = await db.prepare('SELECT window_start, count FROM rate_limits WHERE key = ?').bind(key).first<{ window_start: string; count: number }>();
  const active = !!row && row.window_start > since;
  const allowed = !active || row.count < l.max;
  const retryAfterMs = allowed || !row ? 0 : Math.max(0, new Date(row.window_start).getTime() + l.windowMs - now.getTime());
  // SQLite UPDATE mein saare SET purani row ki values se hisab hote hain
  const increment = db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN window_start <= ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END`,
    )
    .bind(key, now.toISOString(), since);
  return { allowed, retryAfterMs, increment };
}
