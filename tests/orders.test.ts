// spec: 10.1 orders.test (D1): order banta hai; number unique; server qeemat; rate limit; job band par rad.
//       F04-AC2..AC7, AC11; F05-AC4; SA1, SA5, SA6, SA7; 9.3; settings seed (E01)
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { createOrder, markWhatsappOpened, orderMonth, ORDER_MSG, type OrderEnv } from '../src/lib/orders';
import { getSettings, publicSettings } from '../src/lib/settings';

const SITE = 'https://gvs.test';
let d1: Awaited<ReturnType<typeof startD1>>;
let env: OrderEnv;

const pass = async () => true;
const NOV = () => new Date('2026-11-17T10:00:00Z');

function req(body: unknown, opts: { origin?: string | null; ip?: string; path?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'CF-Connecting-IP': opts.ip ?? '10.0.0.1' };
  if (opts.origin !== null) headers.Origin = opts.origin ?? SITE;
  return new Request(SITE + (opts.path ?? '/api/orders'), { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

const ORDER = {
  name: '  Ali   Raza ',
  phone: '0300-1234567',
  items: [
    // Browser ki "price" bheji bhi jaye to ignore (F04-AC3)
    { id: 'vu-smart', fields: { courseCode: 'CS101' }, price: 1 },
    { id: 'mcq-pack', fields: { subject: 'Pakistan Studies' } },
  ],
  turnstileToken: 'tok',
};

type Body = { ok: boolean; id?: string; total?: number; message?: string; whatsappUrl?: string; trackUrl?: string; last4?: string; first?: boolean; error?: { code: string; message: string } };
async function order(body: unknown = ORDER, o: Parameters<typeof req>[1] & { now?: () => Date; verify?: () => Promise<boolean | null> } = {}) {
  const r = await createOrder(req(body, o), env, { now: o.now ?? NOV, verify: o.verify ?? pass });
  return { status: r.status, body: r.body as Body };
}

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => {
  await d1.reset();
  env = { DB: d1.db, TURNSTILE_SECRET: 'test-secret', SESSION_SECRET: 'test-session-secret' };
});

describe('settings seed (E01)', () => {
  it('seed parhi jati hai aur public settings mein koi raaz nahin', async () => {
    const s = await getSettings(d1.db);
    expect(s.whatsapp_number).toBe('03404905266');
    expect(s.orders_open).toBe(true);
    expect(s.default_job_fee).toBe(300);
    expect(s.subjects).toHaveLength(9);
    const pub = publicSettings(s);
    expect(Object.keys(pub)).not.toContain('agent_enabled');
    expect(Object.keys(pub)).not.toContain('default_job_fee');
  });
});

describe('POST /api/orders (E02)', () => {
  it('order banta hai: number GVS-YYMM-NNNN, qeemat catalog se, phone 923 shakal (F04-AC2, AC3, AC5)', async () => {
    const { status, body } = await order();
    expect(status).toBe(200);
    expect(body.id).toBe('GVS-2611-0001');
    expect(body.total).toBe(600);
    expect(body.last4).toBe('4567');
    expect(body.trackUrl).toBe(`${SITE}/track?id=GVS-2611-0001`);
    const row = await d1.db.prepare('SELECT * FROM orders WHERE id = ?').bind(body.id).first<Record<string, unknown>>();
    expect(row).toMatchObject({ name: 'Ali Raza', phone: '923001234567', phone_last4: '4567', total: 600, status: 'new', contacted: 0 });
    const items = JSON.parse(row!.items_json as string);
    expect(items[0]).toMatchObject({ id: 'vu-smart', name: 'VU Smart pack', price: 350, fields: { courseCode: 'CS101' } });
  });

  it('WhatsApp URL intent 9.3 ka message; customer ka phone message mein nahin (F04-AC8, SA3)', async () => {
    const { body } = await order();
    expect(body.whatsappUrl).toMatch(/^https:\/\/wa\.me\/923404905266\?text=/);
    expect(body.message).toContain('Mera order: GVS-2611-0001');
    expect(body.message).toContain('1. VU Smart pack (CS101) - Rs. 350');
    expect(body.message).toContain('Kul: Rs. 600');
    expect(body.message).toContain(`Order track karein: ${SITE}/track?id=GVS-2611-0001`);
    expect(body.message).not.toMatch(/1234567|0300/);
  });

  it('agla order agla number; mahina badle to 0001 se (Asia/Karachi) (SA1)', async () => {
    expect((await order()).body.id).toBe('GVS-2611-0001');
    expect((await order({ ...ORDER, phone: '03001111111' })).body.id).toBe('GVS-2611-0002');
    // 30 Nov 20:00 UTC = 1 Dec 01:00 Karachi
    const dec = () => new Date('2026-11-30T20:00:00Z');
    expect(orderMonth(dec())).toBe('2612');
    expect((await order({ ...ORDER, phone: '03002222222' }, { now: dec })).body.id).toBe('GVS-2612-0001');
  });

  it('ek sath 10 orders: sab ke number alag (SA1)', async () => {
    const res = await Promise.all(Array.from({ length: 10 }, (_, i) => order({ ...ORDER, phone: `0300000000${i}` })));
    const ids = res.map((r) => r.body.id);
    expect(res.every((r) => r.status === 200)).toBe(true);
    expect(new Set(ids).size).toBe(10);
  });

  it('order_new notification aur pehla event banta hai; notification mein naam/phone nahin (F04-AC6, SA6, SA7)', async () => {
    const { body } = await order();
    const n = await d1.db.prepare('SELECT * FROM notifications WHERE order_id = ?').bind(body.id).all<Record<string, string>>();
    expect(n.results).toHaveLength(1);
    expect(n.results[0].type).toBe('order_new');
    expect(n.results[0].message).toBe('Naya order GVS-2611-0001: Rs. 600, 2 cheez(ein)');
    expect(n.results[0].message).not.toMatch(/Ali|1234567/);
    const e = await d1.db.prepare('SELECT * FROM order_events WHERE order_id = ?').bind(body.id).all<Record<string, unknown>>();
    expect(e.results).toEqual([expect.objectContaining({ from_status: null, to_status: 'new', by: 'system' })]);
  });

  it('ek number se ghante mein 5 orders; 6th par 429; ghanta guzre to phir (F04-AC4, 9.3)', async () => {
    for (let i = 0; i < 5; i++) expect((await order()).status).toBe(200);
    const sixth = await order();
    expect(sixth.status).toBe(429);
    expect(sixth.body.error?.message).toBe(ORDER_MSG.phone_limit);
    expect(await d1.db.prepare('SELECT COUNT(*) AS c FROM orders').first('c')).toBe(5);
    const later = () => new Date(NOV().getTime() + 61 * 60 * 1000);
    expect((await order(ORDER, { now: later })).status).toBe(200);
  });

  it('rate_limits mein asal phone/IP nahin, sirf hash (7.2)', async () => {
    await order();
    const { results } = await d1.db.prepare('SELECT key FROM rate_limits').all<{ key: string }>();
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.key).toMatch(/^[0-9a-f]{64}$/);
      expect(r.key).not.toContain('1234567');
    }
  });

  it('ek IP se ghante mein 20 orders; 21st par 429 (9.3)', async () => {
    for (let i = 0; i < 20; i++) expect((await order({ ...ORDER, phone: `030000000${String(i).padStart(2, '0')}` })).status).toBe(200);
    expect((await order({ ...ORDER, phone: '03111111111' })).status).toBe(429);
  });

  it('orders band hon to rad (F04-AC4)', async () => {
    await d1.db.prepare("UPDATE settings SET value = 'false' WHERE key = 'orders_open'").run();
    const r = await order();
    expect(r.status).toBe(400);
    expect(r.body.error?.code).toBe('orders_closed');
  });

  it('Turnstile: ghalat token 400, khali token 400, service kharab 503, secret na ho 503 (F04-AC11)', async () => {
    expect((await order(ORDER, { verify: async () => false })).status).toBe(400);
    expect((await order({ ...ORDER, turnstileToken: '' })).status).toBe(400);
    expect((await order(ORDER, { verify: async () => null })).status).toBe(503);
    env = { DB: d1.db, SESSION_SECRET: 'x' };
    expect((await order()).status).toBe(503);
    expect(await d1.db.prepare('SELECT COUNT(*) AS c FROM orders').first('c')).toBe(0);
  });

  it('Origin ghalat ya ghair-maujood: 403 (8.1)', async () => {
    expect((await order(ORDER, { origin: 'https://evil.test' })).status).toBe(403);
    expect((await order(ORDER, { origin: null })).status).toBe(403);
  });

  it('body 16 KB se bari: 413; kharab JSON: 400 (8.1)', async () => {
    expect((await order({ ...ORDER, name: 'a'.repeat(17_000) })).status).toBe(413);
    expect((await order('{nahin')).status).toBe(400);
  });

  it('jaanch: ghalat naam/number, ghalat khana, anjaan/band product, 10 se zyada (F04-AC1, AC4)', async () => {
    expect((await order({ ...ORDER, name: 'A' })).body.error?.code).toBe('invalid_name');
    expect((await order({ ...ORDER, phone: '12345' })).body.error?.code).toBe('invalid_phone');
    expect((await order({ ...ORDER, items: [{ id: 'vu-smart', fields: { courseCode: 'cs 10' } }] })).body.error?.code).toBe('invalid_field');
    expect((await order({ ...ORDER, items: [{ id: 'vu-smart', fields: {} }] })).body.error?.code).toBe('invalid_field');
    expect((await order({ ...ORDER, items: [{ id: 'vu-smart', fields: { courseCode: 'CS101', x: '1' } }] })).body.error?.code).toBe('invalid_field');
    expect((await order({ ...ORDER, items: [{ id: 'mcq-pack', fields: { subject: 'Jadoo' } }] })).body.error?.code).toBe('invalid_field');
    expect((await order({ ...ORDER, items: [{ id: 'nahin-hai', fields: {} }] })).body.error?.code).toBe('invalid_item');
    expect((await order({ ...ORDER, items: [{ id: 'interview-prep', fields: {} }] })).body.error?.code).toBe('invalid_item');
    const eleven = Array.from({ length: 11 }, (_, i) => ({ id: 'vu-smart', fields: { courseCode: `CS${100 + i}` } }));
    expect((await order({ ...ORDER, items: eleven })).body.error?.code).toBe('too_many');
    expect(await d1.db.prepare('SELECT COUNT(*) AS c FROM orders').first('c')).toBe(0);
  });

  it('job apply: khuli job ki fee + documents message mein; band job par rad (F04-AC3, AC4, intent 9.3)', async () => {
    const ins = d1.db.prepare(
      `INSERT INTO jobs (id, slug, org, post, last_date, official_url, govt_fee, our_fee, documents_json, created_at, updated_at)
       VALUES (?, ?, 'PPSC', ?, ?, 'https://ppsc.gop.pk', 800, ?, ?, 't', 't')`,
    );
    await d1.db.batch([
      ins.bind(1, 'ppsc-educator', 'Educator', '2026-12-01', 500, '["CNIC","Degree"]'),
      ins.bind(2, 'ppsc-lecturer', 'Lecturer', '2026-12-01', null, '[]'),
      ins.bind(3, 'ppsc-old', 'Clerk', '2026-11-16', null, '[]'),
    ]);
    const job = (jobId: string) => ({ ...ORDER, items: [{ id: 'job-apply', jobId, fields: { jobName: 'PPSC post' } }] });

    const a = await order(job('1'));
    expect(a.body.total).toBe(500);
    expect(a.body.message).toContain('Documents: CNIC, Degree');
    expect(a.body.message).toContain('PPSC Educator');
    expect((await order({ ...job('2'), phone: '03009999999' })).body.total).toBe(300); // default_job_fee
    const closed = await order({ ...job('3'), phone: '03008888888' });
    expect(closed.status).toBe(400);
    expect(closed.body.error?.code).toBe('job_closed');
    expect((await order({ ...job('99'), phone: '03007777777' })).body.error?.code).toBe('job_closed');
  });

  it('D1 ki kharabi/had par 503 (F05-AC4)', async () => {
    const broken = { prepare: () => { throw new Error('D1_ERROR: limit'); }, batch: () => Promise.reject(new Error('x')) } as unknown as D1Database;
    env = { ...env, DB: broken };
    const r = await order();
    expect(r.status).toBe(503);
    expect(r.body.error?.code).toBe('unavailable');
  });
});

describe('POST /api/orders/:id/whatsapp-opened (E03, F04-AC7)', () => {
  const opened = (id: string, last4: string, origin?: string) =>
    markWhatsappOpened(req({ last4 }, { path: `/api/orders/${id}/whatsapp-opened`, origin }), env, id, { now: NOV });

  it('sirf pehli dafa record + ek notification', async () => {
    const { body } = await order();
    const id = body.id!;
    const first = await opened(id, '4567');
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ok: true, first: true });
    const second = await opened(id, '4567');
    expect(second.body).toMatchObject({ ok: true, first: false });
    const row = await d1.db.prepare('SELECT whatsapp_opened_at FROM orders WHERE id = ?').bind(id).first('whatsapp_opened_at');
    expect(row).toBe(NOV().toISOString());
    const n = await d1.db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE type = 'whatsapp_opened'").first('c');
    expect(n).toBe(1);
  });

  it('ghalat last4 ya ghalat id: ek hi "Order nahin mila"; Origin ghalat 403', async () => {
    const { body } = await order();
    const a = await opened(body.id!, '0000');
    const b = await opened('GVS-2611-9999', '4567');
    expect(a.status).toBe(404);
    expect(b.body).toEqual(a.body);
    expect((await opened(body.id!, '4567', 'https://evil.test')).status).toBe(403);
  });
});
