// spec: SA2 (qeemat sirf server/catalog se), F04-AC3, F04-AC4 (active, fields pattern, ≤ 10, job band), 9.4
// Pure function: DB nahin. Jobs ki rows bahar se di jati hain (tests aasan).
import { activeProducts, isOrderable, type Product } from './catalog';
import { MAX_ITEMS } from './cart';

export interface RequestItem {
  id: string;
  fields: Record<string, string>;
  jobId?: string;
}

/** jobs table ki zaroori columns (spec 7.2) */
export interface JobRow {
  id: number;
  org: string;
  post: string;
  last_date: string;
  visible: number;
  apply_service: number;
  deleted_at: string | null;
  our_fee: number | null;
  govt_fee: number | null;
  documents_json: string;
}

/** items_json ki ek cheez (snapshot, spec 7.2) */
export interface PricedItem {
  id: string;
  name: string;
  price: number;
  fields: Record<string, string>;
  govtFeeExtra?: boolean;
  jobId?: string;
  jobTitle?: string;
  govtFee?: number;
  documents?: string[];
}

export type PriceError = { ok: false; code: 'invalid_item' | 'invalid_field' | 'too_many' | 'job_closed'; message: string };
export type PriceResult = { ok: true; items: PricedItem[]; total: number } | PriceError;

export interface PriceOptions {
  defaultJobFee: number;
  /** Aaj ki tareekh Asia/Karachi mein, `YYYY-MM-DD` */
  today: string;
  jobs?: Map<string, JobRow>;
  products?: Product[];
}

export const PRICE_MSG = {
  invalid_item: 'Order list mein koi cheez ab dastiyab nahin. Usse hata kar dobara koshish karein.',
  too_many: 'Ek order mein 10 cheezein hi ho sakti hain.',
  job_closed: 'Is job ki aakhri tareekh guzar chuki hai ya apply band hai.',
} as const;

/** Job khuli hai? (visible, mitayi nahin, apply chalu, aakhri tareekh aaj ya baad) */
export function jobOpen(j: JobRow, today: string): boolean {
  return j.visible === 1 && !j.deleted_at && j.apply_service === 1 && j.last_date >= today;
}

function parseDocs(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((d): d is string => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

export function priceOrder(reqItems: RequestItem[], opts: PriceOptions): PriceResult {
  if (reqItems.length === 0) return { ok: false, code: 'invalid_item', message: PRICE_MSG.invalid_item };
  if (reqItems.length > MAX_ITEMS) return { ok: false, code: 'too_many', message: PRICE_MSG.too_many };
  const products = activeProducts(opts.products);
  const out: PricedItem[] = [];

  for (const r of reqItems) {
    const p = products.find((x) => x.id === r.id);
    if (!p || !isOrderable(p)) return { ok: false, code: 'invalid_item', message: PRICE_MSG.invalid_item };

    // Khane: sirf product ke apne; zaroori bhare hon; pattern/options/lambai (F02-AC2, 9.4)
    const fields: Record<string, string> = {};
    for (const key of Object.keys(r.fields)) {
      if (!p.fields.some((f) => f.key === key)) return { ok: false, code: 'invalid_field', message: `${p.name}: ghalat khana.` };
    }
    for (const f of p.fields) {
      const v = (r.fields[f.key] ?? '').trim();
      const bad = (msg: string): PriceError => ({ ok: false, code: 'invalid_field', message: `${p.name}: ${msg}` });
      if (!v) {
        if (f.required) return bad(`${f.label} bharein.`);
        continue;
      }
      if (v.length > 100) return bad(`${f.label} 100 harf se chhota rakhein.`);
      if (f.pattern && !new RegExp(f.pattern).test(v)) return bad(`${f.label} sahih bharein.`);
      if (f.options && !f.options.includes(v)) return bad(`${f.label} list mein se chunein.`);
      fields[f.key] = v;
    }

    const item: PricedItem = { id: p.id, name: p.name, price: p.price as number, fields };
    if (p.govtFeeExtra) item.govtFeeExtra = true;

    if (p.id === 'job-apply') {
      // SA2: job ki our_fee, warna default_job_fee
      let fee = opts.defaultJobFee;
      if (r.jobId !== undefined) {
        const j = opts.jobs?.get(r.jobId);
        if (!j || !jobOpen(j, opts.today)) return { ok: false, code: 'job_closed', message: PRICE_MSG.job_closed };
        fee = j.our_fee ?? opts.defaultJobFee;
        item.jobId = String(j.id);
        item.jobTitle = `${j.org} ${j.post}`;
        if (j.govt_fee !== null) item.govtFee = j.govt_fee;
        const docs = parseDocs(j.documents_json);
        if (docs.length) item.documents = docs;
      }
      item.price = fee;
    } else if (r.jobId !== undefined) {
      return { ok: false, code: 'invalid_item', message: PRICE_MSG.invalid_item };
    }
    out.push(item);
  }
  return { ok: true, items: out, total: out.reduce((s, i) => s + i.price, 0) };
}
