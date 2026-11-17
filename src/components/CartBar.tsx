// spec: 6.1 CartBar, S25 (order form sheet), F03-AC2, AC5, AC6, F04-AC1, F04-AC8, F05-AC2, F05-AC3
// Qadam 4: server abhi nahin, is liye "WhatsApp par order karein" seedha WhatsApp (bina order number) kholta hai = F05 ka rasta.
// Qadam 5 mein pehle POST /api/orders, aur yeh rasta sirf kharabi par.
import { useEffect, useRef, useState } from 'preact/hooks';
import { PUBLIC_WHATSAPP_FALLBACK } from 'astro:env/client';
import { CART_EVENT, CART_MSG, cartTotal, itemDetail, loadCart, ordersOpen, removeFromCart, type CartItem } from '../lib/cart';
import { buildOrderMessage } from '../lib/order-message';
import { validateName, validatePhone } from '../lib/validators';
import { toDisplay, waLink } from '../lib/phone';

const rs = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;

export default function CartBar() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [sent, setSent] = useState<string | null>(null);
  const [copied, setCopied] = useState<'number' | 'message' | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const number = PUBLIC_WHATSAPP_FALLBACK;

  useEffect(() => {
    const sync = () => {
      setItems(loadCart());
      setOpen(ordersOpen());
    };
    sync();
    const onCart = (e: Event) => setItems((e as CustomEvent<CartItem[]>).detail ?? loadCart());
    // Doosri tab mein badla to yahan bhi
    const onStorage = (e: StorageEvent) => e.key?.startsWith('gvs.cart') && sync();
    addEventListener(CART_EVENT, onCart);
    addEventListener('storage', onStorage);
    return () => {
      removeEventListener(CART_EVENT, onCart);
      removeEventListener('storage', onStorage);
    };
  }, []);

  const total = cartTotal(items);
  const openSheet = () => {
    setSent(null);
    dialog.current?.showModal();
  };
  const closeSheet = () => dialog.current?.close();

  function submit(e: Event) {
    e.preventDefault();
    const n = validateName(name);
    const p = validatePhone(phone);
    setErrors({ name: n.ok ? undefined : n.error, phone: p.ok ? undefined : p.error });
    if (!n.ok || !p.ok || items.length === 0) return;
    // F05-AC2: bina order number aur track link; customer ka number message mein nahin (F04-AC8)
    const msg = buildOrderMessage({ items, name: n.value });
    setSent(msg);
    window.open(waLink(number, msg), '_blank', 'noopener');
    // F05-AC3: is raste mein cart khali nahin hoti
  }

  async function copy(text: string, what: 'number' | 'message') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <>
      {items.length > 0 && (
        <>
          {/* Patti ke neeche footer chhup na jaye */}
          <div aria-hidden="true" class="h-[72px]" />
          <div class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
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
                <button type="button" onClick={openSheet} class="min-h-[48px] whitespace-nowrap rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary hover:bg-primary-hover sm:px-4 sm:text-base">
                  WhatsApp par order karein
                </button>
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
            <h2 id="sheet-title" class="text-xl">Aap ki order list</h2>
            <button type="button" onClick={closeSheet} class="min-h-[44px] min-w-[44px] rounded-lg hover:bg-surface-2" aria-label="Band karein">
              ✕
            </button>
          </div>

          {items.length === 0 ? (
            <p class="rounded-xl bg-surface-2 p-4">
              Order list khali hai. Koi pack ya service chunein aur "Order list mein daalein" dabayein.{' '}
              <a href="/plans">Rate list dekhein</a>
            </p>
          ) : (
            <>
              <ul class="divide-y divide-border rounded-xl border border-border">
                {items.map((it) => (
                  <li key={it.key} class="flex items-start justify-between gap-3 p-3">
                    <span>
                      <span class="block font-semibold">{it.name}</span>
                      {itemDetail(it) && <span class="block text-sm text-muted">{itemDetail(it).trim().slice(1, -1)}</span>}
                      {it.govtFeeExtra && <span class="block text-sm text-muted">Sarkari fee alag</span>}
                    </span>
                    <span class="flex items-center gap-1">
                      <span class="tabular font-semibold whitespace-nowrap">{rs(it.price)}</span>
                      <button
                        type="button"
                        onClick={() => setItems(removeFromCart(it.key))}
                        class="min-h-[44px] min-w-[44px] rounded-lg text-wrong hover:bg-wrong-bg"
                        aria-label={`${it.name} hatayen`}
                      >
                        ✕
                      </button>
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
              ) : sent ? (
                <div class="mt-4 flex flex-col gap-3 rounded-xl bg-surface-2 p-4" role="status">
                  <p class="font-semibold">WhatsApp khul raha hai. Wahan "Send" dabayein.</p>
                  <p class="text-sm">
                    Agar WhatsApp nahin khula, to number aur message copy kar ke khud bhej dein. Fikr na karein, aap ki list yahan mehfooz hai.
                  </p>
                  <button type="button" onClick={() => copy(number, 'number')} class="min-h-[44px] rounded-lg border border-primary px-4 font-semibold text-primary">
                    {copied === 'number' ? '✓ Number copy ho gaya' : `Number copy karein (${toDisplay(number)})`}
                  </button>
                  <button type="button" onClick={() => copy(sent, 'message')} class="min-h-[44px] rounded-lg border border-primary px-4 font-semibold text-primary">
                    {copied === 'message' ? '✓ Message copy ho gaya' : 'Message copy karein'}
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
                  <button type="submit" class="min-h-[48px] rounded-lg bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover">
                    WhatsApp par order karein
                  </button>
                  <p class="text-xs text-muted">Sign up nahin. Payment WhatsApp par JazzCash ya Easypaisa se.</p>
                </form>
              )}
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
