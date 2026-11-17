// spec: 10.1 timer.test (intent 7.3; ghalat/barabar workEnd; do din par phailna), SA4, F06-AC5
import { describe, it, expect } from 'vitest';
import { addWorkingMinutes, formatRemaining, orderMinutes, parseHHMM, OVERDUE_MSG } from '../src/lib/timer';

const pkt = (iso: string) => new Date(`${iso}+05:00`);
const add = (paid: string, min: number, ws = '09:00', we = '22:00') => addWorkingMinutes(pkt(paid), min, ws, we, 'Asia/Karachi').toISOString();

describe('addWorkingMinutes (intent 12.7)', () => {
  it('auqaat se pehle: aaj workStart se', () => {
    expect(add('2026-11-16T07:15:00', 120)).toBe(pkt('2026-11-16T11:00:00').toISOString());
  });
  it('theek workStart par', () => {
    expect(add('2026-11-16T09:00:00', 30)).toBe(pkt('2026-11-16T09:30:00').toISOString());
  });
  it('wada theek workEnd par khatam: aaj hi 22:00', () => {
    expect(add('2026-11-16T20:00:00', 120)).toBe(pkt('2026-11-16T22:00:00').toISOString());
  });
  it('theek 22:00 par paid: kal 9 se', () => {
    expect(add('2026-11-16T22:00:00', 120)).toBe(pkt('2026-11-17T11:00:00').toISOString());
  });
  it('aadhi raat ke baad (00:30): usi din 9 se', () => {
    expect(add('2026-11-17T00:30:00', 60)).toBe(pkt('2026-11-17T10:00:00').toISOString());
  });
  it('do din par phailna (1000 minute = 13 ghante + 3 ghante 40 minute)', () => {
    // 16 Nov 21:00 → 60 min aaj, 780 kal (9-22), baqi 160 parson 9:00 se → 11:40
    expect(add('2026-11-16T21:00:00', 1000)).toBe(pkt('2026-11-18T11:40:00').toISOString());
  });
  it('mahina aur saal badalna', () => {
    expect(add('2026-12-31T21:30:00', 120)).toBe(pkt('2027-01-01T10:30:00').toISOString());
  });
  it('seconds bhi mehfooz', () => {
    expect(add('2026-11-16T15:00:30', 120)).toBe(pkt('2026-11-16T17:00:30').toISOString());
  });
  it('mukhtalif auqaat (10:00 se 18:00)', () => {
    expect(add('2026-11-16T17:00:00', 120, '10:00', '18:00')).toBe(pkt('2026-11-17T11:00:00').toISOString());
  });
  it('0 minute: wohi lamha (auqaat ke andar)', () => {
    expect(add('2026-11-16T12:00:00', 0)).toBe(pkt('2026-11-16T12:00:00').toISOString());
  });
  it('ghalat ya barabar workEnd par RangeError', () => {
    expect(() => add('2026-11-16T12:00:00', 60, '09:00', '09:00')).toThrow(RangeError);
    expect(() => add('2026-11-16T12:00:00', 60, '22:00', '09:00')).toThrow(RangeError);
    expect(() => add('2026-11-16T12:00:00', 60, '9am', '22:00')).toThrow(RangeError);
    expect(() => add('2026-11-16T12:00:00', -5)).toThrow(RangeError);
  });
});

describe('parseHHMM', () => {
  it('sahih aur ghalat', () => {
    expect(parseHHMM('09:00')).toBe(540);
    expect(parseHHMM('23:59')).toBe(1439);
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('9:00')).toBeNull();
  });
});

describe('orderMinutes (SA4: sab se lamba; override → catalog → default)', () => {
  const catalogMinutes = (id: string) => ({ 'vu-smart': 120, 'cv-cover': 240 })[id];
  it('sab se lamba', () => {
    expect(orderMinutes(['vu-smart', 'cv-cover'], { defaultMinutes: 120, catalogMinutes })).toBe(240);
  });
  it('override catalog se pehle; anjaan id par default', () => {
    expect(orderMinutes(['vu-smart'], { defaultMinutes: 120, overrides: { 'vu-smart': 60 }, catalogMinutes })).toBe(60);
    expect(orderMinutes(['x'], { defaultMinutes: 90, catalogMinutes })).toBe(90);
    expect(orderMinutes([], { defaultMinutes: 90 })).toBe(90);
  });
});

describe('formatRemaining (F06-AC5)', () => {
  const m = 60_000;
  it('"1 ghanta 20 minute" shakal', () => {
    expect(formatRemaining(80 * m)).toBe('1 ghanta 20 minute');
    expect(formatRemaining(120 * m)).toBe('2 ghante');
    expect(formatRemaining(45 * m)).toBe('45 minute');
    expect(formatRemaining(13 * 60 * m + 30 * m)).toBe('13 ghante 30 minute');
    expect(formatRemaining(1000)).toBe('1 minute');
  });
  it('waqt guzar gaya: null (manfi ginti nahin)', () => {
    expect(formatRemaining(0)).toBeNull();
    expect(formatRemaining(-5 * m)).toBeNull();
    expect(OVERDUE_MSG).toBe('Thori der ho gayi hai, hum aap se WhatsApp par rabte mein hain.');
  });
});
