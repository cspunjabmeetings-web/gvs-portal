// spec: E33 POST /api/agent/orders/:id/note (F27-AC1; admin note ≤ 500); agent_enabled=false par 404
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../../lib/api';
import { agentNote } from '../../../../../lib/agent';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => toResponse(await agentNote(request, env, params.id ?? ''));
