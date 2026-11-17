// spec: F07-AC1..AC5, 9.2 (Admin cookie, Password, CSRF), 9.3 (Admin login: IP hash, 5 ghalat, 15 min rok), E10
// Sirf server par. Password aur cookie kabhi log nahin.
import * as v from 'valibot';
import { fail, ok, readJson, sameOrigin, clientIp, API_MSG, type ApiResult } from './api';
import { checkLimit } from './ratelimit';

export interface AdminEnv {
  DB: D1Database;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
}

export const COOKIE_NAME = 'gvs_admin';
export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_MAX = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MIN_PASSWORD = 12;

export const ADMIN_MSG = {
  wrong: 'Password ghalat hai.',
  unauthorized: 'Dobara login karein.',
  config: 'Admin password set nahin, ya 12 harf se chhota hai. ADMIN_PASSWORD secret dekhein.',
  json: 'Request JSON mein honi chahiye.',
  limited: (min: number) => `Bohat ghalat koshishein. ${min} minute baad koshish karein.`,
} as const;

// ---- Chhote crypto helpers (Workers + Node dono mein Web Crypto) ----
const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/** Constant-time barabari (F07-AC5): dono ka SHA-256, phir poori lambai ka XOR. Lambai ka farq bhi waqt se nahin jhalakta. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ---- Session cookie ----
export async function signSession(secret: string, now: Date): Promise<string> {
  const exp = now.getTime() + SESSION_MS;
  return `v1.${exp}.${await hmac(secret, `admin|v1|${exp}`)}`;
}

export function readCookie(header: string | null, name = COOKIE_NAME): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** Shakal, HMAC aur waqt sab sahih hon to true */
export async function verifySession(value: string | null, secret: string | undefined, now: Date): Promise<boolean> {
  if (!value || !secret) return false;
  const m = /^v1\.([0-9]{10,16})\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!m) return false;
  const exp = Number(m[1]);
  if (!(exp > now.getTime()) || exp > now.getTime() + SESSION_MS + 60_000) return false;
  return safeEqual(m[2], await hmac(secret, `admin|v1|${exp}`));
}

export const sessionCookie = (value: string) => `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}`;
export const clearCookie = () => `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;

/** Request mein sahih admin cookie hai? */
export async function isAdmin(request: Request, env: Pick<AdminEnv, 'SESSION_SECRET'>, now = new Date()): Promise<boolean> {
  return verifySession(readCookie(request.headers.get('Cookie')), env.SESSION_SECRET, now);
}

/** F07-AC3: har /api/admin/* ki pehli jaanch. null = ijazat hai. */
export async function requireAdmin(request: Request, env: Pick<AdminEnv, 'SESSION_SECRET'>, now = new Date()): Promise<ApiResult | null> {
  return (await isAdmin(request, env, now)) ? null : fail(401, 'unauthorized', ADMIN_MSG.unauthorized);
}

/** Bina cookie ke khule admin endpoints (sirf login/logout) */
export const ADMIN_PUBLIC = new Set(['/api/admin/login', '/api/admin/logout']);

export const isAdminPath = (p: string) => p === '/admin' || p.startsWith('/admin/') || p.startsWith('/api/admin/') || p === '/api/admin';

/** Middleware ka faisla (F07-AC3): /api/admin/* (login/logout ke siwa) par cookie lazmi */
export async function guardAdminPath(pathname: string, request: Request, env: Pick<AdminEnv, 'SESSION_SECRET'>, now = new Date()): Promise<ApiResult | null> {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (!(p === '/api/admin' || p.startsWith('/api/admin/')) || ADMIN_PUBLIC.has(p)) return null;
  return requireAdmin(request, env, now);
}

// ---- Login / logout (E10) ----
const LoginBody = v.object({ password: v.pipe(v.string(), v.maxLength(200)) });

/** Har admin POST: Origin apni site + sirf application/json (9.2 CSRF). null = theek. */
export function adminPost(request: Request): ApiResult | null {
  if (!sameOrigin(request)) return fail(403, 'origin', API_MSG.origin);
  // CSRF (9.2): admin par sirf application/json
  if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) return fail(400, 'json', ADMIN_MSG.json);
  return null;
}

export async function login(request: Request, env: AdminEnv, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const blocked = adminPost(request);
  if (blocked) return blocked;
  const body = await readJson(request, 1024);
  if (!body.ok) return body.res;
  const parsed = v.safeParse(LoginBody, body.data);
  if (!parsed.success) return fail(400, 'invalid', ADMIN_MSG.wrong);
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < MIN_PASSWORD || !env.SESSION_SECRET) return fail(503, 'config', ADMIN_MSG.config);

  const now = (deps.now ?? (() => new Date()))();
  try {
    const limit = await checkLimit(env.DB, env.SESSION_SECRET, { scope: 'admin:login', value: clientIp(request), max: LOGIN_MAX, windowMs: LOGIN_WINDOW_MS }, now);
    if (!limit.allowed) return fail(429, 'rate_limited', ADMIN_MSG.limited(Math.max(1, Math.ceil(limit.retryAfterMs / 60_000))));

    if (!(await safeEqual(parsed.output.password, env.ADMIN_PASSWORD))) {
      await limit.increment.run();
      return fail(401, 'wrong_password', ADMIN_MSG.wrong);
    }
    const res = ok();
    res.headers = { 'Set-Cookie': sessionCookie(await signSession(env.SESSION_SECRET, now)) };
    return res;
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

export function logout(request: Request): ApiResult {
  if (!sameOrigin(request)) return fail(403, 'origin', API_MSG.origin);
  const res = ok();
  res.headers = { 'Set-Cookie': clearCookie() };
  return res;
}
