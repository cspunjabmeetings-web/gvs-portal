// spec: F34-AC1, AC2 — browser: ginti ke events. Ek tab mein har course + term + event ek dafa. Chalte test mein koi request nahin: "start" qatar mein
// rehta hai aur nateeje, wapsi ya page band hone par jata hai. Koi pehchan nahin jati; fail ho to chup.
import { toSource, type VuEvent, type VuSource } from './vu-source';

const SRC_KEY = 'gvs.vu.src';
const SEEN_KEY = 'gvs.vu.seen';
type Item = { course: string; term: 'mid' | 'final'; event: VuEvent; source: VuSource };

let queue: Item[] = [];
let memSeen = new Set<string>();
let memSrc: VuSource | null = null;
let listening = false;

function ss(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Link ka ?src= (jab ho), warna is tab ka yaad rakha hua, warna seedha */
export function currentSource(): VuSource {
  const raw = new URLSearchParams(location.search).get('src');
  const store = ss();
  try {
    if (raw) {
      memSrc = toSource(raw);
      store?.setItem(SRC_KEY, memSrc);
      return memSrc;
    }
    return toSource(memSrc ?? store?.getItem(SRC_KEY));
  } catch {
    return memSrc ?? 'direct';
  }
}

function firstTime(key: string): boolean {
  const store = ss();
  try {
    if (store) memSeen = new Set([...memSeen, ...(JSON.parse(store.getItem(SEEN_KEY) ?? '[]') as string[])]);
  } catch {
    /* memory hi kaafi */
  }
  if (memSeen.has(key)) return false;
  memSeen.add(key);
  try {
    store?.setItem(SEEN_KEY, JSON.stringify([...memSeen].slice(-300)));
  } catch {
    /* memory hi kaafi */
  }
  return true;
}

/** Qatar bhejo (sendBeacon: page band hote waqt bhi) */
export function flushVu(): void {
  if (!queue.length) return;
  const body = JSON.stringify({ events: queue.splice(0, 10) });
  try {
    if (navigator.sendBeacon?.('/api/vu/event', new Blob([body], { type: 'application/json' }))) return;
    void fetch('/api/vu/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  } catch {
    /* ginti na ho to na sahi */
  }
}

/** `hold`: abhi na bhejo (test chal raha hai) */
export function vuEvent(course: string, term: 'mid' | 'final', event: VuEvent, hold = false): void {
  if (typeof window === 'undefined') return;
  if (!listening) {
    listening = true;
    addEventListener('pagehide', flushVu);
  }
  const source = currentSource();
  if (!firstTime(`${course}:${term}:${event}`)) return;
  queue.push({ course, term, event, source });
  if (!hold) flushVu();
}
