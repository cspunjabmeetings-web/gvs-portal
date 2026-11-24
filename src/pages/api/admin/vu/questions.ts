// spec: E34 GET/POST /api/admin/vu/questions (F32-AC1)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { listQuestions, saveQuestion } from '../../../../lib/vu-questions';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await listQuestions(request, env));
export const POST: APIRoute = async ({ request }) => toResponse(await saveQuestion(request, env));
