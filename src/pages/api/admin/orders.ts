// spec: E11 GET /api/admin/orders (F08-AC1, AC2, AC3). Saara kaam src/lib/admin-orders.ts mein.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { listOrders } from '../../../lib/admin-orders';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await listOrders(request, env));
