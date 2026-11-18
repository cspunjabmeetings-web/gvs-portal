// spec: E18 DELETE /api/admin/mcqs/:id (F12-AC2)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { deleteMcq } from '../../../../lib/admin-content';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, params }) => toResponse(await deleteMcq(request, env, params.id));
