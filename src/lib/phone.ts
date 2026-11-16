// spec: 3.3 (phone.ts shared), F04-AC1 (03XXXXXXXXX → 923XXXXXXXXX), intent 7.1
// Number ki jaanch aur shaklein. Server bhi yehi istemal kare ga (Qadam 5).

/** Dashes, spaces, +92/92/0092 bardasht; sahih ho to "03XXXXXXXXX", warna null */
export function normalizeLocal(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('0092')) d = d.slice(2);
  if (d.startsWith('92')) d = '0' + d.slice(2);
  return /^03[0-9]{9}$/.test(d) ? d : null;
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
