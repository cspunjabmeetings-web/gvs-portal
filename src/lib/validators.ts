// spec: 3.3 (validators.ts shared, chhote functions, client par library nahin), F04-AC1, F02-AC2, 9.4
import { normalizeLocal } from './phone';

export type Check<T = string> = { ok: true; value: T } | { ok: false; error: string };

/** Naam: 2 se 60 harf (F04-AC1, spec 9.4) */
export function validateName(input: string): Check {
  const v = input.trim().replace(/\s+/g, ' ');
  if (v.length < 2) return { ok: false, error: 'Naam kam az kam 2 harf ka likhein.' };
  if (v.length > 60) return { ok: false, error: 'Naam 60 harf se chhota likhein.' };
  return { ok: true, value: v };
}

/** WhatsApp number: 03XXXXXXXXX; dashes, spaces, +92 bardasht (F04-AC1) */
export function validatePhone(input: string): Check {
  const n = normalizeLocal(input);
  if (!n) return { ok: false, error: 'Number 11 hindson ka hona chahiye, maslan 03001234567.' };
  return { ok: true, value: n };
}

/** Order item ke khane: har value ≤ 100 harf (spec 9.4) */
export function validateFieldValue(value: string): Check {
  const v = value.trim();
  if (v.length > 100) return { ok: false, error: 'Yeh khana 100 harf se chhota rakhein.' };
  return { ok: true, value: v };
}
