// spec: E22 POST /api/admin/jobs/:id/image (tasveer R2 mein; 150 KB se bari rad; qism ki jaanch), F19-AC4, F19-AC6 (job mite to tasveer bhi),
//       4.4 (R2 sirf job tasveerein), 9.2 (admin cookie + Origin; body image/* = CORS preflight), 9.4 (≤ 150 KB server par hard).
import { fail, ok, sameOrigin, API_MSG, type ApiResult } from './api';
import { requireAdmin } from './admin-auth';
import type { ContentEnv } from './content-import';
import { IMAGE_MAX_BYTES, IMAGE_MAX_SIDE, IMAGE_MSG, IMAGE_TYPES, imageKey, sniffImage, type ImageType } from './image-resize';

export interface JobsEnv extends ContentEnv {
  IMAGES?: R2Bucket;
}

const NOT_FOUND = 'Yeh job nahin mili (shayad mit chuki).';
const parseId = (raw: string | undefined) => (raw && /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null);
const parseSide = (raw: string | null) => (raw && /^[1-9]\d{0,3}$/.test(raw) && Number(raw) <= IMAGE_MAX_SIDE ? Number(raw) : null);

/** Body parho, had se ek byte bhi zyada ho to ruk jao (Content-Length par bharosa nahin) */
async function readCapped(request: Request, limit: number): Promise<Uint8Array | 'big' | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return 'big';
      }
      parts.push(value);
    }
  } catch {
    return null;
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

const randHex = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** E22: body = tasveer ke bytes, Content-Type image/webp|jpeg|png, `?w=&h=` (≤ 1200). Purani tasveer R2 se mit jati hai */
export async function uploadJobImage(request: Request, env: JobsEnv, rawId: string | undefined, deps: { now?: () => Date } = {}): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? (sameOrigin(request) ? null : fail(403, 'origin', API_MSG.origin));
  if (denied) return denied;
  const id = parseId(rawId);
  if (!id) return fail(404, 'not_found', NOT_FOUND);
  const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase() as ImageType;
  if (!(IMAGE_TYPES as readonly string[]).includes(type)) return fail(415, 'type', IMAGE_MSG.type);
  if (Number(request.headers.get('Content-Length') ?? '0') > IMAGE_MAX_BYTES) return fail(413, 'too_large', IMAGE_MSG.too_big);
  const u = new URL(request.url);
  const w = parseSide(u.searchParams.get('w'));
  const h = parseSide(u.searchParams.get('h'));
  if (!w || !h) return fail(400, 'size', IMAGE_MSG.size);
  const bytes = await readCapped(request, IMAGE_MAX_BYTES);
  if (bytes === 'big') return fail(413, 'too_large', IMAGE_MSG.too_big);
  if (!bytes || !bytes.byteLength || sniffImage(bytes) !== type) return fail(415, 'type', IMAGE_MSG.type);
  if (!env.IMAGES) return fail(503, 'storage', IMAGE_MSG.storage);

  const at = (deps.now ?? (() => new Date()))().toISOString();
  try {
    const row = await env.DB.prepare('SELECT image_key FROM jobs WHERE id = ?1 AND deleted_at IS NULL').bind(id).first<{ image_key: string | null }>();
    if (!row) return fail(404, 'not_found', NOT_FOUND);
    const key = imageKey(id, w, h, type, randHex());
    await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
    const res = await env.DB.prepare('UPDATE jobs SET image_key = ?2, updated_at = ?3 WHERE id = ?1 AND deleted_at IS NULL').bind(id, key, at).run();
    if (res.meta.changes !== 1) {
      // Isi dauran job mit gayi: nayi tasveer bhi hatao
      await env.IMAGES.delete(key).catch(() => undefined);
      return fail(404, 'not_found', NOT_FOUND);
    }
    if (row.image_key && row.image_key !== key) await env.IMAGES.delete(row.image_key).catch(() => undefined);
    return ok({ id, imageKey: key, width: w, height: h, bytes: bytes.byteLength });
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/** F19-AC6: in keys ki tasveerein R2 se mitao (pehle R2, phir DB — R2 fail ho to job bhi nahin mitti) */
export async function deleteImages(env: JobsEnv, keys: (string | null)[]): Promise<void> {
  const list = keys.filter((k): k is string => !!k);
  if (!list.length) return;
  if (!env.IMAGES) throw new Error('R2 binding nahin');
  for (let i = 0; i < list.length; i += 1000) await env.IMAGES.delete(list.slice(i, i + 1000));
}
