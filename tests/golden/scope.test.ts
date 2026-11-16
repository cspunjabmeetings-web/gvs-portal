// spec: 13.6 check:scope, 10.1 scope.test (Scope guard).
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error plain .mjs script, types nahin
import { checkScope, fileToRoute } from '../../scripts/check-scope.mjs';

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'gvs-scope-'));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  return dir;
}

describe('check:scope', () => {
  it('asal project manifest ke andar hai', () => {
    expect(checkScope(process.cwd())).toEqual([]);
  });

  it('file se route sahih banta hai', () => {
    expect(fileToRoute('index.astro')).toBe('/');
    expect(fileToRoute(join('jobs', '[slug].astro'))).toBe('/jobs/[slug]');
    expect(fileToRoute('sitemap.xml.ts')).toBe('/sitemap.xml');
    expect(fileToRoute(join('api', 'orders', '[id]', 'whatsapp-opened.ts'))).toBe('/api/orders/[id]/whatsapp-opened');
  });

  it('manifest wale routes/deps/tables pass', () => {
    const dir = fixture({
      'src/pages/index.astro': '',
      'src/pages/jobs/[slug].astro': '',
      'src/pages/api/track.ts': '',
      'src/pages/sitemap.xml.ts': '',
      'package.json': JSON.stringify({ dependencies: { astro: '1' }, devDependencies: { vitest: '1' } }),
      'migrations/0001_init.sql': 'CREATE TABLE IF NOT EXISTS orders (id TEXT);',
    });
    try {
      expect(checkScope(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('anjan page, endpoint, dependency aur table fail', () => {
    const dir = fixture({
      'src/pages/blog.astro': '',
      'src/pages/api/secret.ts': '',
      'package.json': JSON.stringify({ dependencies: { react: '1' } }),
      'migrations/0002_x.sql': 'CREATE TABLE users (id TEXT);',
    });
    try {
      const errors: string[] = checkScope(dir);
      expect(errors).toHaveLength(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
