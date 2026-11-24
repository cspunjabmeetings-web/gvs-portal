// spec: E39 GET /api/admin/vu/report (F34-AC3)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { vuReport } from '../../../../lib/vu-stats';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await vuReport(request, env));
