// spec: 3.3 (phone.ts shared), F04-AC1 (03XXXXXXXXX → 923XXXXXXXXX), intent 7.1
// Number ki jaanch aur shaklein. Server bhi yehi istemal kare ga (Qadam 5).

/**
 * Qadam 17b (owner: "user kisi format ka paband nahin"): Urdu (۰-۹) aur Arabic (٠-٩) hindse ASCII mein; phir hindse aur
 * shuru ke "+" ke ilawa sab hata (spaces, dash, dot, qausain, slash, contacts se copy ke chhupe nishan LTR/zero-width).
 * Harf (a-z) ho to number nahin. Null = harf hain.
 */
function cleanDigits(input: string): string | null {
  const ascii = input.replace(/[٠-٩۰-۹]/g, (c) => String((c.charCodeAt(0) & 0xf) % 10));
  if (/\p{L}/u.test(ascii)) return null;
  const plus = /^\s*[^\d+]*\+/.test(ascii);
  const d = ascii.replace(/\D/g, '');
  return plus ? '+' + d : d;
}

/** Dashes, spaces, +92/92/0092, "+92 (0)", 0 ke baghair 3XX, Urdu hindse bardasht; sahih ho to "03XXXXXXXXX", warna null */
export function normalizeLocal(input: string): string | null {
  let d = cleanDigits(input);
  if (d === null) return null;
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('0092')) d = d.slice(2);
  if (/^920\d{10}$/.test(d)) d = '92' + d.slice(3); // +92 (0)3XX…
  if (d.startsWith('92')) d = '0' + d.slice(2);
  if (/^3\d{9}$/.test(d)) d = '0' + d; // shuru ka 0 bhool gaye
  return /^03[0-9]{9}$/.test(d) ? d : null;
}

/** Number rad ho to user ko saaf wajah (Roman Urdu); sahih ho to null */
export function phoneProblem(input: string): string | null {
  if (normalizeLocal(input)) return null;
  const example = 'maslan 03001234567';
  const d = cleanDigits(input);
  if (d === null) return `Number mein sirf hindse likhein, harf nahin (${example}).`;
  const digits = d.replace(/^\+/, '');
  if (digits.length === 0) return `WhatsApp number likhein (${example}).`;
  const local = digits.replace(/^0092/, '0').replace(/^92/, '0');
  if (/^0[1-24-9]/.test(local) || /^[1-24-9]/.test(local)) return `Sirf mobile number chalega jo 03 se shuru ho (${example}).`;
  return `Number mein ${local.length} hindse hain; 11 hone chahiye (${example}).`;
}

/** "03404905266" → "923404905266" (wa.me ke liye) */
export function toIntl(local: string): string {
  const n = normalizeLocal(local);
  if (!n) throw new Error('Ghalat number');
  return '92' + n.slice(1);
}

/** "03404905266" → "0340-4905266" */
export function toDisplay(local: string): string {
  const n = normalizeLocal(local) ?? local;
  return n.replace(/^(\d{4})(\d{7})$/, '$1-$2');
}

/** Aakhri 4 hindse (track ke liye) */
export function last4(local: string): string {
  const n = normalizeLocal(local);
  if (!n) throw new Error('Ghalat number');
  return n.slice(-4);
}

/** https://wa.me/923...?text=... */
export function waLink(local: string, text?: string): string {
  const base = `https://wa.me/${toIntl(local)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
