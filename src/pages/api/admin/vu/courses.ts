// spec: E26 GET/POST /api/admin/vu/courses (F29-AC1)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { listCourses, saveCourses } from '../../../../lib/vu-admin';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await listCourses(request, env));
export const POST: APIRoute = async ({ request }) => toResponse(await saveCourses(request, env));
