// spec: E21 DELETE /api/admin/jobs/:id (F19-AC5, F12-AC5: deleted_at → 410)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { deleteJob } from '../../../../lib/admin-jobs';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, params }) => toResponse(await deleteJob(request, env, params.id));
