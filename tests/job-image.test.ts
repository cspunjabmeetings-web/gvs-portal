// spec: E22 (tasveer R2 mein; 150 KB se bari rad; qism ki jaanch), F19-AC4 (≤ 1200px, ≤ 150 KB, sirf webp|jpeg|png), F19-AC6 (job mite to
//       tasveer bhi), F21-AC9 (alt, width/height), 4.4 + P-11 (PUBLIC_IMG_BASE), 9.2 (cookie + Origin)
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startD1 } from './helpers/d1';
import { adminCookie, adminReq, SECRET, SITE } from './helpers/admin';
import { uploadJobImage, type JobsEnv } from '../src/lib/job-image';
import { saveJobs, deleteJob, deleteOldJobs, listJobs, type AdminJobRow } from '../src/lib/admin-jobs';
import { IMAGE_MAX_BYTES, fitSize, imageDims, imageKey, jobImage, sniffImage } from '../src/lib/image-resize';

let d1: Awaited<ReturnType<typeof startD1>>;
const env = (o: { noBucket?: boolean } = {}): JobsEnv => ({ DB: d1.db, SESSION_SECRET: SECRET, ...(o.noBucket ? {} : { IMAGES: d1.images }) });
// Pakistan: 19 Nov 2026 shaam
const NOW = new Date('2026-11-19T12:00:00Z');
const deps = { now: () => NOW };

const job = (post: string, last: string) => `# JOB\nIdara: PPSC\nPost: ${post}\nAkhri tareekh: ${last}\nOfficial link: https://ppsc.gop.pk/x\n---`;

function bytes(kind: 'webp' | 'png' | 'jpeg' | 'gif', size = 2000): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(size);
  const head =
    kind === 'webp' ? [...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map((c) => c.charCodeAt(0)))
    : kind === 'png' ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    : kind === 'jpeg' ? [0xff, 0xd8, 0xff, 0xe0]
    : [...'GIF89a'].map((c) => c.charCodeAt(0));
  b.set(head);
  return b;
}

async function newJob(post = 'Educator', last = '2026-12-05'): Promise<number> {
  const r = await saveJobs(await adminReq('/api/admin/jobs', { body: { action: 'save', text: job(post, last) } }), env(), deps);
  return (r.body as { ids: number[] }).ids[0];
}

async function upload(id: number | string, o: { body?: Uint8Array<ArrayBuffer>; type?: string; w?: string; h?: string; cookie?: string | null; origin?: string; len?: string; noBucket?: boolean } = {}) {
  const headers: Record<string, string> = { Origin: o.origin ?? SITE, 'Content-Type': o.type ?? 'image/webp' };
  if (o.cookie !== null) headers.Cookie = o.cookie ?? (await adminCookie());
  if (o.len) headers['Content-Length'] = o.len;
  const req = new Request(`${SITE}/api/admin/jobs/${id}/image?w=${o.w ?? '1200'}&h=${o.h ?? '900'}`, { method: 'POST', headers, body: o.body ?? bytes('webp') });
  const r = await uploadJobImage(req, env({ noBucket: o.noBucket }), String(id), deps);
  return { status: r.status, body: r.body as { imageKey?: string; width?: number; error?: { code: string; message: string } } };
}

const r2Keys = async () => (await d1.images.list()).objects.map((o) => o.key).sort();
const keyOf = async (id: number) => (await d1.db.prepare('SELECT image_key FROM jobs WHERE id = ?1').bind(id).first<{ image_key: string | null }>())?.image_key ?? null;
async function del(id: number, o: { noBucket?: boolean } = {}) {
  const req = new Request(`${SITE}/api/admin/jobs/${id}`, { method: 'DELETE', headers: { Origin: SITE, Cookie: await adminCookie() } });
  return deleteJob(req, env(o), String(id), deps);
}

beforeAll(async () => {
  d1 = await startD1();
});
afterAll(async () => {
  await d1.dispose();
});
beforeEach(async () => {
  await d1.reset();
  const keys = await r2Keys();
  if (keys.length) await d1.images.delete(keys);
});

describe('sanjhe qawaid (image-resize.ts)', () => {
  it('F19-AC4: lambi side ≤ 1200, tanasub wahi, chhoti tasveer bari nahin', () => {
    expect(fitSize(4000, 3000)).toEqual({ w: 1200, h: 900 });
    expect(fitSize(1000, 3000)).toEqual({ w: 400, h: 1200 });
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 });
  });
  it('qism file ke bytes se (naam/Content-Type se nahin)', () => {
    expect(sniffImage(bytes('webp'))).toBe('image/webp');
    expect(sniffImage(bytes('png'))).toBe('image/png');
    expect(sniffImage(bytes('jpeg'))).toBe('image/jpeg');
    expect(sniffImage(bytes('gif'))).toBeNull();
    expect(sniffImage(new Uint8Array(0))).toBeNull();
  });
  it('key mein naap; F21-AC9 <img> ke src/alt/width/height; base khali → null (sirf link)', () => {
    const k = imageKey(7, 1200, 900, 'image/webp', 'abcdef0123456789');
    expect(k).toBe('jobs/7-1200x900-abcdef0123456789.webp');
    expect(imageDims(k)).toEqual({ width: 1200, height: 900 });
    expect(imageDims('jobs/7-5000x900-abcdef01.webp')).toBeNull();
    expect(imageDims('../secret')).toBeNull();
    expect(jobImage(k, 'https://img.gvs.pk/', 'PPSC Educator ka ishtihar')).toEqual({ src: `https://img.gvs.pk/${k}`, width: 1200, height: 900, alt: 'PPSC Educator ka ishtihar' });
    expect(jobImage(k, '', 'x')).toBeNull();
    expect(jobImage(k, 'javascript:alert(1)', 'x')).toBeNull();
    expect(jobImage(null, 'https://img.gvs.pk', 'x')).toBeNull();
  });
});

describe('E22 upload', () => {
  it('9.2: bina login 401, ghalat Origin 403 — R2 mein kuch nahin', async () => {
    const id = await newJob();
    expect((await upload(id, { cookie: null })).status).toBe(401);
    expect((await upload(id, { origin: 'https://evil.test' })).status).toBe(403);
    expect(await r2Keys()).toEqual([]);
  });

  it('F19-AC4: GIF/PDF 415; Content-Type aur asal bytes mukhtalif 415; khali body 415', async () => {
    const id = await newJob();
    const gif = await upload(id, { type: 'image/gif', body: bytes('gif') });
    expect(gif.status).toBe(415);
    expect(gif.body.error?.message).toBe('Sirf JPG, PNG ya WebP tasveer chunein.');
    expect((await upload(id, { type: 'application/pdf' })).status).toBe(415);
    expect((await upload(id, { type: 'image/webp', body: bytes('png') })).status).toBe(415);
    expect((await upload(id, { type: 'image/webp', body: new Uint8Array(new ArrayBuffer(0)) })).status).toBe(415);
    expect(await keyOf(id)).toBeNull();
  });

  it('F19-AC4 / 9.4: theek 150 KB qabool, 150 KB + 1 byte 413', async () => {
    const id = await newJob();
    const big = await upload(id, { body: bytes('webp', IMAGE_MAX_BYTES + 1) });
    expect(big.status).toBe(413);
    expect(big.body.error?.message).toBe('Tasveer 150 KB se bari hai.');
    expect(await r2Keys()).toEqual([]);
    expect((await upload(id, { body: bytes('webp', IMAGE_MAX_BYTES) })).status).toBe(200);
  });

  it('jhoota chhota Content-Length ho to bhi asal bytes gine jate hain (413)', async () => {
    const id = await newJob();
    const data = bytes('webp', IMAGE_MAX_BYTES + 10);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(data.subarray(0, 100_000));
        c.enqueue(data.subarray(100_000));
        c.close();
      },
    });
    const req = new Request(`${SITE}/api/admin/jobs/${id}/image?w=1200&h=900`, {
      method: 'POST',
      headers: { Origin: SITE, Cookie: await adminCookie(), 'Content-Type': 'image/webp' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect((await uploadJobImage(req, env(), String(id), deps)).status).toBe(413);
  });

  it('naap 1–1200 zaroori (400)', async () => {
    const id = await newJob();
    expect((await upload(id, { w: '1201' })).status).toBe(400);
    expect((await upload(id, { w: '0' })).status).toBe(400);
    expect((await upload(id, { h: 'abc' })).status).toBe(400);
  });

  it('na mili / mitayi job 404', async () => {
    expect((await upload(999)).status).toBe(404);
    expect((await upload('abc')).status).toBe(404);
    const id = await newJob();
    await del(id);
    expect((await upload(id)).status).toBe(404);
    expect(await r2Keys()).toEqual([]);
  });

  it('kamyab: R2 mein (qism + cache), DB mein key, admin list mein nishan', async () => {
    const id = await newJob();
    const r = await upload(id, { w: '1200', h: '850' });
    expect(r.status).toBe(200);
    expect(r.body.imageKey).toMatch(new RegExp(`^jobs/${id}-1200x850-[a-f0-9]{16}\\.webp$`));
    expect(await keyOf(id)).toBe(r.body.imageKey);
    const obj = await d1.images.get(r.body.imageKey!);
    expect(obj?.httpMetadata?.contentType).toBe('image/webp');
    expect(obj?.httpMetadata?.cacheControl).toContain('immutable');
    expect(obj?.size).toBe(2000);
    const l = await listJobs(await adminReq('/api/admin/jobs?tab=open'), env(), deps);
    expect((l.body as { items: AdminJobRow[] }).items[0].imageKey).toBe(r.body.imageKey);
    expect((await upload(id, { type: 'image/jpeg', body: bytes('jpeg') })).body.imageKey).toMatch(/\.jpg$/);
  });

  it('tasveer badlein → purani R2 se mit jati hai (sirf 1 object)', async () => {
    const id = await newJob();
    const a = await upload(id);
    const b = await upload(id, { type: 'image/png', body: bytes('png'), w: '800', h: '600' });
    expect(b.body.imageKey).not.toBe(a.body.imageKey);
    expect(await r2Keys()).toEqual([b.body.imageKey]);
    expect(await keyOf(id)).toBe(b.body.imageKey);
  });

  it('R2 binding na ho to 503 (kuch nahin badla)', async () => {
    const id = await newJob();
    expect((await upload(id, { noBucket: true })).status).toBe(503);
    expect(await keyOf(id)).toBeNull();
  });
});

describe('F19-AC6: job mitane par tasveer bhi', () => {
  it('"Mitayen" → R2 object khatam, image_key NULL', async () => {
    const id = await newJob();
    const keep = await newJob('Lecturer');
    await upload(id);
    const other = (await upload(keep)).body.imageKey;
    expect((await del(id)).status).toBe(200);
    expect(await r2Keys()).toEqual([other]);
    expect(await keyOf(id)).toBeNull();
  });

  it('"Sab purani mita dein" → sirf purani jobs ki tasveerein', async () => {
    const old1 = await newJob('Clerk', '2026-11-01');
    const old2 = await newJob('Naib Qasid', '2026-11-18');
    const open = await newJob('Educator', '2026-11-19');
    await upload(old1);
    await upload(old2);
    const keepKey = (await upload(open)).body.imageKey;
    const r = await deleteOldJobs(await adminReq('/api/admin/jobs/delete-old', { body: { confirm: true } }), env(), deps);
    expect((r.body as { deleted: number }).deleted).toBe(2);
    expect(await r2Keys()).toEqual([keepKey]);
    expect(await keyOf(old1)).toBeNull();
    expect(await keyOf(open)).toBe(keepKey);
  });

  it('tasveer wali job mitate waqt R2 na ho to 503 aur job bhi nahin mitti', async () => {
    const id = await newJob();
    await upload(id);
    expect((await del(id, { noBucket: true })).status).toBe(503);
    const row = await d1.db.prepare('SELECT deleted_at FROM jobs WHERE id = ?1').bind(id).first<{ deleted_at: string | null }>();
    expect(row?.deleted_at).toBeNull();
  });

  it('bina tasveer wali job R2 ke baghair bhi mit jati hai', async () => {
    const id = await newJob();
    expect((await del(id, { noBucket: true })).status).toBe(200);
  });
});
