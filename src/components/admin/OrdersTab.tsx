// spec: 6.3 A02 (din ka khulasa, filter chips, search, cards), F08-AC1, AC2, AC10; E11
// F08-AC11: polling AdminShell mein; naya order aaye to yeh list khud taza. F09-AC2: notification ka link `#orders:<id>` → wohi order search.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { AdminOrder, Filter } from '../../lib/admin-orders';
import type { ContactInput } from '../../lib/admin-ui';
import type { AdminNotification } from '../../lib/notify';
import { ADMIN_EVENTS } from '../../lib/admin-alert';
import OrderCard from './OrderCard';

const rs = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;

const CHIPS: { id: Filter; label: string }[] = [
  { id: 'new', label: 'Naye' },
  { id: 'wa', label: 'WhatsApp nahin khola' },
  { id: 'paid', label: 'Paid' },
  { id: 'pending', label: 'Pending' },
  { id: 'complete', label: 'Complete' },
  { id: 'cancelled', label: 'Cancel' },
  { id: 'all', label: 'Sab' },
];

interface ListResponse {
  ok?: boolean;
  orders?: AdminOrder[];
  hasMore?: boolean;
  summary?: { newToday: number; paidToday: number; completeToday: number; earnedToday: number };
  work?: { start: string; end: string };
  payment?: ContactInput['payment'];
  error?: { message?: string };
}

export default function OrdersTab({ focus = '' }: { focus?: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [summary, setSummary] = useState<ListResponse['summary']>();
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState('');
  const [work, setWork] = useState({ start: '09:00', end: '22:00' });
  const [payment, setPayment] = useState<ContactInput['payment']>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // Search 300 ms ruk kar
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  async function load(offset = 0) {
    const my = ++reqId.current;
    setLoading(true);
    try {
      const p = new URLSearchParams({ status: filter, offset: String(offset) });
      if (query) p.set('q', query);
      const res = await fetch(`/api/admin/orders?${p}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (res.status === 401) return location.reload();
      const data = (await res.json()) as ListResponse;
      if (my !== reqId.current) return;
      if (!res.ok || !data.ok) {
        setError(data.error?.message ?? 'Orders nahin aa sake.');
        return;
      }
      setError(null);
      setOrders((prev) => (offset ? [...prev, ...(data.orders ?? [])] : (data.orders ?? [])));
      setHasMore(!!data.hasMore);
      setSummary(data.summary);
      if (data.work) setWork(data.work);
      setPayment(data.payment);
    } catch {
      if (my === reqId.current) setError('Server se rabta nahin ho saka.');
    } finally {
      if (my === reqId.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load(0);
  }, [filter, query]);

  // Notification se aaye: wohi order dikhao (Sab filter + search)
  useEffect(() => {
    if (!focus) return;
    setFilter('all');
    setQ(focus);
    setQuery(focus);
  }, [focus]);

  // Polling ne naya order / WhatsApp khola / khud cancel laya → list aur khulasa taza.
  // Ref se taaza `load` (filter/search ke sath) bulate hain.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const onIncoming = (e: Event) => {
      const fresh = (e as CustomEvent<AdminNotification[]>).detail ?? [];
      if (fresh.some((n) => n.type !== 'status_changed' && n.type !== 'low_mcq_bank')) void loadRef.current(0);
    };
    addEventListener(ADMIN_EVENTS.incoming, onIncoming);
    return () => removeEventListener(ADMIN_EVENTS.incoming, onIncoming);
  }, []);

  const update = (o: AdminOrder) => {
    setOrders((list) => list.map((x) => (x.id === o.id ? o : x)));
    void refreshSummary();
  };
  async function refreshSummary() {
    try {
      // Sirf khulasa: aakhri offset par koi row nahin aati, summary aati hai
      const res = await fetch('/api/admin/orders?status=all&offset=10000', { cache: 'no-store' });
      const data = (await res.json()) as ListResponse;
      if (data.ok) setSummary(data.summary);
    } catch {
      /* agli dafa */
    }
  }

  // F28-AC1: fetch → file (401 par reload, ghalti par Roman Urdu paigham; JSON file download na ho)
  async function downloadCsv() {
    setCsvBusy(true);
    setCsvError('');
    try {
      const res = await fetch('/api/admin/export', { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      if (res.status === 401) return location.reload();
      if (!res.ok) throw new Error();
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'gvs-orders.csv';
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setCsvError('CSV nahin ban saki. Internet dekh kar dobara koshish karein.');
    } finally {
      setCsvBusy(false);
    }
  }

  return (
    <div class="flex flex-col gap-4">
      <section aria-label="Aaj ka khulasa" class="grid grid-cols-2 gap-2" data-summary>
        {[
          ['Aaj naye', summary?.newToday ?? '–'],
          ['Aaj paid', summary?.paidToday ?? '–'],
          ['Aaj mukammal', summary?.completeToday ?? '–'],
          ['Aaj ki kamai', summary ? rs(summary.earnedToday) : '–'],
        ].map(([label, val]) => (
          <div key={label} class="rounded-xl border border-border bg-surface p-3">
            <p class="text-xs text-muted">{label}</p>
            <p class="tabular text-xl font-bold">{val}</p>
          </div>
        ))}
      </section>

      {/* F28-AC1, A10: saare orders ka CSV (hafta war backup) */}
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-muted">Hafta war backup: CSV download kar ke Google Drive mein rakhen.</p>
        <button type="button" onClick={downloadCsv} disabled={csvBusy} class="min-h-[44px] rounded-lg border border-primary px-4 text-sm font-semibold text-primary disabled:opacity-60" data-export-csv>
          {csvBusy ? 'Ban rahi hai…' : '⬇ Saare orders CSV'}
        </button>
      </div>
      {csvError && (
        <p class="text-sm text-wrong" role="alert">
          ✕ {csvError}
        </p>
      )}

      <div class="flex flex-col gap-2">
        <label for="orders-q" class="sr-only">
          Search
        </label>
        <input
          id="orders-q"
          type="search"
          value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          placeholder="Order number, naam ya phone"
          maxLength={40}
          class="min-h-[44px] rounded-lg border border-border bg-surface px-3"
        />
        <div class="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <div class="flex gap-2" role="group" aria-label="Filter">
            {CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id)}
                aria-pressed={filter === c.id}
                class={`min-h-[44px] whitespace-nowrap rounded-full px-4 text-sm font-semibold ${filter === c.id ? 'bg-primary text-on-primary' : 'border border-border'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p class="rounded-lg bg-wrong-bg p-3 text-sm font-medium text-wrong" role="alert">
          {error}
        </p>
      )}

      {!loading && orders.length === 0 && !error && <p class="rounded-xl bg-surface-2 p-4 text-muted">Is filter mein koi order nahin.</p>}

      <ul class="flex flex-col gap-3" aria-busy={loading}>
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} work={work} payment={payment} onUpdate={update} onAuthLost={() => location.reload()} />
        ))}
      </ul>

      {loading && <p class="text-center text-sm text-muted">Load ho raha hai…</p>}
      {hasMore && !loading && (
        <button type="button" onClick={() => load(orders.length)} class="min-h-[44px] rounded-lg border border-border font-semibold">
          Aur dikhayen
        </button>
      )}
    </div>
  );
}
