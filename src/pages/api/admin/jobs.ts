// spec: E21 GET/POST /api/admin/jobs — list (khuli/purani), poori job, banana/badalna (paste = form), chhupana (F19-AC1..AC3, AC5)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { listJobs, saveJobs } from '../../../lib/admin-jobs';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await listJobs(request, env));
export const POST: APIRoute = async ({ request }) => toResponse(await saveJobs(request, env));
