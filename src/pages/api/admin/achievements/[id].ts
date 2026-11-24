// spec: E37 DELETE /api/admin/achievements/:id (F33-AC1)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { deleteAchievement } from '../../../../lib/achievements';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, params }) => toResponse(await deleteAchievement(request, env, params.id));
