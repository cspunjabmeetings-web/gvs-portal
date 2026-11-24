// spec: E29 GET /api/vu/test?course=&term=&n= (F30-AC3)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { vuTestApi } from '../../../lib/vu-public';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await vuTestApi(request, env.DB));
