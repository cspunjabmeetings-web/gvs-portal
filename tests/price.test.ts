// spec: 10.1 price.test (total, job apply fee, default_job_fee), SA2, F04-AC3, F04-AC4
import { describe, it, expect } from 'vitest';
import { priceOrder, jobOpen, type JobRow } from '../src/lib/price';
import { parseSettings, DEFAULT_SETTINGS } from '../src/lib/settings';

const opts = { defaultJobFee: 300, today: '2026-11-17' };
const job = (o: Partial<JobRow> = {}): JobRow => ({
  id: 7,
  org: 'PPSC',
  post: 'Educator',
  last_date: '2026-11-17',
  visible: 1,
  apply_service: 1,
  deleted_at: null,
  our_fee: null,
  govt_fee: null,
  documents_json: '[]',
  ...o,
});

describe('priceOrder (SA2)', () => {
  it('total catalog ki qeematon ka jama', () => {
    const r = priceOrder(
      [
        { id: 'vu-smart', fields: { courseCode: 'CS101' } },
        { id: 'board-paper', fields: { className: '10th', subject: 'Physics', chapters: '1-3', totalMarks: '75' } },
        { id: 'mock-series', fields: {} },
      ],
      opts,
    );
    expect(r.ok && r.total).toBe(350 + 300 + 700);
  });

  it('job apply: bina job default_job_fee; job ki our_fee; our_fee khali to default', () => {
    const base = { id: 'job-apply', fields: { jobName: 'PPSC Educator' } };
    expect(priceOrder([base], { ...opts, defaultJobFee: 450 })).toMatchObject({ ok: true, total: 450 });
    const jobs = new Map([['7', job({ our_fee: 500, govt_fee: 800 })]]);
    const r = priceOrder([{ ...base, jobId: '7' }], { ...opts, jobs });
    expect(r).toMatchObject({ ok: true, total: 500, items: [{ jobId: '7', govtFee: 800, govtFeeExtra: true }] });
    const jobs2 = new Map([['7', job()]]);
    expect(priceOrder([{ ...base, jobId: '7' }], { ...opts, jobs: jobs2 })).toMatchObject({ ok: true, total: 300 });
  });

  it('jobId sirf job-apply par; doosre product par rad', () => {
    expect(priceOrder([{ id: 'vu-smart', fields: { courseCode: 'CS101' }, jobId: '7' }], opts)).toMatchObject({ ok: false, code: 'invalid_item' });
  });

  it('khaali list aur 10 se zyada rad', () => {
    expect(priceOrder([], opts)).toMatchObject({ ok: false });
    const many = Array.from({ length: 11 }, () => ({ id: 'mock-series', fields: {} }));
    expect(priceOrder(many, opts)).toMatchObject({ ok: false, code: 'too_many' });
  });
});

describe('jobOpen', () => {
  it('aakhri din tak khuli; chhupi, mitayi, apply band, ya guzri hui band', () => {
    expect(jobOpen(job(), '2026-11-17')).toBe(true);
    expect(jobOpen(job(), '2026-11-18')).toBe(false);
    expect(jobOpen(job({ visible: 0 }), '2026-11-17')).toBe(false);
    expect(jobOpen(job({ deleted_at: '2026-11-10' }), '2026-11-17')).toBe(false);
    expect(jobOpen(job({ apply_service: 0 }), '2026-11-17')).toBe(false);
  });
});

describe('parseSettings', () => {
  it('text seedha, baqi JSON; kharab value par default', () => {
    const s = parseSettings([
      { key: 'whatsapp_number', value: '03001234567' },
      { key: 'orders_open', value: 'false' },
      { key: 'default_job_fee', value: 'kharab' },
      { key: 'subjects', value: '{"a":1}' },
      { key: 'anjaan', value: '1' },
    ]);
    expect(s.whatsapp_number).toBe('03001234567');
    expect(s.orders_open).toBe(false);
    expect(s.default_job_fee).toBe(DEFAULT_SETTINGS.default_job_fee);
    expect(s.subjects).toEqual(DEFAULT_SETTINGS.subjects);
    expect('anjaan' in s).toBe(false);
  });
});
