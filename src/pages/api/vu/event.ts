// spec: E38 POST /api/vu/event (F34-AC1)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { recordEvents } from '../../../lib/vu-stats';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => toResponse(await recordEvents(request, env));
