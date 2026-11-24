// spec: F34-AC1, AC2, AC4 — source aur order ka nishan. Pure (browser + server), chhoti.

export const VU_SOURCES = ['channel', 'group', 'share', 'status', 'direct'] as const;
export type VuSource = (typeof VU_SOURCES)[number];
export const SOURCE_LABEL: Record<VuSource, string> = { channel: 'Channel', group: 'Group', share: 'Share', status: 'Status', direct: 'Seedha' };

/** Browser se aane wale; `order` sirf server ginta hai */
export const VU_EVENTS = ['view', 'start', 'done', 'questions', 'pack'] as const;
export type VuEvent = (typeof VU_EVENTS)[number];
export type VuStat = VuEvent | 'order';

/** Jo pehchana na jaye = seedha */
export const toSource = (raw: string | null | undefined): VuSource => VU_SOURCES.find((s) => s === (raw ?? '').toLowerCase()) ?? 'direct';

export interface OrderSource {
  code: string;
  term: 'mid' | 'final';
  source: VuSource;
}
const RE = /^([A-Z]{2,4}\d{3}P?):(mid|final):(channel|group|share|status|direct)$/;

/** orders.source: "CS101:mid:channel" */
export function parseOrderSource(raw: unknown): OrderSource | null {
  const m = typeof raw === 'string' ? RE.exec(raw) : null;
  return m ? { code: m[1], term: m[2] as 'mid' | 'final', source: m[3] as VuSource } : null;
}
export const orderSource = (o: OrderSource) => `${o.code}:${o.term}:${o.source}`;

/** Admin ke liye: "VU Mock: CS101 Midterm (Channel)" */
export function sourceLabel(raw: string | null): string {
  const o = parseOrderSource(raw);
  return o ? `VU Mock: ${o.code} ${o.term === 'mid' ? 'Midterm' : 'Final Term'} (${SOURCE_LABEL[o.source]})` : '';
}

// ---- Report (F34-AC3) ----

export type Counts = Record<VuStat, number>;
export interface ReportRow extends Counts {
  code: string;
  term: 'mid' | 'final';
  /** Is term mein jaanche MCQs ya Important Questions hain? */
  ready: boolean;
}
export interface VuReport {
  from: string;
  to: string;
  total: Counts;
  courses: ReportRow[];
  sources: ({ source: VuSource } & Counts)[];
}
export interface FunnelStep {
  key: 'view' | 'start' | 'done' | 'pack' | 'order';
  n: number;
  /** Pichhle marhale ka feesad (pehla: null) */
  pct: number | null;
}
/** Marhale + sab se zyada chhorne wala (pichhle marhale mein kam az kam 10 hon, warna ginti kam hai) */
export function funnel(c: Counts): { steps: FunnelStep[]; worst: FunnelStep['key'] | null } {
  const keys = ['view', 'start', 'done', 'pack', 'order'] as const;
  let worst: FunnelStep['key'] | null = null;
  let low = 101;
  const steps = keys.map((key, i): FunnelStep => {
    const prev = i ? c[keys[i - 1]] : 0;
    const pct = i && prev ? Math.round((c[key] / prev) * 100) : null;
    if (pct !== null && prev >= 10 && pct < low && pct < 100) {
      low = pct;
      worst = key;
    }
    return { key, n: c[key], pct };
  });
  return { steps, worst };
}
