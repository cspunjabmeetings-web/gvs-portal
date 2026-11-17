// spec: E02 POST /api/orders (F04-AC2..AC6, AC11; F05-AC4). Saara kaam src/lib/orders.ts mein.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../lib/api';
import { createOrder } from '../../lib/orders';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => toResponse(await createOrder(request, env));
