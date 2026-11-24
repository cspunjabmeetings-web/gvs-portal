// spec: 6.3 A03 (order card), A03a (Paid dialog), A03b (Cancel dialog), F08-AC3..AC8, AC10, AC12, 8.6
import { useRef, useState } from 'preact/hooks';
import type { AdminOrder } from '../../lib/admin-orders';
import type { OrderStatus } from '../../lib/track';
import { ALLOWED, STATUS_LABEL, isBack, ago, dueLabel, toKarachiInput, fromKarachiInput, contactMessage, type ContactInput } from '../../lib/admin-ui';
import { addWorkingMinutes, formatRemaining } from '../../lib/timer';
import { itemDetail } from '../../lib/cart';
import { sourceLabel } from '../../lib/vu-source';
import { toDisplay, waLink } from '../../lib/phone';

const rs = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;
const btn = 'min-h-[44px] rounded-lg px-3 text-sm font-semibold';
const BTN_LABEL = (from: OrderStatus, to: OrderStatus) =>
  isBack(from, to) ? `Wapas ${STATUS_LABEL[to]}` : to === 'cancelled' ? 'Cancel' : STATUS_LABEL[to];

const STATUS_CLASS: Record<OrderStatus, string> = {
  new: 'bg-accent text-on-accent',
  paid: 'bg-primary-soft text-primary',
  pending: 'bg-primary-soft text-primary',
  complete: 'bg-correct-bg text-correct',
  cancelled: 'bg-wrong-bg text-wrong',
};

export interface CardProps {
  order: AdminOrder;
  work: { start: string; end: string };
  payment: ContactInput['payment'];
  onUpdate: (o: AdminOrder) => void;
  onAuthLost: () => void;
}

async function post<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
    const data = (await res.json()) as T & { ok?: boolean; error?: { message?: string } };
    if (res.ok && data.ok) return { ok: true, data };
    return { ok: false, status: res.status, message: data.error?.message ?? 'Kuch ghalat ho gaya.' };
  } catch {
    return { ok: false, status: 0, message: 'Server se rabta nahin ho saka.' };
  }
}

export default function OrderCard({ order: o, work, payment, onUpdate, onAuthLost }: CardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dlg, setDlg] = useState<'paid' | 'due' | 'cancel' | null>(null);
  const [dueInput, setDueInput] = useState('');
  const [dueTouched, setDueTouched] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState({ public: o.publicNote ?? '', admin: o.adminNote ?? '' });
  const [noteMsg, setNoteMsg] = useState<{ public?: string; admin?: string }>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const base = `/api/admin/orders/${encodeURIComponent(o.id)}`;

  function handle<T>(r: Awaited<ReturnType<typeof post<T>>>): T | null {
    if (r.ok) {
      setError(null);
      return r.data;
    }
    if (r.status === 401) onAuthLost();
    setError(r.message);
    return null;
  }

  async function move(to: OrderStatus, extra: Record<string, unknown> = {}) {
    setBusy(true);
    const data = handle(await post<{ order: AdminOrder }>(`${base}/status`, { status: to, ...extra }));
    setBusy(false);
    if (data) {
      onUpdate(data.order);
      closeDlg();
    }
  }

  function suggestedDue(): string {
    try {
      return addWorkingMinutes(new Date(), o.minutes, work.start, work.end, 'Asia/Karachi').toISOString();
    } catch {
      return new Date(Date.now() + o.minutes * 60_000).toISOString();
    }
  }

  function openDlg(kind: 'paid' | 'due' | 'cancel') {
    setError(null);
    if (kind === 'paid') setDueInput(toKarachiInput(suggestedDue()));
    if (kind === 'due') setDueInput(toKarachiInput(o.dueAt ?? suggestedDue()));
    setDueTouched(false);
    setReason('');
    setDlg(kind);
    queueMicrotask(() => dialog.current?.showModal());
  }
  function closeDlg() {
    dialog.current?.close();
    setDlg(null);
  }

  function click(to: OrderStatus) {
    if (to === 'paid' && o.status === 'new') return openDlg('paid');
    if (to === 'cancelled') return openDlg('cancel');
    if (isBack(o.status, to) && !confirm(`Order ${o.id} ko wapas "${STATUS_LABEL[to]}" karein?`)) return;
    void move(to);
  }

  async function confirmDue() {
    const iso = fromKarachiInput(dueInput);
    if (!iso) return setError('Wada ka waqt sahih likhein.');
    if (dlg === 'paid') return move('paid', dueTouched ? { dueAt: iso } : {});
    setBusy(true);
    const data = handle(await post<{ order: AdminOrder }>(`${base}/status`, { dueAt: iso }));
    setBusy(false);
    if (data) {
      onUpdate(data.order);
      closeDlg();
    }
  }

  async function saveNote(kind: 'public' | 'admin') {
    setNoteMsg((m) => ({ ...m, [kind]: 'Save ho raha hai…' }));
    const data = handle(await post<{ text: string | null }>(`${base}/note`, { kind, text: notes[kind] }));
    if (data) {
      setNoteMsg((m) => ({ ...m, [kind]: '✓ Save ho gaya' }));
      onUpdate({ ...o, [kind === 'public' ? 'publicNote' : 'adminNote']: data.text });
    } else setNoteMsg((m) => ({ ...m, [kind]: undefined }));
  }

  async function toggleContacted() {
    const data = handle(await post<{ contacted: boolean }>(`${base}/contacted`, { contacted: !o.contacted }));
    if (data) onUpdate({ ...o, contacted: data.contacted });
  }

  const left = o.dueAt ? formatRemaining(new Date(o.dueAt).getTime() - Date.now()) : null;
  const local = o.phone ? '0' + o.phone.slice(2) : '';

  return (
    <li class="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4" data-order={o.id}>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="tabular text-lg font-bold">{o.id}</p>
          <p class="text-sm text-muted">{ago(o.createdAt)}</p>
        </div>
        <span class={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_CLASS[o.status]}`} data-status={o.status}>
          {STATUS_LABEL[o.status]}
        </span>
      </div>

      {o.purged ? (
        <p class="rounded-lg bg-surface-2 p-2 text-sm text-muted">Data mita diya gaya (90 din purana order).</p>
      ) : (
        <div>
          <p class="font-semibold">{o.name}</p>
          <a href={`tel:+${o.phone}`} class="tabular">
            {toDisplay(local)}
          </a>
        </div>
      )}

      <ul class="text-sm">
        {o.items.map((it, i) => (
          <li key={i} class="flex justify-between gap-3">
            <span>
              {it.name}
              {it.jobTitle ? ` (${it.jobTitle})` : itemDetail(it)}
            </span>
            <span class="tabular whitespace-nowrap">{rs(it.price)}</span>
          </li>
        ))}
        <li class="mt-1 flex justify-between border-t border-border pt-1 font-bold">
          <span>Kul</span>
          <span class="tabular">{rs(o.total)}</span>
        </li>
      </ul>

      <div class="flex flex-wrap gap-2 text-sm">
        {sourceLabel(o.source) && (
          <span class="rounded-full bg-primary-soft px-2 py-0.5 font-medium" data-source>
            {sourceLabel(o.source)}
          </span>
        )}
        <span class={`rounded-full px-2 py-0.5 ${o.whatsappOpenedAt ? 'bg-correct-bg text-correct' : 'bg-wrong-bg text-wrong'}`} data-wa>
          WhatsApp khola: {o.whatsappOpenedAt ? 'haan' : 'nahin'}
        </span>
        {(o.status === 'paid' || o.status === 'pending') && o.dueAt && (
          <span class="rounded-full bg-surface-2 px-2 py-0.5" data-timer>
            Wada {dueLabel(o.dueAt)} · {left ? `${left} baqi` : 'waqt guzar gaya'}
          </span>
        )}
        {o.status === 'cancelled' && o.cancelReason && <span class="rounded-full bg-surface-2 px-2 py-0.5">Wajah: {o.cancelReason}</span>}
      </div>

      <label class="flex min-h-[44px] items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={o.contacted} onChange={toggleContacted} class="h-5 w-5" />
        Rabta hua
      </label>

      <div class="flex flex-wrap gap-2">
        {ALLOWED[o.status].map((to) => (
          <button
            key={to}
            type="button"
            disabled={busy}
            onClick={() => click(to)}
            class={`${btn} ${to === 'cancelled' ? 'border border-wrong text-wrong' : isBack(o.status, to) ? 'border border-border' : 'bg-primary text-on-primary'}`}
          >
            {BTN_LABEL(o.status, to)}
          </button>
        ))}
        {(o.status === 'paid' || o.status === 'pending') && (
          <button type="button" disabled={busy} onClick={() => openDlg('due')} class={`${btn} border border-border`}>
            Wada badlein
          </button>
        )}
        {!o.purged && (
          <a
            href={waLink(local, contactMessage({ ...o, payment }))}
            target="_blank"
            rel="noopener"
            class={`${btn} flex items-center border border-primary text-primary no-underline`}
            data-contact
          >
            Khud rabta karein
          </a>
        )}
      </div>

      {error && (
        <p class="rounded-lg bg-wrong-bg p-2 text-sm font-medium text-wrong" role="alert">
          {error}
        </p>
      )}

      <details class="text-sm">
        <summary class="min-h-[44px] cursor-pointer py-2 font-medium">Notes{o.publicNote || o.adminNote ? ' ✎' : ''}</summary>
        {(['public', 'admin'] as const).map((kind) => (
          <div key={kind} class="mt-2 flex flex-col gap-1">
            <label for={`${o.id}-${kind}`} class="font-medium">
              {kind === 'public' ? 'Customer ko dikhne wala note' : 'Andaruni note (sirf aap ke liye)'}
            </label>
            <textarea
              id={`${o.id}-${kind}`}
              value={notes[kind]}
              maxLength={500}
              rows={2}
              onInput={(e) => setNotes((n) => ({ ...n, [kind]: (e.target as HTMLTextAreaElement).value }))}
              class="rounded-lg border border-border bg-surface p-2"
            />
            <div class="flex items-center gap-2">
              <button type="button" onClick={() => saveNote(kind)} class={`${btn} border border-border`}>
                Save
              </button>
              {noteMsg[kind] && <span class="text-muted">{noteMsg[kind]}</span>}
            </div>
          </div>
        ))}
      </details>

      <dialog ref={dialog} onClose={() => setDlg(null)} class="m-auto w-[min(92vw,26rem)] rounded-2xl bg-surface p-0 text-text backdrop:bg-black/50">
        {dlg && (
          <div class="flex flex-col gap-3 p-4">
            {dlg === 'cancel' ? (
              <>
                <h3 class="text-lg">Order {o.id} cancel karein</h3>
                <label for={`${o.id}-reason`} class="text-sm font-medium">
                  Wajah (customer ko dikhegi) *
                </label>
                <textarea
                  id={`${o.id}-reason`}
                  value={reason}
                  maxLength={200}
                  rows={3}
                  onInput={(e) => setReason((e.target as HTMLTextAreaElement).value)}
                  class="rounded-lg border border-border bg-surface p-2"
                />
                <div class="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    onClick={() => move('cancelled', { cancelReason: reason })}
                    class={`${btn} flex-1 bg-wrong text-on-primary disabled:opacity-60`}
                  >
                    Cancel karein
                  </button>
                  <button type="button" onClick={closeDlg} class={`${btn} border border-border`}>
                    Wapas
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 class="text-lg">{dlg === 'paid' ? `Order ${o.id}: payment mil gayi?` : `Order ${o.id}: wada badlein`}</h3>
                <p class="text-lg font-semibold" data-due-label>
                  Wada: {fromKarachiInput(dueInput) ? dueLabel(fromKarachiInput(dueInput)!) : '—'}
                </p>
                {dlg === 'paid' && <p class="text-sm text-muted">Kaam ke auqaat ({work.start} se {work.end}) mein {o.minutes} minute.</p>}
                <label for={`${o.id}-due`} class="text-sm font-medium">
                  Waqt badalna ho to (Pakistan waqt)
                </label>
                <input
                  id={`${o.id}-due`}
                  type="datetime-local"
                  value={dueInput}
                  onInput={(e) => {
                    setDueInput((e.target as HTMLInputElement).value);
                    setDueTouched(true);
                  }}
                  class="min-h-[44px] rounded-lg border border-border bg-surface px-3"
                />
                {error && (
                  <p class="text-sm text-wrong" role="alert">
                    {error}
                  </p>
                )}
                <div class="flex gap-2">
                  <button type="button" disabled={busy} onClick={confirmDue} class={`${btn} flex-1 bg-primary text-on-primary`}>
                    {dlg === 'paid' ? 'Tasdeeq: Paid' : 'Wada save karein'}
                  </button>
                  <button type="button" onClick={closeDlg} class={`${btn} border border-border`}>
                    Wapas
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </dialog>
    </li>
  );
}
