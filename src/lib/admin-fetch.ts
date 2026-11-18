// spec: 8.1 (jawab ki shakal), F07-AC3 (401 par dobara login) — admin ke browser components ka sanjha fetch (Qadam 9c)
// Browser mein chalta hai. Ghalti ka paigham hamesha Roman Urdu (browser ka "Failed to fetch" nahin).

export type AdminResult<T> = { ok: true; data: T } | { ok: false; message: string; status: number };

const NET = 'Internet ya server ka masla. Dobara koshish karein.';

export async function adminJson<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<AdminResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401) {
      location.reload();
      return { ok: false, message: 'Dobara login karein.', status: 401 };
    }
    const data = (await res.json()) as T & { ok?: boolean; error?: { message?: string } };
    if (!res.ok || !data.ok) return { ok: false, message: data.error?.message || NET, status: res.status };
    return { ok: true, data };
  } catch {
    return { ok: false, message: NET, status: 0 };
  }
}
