// spec: SA4 (wada / due_at), F06-AC5 (ulti ginti, manfi nahin), intent 7.3, 9.4 (timer ke usool), 12.7
// Contract (timer.golden): addWorkingMinutes(paidAt, minutes, workStart, workEnd, 'Asia/Karachi') => Date
// Shared: server (Qadam 7 "Paid") aur browser (/track) dono.

const MIN = 60_000;
const DAY_MS = 24 * 60 * MIN;

/** "09:00" → minute (540); ghalat shakal par null */
export function parseHHMM(s: string): number | null {
  const m = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

interface Local {
  y: number;
  m: number;
  d: number;
  /** Local aadhi raat se ms */
  ms: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    fmtCache.set(tz, f);
  }
  return f;
}

function toLocal(date: Date, tz: string): Local {
  const p = Object.fromEntries(fmt(tz).formatToParts(date).map((x) => [x.type, x.value]));
  const ms = ((Number(p.hour) * 60 + Number(p.minute)) * 60 + Number(p.second)) * 1000 + date.getUTCMilliseconds();
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), ms };
}

/** Is lamhe par time zone ka farq (local - UTC), ms mein */
function offset(t: number, tz: string): number {
  const l = toLocal(new Date(t), tz);
  return Date.UTC(l.y, l.m - 1, l.d) + l.ms - t;
}

/** Local tareekh + waqt → UTC Date */
function fromLocal(l: Local, tz: string): Date {
  const guess = Date.UTC(l.y, l.m - 1, l.d) + l.ms;
  let t = guess - offset(guess, tz);
  const o2 = offset(t, tz);
  if (guess - o2 !== t) t = guess - o2; // DST ki tabdeeli ke qareeb (Pakistan mein nahin)
  return new Date(t);
}

function nextDay(l: Local): Local {
  const n = new Date(Date.UTC(l.y, l.m - 1, l.d + 1));
  return { y: n.getUTCFullYear(), m: n.getUTCMonth() + 1, d: n.getUTCDate(), ms: 0 };
}

/**
 * Kaam ke auqaat mein `minutes` jama karo (intent 12.7):
 * auqaat se pehle → aaj workStart; baad mein → kal workStart; din khatam ho to agle din jari.
 * workEnd ≤ workStart ya ghalat shakal par RangeError (Settings ki jaanch Qadam 8 mein yeh rokti hai).
 */
export function addWorkingMinutes(start: Date, minutes: number, workStart: string, workEnd: string, timeZone: string): Date {
  const ws = parseHHMM(workStart);
  const we = parseHHMM(workEnd);
  if (ws === null || we === null || we <= ws) throw new RangeError('Kaam ke auqaat ghalat hain (workStart < workEnd hona chahiye).');
  if (!Number.isFinite(minutes) || minutes < 0) throw new RangeError('Minute ghalat hain.');

  const wsMs = ws * MIN;
  const weMs = we * MIN;
  let day = toLocal(start, timeZone);
  let cur = day.ms;
  if (cur < wsMs) cur = wsMs;
  else if (cur >= weMs) {
    day = nextDay(day);
    cur = wsMs;
  }

  let left = Math.round(minutes * MIN);
  // Hifazat: had se zyada din nahin (300 minute ka wada ~1 din; 10 saal kaafi se zyada)
  for (let i = 0; i < 3660; i++) {
    const avail = weMs - cur;
    if (left <= avail) return fromLocal({ ...day, ms: cur + left }, timeZone);
    left -= avail;
    day = nextDay(day);
    cur = wsMs;
  }
  throw new RangeError('Wada hisab se bahar hai.');
}

/** SA4: order ki cheezon mein sab se lamba waqt; settings override → catalog → default */
export function orderMinutes(
  itemIds: string[],
  opts: { defaultMinutes: number; overrides?: Record<string, number>; catalogMinutes?: (id: string) => number | undefined },
): number {
  const list = itemIds.map((id) => opts.overrides?.[id] ?? opts.catalogMinutes?.(id) ?? opts.defaultMinutes);
  return list.length ? Math.max(...list) : opts.defaultMinutes;
}

/**
 * F06-AC5: "1 ghanta 20 minute". Waqt guzar gaya (≤ 0) to null (manfi ginti kabhi nahin).
 * Minute upar ki taraf (1 second bacha ho to "1 minute").
 */
export function formatRemaining(ms: number): string | null {
  if (!(ms > 0)) return null;
  const total = Math.ceil(ms / MIN);
  const days = Math.floor((total * MIN) / DAY_MS);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (days >= 1 && h >= 24) {
    const hh = h - days * 24;
    return [`${days} din`, hh ? `${hh} ${hh === 1 ? 'ghanta' : 'ghante'}` : ''].filter(Boolean).join(' ');
  }
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? 'ghanta' : 'ghante'}`);
  if (m) parts.push(`${m} minute`);
  return parts.join(' ');
}

export const OVERDUE_MSG = 'Thori der ho gayi hai, hum aap se WhatsApp par rabte mein hain.';
