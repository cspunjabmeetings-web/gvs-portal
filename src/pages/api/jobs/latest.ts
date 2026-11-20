// spec: E07 GET /api/jobs/latest (P-05) — Home ke liye 3 taza khuli jobs (F01-AC4), s-maxage=300
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { latestJobs } from '../../../lib/jobs';

export const prerender = false;

export const GET: APIRoute = async () => toResponse(await latestJobs(env.DB));
