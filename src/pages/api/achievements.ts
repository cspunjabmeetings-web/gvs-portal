// spec: E36 GET /api/achievements?place= (F33-AC3)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../lib/api';
import { achievementsApi } from '../../lib/achievements';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await achievementsApi(request, env.DB));
