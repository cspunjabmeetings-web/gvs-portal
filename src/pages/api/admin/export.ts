// spec: E25 GET /api/admin/export (F28-AC1, AC2, A10). Saara kaam src/lib/admin-export.ts mein.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { exportOrders } from '../../../lib/admin-export';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => exportOrders(request, env);
