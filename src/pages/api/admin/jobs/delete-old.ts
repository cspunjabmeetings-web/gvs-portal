// spec: E21 POST /api/admin/jobs/delete-old — "Sab purani mita dein" (tasdeeq ke sath, F19-AC5)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { deleteOldJobs } from '../../../../lib/admin-jobs';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => toResponse(await deleteOldJobs(request, env));
