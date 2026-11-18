// spec: E20 GET/POST /api/admin/notes — dekhna, badalna (slug wahi), chhupana (F12-AC1, AC2, AC4)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { listNotes, saveNote } from '../../../lib/admin-content';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await listNotes(request, env));
export const POST: APIRoute = async ({ request }) => toResponse(await saveNote(request, env));
