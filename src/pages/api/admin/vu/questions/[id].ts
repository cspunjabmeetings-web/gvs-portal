// spec: E34 DELETE /api/admin/vu/questions/:id (F32-AC1)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../../lib/api';
import { deleteQuestion } from '../../../../../lib/vu-questions';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, params }) => toResponse(await deleteQuestion(request, env, params.id));
