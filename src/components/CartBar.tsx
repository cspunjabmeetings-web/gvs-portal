// spec: 6.1 CartBar, S25 (order form sheet), F03-AC2, AC5, AC6, F04-AC1, AC2, AC7..AC11, F05-AC1..AC3
// Qadam 5: pehle POST /api/orders (order number, phir "WhatsApp par bhejein").
// Server/Turnstile ki kharabi (network, 5xx, 10 s timeout) par F05: "WhatsApp par seedha order bhejein", cart khali nahin.
import { useEffect, useRef, useState } from 'preact/hooks';
import { CART_EVENT, CART_MSG, cartTotal, clearCart, itemDetail, loadCart, ordersOpen, rememberOrder, removeFromCart, takeSpotlight, type CartItem } from '../lib/cart';
import { buildOrderMessage, govtFeeLine } from '../lib/order-message';
import { validateName, validatePhone } from '../lib/validators';
import { toDisplay, waLink } from '../lib/phone';
import { cachedSettings, refreshSettings, whatsappNumber } from '../lib/site-settings';
import { TurnstileWidget } from '../lib/turnstile-client';
import { track } from '../lib/analytics';

const rs = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;

type Phase =
  | { k: 'form' }
  /** check = Turnstile token ka intezar (17b: button par "Hifazati jaanch ho rahi hai…") */
  | { k: 'sending'; check?: boolean }
  | { k: 'done'; id: string; last4: string; message: string; waUrl: string; number: string }
  /** reason: 17b — user ko asal wajah ka naam (koi zaati maloomat nahin) */
  | { k: 'fallback'; message: string; number: string; reason: string };

type Copied = 'id' | 'number' | 'message' | null;

const btnPrimary = 'flex min-h-[52px] items-center justify-center rounded-lg bg-primary px-4 text-center text-lg font-semibold text-on-primary no-underline hover:bg-primary-hover';
const btnOutline = 'min-h-[44px] rounded-lg border border-primary px-4 font-semibold text-primary';

export default function CartBar() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ k: 'form' });
  const [copied, setCopied] = useState<Copied>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const tsBox = useRef<HTMLDivElement>(null);
  const turnstile = useRef<TurnstileWidget | null>(null);
  const openedSent = useRef(false);
  const prevCount = useRef(0);
  const [spot, setSpot] = useState(false);

  // F03-AC8: 4 s baad, ya kahin bhi tap/key par, spotlight khatam
  useEffect(() => {
    if (!spot) return;
    const off = () => setSpot(false);
    const t = setTimeout(off, 4000);
    addEventListener('pointerdown', off, { capture: true });
    addEventListener('keydown', off, { capture: true });
    return () => {
      clearTimeout(t);
      removeEventListener('pointerdown', off, { capture: true });
      removeEventListener('keydown', off, { capture: true });
    };
  }, [spot]);

  useEffect(() => {
    const sync = () => {
      const now = loadCart();
      prevCount.current = now.length;
      setItems(now);
      setOpen(ordersOpen());
    };
    cachedSettings();
    sync();
    // E01: number aur orders_open taza (5 minute cache)
    refreshSettings().then((s) => s && setOpen(s.orders_open));
    const onCart = (e: Event) => {
      const next = (e as CustomEvent<CartItem[]>).detail ?? loadCart();
      // F03-AC8: khali list mein pehli cheez aayi → button par spotlight (har browser mein pehli 2 dafa)
      if (prevCount.current === 0 && next.length > 0 && ordersOpen() && takeSpotlight()) setSpot(true);
      prevCount.current = next.length;
      setItems(next);
    };
    // Doosri tab mein badla to yahan bhi
    const onStorage = (e: StorageEvent) => e.key?.startsWith('gvs.cart') && sync();
    addEventListener(CART_EVENT, onCart);
    addEventListener('storage', onStorage);
    return () => {
      removeEventListener(CART_EVENT, onCart);
      removeEventListener('storage', onStorage);
    };
  }, []);

  // F04-AC11: Turnstile sirf form dikhne par load (lazy)
  useEffect(() => {
    if (phase.k !== 'form' || !tsBox.current || !open || items.length === 0) return;
    turnstile.current ??= new TurnstileWidget();
    void turnstile.current.mount(tsBox.current);
  });

  const total = cartTotal(items);
  const openSheet = () => {
    if (phase.k !== 'sending' && items.length > 0) setPhase({ k: 'form' });
    setServerError(null);
    dialog.current?.showModal();
    track('open_order_form', { items: items.length }); // F23-AC1
  };
  const closeSheet = () => dialog.current?.close();

  function fallback(n: string, reason: string) {
    // F05-AC2: bina order number aur track link; F05-AC3: cart khali nahin
    setPhase({ k: 'fallback', message: buildOrderMessage({ items, name: n }), number: whatsappNumber(), reason });
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (phase.k === 'sending') return;
    const n = validateName(name);
    const p = validatePhone(phone);
    setErrors({ name: n.ok ? undefined : n.error, phone: p.ok ? undefined : p.error });
    setServerError(null);
    if (!n.ok || !p.ok || items.length === 0) return;

    setPhase({ k: 'sending', check: !turnstile.current?.hasToken() });
    const token = await turnstile.current?.getToken();
    // Turnstile load/verify na ho: order band nahin (F04-AC11)
    if (!token) return fallback(n.value, `Hifazati jaanch mukammal nahin hui (${turnstile.current?.failureCode() ?? 'load'})`);
    setPhase({ k: 'sending' });

    let res: Response;
    let data: { ok?: boolean; id?: string; last4?: string; message?: string; whatsappUrl?: string; whatsappNumber?: string; error?: { code?: string; message?: string } };
    try {
      res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n.value, phone: p.value, items: items.map(({ id, fields, jobId }) => ({ id, fields, jobId })), source: items.find((x) => x.vuSource)?.vuSource, turnstileToken: token }),
        signal: AbortSignal.timeout(10_000), // F05-AC1
      });
      data = await res.json();
    } catch (err) {
      turnstile.current?.reset();
      const timeout = err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
      return fallback(n.value, timeout ? 'Server ne 10 second mein jawab nahin diya' : 'Internet ka masla (server tak rabta nahin hua)');
    }
    turnstile.current?.reset(); // token ek dafa chalta hai

    if (res.ok && data.ok && data.id && data.message && data.whatsappUrl) {
      track('order_created', { items: items.length }); // F23-AC2: order number/raqam nahin
      rememberOrder({ id: data.id, last4: data.last4 ?? p.value.slice(-4), at: new Date().toISOString() });
      clearCart(); // F04-AC10
      openedSent.current = false;
      setPhase({ k: 'done', id: data.id, last4: data.last4 ?? p.value.slice(-4), message: data.message, waUrl: data.whatsappUrl, number: data.whatsappNumber ?? whatsappNumber() });
      return;
    }
    if (res.status >= 500 || !data.error) return fallback(n.value, `Server ki kharabi (${res.status})`); // F05-AC1, AC4
    if (data.error.code === 'orders_closed') setOpen(false);
    setServerError(data.error.message ?? 'Kuch ghalat ho gaya. Dobara koshish karein.');
    setPhase({ k: 'form' });
  }

  // F04-AC7: sirf pehli dafa (server bhi sirf pehli dafa record karta hai)
  function markOpened(id: string, last4: string) {
    if (openedSent.current) return;
    track('whatsapp_opened', { fallback: false });
    openedSent.current = true;
    fetch(`/api/orders/${encodeURIComponent(id)}/whatsapp-opened`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last4 }),
      keepalive: true,
    }).catch(() => {
      openedSent.current = false;
    });
  }

  async function copy(text: string, what: Copied) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  const copyButtons = (number: string, message: string) => (
    <>
      <button type="button" onClick={() => copy(number, 'number')} class={btnOutline}>
        {copied === 'number' ? '✓ Number copy ho gaya' : `Number copy karein (${toDisplay(number)})`}
      </button>
      <button type="button" onClick={() => copy(message, 'message')} class={btnOutline}>
        {copied === 'message' ? '✓ Message copy ho gaya' : 'Message copy karein'}
      </button>
    </>
  );

  function body() {
    if (phase.k === 'done') {
      return (
        <div class="flex flex-col gap-3" role="status">
          <p class="font-semibold text-correct">✓ Aap ka order mil gaya.</p>
          <div class="rounded-xl bg-surface-2 p-4 text-center">
            <p class="text-sm text-muted">Aap ka order number</p>
            <p class="tabular my-1 text-3xl font-bold tracking-wide" data-order-id>
              {phase.id}
            </p>
            <button type="button" onClick={() => copy(phase.id, 'id')} class={`${btnOutline} mt-1`}>
              {copied === 'id' ? '✓ Copy ho gaya' : 'Order number copy karein'}
            </button>
          </div>
          <a href={phase.waUrl} target="_blank" rel="noopener" onClick={() => markOpened(phase.id, phase.last4)} class={btnPrimary}>
            WhatsApp par bhejein
          </a>
          <p class="text-sm">
            Agar WhatsApp nahin khula, to number aur message copy kar ke khud bhej dein. Fikr na karein, aap ka order hamare paas aa gaya hai. Hum jald
            aap se WhatsApp par rabta karenge.
          </p>
          {copyButtons(phase.number, phase.message)}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <p class="rounded-xl bg-surface-2 p-4">
          Order list khali hai. Koi pack ya service chunein aur "Order list mein daalein" dabayein. <a href="/plans">Rate list dekhein</a>
        </p>
      );
    }

    return (
      <>
        <ul class="divide-y divide-border rounded-xl border border-border">
          {items.map((it) => (
            <li key={it.key} class="flex items-start justify-between gap-3 p-3">
              <span>
                <span class="block font-semibold">{it.name}</span>
                {itemDetail(it) && <span class="block text-sm text-muted">{itemDetail(it).trim().slice(1, -1)}</span>}
                {it.govtFeeExtra && <span class="block text-sm text-muted">{typeof it.govtFee === 'number' ? govtFeeLine(it.govtFee) : 'Sarkari fee alag'}</span>}
              </span>
              <span class="flex items-center gap-1">
                <span class="tabular font-semibold whitespace-nowrap">{rs(it.price)}</span>
                {phase.k !== 'sending' && (
                  <button
                    type="button"
                    onClick={() => setItems(removeFromCart(it.key))}
                    class="min-h-[44px] min-w-[44px] rounded-lg text-wrong hover:bg-wrong-bg"
                    aria-label={`${it.name} hatayen`}
                  >
                    ✕
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p class="mt-3 flex justify-between text-lg font-bold">
          <span>Kul</span>
          <span class="tabular">{rs(total)}</span>
        </p>

        {!open ? (
          <p class="mt-4 rounded-xl bg-surface-2 p-4 font-medium">{CART_MSG.closed}</p>
        ) : phase.k === 'fallback' ? (
          <div class="mt-4 flex flex-col gap-3">
            <p class="rounded-xl bg-wrong-bg p-3 font-medium text-wrong" role="alert">
              Order abhi system mein nahin ban saka. Fikr na karein, aap ka order seedha WhatsApp par bhej dein. Aap ki list yahan mehfooz hai.
              <span class="mt-1 block text-sm font-normal" data-fallback-reason>
                Wajah: {phase.reason}
              </span>
            </p>
            <a href={waLink(phase.number, phase.message)} target="_blank" rel="noopener" onClick={() => track('whatsapp_opened', { fallback: true })} class={btnPrimary}>
              WhatsApp par seedha order bhejein
            </a>
            {copyButtons(phase.number, phase.message)}
            <button type="button" onClick={() => setPhase({ k: 'form' })} class="min-h-[44px] text-sm font-medium text-primary underline">
              Dobara koshish karein
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate class="mt-4 flex flex-col gap-3">
            <div class="flex flex-col gap-1">
              <label for="order-name" class="text-sm font-medium">Naam *</label>
              <input
                id="order-name"
                value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                autocomplete="name"
                maxLength={60}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'order-name-err' : undefined}
                class="min-h-[44px] rounded-lg border border-border bg-surface px-3"
              />
              {errors.name && <p id="order-name-err" class="text-sm text-wrong">✕ {errors.name}</p>}
            </div>
            <div class="flex flex-col gap-1">
              <label for="order-phone" class="text-sm font-medium">WhatsApp number *</label>
              <input
                id="order-phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
                autocomplete="tel"
                placeholder="03XX-XXXXXXX"
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? 'order-phone-err' : undefined}
                class="min-h-[44px] rounded-lg border border-border bg-surface px-3"
              />
              {errors.phone && <p id="order-phone-err" class="text-sm text-wrong">✕ {errors.phone}</p>}
            </div>
            <div ref={tsBox} />
            {serverError && (
              <p class="rounded-lg bg-wrong-bg p-3 text-sm font-medium text-wrong" role="alert">
                ✕ {serverError}
              </p>
            )}
            <button
              type="submit"
              disabled={phase.k === 'sending'}
              class="min-h-[48px] rounded-lg bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-70"
            >
              {phase.k === 'sending' ? (phase.check ? 'Hifazati jaanch ho rahi hai…' : 'Order bhej rahe hain…') : 'WhatsApp par order karein'}
            </button>
            <p class="text-xs text-muted">Sign up nahin. Payment WhatsApp par JazzCash ya Easypaisa se.</p>
          </form>
        )}
      </>
    );
  }

  return (
    <>
      {/* F03-AC8: screen reader ko tip ek dafa (region hamesha maujood, matn sirf spotlight par) */}
      <p role="status" class="sr-only">
        {spot ? 'Neeche "WhatsApp par order karein" dabayen.' : ''}
      </p>
      {items.length > 0 && (
        <>
          {/* Patti ke neeche footer chhup na jaye */}
          <div aria-hidden="true" class="h-[72px]" data-cart-bar />
          <div data-cart-bar class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
            <div class="container-page flex min-h-[64px] items-center justify-between gap-3">
              <button
                type="button"
                onClick={openSheet}
                class="flex shrink-0 flex-col items-start justify-center text-left min-h-[44px] whitespace-nowrap"
                aria-haspopup="dialog"
                aria-label={`Order list: ${items.length} ${items.length === 1 ? 'cheez' : 'cheezein'}, kul ${rs(total)}`}
              >
                <span class="text-sm text-muted">{items.length} {items.length === 1 ? 'cheez' : 'cheezein'}</span>
                <span class="tabular font-bold">Kul {rs(total)}</span>
              </button>
              {open ? (
                <div class="relative">
                  {/* F03-AC8: tip button ke upar (absolute → layout nahin hilta), clicks guzar jate hain */}
                  {spot && (
                    <div aria-hidden="true" data-spotlight-tip class="anim-reveal pointer-events-none absolute bottom-full right-0 mb-3 w-max max-w-[70vw] rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-on-accent shadow-lg">
                      Yahan dabayen → WhatsApp par order
                      <span class="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 bg-accent" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={openSheet}
                    data-spotlight={spot ? '' : undefined}
                    class={`min-h-[48px] whitespace-nowrap rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary hover:bg-primary-hover sm:px-4 sm:text-base ${spot ? 'spotlight-pulse' : ''}`}
                  >
                    WhatsApp par order karein
                  </button>
                </div>
              ) : (
                <p class="max-w-[55%] text-sm font-medium text-accent-text">{CART_MSG.closed}</p>
              )}
            </div>
          </div>
        </>
      )}

      <dialog
        ref={dialog}
        aria-labelledby="sheet-title"
        class="m-0 mt-auto w-full max-w-none rounded-t-2xl bg-surface p-0 text-text backdrop:bg-black/50 md:m-auto md:max-w-lg md:rounded-2xl"
        onClick={(e) => e.target === dialog.current && closeSheet()}
      >
        <div class="max-h-[85dvh] overflow-y-auto p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 id="sheet-title" class="text-xl">{phase.k === 'done' ? 'Order mil gaya' : 'Aap ki order list'}</h2>
            <button type="button" onClick={closeSheet} class="min-h-[44px] min-w-[44px] rounded-lg hover:bg-surface-2" aria-label="Band karein">
              ✕
            </button>
          </div>
          {body()}
        </div>
      </dialog>
    </>
  );
}
