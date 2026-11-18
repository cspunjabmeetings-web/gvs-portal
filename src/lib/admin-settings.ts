// spec: E24 GET/POST /api/admin/settings (F10-AC1..AC7), 8.1, 9.2 (CSRF: Origin + JSON), intent 9.9, 12.4
// F10-AC5: password badalne ka koi endpoint nahin. F10-AC6: agent_enabled sirf parhne ke liye.
import { fail, ok, readJson, API_MSG, type ApiResult } from './api';
import { adminPost, requireAdmin } from './admin-auth';
import { getSettings, serializeSetting, type Settings } from './settings';
import { activeProducts } from './catalog';
import { EDITABLE_KEYS, pickEditable, validateSettingsPatch } from './settings-rules';

export interface AdminSettingsEnv {
  DB: D1Database;
  SESSION_SECRET?: string;
}

/** Settings ka body chhota hai (mazameen ki list samet) */
export const SETTINGS_BODY_LIMIT = 8 * 1024;

const productList = () => activeProducts().map((p) => ({ id: p.id, name: p.name, deliveryMinutes: p.deliveryMinutes }));
const productIds = () => new Set(activeProducts().map((p) => p.id));

function view(s: Settings) {
  return { settings: pickEditable(s), agent_enabled: s.agent_enabled, products: productList() };
}

/** E24 GET */
export async function readAdminSettings(request: Request, env: AdminSettingsEnv): Promise<ApiResult> {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  try {
    return ok(view(await getSettings(env.DB)));
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}

/** E24 POST: body `{ settings: { <key>: value, ... } }` — sirf badli hui keys. Ghalat ho to kuch bhi save nahin. */
export async function saveAdminSettings(request: Request, env: AdminSettingsEnv): Promise<ApiResult> {
  const denied = (await requireAdmin(request, env)) ?? adminPost(request);
  if (denied) return denied;
  const body = await readJson(request, SETTINGS_BODY_LIMIT);
  if (!body.ok) return body.res;
  const patch = (body.data as { settings?: unknown } | null)?.settings;

  try {
    const current = await getSettings(env.DB);
    const r = validateSettingsPatch(patch, pickEditable(current), productIds());
    if (!r.ok) return { status: 400, body: { ok: false, error: { code: 'invalid', field: r.field, message: r.message } } };

    // Ek batch: ya sab save, ya kuch nahin
    const stmt = env.DB.prepare('INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    const writes = EDITABLE_KEYS.filter((k) => k in r.values).map((k) => stmt.bind(k, serializeSetting(k, r.values[k] as Settings[typeof k])));
    await env.DB.batch(writes);
    return ok(view(await getSettings(env.DB)));
  } catch {
    return fail(503, 'unavailable', API_MSG.unavailable);
  }
}
