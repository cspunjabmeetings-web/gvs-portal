// spec: E20 DELETE /api/admin/notes/:id (F12-AC5: deleted_at → 410)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { deleteNote } from '../../../../lib/admin-content';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, params }) => toResponse(await deleteNote(request, env, params.id));
