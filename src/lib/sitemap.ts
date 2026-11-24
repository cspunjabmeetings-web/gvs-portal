// spec: E08 GET /sitemap.xml (on-demand, s-maxage=3600), F21-AC3 (static + on-demand pages; /admin, /track, /my-history aur band jobs
//       nahin), FX-03 (10 ms CPU: chand halki queries, koi matn/parse nahin). Static list seo.json se (spec ke static routes).
import seo from '../data/seo.json';
import { subjectCards } from './practice';
import { publicMocks } from './mocks';
import { vuCourses } from './vu-public';
import { pkDate } from './pkdate';

/** Sitemap mein kabhi nahin (noindex / zaati / ghalti ka page) */
export const SITEMAP_EXCLUDE = new Set(['/admin', '/track', '/my-history', '/404']);

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const day = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : undefined);

export async function sitemapUrls(db: D1Database, base: string, now = new Date()): Promise<SitemapUrl[]> {
  const abs = (p: string) => new URL(p, base).href;
  const out: SitemapUrl[] = Object.keys(seo.pages)
    .filter((r) => !SITEMAP_EXCLUDE.has(r))
    .map((r) => ({ loc: abs(r) }));

  const [subjects, mocks, notes, jobs, vu] = await Promise.all([
    subjectCards(db),
    publicMocks(db),
    db.prepare('SELECT slug, updated_at FROM notes WHERE visible = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 5000').all<{ slug: string; updated_at: string }>(),
    // Sirf khuli jobs (F21-AC3): akhri tareekh Pakistan ki aaj ya baad
    db
      .prepare('SELECT slug, updated_at FROM jobs WHERE visible = 1 AND deleted_at IS NULL AND last_date >= ?1 ORDER BY last_date ASC LIMIT 5000')
      .bind(pkDate(now))
      .all<{ slug: string; updated_at: string }>(),
    vuCourses(db),
  ]);
  // F30-AC6: sirf jin courses mein jaanche sawal hain
  for (const c of vu) if (c.mid + c.final > 0) out.push({ loc: abs(`/vu-mock/${c.code.toLowerCase()}`) });
  for (const s of subjects) if (s.count > 0) out.push({ loc: abs(`/mcqs/${s.slug}`) });
  for (const m of mocks) out.push({ loc: abs(`/mock-tests/${m.slug}`) });
  for (const n of notes.results) out.push({ loc: abs(`/notes/${n.slug}`), lastmod: day(n.updated_at) });
  for (const j of jobs.results) out.push({ loc: abs(`/jobs/${j.slug}`), lastmod: day(j.updated_at) });
  return out;
}

export function sitemapXml(urls: SitemapUrl[]): string {
  const body = urls.map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>\n`;
}
