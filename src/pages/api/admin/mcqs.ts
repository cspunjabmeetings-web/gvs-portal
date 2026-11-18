// spec: E18 GET/POST /api/admin/mcqs — GET: list (F12-AC1) ya ?hashes= (F11-AC7); POST: banana/badalna/verified (F12-AC2, AC6).
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { listMcqs, saveMcq } from '../../../lib/admin-content';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await listMcqs(request, env));
export const POST: APIRoute = async ({ request }) => toResponse(await saveMcq(request, env));
