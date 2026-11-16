// spec: 10.1 settings.golden (intent 12.4). GOLDEN: kamzor karna mana (spec 13.9).
// Qadam 5 mein migrations/*.sql ka settings seed bante hi yeh test khud chalu ho jata hai.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'migrations');

// Intent 12.4 ki shuru ki values (seed). Sirf owner ki ijazat se badlein.
const EXPECTED: Record<string, string> = {
  whatsapp_number: '03404905266',
  work_start: '09:00',
  work_end: '22:00',
  default_delivery_minutes: '120',
  auto_cancel_hours: '48',
  default_job_fee: '300',
  job_image_keep_days: '30',
  orders_open: 'true',
  ads_provider: 'house',
  agent_enabled: 'false',
};

function allSql(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n');
}

const hasSeed = existsSync(MIGRATIONS) && /INSERT[\s\S]*settings/i.test(allSql());

describe.skipIf(!hasSeed)('settings.golden (intent 12.4 seed)', () => {
  for (const [key, value] of Object.entries(EXPECTED)) {
    it(`${key} = ${value}`, () => {
      // ('key', 'value') ya ('key', value) dono shaklein qabool
      const re = new RegExp(`\\(\\s*'${key}'\\s*,\\s*'?${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'?\\s*\\)`);
      expect(allSql()).toMatch(re);
    });
  }
});
