// spec: E10 POST /api/admin/logout (F07-AC4: cookie saaf)
import type { APIRoute } from 'astro';
import { toResponse } from '../../../lib/api';
import { logout } from '../../../lib/admin-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => toResponse(logout(request));
