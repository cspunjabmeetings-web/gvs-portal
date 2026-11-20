// spec: 8.1 (JSON format, Origin check, body cap 16 KB, HTTP codes, no-store), 9.2 CSRF
// Sirf server par istemal (endpoints aur tests).

export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

export const PUBLIC_BODY_LIMIT = 16 * 1024;

export const API_MSG = {
  origin: 'Yeh request qabool nahin.',
  too_large: 'Bheji gayi maloomat bohat lambi hai.',
  bad_json: 'Maloomat sahih shakal mein nahin.',
  unavailable: 'Server abhi jawab nahin de raha. Thori der baad koshish karein.',
} as const;

export const ok = (body: Record<string, unknown> = {}, headers?: Record<string, string>): ApiResult => ({
  status: 200,
  body: { ok: true, ...body },
  headers,
});

export const fail = (status: number, code: string, message: string): ApiResult => ({
  status,
  body: { ok: false, error: { code, message } },
});

/** ApiResult → Response. Default `no-store` (8.1); cache wale endpoints apna header dete hain */
export function toResponse(r: ApiResult): Response {
  return new Response(JSON.stringify(r.body), {
    status: r.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...r.headers,
    },
  });
}

/** POST par Origin sirf apni site ka (8.1, 9.2) */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return !!origin && origin === new URL(request.url).origin;
}

/** Body parho, had ke sath; ghalti par ApiResult */
export async function readJson(request: Request, limit = PUBLIC_BODY_LIMIT): Promise<{ ok: true; data: unknown } | { ok: false; res: ApiResult }> {
  const len = Number(request.headers.get('Content-Length') ?? '0');
  if (len > limit) return { ok: false, res: fail(413, 'too_large', API_MSG.too_large) };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, res: fail(400, 'bad_json', API_MSG.bad_json) };
  }
  if (new TextEncoder().encode(text).length > limit) return { ok: false, res: fail(413, 'too_large', API_MSG.too_large) };
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, res: fail(400, 'bad_json', API_MSG.bad_json) };
  }
}

/** Visitor ka IP (sirf hash karne ke liye; kabhi save/log nahin) */
export const clientIp = (request: Request) => request.headers.get('CF-Connecting-IP') ?? 'unknown';

/** CHANGE REQUEST Qadam 17a: preview link (Cloudflare ka `*.workers.dev`) Google mein na aaye (middleware noindex lagata hai) */
export const isPreviewHost = (host: string) => host === 'workers.dev' || host.endsWith('.workers.dev');
