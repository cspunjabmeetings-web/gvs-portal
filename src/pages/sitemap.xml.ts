// spec: E08 GET /sitemap.xml (on-demand, s-maxage=3600), F21-AC3
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { sitemapUrls, sitemapXml } from '../lib/sitemap';

export const prerender = false;

export const GET: APIRoute = async ({ site, url }) => {
  try {
    const xml = sitemapXml(await sitemapUrls(env.DB, (site ?? url).href));
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' } });
  } catch {
    return new Response('Sitemap abhi tayyar nahin.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
};
