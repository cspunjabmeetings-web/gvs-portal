// spec: E19 DELETE /api/admin/mocks/:id (F12-AC3, AC5: deleted_at, sawal bank mein)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { deleteMock } from '../../../../lib/admin-content';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, params }) => toResponse(await deleteMock(request, env, params.id));
