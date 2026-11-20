// spec: F07-AC3 (har /api/admin/* bina cookie 401), F27-AC1 (/api/agent/* no-store), F07-AC4 (/admin noindex), 8.1 (raaz wale jawab no-store)
// Route nahin; har on-demand request se pehle chalta hai. Static pages par kuch nahin karta.
import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { toResponse } from './lib/api';
import { guardAdminPath, isAdminPath } from './lib/admin-auth';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  // F27 (V2 tayyari): agent endpoints apni Bearer jaanch khud karte hain (cookie nahin); yahan sirf no-store + noindex
  if (path === '/api/agent' || path.startsWith('/api/agent/')) {
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'no-store');
    out.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return out;
  }
  if (!isAdminPath(path)) return next();

  const denied = await guardAdminPath(path, ctx.request, env);
  const res = denied ? toResponse(denied) : await next();
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'no-store');
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
});
