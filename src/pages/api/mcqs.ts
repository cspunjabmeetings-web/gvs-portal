// spec: E06 GET /api/mcqs?subject=&offset= (F14-AC2, AC3; sirf verified; offset ≤ 10,000). Saara kaam src/lib/practice.ts mein.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../lib/api';
import { practiceApi } from '../../lib/practice';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await practiceApi(request, env.DB));
