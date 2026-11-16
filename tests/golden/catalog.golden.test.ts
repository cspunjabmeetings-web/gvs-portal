// spec: F02-AC8, 10.1 catalog.golden (intent 7.2). GOLDEN: kamzor karna mana (spec 13.9).
// Qadam 2 mein src/data/catalog.json bante hi yeh test khud chalu ho jata hai.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CATALOG = join(process.cwd(), 'src', 'data', 'catalog.json');

// Intent 7.2 (owner ki manzoor rate list). Sirf owner ki ijazat se badle.
const EXPECTED: Record<string, number> = {
  'mcq-pack': 250,
  'past-papers': 400,
  'current-affairs': 120,
  'mock-series': 700,
  'vu-quick': 250,
  'vu-smart': 350,
  'vu-complete': 450,
  'vu-topper': 550,
  'board-paper': 300,
  'cv-cover': 500,
  'job-apply': 300,
  'scheme-help': 300,
};

type Product = { id: string; price?: number | null; active?: boolean };

function load(): Product[] {
  const raw = JSON.parse(readFileSync(CATALOG, 'utf8'));
  return Array.isArray(raw) ? raw : raw.products;
}

describe.skipIf(!existsSync(CATALOG))('catalog.golden (intent 7.2)', () => {
  it('har product ki qeemat intent 7.2 ke barabar hai', () => {
    const products = load();
    const priced = Object.fromEntries(
      products.filter((p) => typeof p.price === 'number').map((p) => [p.id, p.price]),
    );
    expect(priced).toEqual(EXPECTED);
  });

  it('ids unique hain', () => {
    const ids = load().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('qeematein poore rupay hain', () => {
    for (const p of load()) {
      if (typeof p.price === 'number') expect(Number.isInteger(p.price)).toBe(true);
    }
  });
});
