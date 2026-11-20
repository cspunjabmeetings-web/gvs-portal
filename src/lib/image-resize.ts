// spec: F19-AC4 (browser mein hi WebP, ≤ 150 KB, lambi side ≤ 1200px; sirf webp|jpeg|png), 9.4 (job ki tasveer ≤ 150 KB),
//       E22, F21-AC9 (tasveer: alt, width/height), 4.4 + P-11 (tasveer R2 custom domain `img.<domain>` se, Worker se nahin).
// Sanjhe qawaid (browser + server, DOM ke baghair) aur browser ka `shrinkImage` (canvas; sirf click par chalta hai).

export const IMAGE_MAX_BYTES = 150 * 1024;
export const IMAGE_MAX_SIDE = 1200;
/** Phone ki asal photo kitni bari chun sakte hain (browser mein chhoti hone se pehle) */
export const IMAGE_INPUT_MAX = 20 * 1024 * 1024;
export const IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];
export const IMAGE_EXT: Record<ImageType, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

export const IMAGE_MSG = {
  type: 'Sirf JPG, PNG ya WebP tasveer chunein.',
  input_big: 'Yeh file bohat bari hai (20 MB se zyada). Doosri tasveer chunein.',
  too_big: 'Tasveer 150 KB se bari hai.',
  shrink: 'Tasveer 150 KB tak chhoti nahin ho saki. Kam tafseel wali tasveer chunein.',
  read: 'Yeh tasveer khul nahin saki. Doosri chunein.',
  size: 'Tasveer ka naap sahih nahin.',
  storage: 'Tasveer ki jagah (R2) abhi tayyar nahin.',
} as const;

/** Lambi side ≤ max, tanasub wahi (chhoti tasveer bari nahin hoti) */
export function fitSize(w: number, h: number, max = IMAGE_MAX_SIDE): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** File ke shuru ke bytes se asal qism (Content-Type par bharosa nahin) */
export function sniffImage(b: Uint8Array): ImageType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** R2 key: `jobs/<id>-<w>x<h>-<random>.<ext>` — naap key mein (nayi column nahin), har upload naya naam (purani cache ka masla nahin) */
export const imageKey = (id: number, w: number, h: number, type: ImageType, rand: string) => `jobs/${id}-${w}x${h}-${rand}.${IMAGE_EXT[type]}`;
const KEY_RE = /^jobs\/[1-9]\d{0,9}-([1-9]\d{0,3})x([1-9]\d{0,3})-[a-f0-9]{8,32}\.(webp|jpg|png)$/;

export function imageDims(key: string): { width: number; height: number } | null {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  return width <= IMAGE_MAX_SIDE && height <= IMAGE_MAX_SIDE ? { width, height } : null;
}

/** F21-AC9: public page ki `<img>` — base (PUBLIC_IMG_BASE) khali ho ya key ghalat to null (sirf "Ishtihar dekhein" link) */
export function jobImage(key: string | null, base: string, alt: string): { src: string; width: number; height: number; alt: string } | null {
  const b = base.trim().replace(/\/+$/, '');
  if (!key || !b || !/^https?:\/\//.test(b)) return null;
  const d = imageDims(key);
  return d ? { src: `${b}/${key}`, ...d, alt } : null;
}

export type Shrunk = { ok: true; blob: Blob; w: number; h: number; type: ImageType } | { ok: false; message: string };

const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];

/** Browser: tasveer → WebP (WebP na bane to JPEG), lambi side ≤ 1200, ≤ 150 KB */
export async function shrinkImage(file: File): Promise<Shrunk> {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return { ok: false, message: IMAGE_MSG.type };
  if (file.size > IMAGE_INPUT_MAX) return { ok: false, message: IMAGE_MSG.input_big };
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return { ok: false, message: IMAGE_MSG.read };
  }
  try {
    let { w, h } = fitSize(bmp.width, bmp.height);
    for (let round = 0; round < 4; round++) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { ok: false, message: IMAGE_MSG.read };
      ctx.fillStyle = '#ffffff'; // PNG ka shaffaf hissa JPEG mein kala na ho
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      for (const q of QUALITIES) {
        let blob = await toBlob(canvas, 'image/webp', q);
        if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', q);
        if (!blob) return { ok: false, message: IMAGE_MSG.read };
        if (blob.size <= IMAGE_MAX_BYTES) return { ok: true, blob, w, h, type: blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg' };
      }
      ({ w, h } = fitSize(w, h, Math.round(Math.max(w, h) * 0.8)));
    }
    return { ok: false, message: IMAGE_MSG.shrink };
  } finally {
    bmp.close();
  }
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) => new Promise<Blob | null>((res) => c.toBlob(res, type, q));
