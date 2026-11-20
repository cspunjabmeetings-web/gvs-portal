// spec: F20-AC1 ("Hum apply kar dein" → order item `id: job-apply`, `jobId`; qeemat = job ki fee — server job se dobara hisab karta hai),
//       F20-AC2 (job ka naam + documents + sarkari fee ka snapshot: CartBar aur seedhe WhatsApp message mein), F03 (order list), F03-AC6 (orders band).
import { useEffect, useState } from 'preact/hooks';
import { addToCart, CART_MSG } from '../lib/cart';
import { track } from '../lib/analytics';
import { cachedSettings, refreshSettings } from '../lib/site-settings';

export interface JobApplyProps {
  jobId: number;
  org: string;
  post: string;
  fee: number;
  govtFee: number | null;
  documents: string[];
  /** catalog ka job-apply naam */
  productName: string;
}

export default function JobApply(p: JobApplyProps) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    cachedSettings();
    void refreshSettings();
  }, []);

  function add() {
    track('job_apply_click', { org: p.org }); // F23-AC1
    const title = `${p.org} ${p.post}`.replace(/\s+/g, ' ').trim();
    const r = addToCart({
      id: 'job-apply',
      name: p.productName,
      price: p.fee,
      fields: { jobName: title.slice(0, 100) },
      govtFeeExtra: true,
      jobId: String(p.jobId),
      jobTitle: title,
      ...(p.govtFee !== null ? { govtFee: p.govtFee } : {}),
      ...(p.documents.length ? { documents: p.documents.slice(0, 20) } : {}),
    });
    if (r.ok) track('add_to_cart', { product: 'job-apply', source: 'job' });
    setMsg(r.ok ? { ok: true, text: `${CART_MSG.added} Neeche "WhatsApp par order karein" dabayen.` } : { ok: false, text: CART_MSG[r.reason] });
  }

  return (
    <div class="flex flex-col gap-2" data-job-apply>
      <button type="button" onClick={add} class="min-h-[48px] rounded-lg bg-primary px-4 font-semibold text-on-primary" data-job-apply-btn>
        Hum apply kar dein
      </button>
      <p class={`min-h-[1.5rem] text-sm ${msg ? (msg.ok ? 'text-correct' : 'text-wrong') : ''}`} role="status" aria-live="polite" data-job-apply-msg>
        {msg?.text ?? ''}
      </p>
    </div>
  );
}
