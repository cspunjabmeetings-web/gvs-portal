// spec: E26 DELETE /api/admin/vu/courses/:code (F29-AC1)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../../lib/api';
import { deleteCourse } from '../../../../../lib/vu-admin';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, params }) => toResponse(await deleteCourse(request, env, params.code));
