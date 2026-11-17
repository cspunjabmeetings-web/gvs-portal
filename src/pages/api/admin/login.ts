// spec: E10 POST /api/admin/login (F07-AC1, AC2, AC5). Saara kaam src/lib/admin-auth.ts mein.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { login } from '../../../lib/admin-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => toResponse(await login(request, env));
