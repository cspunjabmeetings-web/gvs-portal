// spec: E13 POST /api/admin/orders/:id/note (F08-AC8; 9.4 ≤ 500)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../../lib/api';
import { setNote } from '../../../../../lib/admin-orders';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => toResponse(await setNote(request, env, params.id ?? ''));
