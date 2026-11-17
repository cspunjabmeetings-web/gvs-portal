// spec: 10.1 (D1 tests ke liye chhote helpers: order banana, admin cookie, admin request)
import { createOrder } from '../../src/lib/orders';
import { signSession, COOKIE_NAME } from '../../src/lib/admin-auth';

export const SITE = 'https://gvs.test';
export const SECRET = 'test-session-secret';

export async function makeOrder(db: D1Database, o: { phone?: string; name?: string; items?: unknown[]; now?: Date } = {}): Promise<string> {
  const r = await createOrder(
    new Request(`${SITE}/api/orders`, {
      method: 'POST',
      headers: { Origin: SITE, 'Content-Type': 'application/json', 'CF-Connecting-IP': `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
      body: JSON.stringify({ name: o.name ?? 'Ali Raza', phone: o.phone ?? '0300-1234567', items: o.items ?? [{ id: 'vu-smart', fields: { courseCode: 'CS101' } }], turnstileToken: 't' }),
    }),
    { DB: db, TURNSTILE_SECRET: 'x', SESSION_SECRET: SECRET },
    { now: () => o.now ?? new Date('2026-11-17T10:00:00Z'), verify: async () => true },
  );
  const id = (r.body as { id?: string }).id;
  if (!id) throw new Error('order nahin bana: ' + JSON.stringify(r.body));
  return id;
}

export async function adminCookie(now = new Date()): Promise<string> {
  return `${COOKIE_NAME}=${await signSession(SECRET, now)}`;
}

export async function adminReq(path: string, o: { method?: string; body?: unknown; cookie?: string | null; origin?: string } = {}): Promise<Request> {
  const headers: Record<string, string> = { Origin: o.origin ?? SITE };
  if (o.cookie !== null) headers.Cookie = o.cookie ?? (await adminCookie());
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(SITE + path, { method: o.method ?? (o.body !== undefined ? 'POST' : 'GET'), headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
}
