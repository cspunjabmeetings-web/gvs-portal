// spec: F04-AC11 (P-09), 9.2 Spam: server par siteverify; TURNSTILE_SECRET sirf Cloudflare secret / .dev.vars

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * true = token sahih, false = token ghalat (400),
 * null = Turnstile service ki kharabi (503 → browser F05 rasta)
 */
export type TurnstileVerdict = boolean | null;

export async function verifyTurnstile(secret: string, token: string, ip: string, fetcher: typeof fetch = fetch): Promise<TurnstileVerdict> {
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  if (ip !== 'unknown') form.set('remoteip', ip);
  try {
    const res = await fetcher(SITEVERIFY_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return null;
  }
}
