// spec: E15 POST /api/admin/notifications/read (F09-AC2: "Parh liya", "Sab parh liye")
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { markRead } from '../../../../lib/notify';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => toResponse(await markRead(request, env));
