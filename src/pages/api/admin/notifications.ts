// spec: E15 GET /api/admin/notifications?since=&unread= (F09-AC1, AC3, F08-AC11). Saara kaam src/lib/notify.ts mein.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { listNotifications } from '../../../lib/notify';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await listNotifications(request, env));
