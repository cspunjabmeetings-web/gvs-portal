// spec: E18 GET/POST /api/admin/mcqs/duplicates (F12-AC7)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { deleteDuplicates, listDuplicates } from '../../../../lib/admin-dups';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await listDuplicates(request, env));
export const POST: APIRoute = async ({ request }) => toResponse(await deleteDuplicates(request, env));
