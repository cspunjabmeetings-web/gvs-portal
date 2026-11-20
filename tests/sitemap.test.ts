// spec: E08, F21-AC3 (static + on-demand pages; /admin, /track, /my-history aur band jobs nahin), F12-AC5 (chhupa/mitaya nahin)
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, SECRET } from './helpers/admin';
import { importChunk } from '../src/lib/content-import';
import { saveJobs } from '../src/lib/admin-jobs';
import { sitemapUrls, sitemapXml, SITEMAP_EXCLUDE } from '../src/lib/sitemap';
import seo from '../src/data/seo.json';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
// Pakistan: 20 Nov 2026 subah
const NOW = new Date('2026-11-20T05:00:00Z');
const BASE = 'https://gvs.test/';

async function imp(text: string, verified = true) {
  const r = await importChunk(await adminReq('/api/admin/content/import', { body: { text, verified } }), env(), { now: () => NOW });
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
}
async function job(post: string, last: string) {
  const r = await saveJobs(await adminReq('/api/admin/jobs', { body: { action: 'save', text: `# JOB\nIdara: PPSC\nPost: ${post}\nAkhri tareekh: ${last}\nOfficial link: https://ppsc.gop.pk/x\n---` } }), env(), { now: () => NOW });
  return (r.body as { ids: number[]; slugs: string[] });
}
const locs = async () => (await sitemapUrls(d1.db, BASE, NOW)).map((u) => u.loc.replace(BASE, '/'));

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('sitemap (E08, F21-AC3)', () => {
  it('khali DB: sirf static pages; /admin, /track, /my-history, /404 nahin', async () => {
    const l = await locs();
    for (const r of SITEMAP_EXCLUDE) expect(l).not.toContain(r);
    expect(l).toContain('/');
    expect(l).toContain('/jobs/ppsc');
    expect(l).toHaveLength(Object.keys(seo.pages).length - SITEMAP_EXCLUDE.size);
    expect(l.some((x) => x.startsWith('/mcqs/'))).toBe(false);
  });

  it('mazmoon sirf jab jaancha sawal ho; mock sirf dikhne wala; note chhupa/mitaya nahin', async () => {
    await imp('# MCQ\nMazmoon: English\nSawal: Sahih spelling?\nA) a\nB) b*\n---');
    await imp('# MCQ\nMazmoon: Pakistan Studies\nSawal: Na jaancha?\nA) a\nB) b*\n---', false);
    await imp('# MOCK\nNaam: Mock Ek\nWaqt: 10 minute\n---\n# MCQ\nMazmoon: English\nSawal: Mock sawal?\nA) a\nB) b*\n---\n# END MOCK');
    await imp('# NOTE\nUnwan: Dikhta Note\nMazmoon: English\nKhulasa: k\nMatn:\n## A\n- x\n---');
    await imp('# NOTE\nUnwan: Chhupa Note\nMazmoon: English\nKhulasa: k\nMatn:\n## A\n- x\n---');
    await imp('# NOTE\nUnwan: Mitaya Note\nMazmoon: English\nKhulasa: k\nMatn:\n## A\n- x\n---');
    await d1.db.prepare("UPDATE notes SET visible = 0 WHERE slug = 'chhupa-note'").run();
    await d1.db.prepare("UPDATE notes SET deleted_at = '2026-11-19T00:00:00Z' WHERE slug = 'mitaya-note'").run();
    const l = await locs();
    expect(l).toContain('/mcqs/english');
    expect(l).not.toContain('/mcqs/pakistan-studies');
    expect(l).toContain('/mock-tests/mock-ek');
    expect(l).toContain('/notes/dikhta-note');
    expect(l).not.toContain('/notes/chhupa-note');
    expect(l).not.toContain('/notes/mitaya-note');
    await d1.db.prepare("UPDATE mocks SET visible = 0 WHERE slug = 'mock-ek'").run();
    expect(await locs()).not.toContain('/mock-tests/mock-ek');
  });

  it('jobs: sirf khuli (aaj ki akhri tareekh bhi), band/chhupi/mitayi nahin; lastmod', async () => {
    const open = await job('Educator', '2026-11-20');
    const closed = await job('Clerk', '2026-11-19');
    const hidden = await job('Lecturer', '2026-12-01');
    const gone = await job('Driver', '2026-12-01');
    await d1.db.prepare('UPDATE jobs SET visible = 0 WHERE id = ?1').bind(hidden.ids[0]).run();
    await d1.db.prepare("UPDATE jobs SET deleted_at = '2026-11-19T00:00:00Z' WHERE id = ?1").bind(gone.ids[0]).run();
    const urls = await sitemapUrls(d1.db, BASE, NOW);
    const l = urls.map((u) => u.loc.replace(BASE, '/'));
    expect(l).toContain(`/jobs/${open.slugs[0]}`);
    for (const s of [closed, hidden, gone]) expect(l).not.toContain(`/jobs/${s.slugs[0]}`);
    expect(urls.find((u) => u.loc.endsWith(open.slugs[0]))?.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('XML: sahih dhancha, & escape', () => {
    const x = sitemapXml([{ loc: 'https://gvs.test/a?b=1&c=2', lastmod: '2026-11-20' }, { loc: 'https://gvs.test/' }]);
    expect(x.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(x).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(x).toContain('<loc>https://gvs.test/a?b=1&amp;c=2</loc><lastmod>2026-11-20</lastmod>');
    expect((x.match(/<url>/g) ?? []).length).toBe(2);
  });
});
