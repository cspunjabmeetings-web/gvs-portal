// spec: E28 POST /api/admin/vu/import (F29-AC2)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { importVu } from '../../../../lib/vu-admin';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => toResponse(await importVu(request, env));
