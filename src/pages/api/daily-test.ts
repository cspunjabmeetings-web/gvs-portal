// spec: E05 GET /api/daily-test (F13-AC1, AC2; s-maxage=300). Saara kaam src/lib/daily.ts mein.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../lib/api';
import { dailyTest } from '../../lib/daily';

export const prerender = false;

export const GET: APIRoute = async () => toResponse(await dailyTest(env.DB));
