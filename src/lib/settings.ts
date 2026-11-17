// spec: 7.2 settings, E01 (/api/settings, koi raaz nahin), intent 12.4
// Seed (migrations/0001) mein text wali settings seedhi likhi hain, baqi JSON. Har key ki type yahan tay hai.

export interface Settings {
  whatsapp_number: string;
  jazzcash_number: string;
  jazzcash_title: string;
  easypaisa_number: string;
  easypaisa_title: string;
  work_start: string;
  work_end: string;
  default_delivery_minutes: number;
  delivery_overrides: Record<string, number>;
  auto_cancel_hours: number;
  default_job_fee: number;
  job_image_keep_days: number;
  subjects: string[];
  announcement_text: string;
  announcement_on: boolean;
  orders_open: boolean;
  ads_provider: string;
  agent_enabled: boolean;
}

/** Intent 12.4 ki shuru ki values; DB mein key na ho to yehi (settings.golden ke barabar) */
export const DEFAULT_SETTINGS: Settings = {
  whatsapp_number: '03404905266',
  jazzcash_number: '',
  jazzcash_title: '',
  easypaisa_number: '',
  easypaisa_title: '',
  work_start: '09:00',
  work_end: '22:00',
  default_delivery_minutes: 120,
  delivery_overrides: {},
  auto_cancel_hours: 48,
  default_job_fee: 300,
  job_image_keep_days: 30,
  subjects: ['General Knowledge', 'Pakistan Studies', 'Islamiat', 'English', 'Everyday Science', 'Current Affairs', 'Computer', 'Urdu', 'Maths'],
  announcement_text: '',
  announcement_on: false,
  orders_open: true,
  ads_provider: 'house',
  agent_enabled: false,
};

type Kind = 'text' | 'json';
const TEXT_KEYS = new Set<keyof Settings>([
  'whatsapp_number',
  'jazzcash_number',
  'jazzcash_title',
  'easypaisa_number',
  'easypaisa_title',
  'work_start',
  'work_end',
  'announcement_text',
  'ads_provider',
]);
const kindOf = (k: keyof Settings): Kind => (TEXT_KEYS.has(k) ? 'text' : 'json');

/** DB ki rows → Settings. Kharab value par default (site na toote). */
export function parseSettings(rows: { key: string; value: string }[]): Settings {
  const out: Settings = structuredClone(DEFAULT_SETTINGS);
  const o = out as unknown as Record<string, unknown>;
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    const k = key as keyof Settings;
    if (kindOf(k) === 'text') {
      o[k] = value;
      continue;
    }
    try {
      const v: unknown = JSON.parse(value);
      if (typeof v === typeof DEFAULT_SETTINGS[k] && Array.isArray(v) === Array.isArray(DEFAULT_SETTINGS[k])) o[k] = v;
    } catch {
      /* default rehne do */
    }
  }
  return out;
}

export async function getSettings(db: D1Database): Promise<Settings> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  return parseSettings(results);
}

/** E01: sirf woh jo visitor ko chahiye; koi raaz nahin */
export type PublicSettings = Pick<
  Settings,
  | 'whatsapp_number'
  | 'jazzcash_number'
  | 'jazzcash_title'
  | 'easypaisa_number'
  | 'easypaisa_title'
  | 'work_start'
  | 'work_end'
  | 'announcement_text'
  | 'announcement_on'
  | 'orders_open'
  | 'subjects'
>;

export function publicSettings(s: Settings): PublicSettings {
  return {
    whatsapp_number: s.whatsapp_number,
    jazzcash_number: s.jazzcash_number,
    jazzcash_title: s.jazzcash_title,
    easypaisa_number: s.easypaisa_number,
    easypaisa_title: s.easypaisa_title,
    work_start: s.work_start,
    work_end: s.work_end,
    announcement_text: s.announcement_on ? s.announcement_text : '',
    announcement_on: s.announcement_on,
    orders_open: s.orders_open,
    subjects: s.subjects,
  };
}
