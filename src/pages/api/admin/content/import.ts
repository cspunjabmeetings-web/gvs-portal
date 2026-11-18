// spec: E17 POST /api/admin/content/import (F11). Saara kaam src/lib/content-import.ts mein.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { importChunk } from '../../../../lib/content-import';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => toResponse(await importChunk(request, env));
