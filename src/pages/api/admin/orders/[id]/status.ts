// spec: E12 POST /api/admin/orders/:id/status (F08-AC4, AC5, AC6, AC9; 8.6; SA4; A-08)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../../lib/api';
import { changeStatus } from '../../../../../lib/admin-orders';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => toResponse(await changeStatus(request, env, params.id ?? ''));
