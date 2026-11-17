// spec: 3.3, F03-AC1..AC7 (order list browser mein), F05-AC3, intent 9.2, 11.4
// Koi network call nahin (F03-AC1). localStorage band ho to memory (F03-AC7).

export interface CartItem {
  /** id + tafseel se bani pehchan (F03-AC4) */
  key: string;
  id: string;
  name: string;
  /** Sirf dikhane ke liye; server qeemat khud catalog se hisab karta hai (F04-AC3) */
  price: number;
  fields: Record<string, string>;
  govtFeeExtra?: boolean;
  jobId?: string;
}

export const MAX_ITEMS = 10; // intent 7.4
export const STORAGE_KEY = 'gvs.cart.v1';
export const CART_EVENT = 'gvs:cart';

export const CART_MSG = {
  added: 'Order list mein daal diya.',
  duplicate: 'Yeh cheez pehle se list mein hai.',
  full: 'Ek order mein 10 cheezein hi ho sakti hain.',
  closed: 'Abhi orders band hain. Aap ki list mehfooz hai.',
} as const;

export type AddResult = { ok: true; items: CartItem[] } | { ok: false; items: CartItem[]; reason: 'duplicate' | 'full' | 'closed' };

/** Same product + same tafseel = same key; khane ki tarteeb ka farq nahin, chhote/bare harf ka farq nahin */
export function itemKey(id: string, fields: Record<string, string>, jobId?: string): string {
  const parts = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k].trim().toLowerCase()}`);
  return [id, jobId ?? '', ...parts].join('|');
}

export function addItem(items: CartItem[], item: Omit<CartItem, 'key'>, open = true): AddResult {
  if (!open) return { ok: false, items, reason: 'closed' };
  const key = itemKey(item.id, item.fields, item.jobId);
  if (items.some((i) => i.key === key)) return { ok: false, items, reason: 'duplicate' };
  if (items.length >= MAX_ITEMS) return { ok: false, items, reason: 'full' };
  return { ok: true, items: [...items, { ...item, key }] };
}

export function removeItem(items: CartItem[], key: string): CartItem[] {
  return items.filter((i) => i.key !== key);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.price, 0);
}

/** "(CS101)" ya "(10th, Physics, Chapter 1 se 3, 75)" */
export function itemDetail(item: Pick<CartItem, 'fields'>): string {
  const vals = Object.values(item.fields).map((v) => v.trim()).filter(Boolean);
  return vals.length ? ` (${vals.join(', ')})` : '';
}

// ---- Storage: localStorage, warna memory (F03-AC7) ----

type Store = { get(): string | null; set(v: string): void };
let memory: string | null = null;
const memoryStore: Store = { get: () => memory, set: (v) => (memory = v) };

function pickStore(): Store {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return memoryStore;
    const probe = '__gvs_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { get: () => ls.getItem(STORAGE_KEY), set: (v) => ls.setItem(STORAGE_KEY, v) };
  } catch {
    return memoryStore;
  }
}

function isItem(x: unknown): x is CartItem {
  const i = x as CartItem;
  return !!i && typeof i.key === 'string' && typeof i.id === 'string' && typeof i.name === 'string' && typeof i.price === 'number' && typeof i.fields === 'object';
}

export function loadCart(store: Store = pickStore()): CartItem[] {
  try {
    const raw = store.get();
    if (!raw) return [];
    const data = JSON.parse(raw) as { v?: number; items?: unknown[] };
    if (data.v !== 1 || !Array.isArray(data.items)) return [];
    return data.items.filter(isItem).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[], store: Store = pickStore()): void {
  try {
    store.set(JSON.stringify({ v: 1, items }));
  } catch {
    memoryStore.set(JSON.stringify({ v: 1, items }));
  }
  try {
    globalThis.dispatchEvent?.(new CustomEvent(CART_EVENT, { detail: items }));
  } catch {
    /* SSR / purana browser */
  }
}

/** Orders khule hain? Value /api/settings (orders_open) se, site-settings.ts bharta hai; na ho to khule (F03-AC6) */
export function ordersOpen(): boolean {
  const s = (globalThis as { __gvsSettings?: { orders_open?: boolean } }).__gvsSettings;
  return s?.orders_open !== false;
}

/** Browser mein: list mein daalo aur mehfooz karo */
export function addToCart(item: Omit<CartItem, 'key'>): AddResult {
  const res = addItem(loadCart(), item, ordersOpen());
  if (res.ok) saveCart(res.items);
  return res;
}

export function removeFromCart(key: string): CartItem[] {
  const items = removeItem(loadCart(), key);
  saveCart(items);
  return items;
}

/** F04-AC10: order kamyab → list khali */
export function clearCart(): void {
  saveCart([]);
}

// ---- "Mere orders" (spec 7.5: key gvs.v1, orders ≤ 20). Qadam 10 ka history.ts isi shakal ko parhe ga. ----
export const HISTORY_KEY = 'gvs.v1';
export interface SavedOrder {
  id: string;
  last4: string;
  at: string;
}

/** Order number + aakhri 4 hindse browser mein mehfooz (F04-AC10). Naya sab se upar. */
export function rememberOrder(o: SavedOrder, ls: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    if (!ls) return;
    let data: Record<string, unknown> = { v: 1 };
    try {
      const parsed = JSON.parse(ls.getItem(HISTORY_KEY) ?? 'null') as Record<string, unknown> | null;
      if (parsed && parsed.v === 1) data = parsed;
    } catch {
      /* kharab data: naye se */
    }
    const prev = Array.isArray(data.orders) ? (data.orders as SavedOrder[]).filter((x) => x && x.id !== o.id) : [];
    data.orders = [o, ...prev].slice(0, 20);
    ls.setItem(HISTORY_KEY, JSON.stringify(data));
  } catch {
    /* storage band: chhor do */
  }
}

/** Test ke liye: memory store saaf */
export function _resetMemory() {
  memory = null;
}
export const _memoryStore = memoryStore;
