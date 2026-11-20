// spec: F07-AC3 (har /api/admin/* bina cookie 401), F27-AC1 (/api/agent/* no-store), F07-AC4 (/admin noindex), 8.1 (raaz wale jawab no-store),
//       CHANGE REQUEST Qadam 17a (owner "3 haan"): preview `*.workers.dev` par har jawab noindex
// Route nahin; har on-demand request se pehle chalta hai. Static pages par yeh nahin chalta — un ke liye public/_headers.
import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { toResponse, isPreviewHost } from './lib/api';
import { guardAdminPath, isAdminPath } from './lib/admin-auth';

function withHeaders(res: Response, h: Record<string, string>): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(h)) out.headers.set(k, v);
  return out;
}

const NOINDEX = 'noindex, nofollow';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  const preview = isPreviewHost(ctx.url.hostname);
  // F27 (V2 tayyari): agent endpoints apni Bearer jaanch khud karte hain (cookie nahin); yahan sirf no-store + noindex
  if (path === '/api/agent' || path.startsWith('/api/agent/')) {
    return withHeaders(await next(), { 'Cache-Control': 'no-store', 'X-Robots-Tag': NOINDEX });
  }
  if (!isAdminPath(path)) {
    const res = await next();
    return preview ? withHeaders(res, { 'X-Robots-Tag': NOINDEX }) : res;
  }

  const denied = await guardAdminPath(path, ctx.request, env);
  const res = denied ? toResponse(denied) : await next();
  return withHeaders(res, { 'Cache-Control': 'no-store', 'X-Robots-Tag': NOINDEX });
});
