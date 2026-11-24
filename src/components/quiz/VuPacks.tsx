// spec: F31-AC3 (score par pack, ek tap par order list mein, baqi "Doosre packs"), F31-AC4 (muft vs pack, refund line, WhatsApp par poochein)
// Naam, qeemat aur "kya milega" sirf catalog se (usool 7); order par server qeemat dobara hisab karta hai (F04-AC3).
import { useEffect, useState } from 'preact/hooks';
import { addToCart, CART_MSG } from '../../lib/cart';
import { track } from '../../lib/analytics';
import { waLink } from '../../lib/phone';
import { whatsappNumber } from '../../lib/site-settings';
import { packFor } from '../../lib/vu-progress';

export interface VuPack {
  id: string;
  name: string;
  price: number;
  includes: string[];
}

const btn = 'inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 font-semibold no-underline';
const rs = (n: number) => `Rs. ${n.toLocaleString('en-US')}`;
const FREE = ['Muft practice MCQs', 'Har sawal ka jawab'];

export default function VuPacks(p: { packs: VuPack[]; code: string; term: string; /** null = abhi koi test nahin */ percent: number | null }) {
  const [msg, setMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [wa, setWa] = useState('/contact');
  useEffect(() => setWa(waLink(whatsappNumber(), `Assalam o Alaikum GVS Academy, mujhe ${p.code} (${p.term}) ke pack ke bare mein poochna hai.`)), [p.code, p.term]);

  const main = p.percent === null ? null : (p.packs.find((x) => x.id === packFor(p.percent!)) ?? null);
  const others = p.packs.filter((x) => x !== main);
  if (!p.packs.length) return null;

  function add(x: VuPack) {
    const r = addToCart({ id: x.id, name: x.name, price: x.price, fields: { courseCode: p.code, term: p.term } });
    if (r.ok) track('add_to_cart', { product: x.id, source: 'vu' });
    setMsg(r.ok ? { id: x.id, ok: true, text: `✓ ${CART_MSG.added} Neeche "WhatsApp par order karein" dabayen.` } : { id: x.id, ok: false, text: `✕ ${CART_MSG[r.reason]}` });
  }

  const card = (x: VuPack, big: boolean) => (
    <div class={`flex flex-col gap-3 rounded-2xl p-4 ${big ? 'border-2 border-accent bg-surface' : 'border border-border bg-surface'}`} data-vu-pack={x.id}>
      <div class="flex items-start justify-between gap-3">
        <p class="text-lg font-bold">{x.name}</p>
        <p class="tabular whitespace-nowrap text-xl font-bold">{rs(x.price)}</p>
      </div>
      <p class="text-sm">
        <span class="rounded-full bg-primary-soft px-3 py-1 font-semibold">
          {p.code} · {p.term}
        </span>
      </p>
      {big && (
        <div class="grid grid-cols-2 gap-2 text-sm" data-vu-compare>
          <div class="rounded-xl bg-surface-2 p-3">
            <p class="font-semibold">Muft yahan</p>
            <ul class="mt-1 flex flex-col gap-1">
              {FREE.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
          </div>
          <div class="rounded-xl bg-primary-soft p-3">
            <p class="font-semibold">Pack mein</p>
            <ul class="mt-1 flex flex-col gap-1">
              {x.includes.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {!big && (
        <ul class="flex flex-col gap-1 text-sm">
          {x.includes.map((f) => (
            <li key={f}>✓ {f}</li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => add(x)} class={`${btn} min-h-[52px] ${big ? 'bg-accent text-on-accent' : 'border-2 border-primary text-text'}`} data-vu-add-pack={x.id}>
        Order list mein daalein
      </button>
      <p class={`text-sm font-medium ${msg?.id === x.id ? (msg.ok ? 'text-correct' : 'text-wrong') : 'sr-only'}`} role="status" aria-live="polite" data-vu-pack-msg>
        {msg?.id === x.id ? msg.text : ''}
      </p>
    </div>
  );

  return (
    <section class="flex flex-col gap-3" aria-labelledby="vu-packs-h" data-vu-packs>
      <h2 id="vu-packs-h" class="text-xl">
        {main ? `${p.code} ki tayyari poori karein` : `${p.code} ke packs`}
      </h2>
      {main && card(main, true)}
      <details class="rounded-2xl border border-border bg-surface" data-vu-others>
        <summary class="flex min-h-[48px] cursor-pointer items-center px-4 font-semibold">{main ? 'Doosre packs dekhein' : 'Packs aur qeemat dekhein'}</summary>
        <div class="flex flex-col gap-3 p-3">{others.map((x) => <div key={x.id}>{card(x, false)}</div>)}</div>
      </details>
      <a href={wa} target="_blank" rel="noopener" class={`${btn} border border-border`} data-vu-ask-pack>
        WhatsApp par pack poochein
      </a>
      <p class="text-sm" data-refund-line>
        Order se pehle dekhein: <a href="/terms#refund">Refund policy</a> · <a href="/how-to-order">Order kaise karein</a>
      </p>
    </section>
  );
}
