// spec: E30 GET /api/agent/orders?status=paid (F27-AC1, AC5); agent_enabled=false par 404
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { agentOrders } from '../../../lib/agent';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await agentOrders(request, env));
