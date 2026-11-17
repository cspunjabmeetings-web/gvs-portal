// spec: 6.3 (har admin screen par ghanti + tabs: Orders, Notifications, Content, Jobs, Settings), F07-AC4 (logout), F08-AC10 (44px, 360px)
// Qadam 7a: sirf dhancha. Orders = 7b, Notifications + ghanti ki ginti = 7c, Settings = Qadam 8, Content = 9, Jobs = 13.
// Tabs URL hash se (#orders); nayi route nahin (spec 6.4 mein sirf PAGE /admin).
import { useEffect, useState } from 'preact/hooks';

const TABS = [
  { id: 'orders', label: 'Orders', soon: 'Orders ki list agle hisse (7b) mein aaye gi.' },
  { id: 'notifications', label: 'Notifications', soon: 'Notifications agle hisse (7c) mein aayengi.' },
  { id: 'content', label: 'Content', soon: 'Content tab Qadam 9 mein aaye ga.' },
  { id: 'jobs', label: 'Jobs', soon: 'Jobs tab Qadam 13 mein aaye ga.' },
  { id: 'settings', label: 'Settings', soon: 'Settings tab Qadam 8 mein aaye ga.' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const fromHash = (): TabId => {
  const h = location.hash.slice(1);
  return (TABS.find((t) => t.id === h)?.id ?? 'orders') as TabId;
};

export default function AdminShell() {
  const [tab, setTab] = useState<TabId>('orders');
  const [unread] = useState(0); // 7c: /api/admin/notifications se
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTab(fromHash());
    const onHash = () => setTab(fromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
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
              <span class="tabular absolute -right-1 -top-1 min-w-[20px] rounded-full bg-accent px-1 text-center text-xs font-bold text-on-accent">{unread}</span>
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
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section class="rounded-xl border border-border bg-surface p-4" aria-live="polite" data-tab={tab}>
        <p class="text-muted">{current.soon}</p>
      </section>
    </div>
  );
}
