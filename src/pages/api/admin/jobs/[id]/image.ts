// spec: E22 POST /api/admin/jobs/:id/image — tasveer R2 mein (F19-AC4: ≤ 150 KB, sirf webp|jpeg|png)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../../lib/api';
import { uploadJobImage } from '../../../../../lib/job-image';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => toResponse(await uploadJobImage(request, env, params.id));
