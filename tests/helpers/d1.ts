// spec: 10.1 (D1 tests), owner ka faisla (A): vitest 5 + wrangler getPlatformProxy (asal local D1 / Miniflare)
import { getPlatformProxy } from 'wrangler';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'migrations');

/** migrations/*.sql ko statements mein todo (comments hata kar, `;` par) */
export function migrationStatements(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .flatMap((f) =>
      readFileSync(join(MIGRATIONS, f), 'utf8')
        .split('\n')
        .filter((l) => !l.trim().startsWith('--'))
        .join('\n')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
    );
}

export async function startD1() {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  const db = proxy.env.DB;
  const migrate = async () => {
    const { results } = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'").all<{ name: string }>();
    if (results.length) {
      await db.batch([db.prepare('PRAGMA defer_foreign_keys = ON'), ...results.map((r) => db.prepare(`DROP TABLE IF EXISTS "${r.name}"`))]);
    }
    await db.batch(migrationStatements().map((s) => db.prepare(s)));
  };
  await migrate();
  return { db, reset: migrate, dispose: () => proxy.dispose() };
}
