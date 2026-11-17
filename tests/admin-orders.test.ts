// spec: E11, E13, E14; F08-AC1 (khulasa, A-01), AC2 (filter + search, 9.2 LIKE escape), AC3, AC8, AC12; 9.4
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { makeOrder, adminReq, SECRET } from './helpers/admin';
import { listOrders, setNote, setContacted, changeStatus, likeEscape, todayStartUtc, type AdminOrder } from '../src/lib/admin-orders';
import { contactMessage, dueLabel, ago, toKarachiInput, fromKarachiInput } from '../src/lib/admin-ui';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
const NOW = new Date('2026-11-17T10:00:00Z'); // 3 PM PKT

type ListBody = { ok: boolean; orders: AdminOrder[]; hasMore: boolean; summary: Record<string, number>; work: { start: string; end: string } };
async function list(params: Record<string, string> = {}, now = NOW) {
  const r = await listOrders(await adminReq(`/api/admin/orders?${new URLSearchParams(params)}`), env(), { now: () => now });
  return { status: r.status, body: r.body as ListBody };
}
const ids = (b: ListBody) => b.orders.map((o) => o.id);

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('GET /api/admin/orders (E11)', () => {
  it('bina cookie 401 (F07-AC3)', async () => {
    const r = await listOrders(await adminReq('/api/admin/orders', { cookie: null }), env());
    expect(r.status).toBe(401);
  });

  it('card ki saari cheezein; naye upar; phone poora (F08-AC3)', async () => {
    const a = await makeOrder(d1.db, { now: new Date('2026-11-17T08:00:00Z') });
    const b = await makeOrder(d1.db, { phone: '03111111111', name: 'Sara Khan', now: new Date('2026-11-17T09:00:00Z') });
    const { body } = await list();
    expect(ids(body)).toEqual([b, a]);
    expect(body.orders[0]).toMatchObject({ id: b, name: 'Sara Khan', phone: '923111111111', purged: false, status: 'new', total: 350, whatsappOpenedAt: null, contacted: false, minutes: 120 });
    expect(body.orders[0].items[0]).toMatchObject({ id: 'vu-smart', fields: { courseCode: 'CS101' } });
    expect(body.work).toEqual({ start: '09:00', end: '22:00' });
  });

  it('filters: naye, WhatsApp nahin khola, paid, cancel, sab (F08-AC2)', async () => {
    const a = await makeOrder(d1.db, { phone: '03000000001' });
    const b = await makeOrder(d1.db, { phone: '03000000002' });
    const c = await makeOrder(d1.db, { phone: '03000000003' });
    await d1.db.prepare('UPDATE orders SET whatsapp_opened_at = ? WHERE id = ?').bind(NOW.toISOString(), b).run();
    await d1.db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").bind(c).run();
    expect(ids((await list({ status: 'new' })).body).sort()).toEqual([a, b].sort());
    expect(ids((await list({ status: 'wa' })).body)).toEqual([a]);
    expect(ids((await list({ status: 'paid' })).body)).toEqual([c]);
    expect(ids((await list({ status: 'cancelled' })).body)).toEqual([]);
    expect((await list({ status: 'all' })).body.orders).toHaveLength(3);
    expect((await list({ status: 'kuch-bhi' })).body.orders).toHaveLength(3);
  });

  it('search: order number (chhote harf bhi), naam, phone ke hindse (0300-xx shakal) (F08-AC2)', async () => {
    const a = await makeOrder(d1.db, { name: 'Ali Raza', phone: '0300-1234567' });
    const b = await makeOrder(d1.db, { name: 'Sara Khan', phone: '0333-7654321' });
    expect(ids((await list({ q: b.toLowerCase() })).body)).toEqual([b]);
    expect(ids((await list({ q: 'sara' })).body)).toEqual([b]);
    expect(ids((await list({ q: '0300-123' })).body)).toEqual([a]);
    expect(ids((await list({ q: '7654' })).body)).toEqual([b]);
    expect((await list({ q: 'koi nahin' })).body.orders).toEqual([]);
  });

  it('search mein % aur _ seedhe harf hain, wildcard nahin (9.2)', async () => {
    await makeOrder(d1.db, { name: 'Ali Raza' });
    expect((await list({ q: '%' })).body.orders).toEqual([]);
    expect((await list({ q: '_' })).body.orders).toEqual([]);
    expect(likeEscape('a%b_c\\')).toBe('a\\%b\\_c\\\\');
  });

  it('50 ek page; "Aur dikhayen" (offset)', async () => {
    const stmts = Array.from({ length: 52 }, (_, i) =>
      d1.db
        .prepare("INSERT INTO orders (id, name, phone, phone_last4, items_json, total, status, created_at, updated_at) VALUES (?, 'X', '923000000000', '0000', '[]', 100, 'new', ?, ?)")
        .bind(`GVS-2611-${String(i + 1).padStart(4, '0')}`, `2026-11-17T0${Math.floor(i / 10)}:${String(i % 60).padStart(2, '0')}:00Z`, 't'),
    );
    await d1.db.batch(stmts);
    const p1 = await list();
    expect(p1.body.orders).toHaveLength(50);
    expect(p1.body.hasMore).toBe(true);
    const p2 = await list({ offset: '50' });
    expect(p2.body.orders).toHaveLength(2);
    expect(p2.body.hasMore).toBe(false);
  });

  it('aaj ka khulasa Pakistan ke "aaj" se; kamai sirf paid/pending/complete jin ka paid_at aaj (F08-AC1, A-01)', async () => {
    expect(todayStartUtc(NOW)).toBe('2026-11-16T19:00:00.000Z');
    // Kal raat 11:30 PM PKT (= aaj se pehle)
    const old = await makeOrder(d1.db, { phone: '03000000009', now: new Date('2026-11-16T18:30:00Z') });
    const a = await makeOrder(d1.db, { phone: '03000000001', now: new Date('2026-11-16T19:30:00Z') }); // aaj 12:30 AM
    const b = await makeOrder(d1.db, { phone: '03000000002' });
    const c = await makeOrder(d1.db, { phone: '03000000003' });
    const mv = async (id: string, body: Record<string, unknown>) => changeStatus(await adminReq(`/x`, { body }), env(), id, { now: () => NOW });
    await mv(a, { status: 'paid' });
    await mv(b, { status: 'paid' });
    await mv(b, { status: 'complete' });
    await mv(c, { status: 'paid' });
    await mv(c, { status: 'cancelled', cancelReason: 'x' });
    await mv(old, { status: 'paid' }); // purana order, payment aaj
    const s = (await list()).body.summary;
    expect(s).toEqual({ newToday: 3, paidToday: 3, completeToday: 1, earnedToday: 350 * 3 });
  });

  it('90 din baad naam/number mite hon to purged (F08-AC12)', async () => {
    const id = await makeOrder(d1.db);
    await d1.db.prepare("UPDATE orders SET name = '', phone = '', phone_last4 = '' WHERE id = ?").bind(id).run();
    expect((await list()).body.orders[0]).toMatchObject({ purged: true, name: '', phone: '' });
  });
});

describe('notes aur "Rabta hua" (E13, E14)', () => {
  it('public aur andaruni note alag; khali = null; 500 se zyada 400 (F08-AC8, 9.4)', async () => {
    const id = await makeOrder(d1.db);
    const note = async (kind: string, text: string) => setNote(await adminReq(`/x`, { body: { kind, text } }), env(), id);
    expect((await note('public', '  Kal subah tak  ')).status).toBe(200);
    expect((await note('admin', 'Customer ne do dafa poocha')).status).toBe(200);
    expect(await d1.db.prepare('SELECT public_note, admin_note FROM orders WHERE id = ?').bind(id).first()).toEqual({ public_note: 'Kal subah tak', admin_note: 'Customer ne do dafa poocha' });
    expect((await note('admin', '')).status).toBe(200);
    expect(await d1.db.prepare('SELECT admin_note FROM orders WHERE id = ?').bind(id).first('admin_note')).toBeNull();
    expect((await note('public', 'x'.repeat(501))).status).toBe(400);
    expect((await note('kuch', 'x')).status).toBe(400);
    expect((await setNote(await adminReq(`/x`, { body: { kind: 'public', text: 'x' } }), env(), 'GVS-2611-9999')).status).toBe(404);
  });

  it('public note /track par dikhe; andaruni nahin', async () => {
    const { trackOrder } = await import('../src/lib/track');
    const id = await makeOrder(d1.db);
    await setNote(await adminReq(`/x`, { body: { kind: 'public', text: 'Public baat' } }), env(), id);
    await setNote(await adminReq(`/x`, { body: { kind: 'admin', text: 'Raaz ki baat' } }), env(), id);
    const t = await trackOrder(new Request(`https://gvs.test/api/track?id=${id}&last4=4567`), env());
    expect(JSON.stringify(t.body)).toContain('Public baat');
    expect(JSON.stringify(t.body)).not.toContain('Raaz ki baat');
  });

  it('"Rabta hua" on/off', async () => {
    const id = await makeOrder(d1.db);
    const c = async (contacted: unknown) => setContacted(await adminReq(`/x`, { body: { contacted } }), env(), id);
    expect((await c(true)).status).toBe(200);
    expect(await d1.db.prepare('SELECT contacted FROM orders WHERE id = ?').bind(id).first('contacted')).toBe(1);
    expect((await c(false)).status).toBe(200);
    expect(await d1.db.prepare('SELECT contacted FROM orders WHERE id = ?').bind(id).first('contacted')).toBe(0);
    expect((await c('haan')).status).toBe(400);
  });
});

describe('admin-ui helpers', () => {
  it('khud rabta ka message: new (payment numbers ke sath / baghair), complete, baqi (F08-AC7, intent 9.7)', () => {
    const base = { id: 'GVS-2611-0042', name: 'Ali Raza', total: 600, whatsappOpenedAt: null };
    expect(contactMessage({ ...base, status: 'new', payment: { jazzcashNumber: '03001112223', jazzcashTitle: 'GVS', easypaisaNumber: '', easypaisaTitle: '' } })).toBe(
      'Assalam o Alaikum Ali, aap ne GVS Academy par order GVS-2611-0042 (Rs. 600) diya tha. Payment ke liye JazzCash 03001112223 (GVS). Koi sawal ho to isi chat par poochein.',
    );
    expect(contactMessage({ ...base, status: 'new' })).toContain('Payment ki tafseel isi chat par bataayi jaye gi.');
    expect(contactMessage({ ...base, status: 'complete' })).toBe('Aap ka order GVS-2611-0042 mukammal ho gaya hai. Shukriya!');
    expect(contactMessage({ ...base, status: 'paid' })).toContain('GVS-2611-0042');
  });

  it('"Wada: aaj 5:00 PM" / kal / tareekh (F08-AC5)', () => {
    expect(dueLabel('2026-11-17T12:00:00Z', NOW)).toBe('aaj 5:00 PM');
    expect(dueLabel('2026-11-18T05:30:00Z', NOW)).toBe('kal 10:30 AM');
    expect(dueLabel('2026-11-20T04:00:00Z', NOW)).toBe('20 Nov 9:00 AM');
  });

  it('datetime-local ↔ ISO Pakistan waqt mein', () => {
    expect(toKarachiInput('2026-11-17T12:00:00Z')).toBe('2026-11-17T17:00');
    expect(fromKarachiInput('2026-11-17T17:00')).toBe('2026-11-17T12:00:00.000Z');
    expect(fromKarachiInput('kal')).toBeNull();
  });

  it('kitni der pehle', () => {
    const now = NOW.getTime();
    expect(ago(NOW.toISOString(), now)).toBe('abhi');
    expect(ago(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5 minute pehle');
    expect(ago(new Date(now - 3 * 3600_000).toISOString(), now)).toBe('3 ghante pehle');
    expect(ago(new Date(now - 49 * 3600_000).toISOString(), now)).toBe('2 din pehle');
  });
});
