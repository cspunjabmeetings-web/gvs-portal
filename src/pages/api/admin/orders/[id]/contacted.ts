// spec: E14 POST /api/admin/orders/:id/contacted (F08-AC3 "Rabta hua")
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../../lib/api';
import { setContacted } from '../../../../../lib/admin-orders';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => toResponse(await setContacted(request, env, params.id ?? ''));
