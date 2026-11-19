// spec: E23 GET/POST /api/admin/daily-pins (P-03, A09; GET spec v0.3.5)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { listPins, savePin } from '../../../lib/daily-pins';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await listPins(request, env));
export const POST: APIRoute = async ({ request }) => toResponse(await savePin(request, env));
