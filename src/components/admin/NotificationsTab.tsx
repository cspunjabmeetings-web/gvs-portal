// spec: 6.3 (admin: Notifications), F09-AC1 (sab qismein, naye upar), F09-AC2 (order link, "Parh liya", "Sab parh liye"), F08-AC11 (browser notification ki ijazat), F08-AC10 (44px, 360px)
import { useEffect, useState } from 'preact/hooks';
import type { AdminNotification, NotificationType } from '../../lib/notify';
import { ago } from '../../lib/admin-ui';
import { ADMIN_EVENTS, askNotifyPermission, notifyPermission, unlockAudio, chime, type NotifyPermission } from '../../lib/admin-alert';

const TYPE_LABEL: Record<NotificationType, string> = {
  order_new: 'Naya order',
  whatsapp_opened: 'WhatsApp khola',
  status_changed: 'Darja badla',
  auto_cancelled: 'Khud cancel',
  low_mcq_bank: 'MCQs kam',
};

interface ListResponse {
  ok?: boolean;
  items?: AdminNotification[];
  hasMore?: boolean;
  unread?: number;
  error?: { message?: string };
}

const announceUnread = (n: number) => dispatchEvent(new CustomEvent(ADMIN_EVENTS.unread, { detail: n }));

export default function NotificationsTab() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotifyPermission>('unsupported');

  async function load(before?: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/notifications${before ? `?before=${before}` : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (res.status === 401) return location.reload();
      const data = (await res.json()) as ListResponse;
      if (!res.ok || !data.ok) {
        setError(data.error?.message ?? 'Notifications nahin aa sakin.');
        return;
      }
      setError(null);
      setItems((prev) => (before ? [...prev, ...(data.items ?? [])] : (data.items ?? [])));
      setHasMore(!!data.hasMore);
      if (typeof data.unread === 'number') announceUnread(data.unread);
    } catch {
      setError('Server se rabta nahin ho saka.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPerm(notifyPermission());
    void load();
    // Shell ki polling naye items laye to upar jod do
    const onIncoming = (e: Event) => {
      const fresh = (e as CustomEvent<AdminNotification[]>).detail ?? [];
      setItems((prev) => {
        const have = new Set(prev.map((x) => x.id));
        return [...fresh.filter((x) => !have.has(x.id)), ...prev];
      });
    };
    addEventListener(ADMIN_EVENTS.incoming, onIncoming);
    return () => removeEventListener(ADMIN_EVENTS.incoming, onIncoming);
  }, []);

  async function read(body: { ids: number[] } | { all: true }) {
    try {
      const res = await fetch('/api/admin/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 401) return location.reload();
      const data = (await res.json()) as ListResponse;
      if (!res.ok || !data.ok) {
        setError(data.error?.message ?? 'Abhi nahin ho saka. Dobara koshish karein.');
        return;
      }
      setError(null);
      const now = new Date().toISOString();
      const ids = 'ids' in body ? new Set(body.ids) : null;
      setItems((list) => list.map((x) => (!x.readAt && (!ids || ids.has(x.id)) ? { ...x, readAt: now } : x)));
      if (typeof data.unread === 'number') announceUnread(data.unread);
    } catch {
      setError('Server se rabta nahin ho saka.');
    }
  }

  async function allowNotifications() {
    unlockAudio();
    setPerm(await askNotifyPermission());
  }

  const unreadHere = items.some((x) => !x.readAt);

  return (
    <div class="flex flex-col gap-4">
      <section class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 text-sm" aria-label="Naye order ki ittila" data-alert-settings>
        <p>Admin khula ho to har minute naye orders dekhe jate hain. Naye order par halki awaz aati hai.</p>
        {perm === 'granted' && <p class="font-semibold text-primary">Browser notification chalu hai.</p>}
        {perm === 'default' && (
          <button type="button" onClick={allowNotifications} class="min-h-[44px] rounded-lg bg-primary px-4 font-semibold text-on-primary" data-allow-notify>
            Browser notification chalu karein
          </button>
        )}
        {perm === 'denied' && <p class="text-muted">Browser notification band hai. Browser ki settings mein is site ko ijazat dein.</p>}
        {perm === 'unsupported' && <p class="text-muted">Yeh browser notification nahin dikhata. Awaz aur ghanti ki ginti phir bhi chalein gi.</p>}
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            chime();
          }}
          class="min-h-[44px] rounded-lg border border-border px-4 font-semibold"
          data-test-sound
        >
          Awaz sun kar dekhein
        </button>
      </section>

      <div class="flex justify-end">
        <button
          type="button"
          onClick={() => read({ all: true })}
          disabled={!unreadHere}
          class="min-h-[44px] rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-50"
          data-read-all
        >
          Sab parh liye
        </button>
      </div>

      {error && (
        <p class="rounded-lg bg-wrong-bg p-3 text-sm font-medium text-wrong" role="alert">
          {error}
        </p>
      )}

      {!loading && items.length === 0 && !error && <p class="rounded-xl bg-surface-2 p-4 text-muted">Abhi koi notification nahin.</p>}

      <ul class="flex flex-col gap-2" aria-busy={loading} data-notifs>
        {items.map((n) => (
          <li
            key={n.id}
            class={`flex flex-col gap-2 rounded-xl border p-3 ${n.readAt ? 'border-border bg-surface' : 'border-primary bg-surface-2'}`}
            data-notif={n.id}
            data-unread={n.readAt ? undefined : ''}
          >
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="rounded-full border border-border px-2 py-0.5 font-semibold">{TYPE_LABEL[n.type] ?? n.type}</span>
              <span class="text-muted">{ago(n.createdAt)}</span>
            </div>
            <p class={n.readAt ? '' : 'font-semibold'}>{n.message}</p>
            <div class="flex flex-wrap gap-2">
              {n.orderId && (
                <a
                  href={`#orders:${n.orderId}`}
                  onClick={() => {
                    if (!n.readAt) void read({ ids: [n.id] });
                  }}
                  class="flex min-h-[44px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary no-underline"
                  data-order-link
                >
                  Order {n.orderId} dekhein
                </a>
              )}
              {!n.readAt && (
                <button type="button" onClick={() => read({ ids: [n.id] })} class="min-h-[44px] rounded-lg border border-border px-4 text-sm font-semibold" data-read>
                  Parh liya
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {loading && <p class="text-center text-sm text-muted">Load ho raha hai…</p>}
      {hasMore && !loading && (
        <button type="button" onClick={() => load(items[items.length - 1]?.id)} class="min-h-[44px] rounded-lg border border-border font-semibold">
          Aur dikhayen
        </button>
      )}
    </div>
  );
}
