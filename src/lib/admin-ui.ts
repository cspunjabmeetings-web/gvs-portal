// spec: F08-AC3 ("kitni der pehle", timer), F08-AC5 ("Wada: aaj 5:00 PM", badalne ka khana), F08-AC7 (intent 9.7 ke messages)
// Pure helpers (browser + tests). Asia/Karachi = UTC+5, DST nahin.
import type { OrderStatus } from './track';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Naya',
  paid: 'Paid',
  pending: 'Pending',
  complete: 'Complete',
  cancelled: 'Cancel',
};

/** Spec 8.6: se → jin darjon mein ja sakta hai (aage, cancel, ya ek darja peeche). Server aur UI dono yehi. */
export const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  new: ['paid', 'cancelled'],
  paid: ['pending', 'complete', 'cancelled', 'new'],
  pending: ['complete', 'cancelled', 'paid'],
  complete: ['pending'],
  cancelled: [],
};
export const canMove = (from: OrderStatus, to: OrderStatus) => ALLOWED[from].includes(to);

/** Peeche jana (ghalti theek karna) — UI mein tasdeeq maangta hai */
export const isBack = (from: OrderStatus, to: OrderStatus) =>
  (from === 'paid' && to === 'new') || (from === 'pending' && to === 'paid') || (from === 'complete' && to === 'pending');

const TZ = 'Asia/Karachi';
const MIN = 60_000;

/** "abhi", "5 minute pehle", "3 ghante pehle", "2 din pehle" */
export function ago(iso: string, now = Date.now()): string {
  const m = Math.floor((now - new Date(iso).getTime()) / MIN);
  if (m < 1) return 'abhi';
  if (m < 60) return `${m} minute pehle`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'ghanta' : 'ghante'} pehle`;
  const d = Math.floor(h / 24);
  return `${d} din pehle`;
}

function parts(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** "aaj 5:00 PM" / "kal 10:30 AM" / "20 Nov 9:00 AM" (Pakistan waqt) */
export function dueLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const t = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  const day = parts(d).date;
  const today = parts(now).date;
  const tomorrow = parts(new Date(now.getTime() + 864e5)).date;
  if (day === today) return `aaj ${t}`;
  if (day === tomorrow) return `kal ${t}`;
  const dm = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' }).format(d);
  return `${dm} ${t}`;
}

/** Date → `<input type="datetime-local">` ki value, Pakistan waqt mein */
export function toKarachiInput(iso: string): string {
  const p = parts(new Date(iso));
  return `${p.date}T${p.time}`;
}

/** `<input type="datetime-local">` (Pakistan waqt) → ISO; ghalat par null */
export function fromKarachiInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+05:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export interface ContactInput {
  id: string;
  name: string;
  total: number;
  status: OrderStatus;
  whatsappOpenedAt: string | null;
  payment?: { jazzcashNumber: string; jazzcashTitle: string; easypaisaNumber: string; easypaisaTitle: string };
}

const rs = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;

/** F08-AC7, intent 9.7: darje ke hisab se customer ko tayyar message */
export function contactMessage(o: ContactInput): string {
  const first = o.name.trim().split(/\s+/)[0] || '';
  const hello = `Assalam o Alaikum${first ? ' ' + first : ''}`;
  if (o.status === 'complete') return `Aap ka order ${o.id} mukammal ho gaya hai. Shukriya!`;
  if (o.status === 'new') {
    const pay: string[] = [];
    if (o.payment?.jazzcashNumber) pay.push(`JazzCash ${o.payment.jazzcashNumber}${o.payment.jazzcashTitle ? ` (${o.payment.jazzcashTitle})` : ''}`);
    if (o.payment?.easypaisaNumber) pay.push(`Easypaisa ${o.payment.easypaisaNumber}${o.payment.easypaisaTitle ? ` (${o.payment.easypaisaTitle})` : ''}`);
    const payLine = pay.length ? `Payment ke liye ${pay.join(', ')}.` : 'Payment ki tafseel isi chat par bataayi jaye gi.';
    return `${hello}, aap ne GVS Academy par order ${o.id} (${rs(o.total)}) diya tha. ${payLine} Koi sawal ho to isi chat par poochein.`;
  }
  return `${hello}, GVS Academy se aap ke order ${o.id} ke baare mein rabta kar rahe hain.`;
}
