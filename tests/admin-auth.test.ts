// spec: 10.1 admin-auth.test (401 baghair cookie; 5 ghalat par rok; cookie flags), F07-AC1..AC5, 9.2, 9.3
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import {
  login,
  logout,
  requireAdmin,
  guardAdminPath,
  signSession,
  verifySession,
  safeEqual,
  readCookie,
  ADMIN_MSG,
  COOKIE_NAME,
  type AdminEnv,
} from '../src/lib/admin-auth';

const SITE = 'https://gvs.test';
const PASSWORD = 'sahih-password-123';
const NOW = () => new Date('2026-11-17T10:00:00Z');
let d1: Awaited<ReturnType<typeof startD1>>;
let env: AdminEnv;

function post(path: string, body: unknown, o: { origin?: string | null; ip?: string; type?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': o.type ?? 'application/json', 'CF-Connecting-IP': o.ip ?? '10.1.1.1' };
  if (o.origin !== null) headers.Origin = o.origin ?? SITE;
  return new Request(SITE + path, { method: 'POST', headers, body: JSON.stringify(body) });
}
const tryLogin = (password: string, o: Parameters<typeof post>[2] & { now?: () => Date } = {}) => login(post('/api/admin/login', { password }, o), env, { now: o.now ?? NOW });
const withCookie = (value: string) => new Request(`${SITE}/api/admin/orders`, { headers: { Cookie: `x=1; ${COOKIE_NAME}=${value}` } });
const cookieValue = (setCookie: string) => setCookie.split(';')[0].split('=').slice(1).join('=');

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => {
  await d1.reset();
  env = { DB: d1.db, ADMIN_PASSWORD: PASSWORD, SESSION_SECRET: 'test-session-secret' };
});

describe('session cookie (F07-AC1)', () => {
  it('sign → verify; 7 din tak sahih, phir nahin', async () => {
    const v = await signSession('s', NOW());
    expect(await verifySession(v, 's', NOW())).toBe(true);
    expect(await verifySession(v, 's', new Date(NOW().getTime() + 6.9 * 864e5))).toBe(true);
    expect(await verifySession(v, 's', new Date(NOW().getTime() + 7 * 864e5 + 1))).toBe(false);
  });

  it('badla hua HMAC, doosra secret, badli expiry, kharab shakal: rad', async () => {
    const v = await signSession('s', NOW());
    const [ver, exp, mac] = v.split('.');
    const flipped = mac.slice(0, -1) + (mac.endsWith('A') ? 'B' : 'A');
    expect(await verifySession(`${ver}.${exp}.${flipped}`, 's', NOW())).toBe(false);
    expect(await verifySession(v, 'doosra', NOW())).toBe(false);
    expect(await verifySession(`${ver}.${Number(exp) + 1000}.${mac}`, 's', NOW())).toBe(false);
    for (const bad of ['', 'abc', 'v1..', 'v2.1.x', `v1.${exp}`]) expect(await verifySession(bad, 's', NOW())).toBe(false);
    expect(await verifySession(v, undefined, NOW())).toBe(false);
  });

  it('readCookie: kai cookies mein se sahih', () => {
    expect(readCookie(`a=1; ${COOKIE_NAME}=v1.x; b=2`)).toBe('v1.x');
    expect(readCookie('a=1')).toBeNull();
    expect(readCookie(null)).toBeNull();
  });

  it('safeEqual (F07-AC5)', async () => {
    expect(await safeEqual('abc', 'abc')).toBe(true);
    expect(await safeEqual('abc', 'abd')).toBe(false);
    expect(await safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('POST /api/admin/login (E10)', () => {
  it('sahih password: cookie HttpOnly; Secure; SameSite=Strict; Path=/; 7 din (F07-AC1)', async () => {
    const r = await tryLogin(PASSWORD);
    expect(r.status).toBe(200);
    const sc = r.headers?.['Set-Cookie'] ?? '';
    expect(sc.startsWith(`${COOKIE_NAME}=v1.`)).toBe(true);
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=604800']) expect(sc).toContain(flag);
    expect(await verifySession(cookieValue(sc), env.SESSION_SECRET, NOW())).toBe(true);
    expect(JSON.stringify(r.body)).not.toContain(PASSWORD);
  });

  it('ghalat: 401; 5 ghalat ke baad 6th par 429 + bachay minute; rok mein sahih bhi 429; 15 min baad khul jaye (F07-AC2)', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await tryLogin('ghalat-password-xx');
      expect(r.status).toBe(401);
      expect((r.body as { error: { message: string } }).error.message).toBe(ADMIN_MSG.wrong);
    }
    const sixth = await tryLogin('ghalat-password-xx', { now: () => new Date(NOW().getTime() + 3 * 60_000) });
    expect(sixth.status).toBe(429);
    expect((sixth.body as { error: { message: string } }).error.message).toBe(ADMIN_MSG.limited(12));
    expect((await tryLogin(PASSWORD)).status).toBe(429);
    // Doosra IP alag
    expect((await tryLogin(PASSWORD, { ip: '10.9.9.9' })).status).toBe(200);
    expect((await tryLogin(PASSWORD, { now: () => new Date(NOW().getTime() + 16 * 60_000) })).status).toBe(200);
  });

  it('rate_limits mein IP nahin, sirf hash (9.3)', async () => {
    await tryLogin('ghalat-password-xx');
    const { results } = await d1.db.prepare('SELECT key FROM rate_limits').all<{ key: string }>();
    expect(results).toHaveLength(1);
    expect(results[0].key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sahih login rate_limits mein kuch nahin likhta', async () => {
    await tryLogin(PASSWORD);
    expect(await d1.db.prepare('SELECT COUNT(*) AS c FROM rate_limits').first('c')).toBe(0);
  });

  it('Origin ghalat/ghair-maujood 403; JSON nahin to 400 (9.2 CSRF)', async () => {
    expect((await tryLogin(PASSWORD, { origin: 'https://evil.test' })).status).toBe(403);
    expect((await tryLogin(PASSWORD, { origin: null })).status).toBe(403);
    expect((await tryLogin(PASSWORD, { type: 'text/plain' })).status).toBe(400);
    expect((await tryLogin(PASSWORD, { type: 'application/x-www-form-urlencoded' })).status).toBe(400);
  });

  it('ADMIN_PASSWORD na ho ya 12 harf se chhota: 503 (F07-AC5)', async () => {
    env = { ...env, ADMIN_PASSWORD: undefined };
    expect((await tryLogin('')).status).toBe(503);
    env = { ...env, ADMIN_PASSWORD: '12345678901' };
    expect((await tryLogin('12345678901')).status).toBe(503);
  });

  it('D1 kharab: 503', async () => {
    env = { ...env, DB: { prepare: () => { throw new Error('D1'); } } as unknown as D1Database };
    expect((await tryLogin(PASSWORD)).status).toBe(503);
  });
});

describe('logout (F07-AC4)', () => {
  it('cookie Max-Age=0 se saaf; Origin ghalat 403', () => {
    const r = logout(post('/api/admin/logout', {}));
    expect(r.status).toBe(200);
    expect(r.headers?.['Set-Cookie']).toBe(`${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
    expect(logout(post('/api/admin/logout', {}, { origin: 'https://evil.test' })).status).toBe(403);
  });
});

describe('401 guard (F07-AC3)', () => {
  it('requireAdmin: bina cookie, jaali, expired 401; sahih null', async () => {
    const good = await signSession(env.SESSION_SECRET!, NOW());
    expect((await requireAdmin(new Request(`${SITE}/api/admin/orders`), env, NOW()))?.status).toBe(401);
    expect((await requireAdmin(withCookie('v1.9999999999999.' + 'A'.repeat(43)), env, NOW()))?.status).toBe(401);
    expect((await requireAdmin(withCookie(good), env, new Date(NOW().getTime() + 8 * 864e5)))?.status).toBe(401);
    expect(await requireAdmin(withCookie(good), env, NOW())).toBeNull();
  });

  it('guardAdminPath: har /api/admin/* par jaanch; login/logout khule; baqi site par kuch nahin', async () => {
    const anon = new Request(`${SITE}/x`);
    for (const p of ['/api/admin/orders', '/api/admin/orders/GVS-2611-0001/status', '/api/admin/settings', '/api/admin/notifications/', '/api/admin', '/api/admin/kuch-bhi'])
      expect((await guardAdminPath(p, anon, env, NOW()))?.status, p).toBe(401);
    for (const p of ['/api/admin/login', '/api/admin/logout', '/admin', '/api/orders', '/api/track', '/'])
      expect(await guardAdminPath(p, anon, env, NOW()), p).toBeNull();
  });
});
