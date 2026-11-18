// spec: E19 GET/POST /api/admin/mocks — dekhna, chhupana/dikhana (F12-AC1, AC2)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { listMocks, setMockVisible } from '../../../lib/admin-content';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await listMocks(request, env));
export const POST: APIRoute = async ({ request }) => toResponse(await setMockVisible(request, env));
