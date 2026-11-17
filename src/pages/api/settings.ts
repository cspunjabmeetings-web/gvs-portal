// spec: E01 GET /api/settings (koi raaz nahin, s-maxage=60), F05-AC4 (kharabi par 503)
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { fail, ok, toResponse, API_MSG } from '../../lib/api';
import { getSettings, publicSettings } from '../../lib/settings';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const s = publicSettings(await getSettings(env.DB));
    return toResponse(ok({ settings: s }, { 'Cache-Control': 'public, max-age=0, s-maxage=60' }));
  } catch {
    return toResponse(fail(503, 'unavailable', API_MSG.unavailable));
  }
};
