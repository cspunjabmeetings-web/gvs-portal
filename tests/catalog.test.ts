// spec: F02-AC2, F02-AC3, F02-AC4, F02-AC5, intent 7.2, 12.3 (catalog ka dhancha)
import { describe, it, expect } from 'vitest';
import data from '../src/data/catalog.json';
import { activeProducts, getProduct, isOrderable, fieldMessage, formatPrice, type Product } from '../src/lib/catalog';

const products = data.products as Product[];
const DOORS = ['job-prep', 'vu', 'board', 'career', 'sarkari'];

describe('catalog.json ka dhancha', () => {
  it('har product mein zaroori khane hain', () => {
    for (const p of products) {
      expect(p.id, p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.name.length, p.id).toBeGreaterThan(2);
      expect(DOORS, p.id).toContain(p.door);
      expect(p.deliveryMinutes, p.id).toBeGreaterThanOrEqual(15);
      expect(Array.isArray(p.fields), p.id).toBe(true);
      expect(p.includes.length, p.id).toBeGreaterThan(0);
      expect(typeof p.active, p.id).toBe('boolean');
    }
  });

  it('har field ki pattern sahih hai aur misal us par pura utarti hai (F02-AC2)', () => {
    for (const p of products) {
      for (const f of p.fields) {
        expect(f.key, `${p.id}.${f.key}`).toMatch(/^[a-zA-Z]+$/);
        expect(['text', 'select', 'month', 'number']).toContain(f.type);
        if (f.type === 'select') expect(f.options?.length, `${p.id}.${f.key}`).toBeGreaterThan(0);
        if (f.pattern) {
          const re = new RegExp(f.pattern);
          expect(f.example, `${p.id}.${f.key} example`).toBeDefined();
          expect(re.test(f.example!), `${p.id}.${f.key}: "${f.example}"`).toBe(true);
          // HTML pattern attribute (bina ^$) bhi browser ke 'v' flag ke sath chalni chahiye
          expect(() => new RegExp(`^(?:${f.pattern!.replace(/^\^/, '').replace(/\$$/, '')})$`, 'v')).not.toThrow();
        }
      }
    }
  });

  it('VU course code: CS101 sahih, cs10 ghalat; paigham spec ke mutabiq', () => {
    const f = getProduct('vu-smart')!.fields.find((x) => x.key === 'courseCode')!;
    const re = new RegExp(f.pattern!);
    expect(re.test('CS101')).toBe(true);
    expect(re.test('MGT201A')).toBe(true);
    expect(re.test('cs10')).toBe(false);
    expect(fieldMessage(f)).toBe('Course code aisa hona chahiye, maslan CS101.');
  });

  it('active: false wala product na dikhe, na order ho (F02-AC3)', () => {
    const fake: Product = { ...products[0], id: 'band-product', active: false };
    const list = [...products, fake];
    expect(activeProducts(list).map((p) => p.id)).not.toContain('band-product');
    expect(getProduct('band-product', list)).toBeUndefined();
    expect(isOrderable(fake)).toBe(false);
  });

  it('job-apply aur scheme-help par sarkari fee alag (F02-AC4)', () => {
    const withFee = products.filter((p) => p.govtFeeExtra).map((p) => p.id).sort();
    expect(withFee).toEqual(['job-apply', 'scheme-help']);
  });

  it('interview tayyari: qeemat nahin, order list mein nahin (F02-AC5)', () => {
    const ip = getProduct('interview-prep')!;
    expect(ip.price).toBeNull();
    expect(isOrderable(ip)).toBe(false);
  });

  it('law/commerce notes catalog mein nahin (intent 7.2)', () => {
    for (const p of products) expect(p.id + p.name).not.toMatch(/law|commerce/i);
  });

  it('documents wali services (intent 7.3)', () => {
    const docs = products.filter((p) => p.needsDocuments).map((p) => p.id).sort();
    expect(docs).toEqual(['cv-cover', 'job-apply', 'scheme-help']);
  });

  it('qeemat ki shakal', () => {
    expect(formatPrice(350)).toBe('Rs. 350');
    expect(formatPrice(1200)).toBe('Rs. 1,200');
  });
});
