// spec: 6.3 (har admin screen par ghanti + tabs: Orders, Notifications, Content, Jobs, Settings), F07-AC4 (logout), F08-AC10 (44px, 360px),
//       F08-AC11 (60 s polling, awaz, browser notification, ghanti), F09-AC3 (ghanti ki na-parhi ginti har tab par)
// Qadam 7a: dhancha; 7b: Orders tab; 7c: Notifications + polling; 8: Settings (F10); 9b: Content (F11). 13a: Jobs tab (F19).
// Tabs URL hash se (#orders, #orders:GVS-2611-0005, #notifications); nayi route nahin (spec 6.4 mein sirf PAGE /admin).
import { useEffect, useRef, useState } from 'preact/hooks';
import OrdersTab from './OrdersTab';
import NotificationsTab from './NotificationsTab';
import SettingsTab from './SettingsTab';
import ContentTab from './ContentTab';
import JobsTab from './JobsTab';
import type { AdminNotification } from '../../lib/notify';
import { ADMIN_EVENTS, chime, showBrowserNotification, unlockAudio } from '../../lib/admin-alert';

const TABS = [
  { id: 'orders', label: 'Orders', soon: '' },
  { id: 'notifications', label: 'Notifications', soon: '' },
  { id: 'content', label: 'Content', soon: '' },
  { id: 'jobs', label: 'Jobs', soon: '' },
  { id: 'settings', label: 'Settings', soon: '' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** F08-AC11: admin khula ho to har 60 s */
export const POLL_MS = 60_000;

const ORDER_ID = /^GVS-\d{4}-\d{4,}$/;

function fromHash(): { tab: TabId; focus: string } {
  const [h, extra = ''] = decodeURIComponent(location.hash.slice(1)).split(':');
  const tab = (TABS.find((t) => t.id === h)?.id ?? 'orders') as TabId;
  return { tab, focus: tab === 'orders' && ORDER_ID.test(extra) ? extra : '' };
}

interface PollResponse {
  ok?: boolean;
  items?: AdminNotification[];
  unread?: number;
}

export default function AdminShell() {
  const [tab, setTab] = useState<TabId>('orders');
  const [focus, setFocus] = useState('');
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const lastId = useRef<number | null>(null);
  const polling = useRef(false);

  useEffect(() => {
    const onHash = () => {
      const h = fromHash();
      setTab(h.tab);
      setFocus(h.focus);
    };
    onHash();
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  // F08-AC11 + F09-AC3: polling, ghanti ki ginti, naye order par awaz + browser notification
  useEffect(() => {
    async function poll() {
      if (polling.current) return;
      polling.current = true;
      try {
        const first = lastId.current === null;
        const res = await fetch(first ? '/api/admin/notifications' : `/api/admin/notifications?since=${lastId.current}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(15_000),
        });
        if (res.status === 401) return location.reload();
        const data = (await res.json()) as PollResponse;
        if (!res.ok || !data.ok) return;
        if (typeof data.unread === 'number') setUnread(data.unread);
        const items = data.items ?? [];
        // Pehli dafa: sirf jagah yaad karo — purane orders par awaz nahin
        if (!first && items.length) {
          dispatchEvent(new CustomEvent(ADMIN_EVENTS.incoming, { detail: items }));
          const orders = items.filter((n) => n.type === 'order_new');
          if (orders.length) {
            chime();
            showBrowserNotification(orders.length === 1 ? 'GVS: naya order' : `GVS: ${orders.length} naye orders`, orders[0].message, `gvs-${orders[0].id}`);
          }
        }
        lastId.current = Math.max(lastId.current ?? 0, items[0]?.id ?? 0);
      } catch {
        /* agli dafa */
      } finally {
        polling.current = false;
      }
    }

    void poll();
    const timer = setInterval(poll, POLL_MS);
    // Tab wapas samne aaye to foran (chhupi tab mein bhi polling chalti hai — owner ka faisla)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    const onUnread = (e: Event) => setUnread((e as CustomEvent<number>).detail);
    document.addEventListener('visibilitychange', onVisible);
    addEventListener(ADMIN_EVENTS.unread, onUnread);
    // Browser awaz sirf tap ke baad chalne deta hai
    addEventListener('pointerdown', unlockAudio);
    addEventListener('keydown', unlockAudio);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      removeEventListener(ADMIN_EVENTS.unread, onUnread);
      removeEventListener('pointerdown', unlockAudio);
      removeEventListener('keydown', unlockAudio);
    };
  }, []);

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    } finally {
      location.replace('/admin');
    }
  }

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-2xl">{current.label}</h1>
        <div class="flex items-center gap-2">
          <a
            href="#notifications"
            class="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border no-underline"
            aria-label={`Notifications: ${unread} na-parhi`}
            data-bell
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
              <path d="M10 20a2 2 0 0 0 4 0" />
            </svg>
            {unread > 0 && (
              <span class="tabular absolute -right-1 -top-1 min-w-[20px] rounded-full bg-accent px-1 text-center text-xs font-bold text-on-accent" data-bell-count>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </a>
          <button type="button" onClick={logout} disabled={busy} class="min-h-[44px] rounded-lg border border-border px-3 text-sm font-semibold">
            Logout
          </button>
        </div>
      </div>

      <nav aria-label="Admin tabs" class="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul class="flex gap-2">
          {TABS.map((t) => (
            <li key={t.id}>
              <a
                href={`#${t.id}`}
                aria-current={t.id === tab ? 'page' : undefined}
                class={`flex min-h-[44px] items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold no-underline ${
                  t.id === tab ? 'bg-primary text-on-primary' : 'border border-border text-text'
                }`}
              >
                {t.label}
                {t.id === 'notifications' && unread > 0 && <span class="sr-only"> ({unread} na-parhi)</span>}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'orders' ? (
        <div data-tab="orders">
          <OrdersTab focus={focus} />
        </div>
      ) : tab === 'notifications' ? (
        <div data-tab="notifications">
          <NotificationsTab />
        </div>
      ) : tab === 'content' ? (
        <div data-tab="content">
          <ContentTab />
        </div>
      ) : tab === 'jobs' ? (
        <div data-tab="jobs">
          <JobsTab />
        </div>
      ) : tab === 'settings' ? (
        <div data-tab="settings">
          <SettingsTab />
        </div>
      ) : (
        <section class="rounded-xl border border-border bg-surface p-4" aria-live="polite" data-tab={tab}>
          <p class="text-muted">{current.soon}</p>
        </section>
      )}
    </div>
  );
}
