// spec: E18 GET /api/admin/mcqs — 9b: sirf ?hashes= (F11-AC7, ek jaisa sawal); list aur POST Qadam 9c mein.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../lib/api';
import { existingHashes } from '../../../lib/content-import';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => toResponse(await existingHashes(request, env));
