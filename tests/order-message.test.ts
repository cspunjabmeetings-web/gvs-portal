// spec: F04-AC1 (validators), F04-AC8 (intent 9.3 template, phone nahin), F05-AC2 (bina order number)
import { describe, it, expect } from 'vitest';
import { buildOrderMessage } from '../src/lib/order-message';
import { addItem, type CartItem } from '../src/lib/cart';
import { validateName, validatePhone, validateFieldValue } from '../src/lib/validators';

const items: CartItem[] = (() => {
  let list: CartItem[] = [];
  list = addItem(list, { id: 'vu-smart', name: 'VU Smart pack', price: 350, fields: { courseCode: 'CS101' } }).items;
  list = addItem(list, { id: 'mcq-pack', name: 'MCQs pack', price: 250, fields: { subject: 'Pakistan Studies' } }).items;
  return list;
})();

describe('WhatsApp message (intent 9.3)', () => {
  it('order number ke sath: template bilkul intent 9.3 jaisa', () => {
    const msg = buildOrderMessage({ items, name: 'Ali Raza', orderId: 'GVS-2611-0042', trackUrl: 'https://example.pk/track?id=GVS-2611-0042' });
    expect(msg).toBe(
      [
        'Assalam o Alaikum GVS Academy,',
        'Mera order: GVS-2611-0042',
        '',
        '1. VU Smart pack (CS101) - Rs. 350',
        '2. MCQs pack (Pakistan Studies) - Rs. 250',
        '',
        'Kul: Rs. 600',
        'Naam: Ali Raza',
        '',
        'Order track karein: https://example.pk/track?id=GVS-2611-0042',
      ].join('\n'),
    );
  });

  it('seedha order (F05-AC2): order number aur track link nahin', () => {
    const msg = buildOrderMessage({ items, name: 'Ali Raza' });
    expect(msg).not.toMatch(/GVS-\d/);
    expect(msg).not.toMatch(/track/i);
    expect(msg).toMatch(/Kul: Rs\. 600/);
  });

  it('customer ka phone number message mein kabhi nahin (F04-AC8)', () => {
    const msg = buildOrderMessage({ items, name: 'Ali Raza' });
    expect(msg).not.toMatch(/03\d{9}|923\d{9}|\+92/);
  });

  it('sarkari fee wali cheez par wazahat', () => {
    const list = addItem([], { id: 'job-apply', name: 'Online job apply service', price: 300, govtFeeExtra: true, fields: { jobName: 'PPSC Educator' } }).items;
    expect(buildOrderMessage({ items: list, name: 'Sara' })).toMatch(/Sarkari fee alag, official challan par/);
  });
});

describe('validators (F04-AC1)', () => {
  it('naam 2-60 harf', () => {
    expect(validateName('A').ok).toBe(false);
    expect(validateName('  Ali   Raza ')).toEqual({ ok: true, value: 'Ali Raza' });
    expect(validateName('x'.repeat(61)).ok).toBe(false);
  });

  it('number 03XXXXXXXXX, +92 aur dashes bardasht', () => {
    expect(validatePhone('0300-1234567')).toEqual({ ok: true, value: '03001234567' });
    expect(validatePhone('+92 300 1234567')).toEqual({ ok: true, value: '03001234567' });
    const bad = validatePhone('12345');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe('Number 11 hindson ka hona chahiye, maslan 03001234567.');
  });

  it('khana 100 harf tak', () => {
    expect(validateFieldValue('x'.repeat(100)).ok).toBe(true);
    expect(validateFieldValue('x'.repeat(101)).ok).toBe(false);
  });
});
