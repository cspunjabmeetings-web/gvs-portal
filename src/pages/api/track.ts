// spec: E04 GET /api/track (F06-AC2..AC4, AC9: no-store). Saara kaam src/lib/track.ts mein.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../lib/api';
import { trackOrder } from '../../lib/track';

export const prerender = false;

// toResponse hamesha `Cache-Control: no-store` lagata hai
export const GET: APIRoute = async ({ request }) => toResponse(await trackOrder(request, env));
