// spec: 10.1 csv.test (formula injection), F28-AC1 (E25 orders ka CSV), F28-AC2 / SA13, 9.2 (sirf admin)
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { makeOrder, adminReq } from './helpers/admin';
import { csvCell, csvRow, karachiTime, itemsSummary, ordersCsv, exportOrders, EXPORT_HEADER, BOM } from '../src/lib/admin-export';

describe('F28-AC2: formula injection se bachao', () => {
  it.each([
    ['=SUM(1,2)', `"'=SUM(1,2)"`],
    ['+92300', `"'+92300"`],
    ['-5', `"'-5"`],
    ['@cmd', `"'@cmd"`],
    ['\t=1', `"'\t=1"`],
    ['\r=1', `"'\r=1"`],
  ])('%j → aage apostrophe', (v, out) => expect(csvCell(v)).toBe(out));

  it('aam matn waisa hi; beech ka = ya - nahin chheda', () => {
    expect(csvCell('Ali Raza')).toBe('"Ali Raza"');
    expect(csvCell('a=b')).toBe('"a=b"');
    expect(csvCell('2026-11-22 14:05')).toBe('"2026-11-22 14:05"');
    expect(csvCell(700)).toBe('"700"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it('quotes dohre; comma aur newline cell ke andar mehfooz', () => {
    expect(csvCell('Ali "Pappu" Raza')).toBe('"Ali ""Pappu"" Raza"');
    expect(csvRow(['a,b', 'line1\nline2'])).toBe('"a,b","line1\nline2"');
  });
});

describe('madadgar', () => {
  it('karachiTime: UTC → Pakistan (+5), khali/ghalat → khali', () => {
    expect(karachiTime('2026-11-17T10:00:00Z')).toBe('2026-11-17 15:00');
    expect(karachiTime('2026-11-17T20:30:00.000Z')).toBe('2026-11-18 01:30');
    expect(karachiTime(null)).toBe('');
    expect(karachiTime('kharab')).toBe('');
  });

  it('itemsSummary: naam + tafseel; kharab json → khali', () => {
    expect(itemsSummary(JSON.stringify([{ name: 'VU Smart pack', fields: { courseCode: 'CS101' } }, { name: 'Mock series', fields: {} }]))).toBe('VU Smart pack (CS101); Mock series');
    expect(itemsSummary('{kharab')).toBe('');
    expect(itemsSummary('{"a":1}')).toBe('');
  });

  it('ordersCsv: BOM, header, CRLF', () => {
    const csv = ordersCsv([]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(BOM.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe(BOM + csvRow([...EXPORT_HEADER]) + '\r\n');
  });
});

describe('E25 GET /api/admin/export (D1)', () => {
  let d1: Awaited<ReturnType<typeof startD1>>;
  const env = () => ({ DB: d1.db, SESSION_SECRET: 'test-session-secret' });
  beforeAll(async () => {
    d1 = await startD1();
  }, 60_000);
  afterAll(async () => d1?.dispose());
  beforeEach(async () => d1.reset());

  const rows = (csv: string) => csv.replace(BOM, '').trim().split('\r\n');

  it('bina login 401 (JSON, CSV nahin)', async () => {
    const r = await exportOrders(await adminReq('/api/admin/export', { cookie: null }), env());
    expect(r.status).toBe(401);
    expect(r.headers.get('Content-Type')).toContain('application/json');
  });

  it('admin: saare orders, naye pehle, Pakistan waqt, 03 number, cheezein, no-store + attachment', async () => {
    const a = await makeOrder(d1.db, { name: 'Ali Raza', phone: '0300-1234567', now: new Date('2026-11-17T08:00:00Z') });
    const b = await makeOrder(d1.db, { name: '=HYPERLINK("http://x")', phone: '03111111111', now: new Date('2026-11-17T09:00:00Z') });
    const r = await exportOrders(await adminReq('/api/admin/export'), env(), { now: () => new Date('2026-11-22T10:00:00Z') });
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(r.headers.get('Content-Disposition')).toBe('attachment; filename="gvs-orders-2026-11-22.csv"');
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    const csv = await r.text();
    const lines = rows(csv);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(csvRow([...EXPORT_HEADER]));
    expect(lines[1].startsWith(`"${b}","2026-11-17 14:00","Naya","'=HYPERLINK(""http://x"")","03111111111","VU Smart pack (CS101)"`)).toBe(true);
    expect(lines[2].startsWith(`"${a}","2026-11-17 13:00","Naya","Ali Raza","03001234567"`)).toBe(true);
  });

  it('90 din purge shuda order: naam/number khali, line phir bhi', async () => {
    const a = await makeOrder(d1.db);
    await d1.db.prepare("UPDATE orders SET name = '', phone = '', phone_last4 = '', status = 'complete' WHERE id = ?").bind(a).run();
    const lines = rows(await (await exportOrders(await adminReq('/api/admin/export'), env())).text());
    expect(lines[1].startsWith(`"${a}","2026-11-17 15:00","Complete","",""`)).toBe(true);
  });
});
