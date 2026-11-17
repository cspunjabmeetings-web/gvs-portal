// spec: 10.1 status.test (D1): section 8.6 ki har ijazat/rok; event + notification. F08-AC4, AC5, AC6, AC9; SA4; A-08
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { makeOrder, adminReq, SECRET } from './helpers/admin';
import { changeStatus, type AdminOrder } from '../src/lib/admin-orders';
import { ALLOWED, canMove } from '../src/lib/admin-ui';
import type { OrderStatus } from '../src/lib/track';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
// 17 Nov 2026 3:00 PM Pakistan
const PAID_AT = new Date('2026-11-17T10:00:00Z');

type Body = { ok: boolean; order?: AdminOrder; error?: { code: string; message: string } };
async function move(id: string, body: Record<string, unknown>, now = PAID_AT) {
  const r = await changeStatus(await adminReq(`/api/admin/orders/${id}/status`, { body }), env(), id, { now: () => now });
  return { status: r.status, body: r.body as Body };
}
const row = (id: string) => d1.db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Record<string, unknown>>();
async function setStatus(id: string, s: OrderStatus) {
  await d1.db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(s, id).run();
}

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('8.6 ki table (pure)', () => {
  const all: OrderStatus[] = ['new', 'paid', 'pending', 'complete', 'cancelled'];
  const allowed = new Set(['new>paid', 'paid>pending', 'paid>complete', 'pending>complete', 'new>cancelled', 'paid>cancelled', 'pending>cancelled', 'paid>new', 'pending>paid', 'complete>pending']);
  it('sirf yehi 10 tabdeeliyan; complete→cancelled aur cancelled se kahin nahin', () => {
    for (const a of all) for (const b of all) expect(canMove(a, b), `${a}>${b}`).toBe(allowed.has(`${a}>${b}`));
    expect(ALLOWED.cancelled).toEqual([]);
  });
});

describe('POST /api/admin/orders/:id/status (E12)', () => {
  it('new → paid: paid_at + wada kaam ke auqaat mein (3 PM + 120 min = 5 PM); event + notification (F08-AC5, AC9, SA4)', async () => {
    const id = await makeOrder(d1.db);
    const r = await move(id, { status: 'paid' });
    expect(r.status).toBe(200);
    expect(r.body.order).toMatchObject({ status: 'paid', paidAt: PAID_AT.toISOString(), dueAt: '2026-11-17T12:00:00.000Z' });
    const ev = await d1.db.prepare("SELECT from_status, to_status, \"by\" FROM order_events WHERE order_id = ? AND to_status = 'paid'").bind(id).first();
    expect(ev).toEqual({ from_status: 'new', to_status: 'paid', by: 'admin' });
    const n = await d1.db.prepare("SELECT message FROM notifications WHERE type = 'status_changed' AND order_id = ?").bind(id).all<{ message: string }>();
    expect(n.results.map((x) => x.message)).toEqual([`Order ${id}: Naya se Paid`]);
  });

  it('kai cheezein: sab se lamba waqt (catalog: dono 120) aur raat 9:30 par paid → kal 10:30 (SA4)', async () => {
    const id = await makeOrder(d1.db, { items: [{ id: 'vu-smart', fields: { courseCode: 'CS101' } }, { id: 'mock-series', fields: {} }] });
    const night = new Date('2026-11-17T16:30:00Z'); // 9:30 PM PKT
    const r = await move(id, { status: 'paid' }, night);
    // 120 min: 30 aaj + 90 kal → kal 10:30 AM PKT = 05:30Z
    expect(r.body.order!.dueAt).toBe('2026-11-18T05:30:00.000Z');
  });

  it('settings ka override catalog par ghalib (A-05)', async () => {
    await d1.db.prepare(`UPDATE settings SET value = '{"vu-smart":60}' WHERE key = 'delivery_overrides'`).run();
    const id = await makeOrder(d1.db);
    expect((await move(id, { status: 'paid' })).body.order!.dueAt).toBe('2026-11-17T11:00:00.000Z');
  });

  it('owner ka badla hua wada (F08-AC5)', async () => {
    const id = await makeOrder(d1.db);
    const r = await move(id, { status: 'paid', dueAt: '2026-11-17T13:30:00.000Z' });
    expect(r.body.order!.dueAt).toBe('2026-11-17T13:30:00.000Z');
  });

  it('ghalat wada (kharab ya 60 din se aage) 400', async () => {
    const id = await makeOrder(d1.db);
    expect((await move(id, { status: 'paid', dueAt: 'kal' })).status).toBe(400);
    expect((await move(id, { status: 'paid', dueAt: '2027-03-01T00:00:00Z' })).status).toBe(400);
    expect((await row(id))!.status).toBe('new');
  });

  it('paid → pending → complete: completed_at + completed_by admin', async () => {
    const id = await makeOrder(d1.db);
    await move(id, { status: 'paid' });
    await move(id, { status: 'pending' });
    const r = await move(id, { status: 'complete' });
    expect(r.body.order!.status).toBe('complete');
    expect(await row(id)).toMatchObject({ completed_at: PAID_AT.toISOString(), completed_by: 'admin' });
  });

  it('paid → complete seedha', async () => {
    const id = await makeOrder(d1.db);
    await move(id, { status: 'paid' });
    expect((await move(id, { status: 'complete' })).status).toBe(200);
  });

  it('peeche: complete → pending (completed_at saaf), paid → new (paid_at, due_at saaf)', async () => {
    const id = await makeOrder(d1.db);
    await move(id, { status: 'paid' });
    await move(id, { status: 'complete' });
    await move(id, { status: 'pending' });
    expect(await row(id)).toMatchObject({ status: 'pending', completed_at: null, completed_by: null });
    await move(id, { status: 'paid' });
    await move(id, { status: 'new' });
    expect(await row(id)).toMatchObject({ status: 'new', paid_at: null, due_at: null });
  });

  it('cancel: wajah lazmi (≤ 200); wajah save (F08-AC6)', async () => {
    const id = await makeOrder(d1.db);
    expect((await move(id, { status: 'cancelled' })).body.error?.code).toBe('reason');
    expect((await move(id, { status: 'cancelled', cancelReason: '   ' })).body.error?.code).toBe('reason');
    expect((await move(id, { status: 'cancelled', cancelReason: 'x'.repeat(201) })).body.error?.code).toBe('reason');
    const r = await move(id, { status: 'cancelled', cancelReason: '48 ghante payment nahin aayi' });
    expect(r.body.order).toMatchObject({ status: 'cancelled', cancelReason: '48 ghante payment nahin aayi' });
  });

  it('mana: new → complete, new → pending, complete → cancelled, cancelled → kuch bhi (F08-AC4)', async () => {
    const id = await makeOrder(d1.db);
    for (const s of ['complete', 'pending'] as const) expect((await move(id, { status: s })).body.error?.code).toBe('not_allowed');
    await setStatus(id, 'complete');
    expect((await move(id, { status: 'cancelled', cancelReason: 'x' })).body.error?.code).toBe('not_allowed');
    await setStatus(id, 'cancelled');
    for (const s of ['new', 'paid', 'pending', 'complete'] as const) expect((await move(id, { status: s })).status).toBe(400);
  });

  it('mana tabdeeli par event/notification nahin', async () => {
    const id = await makeOrder(d1.db);
    await move(id, { status: 'complete' });
    expect(await d1.db.prepare('SELECT COUNT(*) AS c FROM order_events WHERE order_id = ?').bind(id).first('c')).toBe(1); // sirf 'new'
    expect(await d1.db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE type = 'status_changed'").first('c')).toBe(0);
  });

  it('sirf wada badalna (A-08): paid/pending par; new par 400; event nahin', async () => {
    const id = await makeOrder(d1.db);
    expect((await move(id, { dueAt: '2026-11-17T14:00:00Z' })).body.error?.code).toBe('due_status');
    await move(id, { status: 'paid' });
    const r = await move(id, { dueAt: '2026-11-17T14:00:00Z' });
    expect(r.body.order!.dueAt).toBe('2026-11-17T14:00:00.000Z');
    expect(await d1.db.prepare("SELECT COUNT(*) AS c FROM order_events WHERE order_id = ? AND to_status = 'paid'").bind(id).first('c')).toBe(1);
  });

  it('do tab ek sath: doosri tabdeeli 409 (darja pehle hi badal gaya)', async () => {
    const id = await makeOrder(d1.db);
    const [a, b] = await Promise.all([move(id, { status: 'paid' }), move(id, { status: 'cancelled', cancelReason: 'x' })]);
    const codes = [a.status, b.status].sort();
    expect(codes[0]).toBe(200);
    expect([400, 409]).toContain(codes[1]);
    expect(await d1.db.prepare('SELECT COUNT(*) AS c FROM order_events WHERE order_id = ?').bind(id).first('c')).toBe(2);
  });

  it('anjaan order 404; khali body 400; bina cookie 401; Origin ghalat 403; JSON nahin 400', async () => {
    expect((await move('GVS-2611-9999', { status: 'paid' })).status).toBe(404);
    const id = await makeOrder(d1.db);
    expect((await move(id, {})).status).toBe(400);
    expect((await changeStatus(await adminReq(`/x`, { body: { status: 'paid' }, cookie: null }), env(), id)).status).toBe(401);
    expect((await changeStatus(await adminReq(`/x`, { body: { status: 'paid' }, origin: 'https://evil.test' }), env(), id)).status).toBe(403);
    const plain = new Request('https://gvs.test/x', { method: 'POST', headers: { Origin: 'https://gvs.test', Cookie: (await adminReq('/x')).headers.get('Cookie')!, 'Content-Type': 'text/plain' }, body: '{"status":"paid"}' });
    expect((await changeStatus(plain, env(), id)).status).toBe(400);
    expect((await row(id))!.status).toBe('new');
  });

  it('/track par paid ka timer aur cancel ki wajah foran (F08-AC5, AC6)', async () => {
    const { trackOrder } = await import('../src/lib/track');
    const id = await makeOrder(d1.db);
    await move(id, { status: 'paid' });
    const t = await trackOrder(new Request(`https://gvs.test/api/track?id=${id}&last4=4567`), env(), { now: () => PAID_AT });
    expect((t.body as { order: { status: string; dueAt: string } }).order).toMatchObject({ status: 'paid', dueAt: '2026-11-17T12:00:00.000Z' });
  });
});
