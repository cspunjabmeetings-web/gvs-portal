// spec: 10.1 agent.test (D1): agent_enabled=false par 404; `paid` nahin kar sakta. F27-AC1..AC5, E30..E33, intent 25.12, 25.13
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { startD1 } from './helpers/d1';
import { makeOrder, SITE } from './helpers/admin';
import {
  agentOrders,
  agentNotifications,
  agentComplete,
  agentNote,
  hashAgentKey,
  resolveFileHint,
  AGENT_KEY_SETTING,
  type AgentOrder,
} from '../src/lib/agent';
import { activeProducts } from '../src/lib/catalog';
import data from '../src/data/catalog.json';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db });
const KEY = 'gvs-agent-test-key-0123456789abcdef';
const NOW = new Date('2026-11-17T12:00:00Z');
const deps = { now: () => NOW };

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

async function enable(on = true, key: string | null = KEY) {
  await d1.db.prepare("UPDATE settings SET value = ? WHERE key = 'agent_enabled'").bind(on ? 'true' : 'false').run();
  if (key !== null) {
    await d1.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(AGENT_KEY_SETTING, await hashAgentKey(key)).run();
  }
}

function req(path: string, o: { key?: string | null; body?: unknown; auth?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (o.auth !== undefined) headers.Authorization = o.auth;
  else if (o.key !== null) headers.Authorization = `Bearer ${o.key ?? KEY}`;
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(SITE + path, { method: o.body !== undefined ? 'POST' : 'GET', headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
}

const call = {
  orders: (o: Parameters<typeof req>[1] = {}, q = '?status=paid') => agentOrders(req('/api/agent/orders' + q, o), env(), deps),
  notifs: (o: Parameters<typeof req>[1] = {}, q = '') => agentNotifications(req('/api/agent/notifications' + q, o), env(), deps),
  complete: (id: string, o: Parameters<typeof req>[1] = {}) => agentComplete(req(`/api/agent/orders/${id}/complete`, { body: {}, ...o }), env(), id, deps),
  note: (id: string, o: Parameters<typeof req>[1] = {}) => agentNote(req(`/api/agent/orders/${id}/note`, { body: { note: 'x' }, ...o }), env(), id, deps),
};

const order = (id: string) => d1.db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Record<string, unknown>>();
const logCount = async () => (await d1.db.prepare('SELECT COUNT(*) AS n FROM agent_log').first<{ n: number }>())!.n;
async function setStatus(id: string, s: string) {
  await d1.db.prepare('UPDATE orders SET status = ?, paid_at = ? WHERE id = ?').bind(s, s === 'new' ? null : NOW.toISOString(), id).run();
}

describe('F27-AC1: agent_enabled = false (Version 1) par charon 404', () => {
  it('seed mein agent_enabled false hai aur key ka hash nahin', async () => {
    const r = await d1.db.prepare("SELECT key, value FROM settings WHERE key IN ('agent_enabled', ?)").bind(AGENT_KEY_SETTING).all();
    expect(r.results).toEqual([{ key: 'agent_enabled', value: 'false' }]);
  });

  it('sahih key ke sath bhi 404; koi order nahin badalta, log khali', async () => {
    const id = await makeOrder(d1.db);
    await setStatus(id, 'paid');
    await enable(false); // hash maujood, lekin band
    for (const r of [await call.orders(), await call.notifs(), await call.complete(id), await call.note(id)]) {
      expect(r.status).toBe(404);
      expect(JSON.stringify(r.body)).not.toMatch(/agent/i);
    }
    expect((await order(id))!.status).toBe('paid');
    expect(await logCount()).toBe(0);
  });

  it('band par key ke baghair bhi 404 (401 nahin, taake wujood zahir na ho)', async () => {
    expect((await call.orders({ key: null })).status).toBe(404);
  });
});

describe('F27-AC2: Bearer key; DB mein sirf hash', () => {
  it('ghalat key, key nahin, "Bearer" nahin, chhoti key → 401', async () => {
    await enable();
    expect((await call.orders({ key: 'ghalat-key-0123456789abcdef' })).status).toBe(401);
    expect((await call.orders({ key: null })).status).toBe(401);
    expect((await call.orders({ auth: KEY })).status).toBe(401);
    expect((await call.orders({ auth: 'Basic ' + KEY })).status).toBe(401);
    expect((await call.orders({ key: 'short' })).status).toBe(401);
    expect(await logCount()).toBe(0);
  });

  it('on ho lekin hash na ho (V1 mein button band) → har key 401', async () => {
    await enable(true, null);
    expect((await call.orders()).status).toBe(401);
  });

  it('sahih key → 200; settings mein sirf 64-hex hash, asal key kahin nahin', async () => {
    await enable();
    expect((await call.orders()).status).toBe(200);
    const all = await d1.db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
    expect(all.results.some((r) => r.value.includes(KEY))).toBe(false);
    const h = all.results.find((r) => r.key === AGENT_KEY_SETTING)!.value;
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(await hashAgentKey(KEY));
  });

  it('hash public /api/settings (E01) aur admin settings ki shakal mein nahin aata', async () => {
    await enable();
    const { getSettings, publicSettings } = await import('../src/lib/settings');
    const s = await getSettings(d1.db);
    expect(JSON.stringify(s)).not.toContain(await hashAgentKey(KEY));
    expect(JSON.stringify(publicSettings(s))).not.toMatch(/agent/);
  });
});

describe('E30: paid orders + fileHint (F27-AC5)', () => {
  it('sirf paid (new/pending/complete/cancelled nahin), purane pehle; naam/number, structured fields, fileHint + file', async () => {
    await enable();
    const a = await makeOrder(d1.db, { items: [{ id: 'vu-smart', fields: { courseCode: 'cs101' } }, { id: 'mcq-pack', fields: { subject: 'Pakistan Studies' } }] });
    const b = await makeOrder(d1.db, { items: [{ id: 'cv-cover', fields: {} }] });
    const c = await makeOrder(d1.db);
    const d = await makeOrder(d1.db);
    await setStatus(a, 'paid');
    await d1.db.prepare("UPDATE orders SET status = 'paid', paid_at = '2026-11-17T09:00:00.000Z' WHERE id = ?").bind(b).run();
    await setStatus(c, 'pending');
    // d = new
    const r = await call.orders();
    expect(r.status).toBe(200);
    const orders = (r.body as { orders: AgentOrder[] }).orders;
    expect(orders.map((o) => o.id)).toEqual([b, a]);
    expect(orders.map((o) => o.id)).not.toContain(d);
    const oa = orders[1];
    expect(oa).toMatchObject({ name: 'Ali Raza', phone: '923001234567', status: 'paid' });
    expect(oa.items[0]).toMatchObject({ id: 'vu-smart', fields: { courseCode: 'cs101' }, fileHint: 'VU/{courseCode}/Smart.pdf', file: 'VU/CS101/Smart.pdf' });
    expect(oa.items[1]).toMatchObject({ fields: { subject: 'Pakistan Studies' }, file: 'MCQs/Pakistan-Studies.pdf' });
    expect(orders[0].items[0]).toMatchObject({ id: 'cv-cover', fileHint: '', file: null });
  });

  it('status=paid ke ilawa 400; har kamyab request agent_log mein (naam/phone nahin)', async () => {
    await enable();
    expect((await call.orders({}, '?status=new')).status).toBe(400);
    await call.orders();
    const log = await d1.db.prepare('SELECT action, order_id, at FROM agent_log').all();
    expect(log.results).toEqual([{ action: 'list_orders', order_id: null, at: NOW.toISOString() }]);
  });
});

describe('intent 25.13: file ka rasta', () => {
  it('khali jagah → "-", course code bare harf, ajeeb harf hat jate, "/" se folder nahin badalta', () => {
    expect(resolveFileHint('Past-Papers/{postName}.pdf', { postName: 'PPSC Educator BPS-14' })).toBe('Past-Papers/PPSC-Educator-BPS-14.pdf');
    expect(resolveFileHint('Current-Affairs/{month}.pdf', { month: '2026-11' })).toBe('Current-Affairs/2026-11.pdf');
    expect(resolveFileHint('VU/{courseCode}/Topper.pdf', { courseCode: 'mth101a' })).toBe('VU/MTH101A/Topper.pdf');
    expect(resolveFileHint('Past-Papers/{postName}.pdf', { postName: '../../etc/passwd' })).toBe('Past-Papers/etc-passwd.pdf');
    expect(resolveFileHint('MCQs/{subject}.pdf', {})).toBeNull();
    expect(resolveFileHint('', { a: 'b' })).toBeNull();
  });

  it('catalog: har product mein fileHint field; har {khana} us product ka asal field hai; folder 25.13 ke naam', () => {
    for (const p of data.products) {
      expect(typeof p.fileHint, p.id).toBe('string');
      for (const [, key] of p.fileHint.matchAll(/\{([A-Za-z0-9_]+)\}/g)) expect(p.fields.map((f) => f.key), p.id).toContain(key);
    }
    const hints = activeProducts().map((p) => p.fileHint).filter(Boolean);
    for (const h of hints) expect(h).toMatch(/^(VU|MCQs|Past-Papers|Current-Affairs)\//);
  });
});

describe('E31: notifications', () => {
  it('since ke baad, purane pehle; ghalat since 400; log', async () => {
    await enable();
    await makeOrder(d1.db);
    await makeOrder(d1.db);
    const all = (await call.notifs()).body as { items: { id: number; message: string }[]; hasMore: boolean };
    expect(all.items.length).toBe(2);
    expect(all.items[0].id).toBeLessThan(all.items[1].id);
    const after = (await call.notifs({}, `?since=${all.items[0].id}`)).body as { items: { id: number }[] };
    expect(after.items.map((x) => x.id)).toEqual([all.items[1].id]);
    expect((await call.notifs({}, '?since=abc')).status).toBe(400);
    expect(await logCount()).toBe(2);
  });
});

describe('E32 complete + F27-AC3 (agent Paid nahin kar sakta)', () => {
  it('paid → complete: completed_by agent, event by agent, notification, note, log; /track par complete', async () => {
    await enable();
    const id = await makeOrder(d1.db);
    await setStatus(id, 'paid');
    const r = await call.complete(id, { body: { note: 'File bhej di gayi' } });
    expect(r.status).toBe(200);
    const o = (await order(id))!;
    expect(o).toMatchObject({ status: 'complete', completed_by: 'agent', completed_at: NOW.toISOString(), admin_note: 'File bhej di gayi' });
    const ev = await d1.db.prepare('SELECT from_status, to_status, "by" FROM order_events WHERE order_id = ? AND to_status = ?').bind(id, 'complete').first();
    expect(ev).toEqual({ from_status: 'paid', to_status: 'complete', by: 'agent' });
    const n = await d1.db.prepare("SELECT message FROM notifications WHERE type = 'status_changed' AND order_id = ?").bind(id).first<{ message: string }>();
    expect(n!.message).toBe(`Order ${id}: Paid se Complete (agent)`);
    expect(n!.message).not.toMatch(/Ali|0300|923/);
    const log = await d1.db.prepare('SELECT action, order_id FROM agent_log').all();
    expect(log.results).toEqual([{ action: 'complete', order_id: id }]);
    const { trackOrder } = await import('../src/lib/track');
    const t = await trackOrder(new Request(`${SITE}/api/track?id=${id}&last4=4567`, { headers: { 'CF-Connecting-IP': '10.9.9.9' } }), { DB: d1.db, SESSION_SECRET: 's' }, deps);
    expect((t.body as { order?: { status: string } }).order?.status).toBe('complete');
  });

  it('pending → complete theek; note ke baghair purana admin note wahi', async () => {
    await enable();
    const id = await makeOrder(d1.db);
    await setStatus(id, 'pending');
    await d1.db.prepare("UPDATE orders SET admin_note = 'owner ka note' WHERE id = ?").bind(id).run();
    expect((await call.complete(id)).status).toBe(200);
    expect((await order(id))!).toMatchObject({ status: 'complete', admin_note: 'owner ka note' });
  });

  it('new (bina payment) → complete 409: agent payment ko nahin chhod sakta; cancelled/complete bhi 409; kuch nahin badalta', async () => {
    await enable();
    for (const s of ['new', 'cancelled', 'complete']) {
      const id = await makeOrder(d1.db);
      await setStatus(id, s);
      const r = await call.complete(id);
      expect(r.status, s).toBe(409);
      expect((await order(id))!.status).toBe(s);
      const ev = await d1.db.prepare('SELECT COUNT(*) AS n FROM order_events WHERE "by" = \'agent\'').first<{ n: number }>();
      expect(ev!.n).toBe(0);
    }
    expect(await logCount()).toBe(0);
  });

  it('body mein total/price bhejna asar nahin karta (sirf note qabool; qeemat wahi)', async () => {
    await enable();
    const id = await makeOrder(d1.db);
    await setStatus(id, 'paid');
    const before = (await order(id))!;
    const r = await call.complete(id, { body: { note: 'x', total: 1 } });
    // Valibot object anjaan keys hata deta hai → complete hota hai, lekin qeemat wahi
    expect(r.status).toBe(200);
    expect((await order(id))!.total).toBe(before.total);
    expect((await order(id))!.items_json).toBe(before.items_json);
  });

  it('na mila order 404; 500+ harf note 400; ghalat JSON 400', async () => {
    await enable();
    expect((await call.complete('GVS-0000-000')).status).toBe(404);
    const id = await makeOrder(d1.db);
    await setStatus(id, 'paid');
    expect((await call.complete(id, { body: { note: 'a'.repeat(501) } })).status).toBe(400);
    const bad = new Request(`${SITE}/api/agent/orders/${id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: '{oops' });
    expect((await agentComplete(bad, env(), id, deps)).status).toBe(400);
    expect((await order(id))!.status).toBe('paid');
  });

  it('F27-AC3: agent ke sirf yeh 4 route hain; paid/status/price/delete ka koi route nahin', () => {
    const root = join(process.cwd(), 'src/pages/api/agent');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else files.push(relative(root, p).replace(/\\/g, '/'));
      }
    };
    walk(root);
    expect(files.sort()).toEqual(['notifications.ts', 'orders.ts', 'orders/[id]/complete.ts', 'orders/[id]/note.ts']);
  });
});

describe('E33 note', () => {
  it('admin note likhta hai, khali = NULL, log; na mila 404 (log nahin)', async () => {
    await enable();
    const id = await makeOrder(d1.db);
    expect((await call.note(id, { body: { note: '  File nahin mili, owner tayyar kare ' } })).status).toBe(200);
    expect((await order(id))!.admin_note).toBe('File nahin mili, owner tayyar kare');
    expect((await order(id))!.status).toBe('new');
    expect((await call.note(id, { body: { note: '' } })).status).toBe(200);
    expect((await order(id))!.admin_note).toBeNull();
    expect((await call.note('GVS-0000-000')).status).toBe(404);
    const log = await d1.db.prepare('SELECT action, order_id FROM agent_log ORDER BY id').all();
    expect(log.results).toEqual([
      { action: 'note', order_id: id },
      { action: 'note', order_id: id },
    ]);
  });
});
