// spec: F34-AC1..AC6, E38, E39, 9.2, 9.3
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminReq, SECRET, SITE } from './helpers/admin';
import { createOrder } from '../src/lib/orders';
import { trackOrder } from '../src/lib/track';
import { listOrders, type AdminOrder } from '../src/lib/admin-orders';
import { exportOrders } from '../src/lib/admin-export';
import { runMaintenance } from '../src/lib/maintenance';
import { EVENT_LIMIT, cleanVuStats, recordEvents, vuReport } from '../src/lib/vu-stats';
import { funnel, orderSource, parseOrderSource, sourceLabel, toSource, type VuReport } from '../src/lib/vu-source';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });
const NOW = new Date('2026-11-24T10:00:00Z');
const E = { course: 'CS101', term: 'mid', event: 'view', source: 'channel' };
async function send(events: unknown, o: { origin?: string; now?: Date; ip?: string } = {}) {
  const r = await recordEvents(
    new Request(`${SITE}/api/vu/event`, { method: 'POST', headers: { Origin: o.origin ?? SITE, 'Content-Type': 'application/json', 'CF-Connecting-IP': o.ip ?? '9.9.9.9' }, body: JSON.stringify({ events }) }),
    env(),
    { now: () => o.now ?? NOW },
  );
  return r.status;
}
const rows = async () => (await d1.db.prepare('SELECT day, course_code, term, source, event, n FROM vu_stats ORDER BY day, course_code, event').all<Record<string, unknown>>()).results;
async function report(days = 7, now = NOW) {
  const r = await vuReport(await adminReq(`/x?days=${days}`), env(), { now: () => now });
  return (r.body as unknown as { report: VuReport }).report;
}
async function order(source: unknown, items: unknown[] = [{ id: 'vu-smart', fields: { courseCode: 'cs101', term: 'Midterm' } }], phone = '0300-1234567') {
  const r = await createOrder(
    new Request(`${SITE}/api/orders`, { method: 'POST', headers: { Origin: SITE, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Ali Raza', phone, items, turnstileToken: 't', source }) }),
    { DB: d1.db, TURNSTILE_SECRET: 'x', SESSION_SECRET: SECRET },
    { now: () => NOW, verify: async () => true },
  );
  return { status: r.status, body: r.body as { id: string; message: string; total: number } };
}
const srcOf = async (id: string) => (await d1.db.prepare('SELECT source FROM orders WHERE id = ?1').bind(id).first<{ source: string | null }>())!.source;

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => {
  await d1.reset();
  await d1.db.prepare("INSERT INTO vu_courses (code, name, visible, mid_ok, created_at) VALUES ('CS101','A',1,5,'t'), ('MTH101','B',1,0,'t'), ('HID101','C',0,0,'t')").run();
});

describe('F34-AC1: ginti (E38)', () => {
  it('jurti hai; din Pakistan ka; alag source/term alag row', async () => {
    expect(await send([E, E, { ...E, event: 'start' }])).toBe(200);
    await send([E, { ...E, source: 'direct' }]);
    await send([E], { now: new Date('2026-11-24T19:30:00Z') }); // PKT mein 25 tareekh
    expect(await rows()).toEqual([
      { day: '2026-11-24', course_code: 'CS101', term: 'mid', source: 'channel', event: 'start', n: 1 },
      { day: '2026-11-24', course_code: 'CS101', term: 'mid', source: 'channel', event: 'view', n: 3 },
      { day: '2026-11-24', course_code: 'CS101', term: 'mid', source: 'direct', event: 'view', n: 1 },
      { day: '2026-11-25', course_code: 'CS101', term: 'mid', source: 'channel', event: 'view', n: 1 },
    ]);
  });
  it('anjaan/chhupa course ki row nahin; ghalat event, order, source, term, 11 events rad', async () => {
    expect(await send([{ ...E, course: 'ZZ999' }, { ...E, course: 'HID101' }])).toBe(200);
    expect(await rows()).toEqual([]);
    for (const bad of [[{ ...E, event: 'order' }], [{ ...E, event: 'x' }], [{ ...E, source: 'fb' }], [{ ...E, term: 'dono' }], [{ ...E, course: "CS101'--" }], [], Array(11).fill(E), 'x']) expect(await send(bad)).toBe(400);
  });
  it('naam/phone/IP ka khana hi nahin; kisi row mein IP nahin', async () => {
    await send([E], { ip: '203.0.113.77' });
    const cols = (await d1.db.prepare("SELECT name FROM pragma_table_info('vu_stats')").all<{ name: string }>()).results.map((r) => r.name);
    expect(cols).toEqual(['day', 'course_code', 'term', 'source', 'event', 'n']);
    const rl = (await d1.db.prepare('SELECT key FROM rate_limits').all<{ key: string }>()).results;
    expect(JSON.stringify([await rows(), rl])).not.toContain('203.0.113.77');
  });
  it('Origin 403; rate limit 429, doosri IP chalti hai', async () => {
    expect(await send([E], { origin: 'https://evil.test' })).toBe(403);
    // 100 alag requests ki jagah ginti had se ek kam par (dheemi machine par 5 s na lage); aakhri do asal requests
    expect(await send([E])).toBe(200);
    await d1.db.prepare('UPDATE rate_limits SET count = ?1').bind(EVENT_LIMIT.max - 1).run();
    expect(await send([E])).toBe(200);
    expect(await send([E])).toBe(429);
    expect(await send([E], { ip: '8.8.8.8' })).toBe(200);
  });
});

describe('F34-AC4: order ka nishan', () => {
  it('sahih source: orders.source, ginti, admin card, CSV; student ke message/track mein nahin', async () => {
    const { body } = await order('CS101:mid:channel');
    expect(await srcOf(body.id)).toBe('CS101:mid:channel');
    expect(await rows()).toMatchObject([{ event: 'order', course_code: 'CS101', source: 'channel', n: 1 }]);
    expect(body.message).not.toMatch(/VU Mock|channel/i);
    const l = (await listOrders(await adminReq('/api/admin/orders?status=all'), env(), { now: () => NOW })).body as unknown as { items?: AdminOrder[]; orders?: AdminOrder[] };
    expect((l.items ?? l.orders)![0].source).toBe('CS101:mid:channel');
    expect(await (await exportOrders(await adminReq('/api/admin/export'), env())).text()).toContain('"VU Mock: CS101 Midterm (Channel)"');
    const tr = await trackOrder(new Request(`${SITE}/api/track?id=${body.id}&last4=4567`), env(), { now: () => NOW });
    expect(tr.status).toBe(200);
    expect(JSON.stringify(tr.body)).not.toMatch(/channel|source/i);
  });
  it('ghalat, doosre course ka, ya VU pack na ho → order banta hai, nishan nahin', async () => {
    const cases: [unknown, unknown[]?][] = [['CS101:mid:fb'], [{ a: 1 }], ['x'.repeat(500)], ['MTH101:mid:channel'], ['CS101:mid:channel', [{ id: 'mock-series', fields: {} }]], [undefined]];
    for (const [i, [src, items]] of cases.entries()) {
      const r = await order(src, items, `0300-12345${10 + i}`);
      expect(r.status, JSON.stringify(src)).toBe(200);
      expect(await srcOf(r.body.id)).toBeNull();
    }
    expect(await rows()).toEqual([]);
  });
  it('vu_stats kharab ho to bhi order banta hai', async () => {
    await d1.db.prepare('DROP TABLE vu_stats').run();
    expect((await order('CS101:mid:channel')).status).toBe(200);
  });
});

describe('F34-AC3, AC5: report (E39)', () => {
  it('ginti asal events ke barabar; muddat; maang bina tayyari; 401', async () => {
    await send([E, E, E, { ...E, event: 'start' }, { ...E, event: 'done' }, { ...E, event: 'pack' }, { ...E, source: 'share' }, { ...E, course: 'MTH101', source: 'direct' }, { ...E, event: 'questions' }]);
    await send([E], { now: new Date('2026-11-10T10:00:00Z') });
    await order('CS101:mid:channel');
    const r = await report(7);
    expect([r.from, r.to]).toEqual(['2026-11-18', '2026-11-24']);
    expect(r.total).toEqual({ view: 5, start: 1, done: 1, questions: 1, pack: 1, order: 1 });
    expect(r.courses.map((c) => [c.code, c.view, c.order, c.ready])).toEqual([
      ['CS101', 4, 1, true],
      ['MTH101', 1, 0, false],
    ]);
    expect(r.sources.map((s) => [s.source, s.view, s.order])).toEqual([
      ['channel', 3, 1],
      ['direct', 1, 0],
      ['share', 1, 0],
    ]);
    expect((await report(30)).total.view).toBe(6);
    expect((await report(999)).from).toBe('2026-11-18');
    expect((await vuReport(await adminReq('/x', { cookie: null }), env())).status).toBe(401);
  });
  it('marhale: feesad aur sab se zyada chhorne wala (10 se kam ginti par nahin)', () => {
    const f = funnel({ view: 120, start: 80, done: 55, pack: 20, order: 6, questions: 0 });
    expect(f.steps.map((s) => s.pct)).toEqual([null, 67, 69, 36, 30]);
    expect(f.worst).toBe('order');
    expect(funnel({ view: 5, start: 1, done: 0, pack: 0, order: 0, questions: 0 }).worst).toBeNull();
    expect(funnel({ view: 0, start: 0, done: 0, pack: 0, order: 0, questions: 0 }).steps.every((s) => s.pct === null)).toBe(true);
  });
});

describe('F34-AC2, AC6', () => {
  it('source pehchan aur label', () => {
    expect(['channel', 'GROUP', 'share', 'status', 'facebook', '', null].map((s) => toSource(s))).toEqual(['channel', 'group', 'share', 'status', 'direct', 'direct', 'direct']);
    expect(parseOrderSource(orderSource({ code: 'CS101P', term: 'final', source: 'group' }))).toEqual({ code: 'CS101P', term: 'final', source: 'group' });
    expect(sourceLabel('CS101:final:direct')).toBe('VU Mock: CS101 Final Term (Seedha)');
    expect([sourceLabel(null), sourceLabel('=HYPERLINK("x")')]).toEqual(['', '']);
  });
  it('180 din: purani mit jati hai, cron se bhi', async () => {
    await send([E], { now: new Date('2026-05-27T10:00:00Z') }); // 181 din
    await send([E], { now: new Date('2026-05-28T10:00:00Z') }); // 180 din
    expect(await cleanVuStats(d1.db, NOW)).toBe(1);
    await send([E], { now: new Date('2026-01-01T10:00:00Z') });
    const m = await runMaintenance({ DB: d1.db }, NOW, { daily: true });
    expect(m.failed).not.toContain('vuStats');
    expect((await rows()).map((r) => r.day)).toEqual(['2026-05-28']);
  });
});
