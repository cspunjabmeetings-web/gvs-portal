// spec: E27 GET/POST /api/admin/vu/mcqs (F29-AC3)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { listVuMcqs, saveVuMcq } from '../../../../lib/vu-admin';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await listVuMcqs(request, env));
export const POST: APIRoute = async ({ request }) => toResponse(await saveVuMcq(request, env));
