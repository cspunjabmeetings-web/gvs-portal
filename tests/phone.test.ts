// spec: 10.1 phone.test (03..., +92..., dashes; 923 shakal; last4), F04-AC1
import { describe, it, expect } from 'vitest';
import { normalizeLocal, toIntl, toDisplay, last4, waLink } from '../src/lib/phone';

describe('phone.ts', () => {
  it('mukhtalif shaklein qabool', () => {
    expect(normalizeLocal('03404905266')).toBe('03404905266');
    expect(normalizeLocal('0340-4905266')).toBe('03404905266');
    expect(normalizeLocal('0340 490 5266')).toBe('03404905266');
    expect(normalizeLocal('+923404905266')).toBe('03404905266');
    expect(normalizeLocal('923404905266')).toBe('03404905266');
    expect(normalizeLocal('00923404905266')).toBe('03404905266');
  });

  it('17b: user ke har aam tareeqe wala sahih number qabool', () => {
    const ok = [
      '03041234567 ', ' 03041234567', '0304 123 4567', '+92 304 1234567', '0304 1234567',
      '‪+92 304 1234567‬', '0304​1234567', '‎03041234567', '﻿03041234567',
      '۰۳۰۴۱۲۳۴۵۶۷', '٠٣٠٤١٢٣٤٥٦٧', '+92 (0)304 1234567', '3041234567', '0304/1234567', '0304.123.4567', '(0304) 1234567',
    ];
    for (const v of ok) expect(normalizeLocal(v), JSON.stringify(v)).toBe('03041234567');
  });

  it('ghalat number rad', () => {
    expect(normalizeLocal('0304abc4567')).toBeNull(); // harf strip nahin hote
    expect(normalizeLocal('03041234567x')).toBeNull();
    expect(normalizeLocal('9230412345')).toBeNull();
    expect(normalizeLocal('0340490526')).toBeNull(); // 10 hindse
    expect(normalizeLocal('04204905266')).toBeNull(); // 03 se nahin
    expect(normalizeLocal('abc')).toBeNull();
    expect(normalizeLocal('')).toBeNull();
  });

  it('923 shakal, display aur last4', () => {
    expect(toIntl('03404905266')).toBe('923404905266');
    expect(toDisplay('03404905266')).toBe('0340-4905266');
    expect(last4('0340-4905266')).toBe('5266');
    expect(() => toIntl('123')).toThrow();
  });

  it('wa.me link', () => {
    expect(waLink('03404905266')).toBe('https://wa.me/923404905266');
    expect(waLink('03404905266', 'Salam GVS')).toBe('https://wa.me/923404905266?text=Salam%20GVS');
  });
});
