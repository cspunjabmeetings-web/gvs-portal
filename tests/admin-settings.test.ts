// spec: E24, F10-AC1..AC7 (Settings ki jaanch, ghalat par kuch mehfooz nahin, orders band, elaan, mazameen, agent band), 9.2
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { makeOrder, adminReq, SECRET, SITE } from './helpers/admin';
import { readAdminSettings, saveAdminSettings } from '../src/lib/admin-settings';
import { getSettings, publicSettings, DEFAULT_SETTINGS } from '../src/lib/settings';
import { SETTINGS_MSG, validateSettingsPatch, pickEditable } from '../src/lib/settings-rules';
import { trackOrder } from '../src/lib/track';
import { activeProducts } from '../src/lib/catalog';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = () => ({ DB: d1.db, SESSION_SECRET: SECRET });

type Body = { ok: boolean; settings?: Record<string, unknown>; agent_enabled?: boolean; products?: { id: string }[]; error?: { field?: string; message: string } };
async function save(settings: unknown, o: { cookie?: string | null; origin?: string } = {}) {
  const r = await saveAdminSettings(await adminReq('/api/admin/settings', { body: { settings }, ...o }), env());
  return { status: r.status, body: r.body as Body };
}
const rawRows = async () => (await d1.db.prepare('SELECT key, value FROM settings ORDER BY key').all<{ key: string; value: string }>()).results;

beforeAll(async () => {
  d1 = await startD1();
}, 60_000);
afterAll(async () => d1?.dispose());
beforeEach(async () => d1.reset());

describe('GET /api/admin/settings (E24)', () => {
  it('bina cookie 401', async () => {
    const r = await readAdminSettings(await adminReq('/api/admin/settings', { cookie: null }), env());
    expect(r.status).toBe(401);
  });

  it('seed ki values, products, agent band (F10-AC6)', async () => {
    const r = await readAdminSettings(await adminReq('/api/admin/settings'), env());
    const b = r.body as Body;
    expect(r.status).toBe(200);
    expect(b.settings?.whatsapp_number).toBe('03404905266');
    expect(b.settings?.subjects).toEqual(DEFAULT_SETTINGS.subjects);
    expect(b.agent_enabled).toBe(false);
    expect(b.products?.map((p) => p.id)).toEqual(activeProducts().map((p) => p.id));
    // Raaz ya Settings tab se bahar ki keys nahin
    expect(Object.keys(b.settings ?? {})).not.toContain('default_job_fee');
    expect(Object.keys(b.settings ?? {})).not.toContain('agent_enabled');
  });
});

describe('POST /api/admin/settings: hifazat (9.2)', () => {
  it('bina cookie 401, ghalat Origin 403, JSON ke baghair 400', async () => {
    expect((await save({ orders_open: false }, { cookie: null })).status).toBe(401);
    expect((await save({ orders_open: false }, { origin: 'https://evil.test' })).status).toBe(403);
    const req = new Request(`${SITE}/api/admin/settings`, {
      method: 'POST',
      headers: { Origin: SITE, Cookie: (await adminReq('/x')).headers.get('Cookie')!, 'Content-Type': 'text/plain' },
      body: JSON.stringify({ settings: { orders_open: false } }),
    });
    expect((await saveAdminSettings(req, env())).status).toBe(400);
    expect((await getSettings(d1.db)).orders_open).toBe(true);
  });

  it('khali patch, bari body, nayi/band keys (agent, job fee) rad (F10-AC6)', async () => {
    expect((await save({})).status).toBe(400);
    expect((await save({ agent_enabled: true })).body.error?.field).toBe('agent_enabled');
    expect((await save({ default_job_fee: 500 })).status).toBe(400);
    expect((await save({ subjects: Array.from({ length: 500 }, (_, i) => 'Mazmoon number ' + i) })).status).toBe(413);
    expect((await getSettings(d1.db)).agent_enabled).toBe(false);
  });

  it('ek bhi ghalat ho to kuch bhi save nahin (atomic)', async () => {
    const before = await rawRows();
    const r = await save({ whatsapp_number: '03001234567', auto_cancel_hours: 0 });
    expect(r.status).toBe(400);
    expect(r.body.error?.field).toBe('auto_cancel_hours');
    expect(await rawRows()).toEqual(before);
  });
});

describe('F10-AC1: WhatsApp number', () => {
  it.each(['0340490526', '04404905266', '034049052667', 'abc', '', 3404905266])('ghalat %s → 400, mehfooz nahin', async (n) => {
    const r = await save({ whatsapp_number: n });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ field: 'whatsapp_number', message: SETTINGS_MSG.whatsapp_number });
    expect((await getSettings(d1.db)).whatsapp_number).toBe('03404905266');
  });

  it('sahih (dash ke sath bhi) → seedha text save, /api/settings mein naya (F10-AC7)', async () => {
    const r = await save({ whatsapp_number: '0345-111 2233' });
    expect(r.status).toBe(200);
    expect(r.body.settings?.whatsapp_number).toBe('03451112233');
    const row = (await rawRows()).find((x) => x.key === 'whatsapp_number');
    expect(row?.value).toBe('03451112233'); // seed wali shakal (JSON quotes nahin)
    expect(publicSettings(await getSettings(d1.db)).whatsapp_number).toBe('03451112233');
  });
});

describe('F10-AC2: payment, waqt, minute, override, auto-cancel', () => {
  it('payment numbers/titles: khali theek, ghalat number rad, title 60 tak; /track par nazar aate hain', async () => {
    expect((await save({ jazzcash_number: '0300123' })).body.error?.field).toBe('jazzcash_number');
    expect((await save({ easypaisa_title: 'x'.repeat(61) })).body.error?.field).toBe('easypaisa_title');
    const r = await save({ jazzcash_number: '03001234567', jazzcash_title: '  Muhammad Ali ', easypaisa_number: '', easypaisa_title: '' });
    expect(r.status).toBe(200);
    expect(r.body.settings).toMatchObject({ jazzcash_number: '03001234567', jazzcash_title: 'Muhammad Ali', easypaisa_number: '' });

    const id = await makeOrder(d1.db, { phone: '0300-1234567' });
    const t = await trackOrder(new Request(`${SITE}/api/track?id=${id}&last4=4567`, { headers: { 'CF-Connecting-IP': '10.9.9.9' } }), env());
    expect((t.body as { order?: { payment?: Record<string, string> } }).order?.payment).toMatchObject({ jazzcashNumber: '03001234567', jazzcashTitle: 'Muhammad Ali' });
  });

  it('kaam ke auqaat: HH:MM, end > start (merge shuda value par bhi)', async () => {
    expect((await save({ work_start: '9am' })).body.error?.message).toBe(SETTINGS_MSG.time);
    expect((await save({ work_start: '22:00', work_end: '09:00' })).body.error?.field).toBe('work_end');
    expect((await save({ work_end: '08:00' })).body.error?.field).toBe('work_end'); // maujooda start 09:00
    expect((await save({ work_start: '22:00' })).body.error?.field).toBe('work_end'); // maujooda end 22:00
    const r = await save({ work_start: '10:30', work_end: '20:00' });
    expect(r.status).toBe(200);
    expect(r.body.settings).toMatchObject({ work_start: '10:30', work_end: '20:00' });
  });

  it.each([14, 1441, 60.5, '120', null])('default minute %s rad', async (m) => {
    expect((await save({ default_delivery_minutes: m })).body.error?.field).toBe('default_delivery_minutes');
  });

  it('default minute 15 aur 1440 theek; JSON shakal mein save', async () => {
    expect((await save({ default_delivery_minutes: 15 })).status).toBe(200);
    expect((await save({ default_delivery_minutes: 1440 })).status).toBe(200);
    expect((await rawRows()).find((x) => x.key === 'default_delivery_minutes')?.value).toBe('1440');
  });

  it('product override: catalog ka id + 15..1440; khali object = sab hata do', async () => {
    const [p] = activeProducts();
    expect((await save({ delivery_overrides: { 'nahin-hai': 60 } })).body.error?.field).toBe('delivery_overrides.nahin-hai');
    expect((await save({ delivery_overrides: { [p.id]: 5 } })).body.error?.field).toBe(`delivery_overrides.${p.id}`);
    expect((await save({ delivery_overrides: [] })).status).toBe(400);
    expect((await save({ delivery_overrides: { [p.id]: 60 } })).body.settings?.delivery_overrides).toEqual({ [p.id]: 60 });
    expect((await getSettings(d1.db)).delivery_overrides).toEqual({ [p.id]: 60 });
    expect((await save({ delivery_overrides: {} })).body.settings?.delivery_overrides).toEqual({});
  });

  it('auto-cancel 1..720', async () => {
    expect((await save({ auto_cancel_hours: 0 })).status).toBe(400);
    expect((await save({ auto_cancel_hours: 721 })).status).toBe(400);
    expect((await save({ auto_cancel_hours: 720 })).status).toBe(200);
    expect((await getSettings(d1.db)).auto_cancel_hours).toBe(720);
  });
});

describe('F10-AC3: elaan aur orders band', () => {
  it('elaan 160 harf tak; on + khali matn rad; on par public mein, off par khali', async () => {
    expect((await save({ announcement_text: 'a'.repeat(161) })).body.error?.field).toBe('announcement_text');
    expect((await save({ announcement_on: true })).body.error?.message).toBe(SETTINGS_MSG.announcement_empty);
    expect((await save({ announcement_on: 'yes' })).status).toBe(400);
    const r = await save({ announcement_text: '  Eid par   3 din order band ', announcement_on: true });
    expect(r.status).toBe(200);
    expect(publicSettings(await getSettings(d1.db)).announcement_text).toBe('Eid par 3 din order band');
    expect((await save({ announcement_on: false })).status).toBe(200);
    expect(publicSettings(await getSettings(d1.db)).announcement_text).toBe('');
    // On hote hue matn khali karna bhi mana
    await save({ announcement_on: true });
    expect((await save({ announcement_text: '' })).status).toBe(400);
  });

  it('orders band → naya order orders_closed; dobara khula → order banta hai', async () => {
    expect((await save({ orders_open: false })).status).toBe(200);
    await expect(makeOrder(d1.db)).rejects.toThrow(/orders_closed/);
    expect((await save({ orders_open: true })).status).toBe(200);
    expect(await makeOrder(d1.db)).toMatch(/^GVS-/);
  });
});

describe('F10-AC4: mazameen', () => {
  it('jodna/hatana; khali, dohra (chhote/bare harf), 41 harf, 51 cheezein rad', async () => {
    expect((await save({ subjects: [] })).body.error?.message).toBe(SETTINGS_MSG.subjects);
    expect((await save({ subjects: ['English', ' english '] })).body.error?.message).toBe(SETTINGS_MSG.subject_dup);
    expect((await save({ subjects: ['  '] })).body.error?.message).toBe(SETTINGS_MSG.subject);
    expect((await save({ subjects: ['x'.repeat(41)] })).status).toBe(400);
    expect((await save({ subjects: Array.from({ length: 51 }, (_, i) => `S${i}`) })).status).toBe(400);
    const r = await save({ subjects: ['General Knowledge', '  Physics  ', 'Urdu'] });
    expect(r.body.settings?.subjects).toEqual(['General Knowledge', 'Physics', 'Urdu']);
    expect(publicSettings(await getSettings(d1.db)).subjects).toEqual(['General Knowledge', 'Physics', 'Urdu']);
  });
});

describe('settings-rules (browser + server ki sanjhi jaanch)', () => {
  const cur = pickEditable(DEFAULT_SETTINGS);
  const ids = new Set(['vu-smart']);
  it('sirf bheji gayi keys wapas, saaf shakal mein', () => {
    expect(validateSettingsPatch({ whatsapp_number: '+92 345 1112233' }, cur, ids)).toEqual({ ok: true, values: { whatsapp_number: '03451112233' } });
  });
  it('array/null patch rad', () => {
    expect(validateSettingsPatch([], cur, ids).ok).toBe(false);
    expect(validateSettingsPatch(null, cur, ids).ok).toBe(false);
  });
});
