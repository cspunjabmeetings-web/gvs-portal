// spec: E15, F09-AC1 (qismein, naye upar), F09-AC2 (parh liya, sab parh liye), F09-AC3 (na-parhi ginti), F09-AC4 (low_mcq_bank din mein 1), F08-AC11 (since se polling), qaida 11
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { makeOrder, adminReq, SECRET } from './helpers/admin';
import { listNotifications, markRead, notifyLowMcqBank, NOTIFY_PAGE, READ_MAX_IDS, type AdminNotification } from '../src/lib/notify';
import { changeStatus } from '../src/lib/admin-orders';
import { markWhatsappOpened } from '../src/lib/orders';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
const NOW = new Date('2026-11-17T10:00:00Z'); // 3 PM PKT

type ListBody = { ok: boolean; items: AdminNotification[]; hasMore: boolean; unread: number };
async function list(params: Record<string, string> = {}) {
  const r = await listNotifications(await adminReq(`/api/admin/notifications?${new URLSearchParams(params)}`), env());
  return { status: r.status, body: r.body as ListBody };
}
async function read(body: unknown, o: { cookie?: string | null; origin?: string } = {}) {
  const r = await markRead(await adminReq('/api/admin/notifications/read', { body, ...o }), env(), { now: () => NOW });
  return { status: r.status, body: r.body as { ok: boolean; unread: number } };
}

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('GET /api/admin/notifications (E15)', () => {
  it('bina cookie 401 (F07-AC3)', async () => {
    const r = await listNotifications(await adminReq('/api/admin/notifications', { cookie: null }), env());
    expect(r.status).toBe(401);
  });

  it('naya order, WhatsApp khola, darja badla: teeno, naye upar, ginti 3 (F09-AC1, AC3)', async () => {
    const id = await makeOrder(d1.db, { name: 'Bilal Ahmed', phone: '0345-1112233' });
    const opened = await markWhatsappOpened(
      new Request(`https://gvs.test/api/orders/${id}/whatsapp-opened`, {
        method: 'POST',
        headers: { Origin: 'https://gvs.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ last4: '2233' }),
      }),
      { DB: d1.db },
      id,
      { now: () => new Date('2026-11-17T10:01:00Z') },
    );
    expect(opened.status).toBe(200);
    const st = await changeStatus(await adminReq(`/api/admin/orders/${id}/status`, { body: { status: 'paid' } }), env(), id, { now: () => new Date('2026-11-17T10:02:00Z') });
    expect(st.status).toBe(200);

    const { status, body } = await list();
    expect(status).toBe(200);
    expect(body.items.map((n) => n.type)).toEqual(['status_changed', 'whatsapp_opened', 'order_new']);
    expect(body.items.every((n) => n.orderId === id && n.readAt === null)).toBe(true);
    expect(body.unread).toBe(3);
    expect(body.hasMore).toBe(false);
    // Qaida 11: naam/phone notification mein nahin
    const text = JSON.stringify(body.items);
    expect(text).not.toMatch(/Bilal|1112233|923451112233/);
  });

  it('since: sirf naye (polling); before: purane ("Aur dikhayen"); unread=1', async () => {
    await makeOrder(d1.db);
    const first = (await list()).body.items[0].id;
    expect((await list({ since: String(first) })).body.items).toEqual([]);
    await makeOrder(d1.db, { phone: '03111111111' });
    const fresh = (await list({ since: String(first) })).body.items;
    expect(fresh).toHaveLength(1);
    expect(fresh[0].id).toBeGreaterThan(first);
    expect((await list({ before: String(fresh[0].id) })).body.items.map((n) => n.id)).toEqual([first]);
    await read({ ids: [first] });
    expect((await list({ unread: '1' })).body.items.map((n) => n.id)).toEqual([fresh[0].id]);
    // Kharab cursor nazar-andaz
    expect((await list({ since: "1 OR 1=1", before: '-5' })).body.items).toHaveLength(2);
  });

  it(`${NOTIFY_PAGE} ek dafa, phir hasMore`, async () => {
    const stmt = d1.db.prepare("INSERT INTO notifications (type, order_id, message, created_at) VALUES ('low_mcq_bank', NULL, ?1, ?2)");
    await d1.db.batch(Array.from({ length: NOTIFY_PAGE + 3 }, (_, i) => stmt.bind(`n${i}`, NOW.toISOString())));
    const a = (await list()).body;
    expect(a.items).toHaveLength(NOTIFY_PAGE);
    expect(a.hasMore).toBe(true);
    expect(a.unread).toBe(NOTIFY_PAGE + 3);
    const b = (await list({ before: String(a.items[a.items.length - 1].id) })).body;
    expect(b.items).toHaveLength(3);
    expect(b.hasMore).toBe(false);
  });
});

describe('POST /api/admin/notifications/read (E15, F09-AC2)', () => {
  it('"Parh liya": sirf wohi; ginti ghatti hai', async () => {
    await makeOrder(d1.db);
    await makeOrder(d1.db, { phone: '03111111111' });
    const [n2, n1] = (await list()).body.items;
    const r = await read({ ids: [n1.id] });
    expect(r).toEqual({ status: 200, body: { ok: true, unread: 1 } });
    const after = (await list()).body.items;
    expect(after.find((n) => n.id === n1.id)?.readAt).toBe(NOW.toISOString());
    expect(after.find((n) => n.id === n2.id)?.readAt).toBeNull();
    // Dobara parhna waqt nahin badalta
    await markRead(await adminReq('/api/admin/notifications/read', { body: { ids: [n1.id] } }), env(), { now: () => new Date('2026-11-18T10:00:00Z') });
    expect((await list()).body.items.find((n) => n.id === n1.id)?.readAt).toBe(NOW.toISOString());
  });

  it('"Sab parh liye": ginti 0', async () => {
    await makeOrder(d1.db);
    await makeOrder(d1.db, { phone: '03111111111' });
    expect((await read({ all: true })).body.unread).toBe(0);
    expect((await list()).body.items.every((n) => n.readAt === NOW.toISOString())).toBe(true);
  });

  it('bina cookie 401, ghalat Origin 403, JSON nahin 400, kharab body 400', async () => {
    expect((await read({ all: true }, { cookie: null })).status).toBe(401);
    expect((await read({ all: true }, { origin: 'https://evil.test' })).status).toBe(403);
    const form = new Request('https://gvs.test/api/admin/notifications/read', {
      method: 'POST',
      headers: { Origin: 'https://gvs.test', 'Content-Type': 'text/plain', Cookie: (await adminReq('/x')).headers.get('Cookie')! },
      body: '{"all":true}',
    });
    expect((await markRead(form, env())).status).toBe(400);
    for (const bad of [{}, { all: false }, { ids: [] }, { ids: [0] }, { ids: [1.5] }, { ids: ['1'] }]) expect((await read(bad)).status).toBe(400);
  });

  it(`ids ki hadd ${READ_MAX_IDS}`, async () => {
    const ids = Array.from({ length: READ_MAX_IDS }, (_, i) => i + 1);
    expect((await read({ ids })).status).toBe(200);
    expect((await read({ ids: [...ids, READ_MAX_IDS + 1] })).status).toBe(400);
  });
});

describe('notifyLowMcqBank (F09-AC4)', () => {
  it('ek din (Pakistan waqt) mein sirf ek; agle din phir', async () => {
    expect(await notifyLowMcqBank(d1.db, 'Agle 7 din ke liye MCQs kam hain', new Date('2026-11-17T04:00:00Z'))).toBe(true); // 9 AM PKT
    expect(await notifyLowMcqBank(d1.db, 'dobara', new Date('2026-11-17T18:00:00Z'))).toBe(false); // 11 PM PKT, wohi din
    expect(await notifyLowMcqBank(d1.db, 'agla din', new Date('2026-11-17T19:30:00Z'))).toBe(true); // 12:30 AM PKT 18 Nov
    const items = (await list()).body.items.filter((n) => n.type === 'low_mcq_bank');
    expect(items.map((n) => n.message)).toEqual(['agla din', 'Agle 7 din ke liye MCQs kam hain']);
    expect(items[0].orderId).toBeNull();
  });
});
