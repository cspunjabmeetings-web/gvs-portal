// spec: F03-AC1, AC3, AC4, AC5, AC6, AC7; intent 7.4 (10 cheezein)
import { describe, it, expect, beforeEach } from 'vitest';
import {
  addItem, removeItem, cartTotal, itemKey, itemDetail, loadCart, saveCart, addToCart, ordersOpen,
  MAX_ITEMS, CART_MSG, _resetMemory, _memoryStore, type CartItem,
} from '../src/lib/cart';

const vu = (code: string) => ({ id: 'vu-smart', name: 'VU Smart pack', price: 350, fields: { courseCode: code } });

describe('cart: pure functions', () => {
  it('daalna aur kul (F03-AC1)', () => {
    const r = addItem([], vu('CS101'));
    expect(r.ok).toBe(true);
    const r2 = addItem(r.items, { id: 'mcq-pack', name: 'MCQs pack', price: 250, fields: { subject: 'Islamiat' } });
    expect(cartTotal(r2.items)).toBe(600);
  });

  it('same product + same tafseel = rok; alag tafseel = nayi line (F03-AC4)', () => {
    const a = addItem([], vu('CS101'));
    const dup = addItem(a.items, vu('cs101 '));
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.reason).toBe('duplicate');
    const other = addItem(a.items, vu('MTH202'));
    expect(other.ok).toBe(true);
    expect(other.items).toHaveLength(2);
    expect(CART_MSG.duplicate).toBe('Yeh cheez pehle se list mein hai.');
  });

  it('10 se zyada nahin (F03-AC3)', () => {
    let items: CartItem[] = [];
    for (let i = 0; i < MAX_ITEMS; i++) items = addItem(items, vu(`CS${100 + i}`)).items;
    expect(items).toHaveLength(10);
    const eleventh = addItem(items, vu('CS999'));
    expect(eleventh.ok).toBe(false);
    if (!eleventh.ok) expect(eleventh.reason).toBe('full');
    expect(CART_MSG.full).toBe('Ek order mein 10 cheezein hi ho sakti hain.');
  });

  it('orders band: daalna nahin, list mehfooz (F03-AC6)', () => {
    const a = addItem([], vu('CS101'));
    const closed = addItem(a.items, vu('MTH202'), false);
    expect(closed.ok).toBe(false);
    if (!closed.ok) expect(closed.reason).toBe('closed');
    expect(closed.items).toHaveLength(1);
  });

  it('hatana (F03-AC5)', () => {
    const a = addItem([], vu('CS101')).items;
    expect(removeItem(a, a[0].key)).toEqual([]);
  });

  it('key mein khanon ki tarteeb ka farq nahin', () => {
    expect(itemKey('board-paper', { a: '1', b: '2' })).toBe(itemKey('board-paper', { b: '2', a: '1' }));
  });

  it('tafseel ki shakal', () => {
    expect(itemDetail({ fields: { courseCode: 'CS101' } })).toBe(' (CS101)');
    expect(itemDetail({ fields: {} })).toBe('');
  });
});

describe('cart: storage', () => {
  beforeEach(() => _resetMemory());

  it('localStorage na ho to memory mein chale, crash nahin (F03-AC7)', () => {
    // Node mein localStorage nahin: memory store
    expect(loadCart()).toEqual([]);
    const r = addToCart(vu('CS101'));
    expect(r.ok).toBe(true);
    expect(loadCart()).toHaveLength(1);
  });

  it('kharab ya purana data: khali list, crash nahin', () => {
    _memoryStore.set('{not json');
    expect(loadCart(_memoryStore)).toEqual([]);
    _memoryStore.set(JSON.stringify({ v: 0, items: [vu('CS101')] }));
    expect(loadCart(_memoryStore)).toEqual([]);
    _memoryStore.set(JSON.stringify({ v: 1, items: [{ junk: true }] }));
    expect(loadCart(_memoryStore)).toEqual([]);
  });

  it('save → load wohi list', () => {
    const items = addItem([], vu('CS101')).items;
    saveCart(items, _memoryStore);
    expect(loadCart(_memoryStore)).toEqual(items);
  });

  it('orders_open setting (F03-AC6)', () => {
    const g = globalThis as { __gvsSettings?: { orders_open?: boolean } };
    expect(ordersOpen()).toBe(true);
    g.__gvsSettings = { orders_open: false };
    expect(ordersOpen()).toBe(false);
    expect(addToCart(vu('CS101')).ok).toBe(false);
    delete g.__gvsSettings;
  });
});
