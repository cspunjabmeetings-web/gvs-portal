// spec: F21-AC1 (title ≤ 60, description ≤ 155, alag alag), intent 14.2, 14.4
import { describe, it, expect } from 'vitest';
import seo from '../src/data/seo.json';
// @ts-ignore plain .mjs script
import { readManifest } from '../scripts/check-scope.mjs';

const pages = seo.pages as Record<string, { title: string; description: string }>;
const staticRoutes: string[] = (readManifest('ROUTES') as string[])
  .filter((l) => l.startsWith('PAGE '))
  .map((l) => l.slice(5).trim())
  .filter((r) => !r.includes('['));

describe('seo.json', () => {
  it('spec ke har static route ka entry hai, aur faltu entry nahin', () => {
    expect(Object.keys(pages).sort()).toEqual([...staticRoutes].sort());
  });

  it('title 60 aur description 155 harf tak (F21-AC1)', () => {
    for (const [route, m] of Object.entries(pages)) {
      expect(m.title.length, `${route} title: ${m.title.length}`).toBeLessThanOrEqual(60);
      expect(m.description.length, `${route} description: ${m.description.length}`).toBeLessThanOrEqual(155);
      expect(m.title.length, route).toBeGreaterThan(5);
      expect(m.description.length, route).toBeGreaterThan(10);
    }
  });

  it('koi do title ya description ek jaise nahin', () => {
    const titles = Object.values(pages).map((m) => m.title);
    const descs = Object.values(pages).map((m) => m.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descs).size).toBe(descs.length);
  });

  it('brand aakhir mein, aur "official" jaisa dhoka nahin (intent 14.2, 14.4)', () => {
    for (const [route, m] of Object.entries(pages)) {
      expect(m.title, route).toMatch(/GVS Academy/);
      expect(m.title + m.description, route).not.toMatch(/\bofficial site\b|\bofficial (ppsc|fpsc|nts)\b/i);
    }
  });
});
