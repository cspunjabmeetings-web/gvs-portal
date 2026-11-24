// spec: E37 GET/POST /api/admin/achievements (F33-AC1, AC2)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { listAchievements, saveAchievement } from '../../../lib/achievements';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await listAchievements(request, env));
export const POST: APIRoute = async ({ request }) => toResponse(await saveAchievement(request, env));
