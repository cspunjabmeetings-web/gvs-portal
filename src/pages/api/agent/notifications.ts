// spec: E31 GET /api/agent/notifications?since= (F27-AC1); agent_enabled=false par 404
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { agentNotifications } from '../../../lib/agent';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await agentNotifications(request, env));
