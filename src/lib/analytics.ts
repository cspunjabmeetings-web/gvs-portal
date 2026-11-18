// spec: F23-AC1 (saare events sirf analytics.ts ke zariye), F23-AC2 (naam/phone/raqam/order number kabhi nahin), qaida 11
// Qadam 10: sirf dhancha (owner ka faisla) — abhi kuch nahin bhejta. GA4 (deferred) Qadam 15 mein yahin judega.

export type EventName = 'daily_test_start' | 'daily_test_complete' | 'practice_set_complete';
type Value = string | number | boolean;

/** Params mein sirf chhote, gair-zaati values; PII ki koi key qabool nahin */
const BLOCKED = /name|phone|mobile|whatsapp|order|amount|total_price|price|cnic|email/i;

const queue: { name: EventName; params: Record<string, Value> }[] = [];

export function track(name: EventName, params: Record<string, Value> = {}): void {
  try {
    const clean: Record<string, Value> = {};
    for (const [k, v] of Object.entries(params)) {
      if (BLOCKED.test(k)) continue;
      if (typeof v === 'string' && v.length > 100) continue;
      clean[k] = v;
    }
    queue.push({ name, params: clean });
    if (queue.length > 50) queue.shift();
  } catch {
    /* analytics kabhi site na toore */
  }
}

/** Test ke liye */
export const _queued = () => queue.slice();
