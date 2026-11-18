// spec: E24 GET/POST /api/admin/settings (F10-AC1..AC7). Saara kaam src/lib/admin-settings.ts mein.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { readAdminSettings, saveAdminSettings } from '../../../lib/admin-settings';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await readAdminSettings(request, env));
export const POST: APIRoute = async ({ request }) => toResponse(await saveAdminSettings(request, env));
