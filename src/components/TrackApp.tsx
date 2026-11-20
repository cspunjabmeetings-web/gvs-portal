// spec: S27, F06-AC1 (?id= pehle se), AC2 (darja + intent 9.4 ka matn), AC3, AC5 (ulti ginti, manfi nahin),
//       AC6 (60 s polling; chhupi tab / complete / cancelled par band), AC7 (payment ke qadam, documents), AC8 (dobara order)
import { useEffect, useRef, useState } from 'preact/hooks';
import type { TrackData } from '../lib/track';
import { formatRemaining, OVERDUE_MSG } from '../lib/timer';
import { addToCart, itemDetail } from '../lib/cart';
import { toDisplay, waLink } from '../lib/phone';
import { whatsappNumber } from '../lib/site-settings';
import { govtFeeLine } from '../lib/order-message';

const rs = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;
const POLL_MS = 60_000;
const FINAL = new Set(['complete', 'cancelled']);

const STATUS_LABEL: Record<TrackData['status'], string> = {
  new: 'Order mila',
  paid: 'Payment mil gayi',
  pending: 'Kaam jari hai',
  complete: 'Mukammal',
  cancelled: 'Cancel',
};

function Countdown({ dueAt }: { dueAt: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!dueAt) return <p>Aap ka order jald tayyar ho jaye ga.</p>;
  const left = formatRemaining(new Date(dueAt).getTime() - now);
  return left ? (
    <p class="text-lg">
      Aap ka order taqreeban <strong class="tabular" data-countdown>{left}</strong> mein mil jaye ga.
    </p>
  ) : (
    <p class="text-lg font-medium" data-countdown>
      {OVERDUE_MSG}
    </p>
  );
}

export default function TrackApp() {
  const [id, setId] = useState('');
  const [last4, setLast4] = useState('');
  const [order, setOrder] = useState<TrackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reorderMsg, setReorderMsg] = useState<string | null>(null);
  const query = useRef<{ id: string; last4: string } | null>(null);

  // F06-AC1: WhatsApp message ke link se ?id= pehle se bhara
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('id');
    if (q) setId(q.trim().toUpperCase().slice(0, 32));
  }, []);

  async function load(q: { id: string; last4: string }, quiet = false) {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`/api/track?id=${encodeURIComponent(q.id)}&last4=${encodeURIComponent(q.last4)}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      const data = (await res.json()) as { ok?: boolean; order?: TrackData; error?: { message?: string } };
      if (res.ok && data.ok && data.order) {
        setOrder(data.order);
        setError(null);
      } else if (!quiet) {
        setOrder(null);
        setError(data.error?.message ?? 'Order nahin mila');
      }
    } catch {
      if (!quiet) setError('Server se rabta nahin ho saka. Thori der baad koshish karein.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  // F06-AC6: har 60 s; tab chhupi ho ya order khatam (complete/cancelled) to nahin
  useEffect(() => {
    if (!order || FINAL.has(order.status)) return;
    const tick = () => {
      if (document.visibilityState === 'visible' && query.current) void load(query.current, true);
    };
    const t = setInterval(tick, POLL_MS);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [order?.status, order?.id]);

  function submit(e: Event) {
    e.preventDefault();
    const q = { id: id.trim().toUpperCase(), last4: last4.trim() };
    if (!/^[0-9]{4}$/.test(q.last4)) {
      setError('Number ke aakhri 4 hindse likhein, maslan 5266.');
      return;
    }
    if (!q.id) {
      setError('Order number likhein, maslan GVS-2611-0042.');
      return;
    }
    query.current = q;
    setReorderMsg(null);
    void load(q);
  }

  // F06-AC8: wohi cheezein dobara order list mein
  function reorder(o: TrackData) {
    let added = 0;
    let skipped = 0;
    for (const it of o.items) {
      const r = addToCart({ id: it.id, name: it.name, price: it.price, fields: it.fields, govtFeeExtra: it.govtFeeExtra, jobId: it.jobId, jobTitle: it.jobTitle, govtFee: it.govtFee, documents: it.documents });
      if (r.ok) added++;
      else skipped++;
    }
    setReorderMsg(
      added
        ? `${added} ${added === 1 ? 'cheez' : 'cheezein'} order list mein daal di gayin. Neeche patti se order karein.`
        : skipped
          ? 'Yeh cheezein pehle se order list mein hain, ya list bhari hai.'
          : 'Order list mein daalne ke liye kuch nahin mila.',
    );
  }

  const wa = whatsappNumber();

  return (
    <div class="flex flex-col gap-5">
      <form onSubmit={submit} noValidate class="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div class="flex flex-col gap-1">
          <label for="track-id" class="text-sm font-medium">Order number *</label>
          <input
            id="track-id"
            value={id}
            onInput={(e) => setId((e.target as HTMLInputElement).value)}
            placeholder="GVS-2611-0042"
            autocapitalize="characters"
            autocomplete="off"
            maxLength={32}
            class="tabular min-h-[44px] rounded-lg border border-border bg-surface px-3"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label for="track-last4" class="text-sm font-medium">WhatsApp number ke aakhri 4 hindse *</label>
          <input
            id="track-last4"
            value={last4}
            onInput={(e) => setLast4((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            autocomplete="off"
            placeholder="5266"
            maxLength={4}
            class="tabular min-h-[44px] rounded-lg border border-border bg-surface px-3"
          />
        </div>
        <button type="submit" disabled={loading} class="min-h-[48px] rounded-lg bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-70">
          {loading ? 'Dhoond rahe hain…' : 'Order dekhein'}
        </button>
        {error && (
          <p class="rounded-lg bg-wrong-bg p-3 font-medium text-wrong" role="alert">
            {error}
          </p>
        )}
      </form>

      {order && (
        <section class="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4" aria-live="polite" aria-labelledby="track-result">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="track-result" class="tabular text-xl">{order.id}</h2>
            <span class="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary" data-status={order.status}>
              {STATUS_LABEL[order.status]}
            </span>
          </div>

          {order.status === 'new' && (
            <div class="flex flex-col gap-2">
              <p class="text-lg font-semibold">Payment ka intezar hai.</p>
              <ol class="list-decimal space-y-1 pl-5">
                <li>
                  Raqam: <strong class="tabular">{rs(order.total)}</strong>
                </li>
                <li>
                  {order.payment && (order.payment.jazzcashNumber || order.payment.easypaisaNumber) ? (
                    <>
                      {order.payment.jazzcashNumber && (
                        <span class="block">
                          JazzCash: <strong class="tabular">{order.payment.jazzcashNumber}</strong>
                          {order.payment.jazzcashTitle && ` (${order.payment.jazzcashTitle})`}
                        </span>
                      )}
                      {order.payment.easypaisaNumber && (
                        <span class="block">
                          Easypaisa: <strong class="tabular">{order.payment.easypaisaNumber}</strong>
                          {order.payment.easypaisaTitle && ` (${order.payment.easypaisaTitle})`}
                        </span>
                      )}
                    </>
                  ) : (
                    'JazzCash ya Easypaisa ka number WhatsApp par bataya jaye ga.'
                  )}
                </li>
                <li>Payment ke baad screenshot WhatsApp par bhejein.</li>
              </ol>
              {order.items.some((i) => i.needsDocuments) && (
                <div class="rounded-lg bg-surface-2 p-3 text-sm">
                  <p class="font-semibold">Documents bhi WhatsApp par bhejein:</p>
                  {order.items
                    .filter((i) => i.needsDocuments)
                    .map((i) => (
                      <p key={i.id} class="mt-1">
                        {i.name}: {i.documents?.length ? i.documents.join(', ') : 'zaroori documents ki list WhatsApp par bataayi jaye gi.'}
                      </p>
                    ))}
                </div>
              )}
              <a
                href={waLink(wa, `Assalam o Alaikum GVS Academy,\nOrder ${order.id} ki payment ka screenshot bhej raha/rahi hoon.`)}
                target="_blank"
                rel="noopener"
                class="mt-1 flex min-h-[48px] items-center justify-center rounded-lg bg-primary px-4 font-semibold text-on-primary no-underline hover:bg-primary-hover"
              >
                Screenshot WhatsApp par bhejein ({toDisplay(wa)})
              </a>
            </div>
          )}

          {(order.status === 'paid' || order.status === 'pending') && (
            <div class="flex flex-col gap-2">
              <p class="font-semibold text-correct">✓ Payment mil gayi</p>
              {order.status === 'pending' && <p>Aap ke order par kaam jari hai.</p>}
              <Countdown dueAt={order.dueAt} />
            </div>
          )}

          {order.status === 'complete' && (
            <div class="flex flex-col gap-3">
              <p class="text-lg font-semibold text-correct">✓ Order mukammal. File aap ke WhatsApp par bhej di gayi hai.</p>
              <button type="button" onClick={() => reorder(order)} class="min-h-[48px] rounded-lg border border-primary px-4 font-semibold text-primary">
                Dobara order karein
              </button>
              {reorderMsg && (
                <p class="text-sm" role="status">
                  {reorderMsg}
                </p>
              )}
            </div>
          )}

          {order.status === 'cancelled' && (
            <div class="flex flex-col gap-1">
              <p class="text-lg font-semibold text-wrong">Order cancel ho gaya.</p>
              {order.cancelReason && <p>Wajah: {order.cancelReason}</p>}
            </div>
          )}

          {order.publicNote && (
            <p class="rounded-lg bg-surface-2 p-3 text-sm">
              <span class="font-semibold">GVS ka note:</span> {order.publicNote}
            </p>
          )}

          <div>
            <h3 class="mb-2 text-base">Order ki cheezein</h3>
            <ul class="divide-y divide-border rounded-lg border border-border text-sm">
              {order.items.map((it, i) => (
                <li key={i} class="flex justify-between gap-3 p-3">
                  <span>
                    <span class="block font-medium">{it.name}</span>
                    {(it.jobTitle || itemDetail(it)) && <span class="block text-muted">{it.jobTitle ?? itemDetail(it).trim().slice(1, -1)}</span>}
                    {(it.govtFeeExtra || typeof it.govtFee === 'number') && <span class="block text-muted" data-govt-fee>{govtFeeLine(it.govtFee)}</span>}
                  </span>
                  <span class="tabular whitespace-nowrap font-semibold">{rs(it.price)}</span>
                </li>
              ))}
            </ul>
            <p class="mt-2 flex justify-between font-bold">
              <span>Kul</span>
              <span class="tabular">{rs(order.total)}</span>
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
