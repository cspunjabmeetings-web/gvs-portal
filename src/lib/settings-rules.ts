// spec: F10-AC1..AC4 (Settings ki har value ki jaanch), E24, intent 9.9, 12.4
// Pure: browser (SettingsTab, foran paigham) aur server (admin-settings.ts, aakhri faisla) dono yahi istemal karte hain.
// Is file mein valibot ya server ki koi cheez nahin, taake admin ke client bundle mein na jaye.
import { normalizeLocal } from './phone';
import { parseHHMM } from './timer';
import type { Settings } from './settings';

/** Settings tab se badalne wali keys. Baqi (job fee, tasveer ke din, ads, agent) apne qadmon mein. */
export const EDITABLE_KEYS = [
  'whatsapp_number',
  'jazzcash_number',
  'jazzcash_title',
  'easypaisa_number',
  'easypaisa_title',
  'work_start',
  'work_end',
  'default_delivery_minutes',
  'delivery_overrides',
  'auto_cancel_hours',
  'announcement_text',
  'announcement_on',
  'orders_open',
  'subjects',
] as const satisfies readonly (keyof Settings)[];

export type EditableKey = (typeof EDITABLE_KEYS)[number];
export type EditableSettings = Pick<Settings, EditableKey>;

export const LIMITS = {
  minutesMin: 15,
  minutesMax: 1440,
  cancelMin: 1,
  cancelMax: 720,
  announcementMax: 160,
  titleMax: 60,
  subjectsMax: 50,
  subjectMax: 40,
} as const;

export const SETTINGS_MSG = {
  whatsapp_number: 'WhatsApp number 11 hindse ka ho aur 03 se shuru ho (maslan 03404905266).',
  jazzcash_number: 'JazzCash number khali chhorein ya 11 hindse (03 se shuru) likhein.',
  easypaisa_number: 'Easypaisa number khali chhorein ya 11 hindse (03 se shuru) likhein.',
  title: `Account title ${LIMITS.titleMax} harf tak.`,
  time: 'Waqt HH:MM shakal mein likhein (maslan 09:00).',
  work_end: 'Khatam ka waqt shuru ke waqt ke baad ho.',
  minutes: `Minute ${LIMITS.minutesMin} se ${LIMITS.minutesMax} tak (poora number).`,
  override_product: 'Yeh product catalog mein nahin.',
  auto_cancel_hours: `Ghante ${LIMITS.cancelMin} se ${LIMITS.cancelMax} tak (poora number).`,
  announcement_text: `Elaan ${LIMITS.announcementMax} harf tak.`,
  announcement_empty: 'Elaan on karne se pehle matn likhein.',
  bool: 'On ya off chunein.',
  subjects: `Kam se kam 1 aur zyada se zyada ${LIMITS.subjectsMax} mazameen.`,
  subject: `Har mazmoon 1 se ${LIMITS.subjectMax} harf tak.`,
  subject_dup: 'Ek mazmoon do dafa nahin.',
  unknown: 'Yeh setting yahan se nahin badalti.',
  empty: 'Koi tabdeeli nahin bheji.',
} as const;

export type RuleResult = { ok: true; values: Partial<EditableSettings> } | { ok: false; field: string; message: string };

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const bad = (field: string, message: string): RuleResult => ({ ok: false, field, message });

function payNumber(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  if (v.trim() === '') return '';
  return normalizeLocal(v);
}

/**
 * Patch (sirf badli hui keys) ki jaanch. `current` = DB ki maujooda settings, taake
 * end > start aur "elaan on + khali matn" jaisi do-key jaanch merge shuda value par ho.
 * `productIds` = catalog ke product (override ke liye).
 */
export function validateSettingsPatch(patch: unknown, current: EditableSettings, productIds: ReadonlySet<string>): RuleResult {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return bad('settings', SETTINGS_MSG.empty);
  const input = patch as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length === 0) return bad('settings', SETTINGS_MSG.empty);
  const out: Partial<EditableSettings> = {};
  const o = out as Record<string, unknown>;

  for (const key of keys) {
    const v = input[key];
    switch (key) {
      case 'whatsapp_number': {
        const n = typeof v === 'string' ? normalizeLocal(v) : null;
        if (!n) return bad(key, SETTINGS_MSG.whatsapp_number);
        o[key] = n;
        break;
      }
      case 'jazzcash_number':
      case 'easypaisa_number': {
        const n = payNumber(v);
        if (n === null) return bad(key, SETTINGS_MSG[key]);
        o[key] = n;
        break;
      }
      case 'jazzcash_title':
      case 'easypaisa_title': {
        if (typeof v !== 'string' || v.trim().length > LIMITS.titleMax) return bad(key, SETTINGS_MSG.title);
        o[key] = v.trim();
        break;
      }
      case 'work_start':
      case 'work_end': {
        if (typeof v !== 'string' || parseHHMM(v.trim()) === null) return bad(key, SETTINGS_MSG.time);
        o[key] = v.trim();
        break;
      }
      case 'default_delivery_minutes': {
        if (!isInt(v, LIMITS.minutesMin, LIMITS.minutesMax)) return bad(key, SETTINGS_MSG.minutes);
        o[key] = v;
        break;
      }
      case 'delivery_overrides': {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return bad(key, SETTINGS_MSG.minutes);
        const clean: Record<string, number> = {};
        for (const [id, m] of Object.entries(v as Record<string, unknown>)) {
          if (!productIds.has(id)) return bad(`${key}.${id}`, SETTINGS_MSG.override_product);
          if (!isInt(m, LIMITS.minutesMin, LIMITS.minutesMax)) return bad(`${key}.${id}`, SETTINGS_MSG.minutes);
          clean[id] = m;
        }
        o[key] = clean;
        break;
      }
      case 'auto_cancel_hours': {
        if (!isInt(v, LIMITS.cancelMin, LIMITS.cancelMax)) return bad(key, SETTINGS_MSG.auto_cancel_hours);
        o[key] = v;
        break;
      }
      case 'announcement_text': {
        if (typeof v !== 'string') return bad(key, SETTINGS_MSG.announcement_text);
        const t = v.trim().replace(/\s+/g, ' ');
        if ([...t].length > LIMITS.announcementMax) return bad(key, SETTINGS_MSG.announcement_text);
        o[key] = t;
        break;
      }
      case 'announcement_on':
      case 'orders_open': {
        if (typeof v !== 'boolean') return bad(key, SETTINGS_MSG.bool);
        o[key] = v;
        break;
      }
      case 'subjects': {
        if (!Array.isArray(v) || v.length < 1 || v.length > LIMITS.subjectsMax) return bad(key, SETTINGS_MSG.subjects);
        const seen = new Set<string>();
        const list: string[] = [];
        for (const s of v) {
          if (typeof s !== 'string') return bad(key, SETTINGS_MSG.subject);
          const t = s.trim().replace(/\s+/g, ' ');
          if (t.length < 1 || t.length > LIMITS.subjectMax) return bad(key, SETTINGS_MSG.subject);
          const lower = t.toLowerCase();
          if (seen.has(lower)) return bad(key, SETTINGS_MSG.subject_dup);
          seen.add(lower);
          list.push(t);
        }
        o[key] = list;
        break;
      }
      default:
        return bad(key, SETTINGS_MSG.unknown);
    }
  }

  // Do-key jaanch merge shuda value par (timer.ts end <= start par RangeError deta hai)
  const merged = { ...current, ...out };
  if (('work_start' in out || 'work_end' in out) && parseHHMM(merged.work_end)! <= parseHHMM(merged.work_start)!) return bad('work_end', SETTINGS_MSG.work_end);
  if (('announcement_on' in out || 'announcement_text' in out) && merged.announcement_on && !merged.announcement_text) return bad('announcement_text', SETTINGS_MSG.announcement_empty);

  return { ok: true, values: out };
}

export function pickEditable(s: Settings): EditableSettings {
  const out = {} as Record<string, unknown>;
  for (const k of EDITABLE_KEYS) out[k] = structuredClone(s[k]);
  return out as unknown as EditableSettings;
}
