// spec: E23 DELETE /api/admin/daily-pins/:date (P-03, A09)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { deletePin } from '../../../../lib/daily-pins';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, params }) => toResponse(await deletePin(request, env, params.date));
