// spec: E32 POST /api/agent/orders/:id/complete (F27-AC1, AC3; completed_by=agent); agent_enabled=false par 404
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../../lib/api';
import { agentComplete } from '../../../../../lib/agent';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => toResponse(await agentComplete(request, env, params.id ?? ''));
