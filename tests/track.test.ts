// spec: 10.1 track.test (D1): ghalat last4 par generic jawab; phone nahin; 5 ghalat par rok. F06-AC2..AC4, AC7, AC9; 9.3
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { createOrder } from '../src/lib/orders';
import { trackOrder, TRACK_MSG, type TrackData, type TrackEnv } from '../src/lib/track';
import { toResponse } from '../src/lib/api';

const SITE = 'https://gvs.test';
const NOW = () => new Date('2026-11-17T10:00:00Z');
let d1: Awaited<ReturnType<typeof startD1>>;
let env: TrackEnv & { TURNSTILE_SECRET: string };

type Body = { ok: boolean; order?: TrackData; error?: { code: string; message: string } };

async function newOrder(items: unknown[] = [{ id: 'vu-smart', fields: { courseCode: 'CS101' } }], phone = '0300-1234567') {
  const r = await createOrder(
    new Request(`${SITE}/api/orders`, {
      method: 'POST',
      headers: { Origin: SITE, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.9' },
      body: JSON.stringify({ name: 'Ali Raza', phone, items, turnstileToken: 't' }),
    }),
    env,
    { now: NOW, verify: async () => true },
  );
  return (r.body as { id: string }).id;
}

async function track(id: string, last4: string, ip = '10.0.0.1', now = NOW) {
  const r = await trackOrder(new Request(`${SITE}/api/track?id=${encodeURIComponent(id)}&last4=${encodeURIComponent(last4)}`, { headers: { 'CF-Connecting-IP': ip } }), env, { now });
  return { status: r.status, body: r.body as Body, raw: r };
}

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => {
  await d1.reset();
  env = { DB: d1.db, SESSION_SECRET: 'test-session-secret', TURNSTILE_SECRET: 'x' };
});

describe('GET /api/track (E04)', () => {
  it('sahih id + last4: darja, cheezein, kul; jawab mein phone/naam kahin nahin (F06-AC2)', async () => {
    const id = await newOrder();
    const { status, body, raw } = await track(id, '4567');
    expect(status).toBe(200);
    expect(body.order).toMatchObject({ id, status: 'new', total: 350, dueAt: null, publicNote: null, cancelReason: null });
    expect(body.order!.items[0]).toMatchObject({ id: 'vu-smart', fields: { courseCode: 'CS101' } });
    const text = JSON.stringify(raw.body);
    expect(text).not.toMatch(/1234567|923001|0300|Ali Raza|phone/i);
  });

  it('chhote harf ka order number bhi chale', async () => {
    const id = await newOrder();
    expect((await track(id.toLowerCase(), '4567')).status).toBe(200);
  });

  it('`new` par payment ki maloomat settings se; documents wali service par needsDocuments (F06-AC7)', async () => {
    await d1.db.prepare("UPDATE settings SET value = '03001112223' WHERE key = 'jazzcash_number'").run();
    const id = await newOrder([{ id: 'cv-cover', fields: {} }, { id: 'vu-smart', fields: { courseCode: 'CS101' } }]);
    const { body } = await track(id, '4567');
    expect(body.order!.payment).toEqual({ jazzcashNumber: '03001112223', jazzcashTitle: '', easypaisaNumber: '', easypaisaTitle: '' });
    expect(body.order!.items.map((i) => !!i.needsDocuments)).toEqual([true, false]);
  });

  it('`paid` par due_at aur public_note; payment ki maloomat nahin', async () => {
    const id = await newOrder();
    await d1.db.prepare("UPDATE orders SET status = 'paid', due_at = '2026-11-17T12:00:00.000Z', public_note = 'Kal subah tak' WHERE id = ?").bind(id).run();
    const { body } = await track(id, '4567');
    expect(body.order).toMatchObject({ status: 'paid', dueAt: '2026-11-17T12:00:00.000Z', publicNote: 'Kal subah tak' });
    expect(body.order!.payment).toBeUndefined();
  });

  it('cancel ki wajah sirf `cancelled` par', async () => {
    const id = await newOrder();
    await d1.db.prepare("UPDATE orders SET status = 'cancelled', cancel_reason = '48 ghante payment nahin aayi' WHERE id = ?").bind(id).run();
    expect((await track(id, '4567')).body.order!.cancelReason).toBe('48 ghante payment nahin aayi');
  });

  it('ghalat last4, ghalat id, kharab shakal: bilkul ek hi jawab (F06-AC3)', async () => {
    const id = await newOrder();
    const a = await track(id, '0000');
    const b = await track('GVS-2611-9999', '4567', '10.0.0.2');
    const c = await track('<script>', 'abcd', '10.0.0.3');
    const d = await track('', '', '10.0.0.4');
    for (const r of [a, b, c, d]) {
      expect(r.status).toBe(404);
      expect(r.body).toEqual({ ok: false, error: { code: 'not_found', message: TRACK_MSG.not_found } });
    }
  });

  it('90 din baad last4 khali: phir koi last4 nahin chalta', async () => {
    const id = await newOrder();
    await d1.db.prepare("UPDATE orders SET phone_last4 = '' WHERE id = ?").bind(id).run();
    expect((await track(id, '4567')).status).toBe(404);
    expect((await track(id, '')).status).toBe(404);
  });

  it('ek order par 5 ghalat koshishein, phir sahih last4 bhi 15 minute tak 429 (F06-AC4)', async () => {
    const id = await newOrder();
    for (let i = 0; i < 5; i++) expect((await track(id, '0000')).status).toBe(404);
    const blocked = await track(id, '4567');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error?.message).toBe(TRACK_MSG.limited);
    // Doosre IP se wohi order chalta hai (key = order + IP)
    expect((await track(id, '4567', '10.0.0.50')).status).toBe(200);
    // 15 minute baad phir
    const later = () => new Date(NOW().getTime() + 16 * 60_000);
    expect((await track(id, '4567', '10.0.0.1', later)).status).toBe(200);
  });

  it('ek IP se 30 ghalat koshishein (mukhtalif orders), phir 429 (9.3)', async () => {
    for (let i = 0; i < 30; i++) expect((await track(`GVS-2611-${String(1000 + i)}`, '0000')).status).toBe(404);
    expect((await track('GVS-2611-5000', '0000')).status).toBe(429);
  });

  it('kamyab track D1 mein kuch nahin likhta (9.3; 60 s polling)', async () => {
    const id = await newOrder();
    const before = await d1.db.prepare('SELECT COUNT(*) AS c FROM rate_limits').first('c');
    for (let i = 0; i < 10; i++) await track(id, '4567');
    expect(await d1.db.prepare('SELECT COUNT(*) AS c FROM rate_limits').first('c')).toBe(before);
  });

  it('jawab `no-store` (F06-AC9)', async () => {
    const id = await newOrder();
    const res = toResponse((await track(id, '4567')).raw);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('secret na ho ya D1 kharab: 503', async () => {
    const id = await newOrder();
    expect((await trackOrder(new Request(`${SITE}/api/track?id=${id}&last4=4567`), { DB: d1.db })).status).toBe(503);
    const broken = { prepare: () => { throw new Error('D1'); } } as unknown as D1Database;
    expect((await trackOrder(new Request(`${SITE}/api/track?id=${id}&last4=4567`), { DB: broken, SESSION_SECRET: 's' })).status).toBe(503);
  });
});
