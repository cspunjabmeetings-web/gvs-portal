// spec: E27 DELETE /api/admin/vu/mcqs/:id (F29-AC3)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../../lib/api';
import { deleteVuMcq } from '../../../../../lib/vu-admin';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, params }) => toResponse(await deleteVuMcq(request, env, params.id));
