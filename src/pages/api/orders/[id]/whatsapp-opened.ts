// spec: E03 POST /api/orders/:id/whatsapp-opened (F04-AC7: sirf pehli dafa, notification)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { toResponse } from '../../../../lib/api';
import { markWhatsappOpened } from '../../../../lib/orders';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => toResponse(await markWhatsappOpened(request, env, params.id ?? ''));
