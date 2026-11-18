// spec: F13-AC1 (din 00:00 Pakistan waqt par badalta hai, Sawal A-06), F13-AC8, 7.5 ("Tareekhein Asia/Karachi ke hisab se")
// Pure, browser + server. Pakistan mein daylight saving nahin (UTC+5), phir bhi Intl se — orders.ts wala tareeqa.

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Date → "YYYY-MM-DD" (Pakistan) */
export function pkDate(d: Date = new Date()): string {
  return fmt.format(d);
}

/** "YYYY-MM-DD" ± din → "YYYY-MM-DD" (kalendar ka hisab, waqt nahin) */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export const isDateStr = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;
