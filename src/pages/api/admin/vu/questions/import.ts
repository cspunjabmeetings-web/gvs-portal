// spec: E35 POST /api/admin/vu/questions/import (F32-AC1)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../../lib/api';
import { importQuestions } from '../../../../../lib/vu-questions';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => toResponse(await importQuestions(request, env));
